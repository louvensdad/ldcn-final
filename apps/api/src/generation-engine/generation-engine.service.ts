import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { ChildProcess } from 'node:child_process';
import { Injectable, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../persistence/prisma.service';
import { MissionPersistenceService } from '../persistence/mission-persistence.service';
import { WorkspaceService } from './workspace.service';
import { ProcessRunnerService } from './process-runner.service';
import { scaffoldNestjsBackend } from './scaffolders/nestjs-backend.scaffolder';
import { planJobs, PlannedJob } from './job-planner';
import { AgentExecutionService } from './agent-execution.service';
import { computeRequirementCoverage, RequirementCoverageItem } from './requirement-coverage';
import { SecurityScannerService } from './security-scanner.service';
import { SecurityReviewService } from './security-review.service';
import { JobReviewService } from './job-review.service';
import { EventBusService } from '../events/event-bus.service';
import { EventLogService } from '../events/event-log.service';
import { AgentCatalogService } from '../catalog/agent-catalog.service';
import { AgentRuntimeService } from '../agent-runtime/agent-runtime.service';
import { JobScopeService } from './job-scope.service';
import { canonicalHash } from './canonical-hash';
import { DuplicateValidationService } from './duplicate-validation.service';
import { ProposedRepositoryChange, RepositoryInspectionResult } from './repository-inspector';
import { WorkspaceValidationService } from './workspace-validation.service';
import { WorkspaceCandidateChange } from './workspace.service';
import { MAX_EXTERNAL_REWORKS, ReviewOrchestrator } from './review-orchestrator.service';

const SUPPORTED_STACK_KEY = 'stack.typescript.nestjs';
const NPM_CMD = process.platform === 'win32' ? 'npm.cmd' : 'npm';

export interface MissionGenerationRunDto {
  id: string;
  missionId: string;
  status: string;
  targetKind: string;
  pluginId: string;
  scaffold: { fileCount: number; requirementIds: string[]; skippedRequirementIds: string[] } | null;
  build: { command: string; exitCode: number | null; durationMs: number; logsExcerpt: string } | null;
  test: { command: string; exitCode: number | null; total: number; passed: number; failed: number; durationMs: number; logsExcerpt: string } | null;
  runtime: { port: number; healthCheckOk: boolean; durationMs: number; logsExcerpt: string } | null;
  downloadReady: boolean;
  /** MISSÃO "Verificação requisito-por-requisito + Delivery Eligibility" — nunca true só porque
   * build/test/runtime passaram; false quando algum requirement que estava no escopo desta versão
   * falhou de verdade (nunca os que ficaram honestamente fora do teto). */
  deliveryEligible: boolean;
  requirementCoverage: RequirementCoverageItem[] | null;
  /** MISSÃO "Security Gate real antes da entrega" — npm audit real + secret scan real + Security
   * Reviewer real sobre código autoral de agente. Nunca bloqueia por vulnerabilidade herdada de
   * framework abaixo de CRITICAL (limitação já disclosed do scaffold). */
  securityPassed: boolean;
  security: {
    npmAudit: { ran: boolean; critical: number; high: number; moderate: number; low: number };
    secretsFound: number;
    secrets: { file: string; pattern: string; line: number }[];
    reviewerRan: boolean;
    reviewerErrorCode: string | null;
    reviewerFindings: { code: string; severity: string; file: string; finding: string }[];
  } | null;
  errorCode: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PreviewHandle { child: ChildProcess; port: number; startedAt: number }

/** CORE-005 — resultado da tentativa do caminho estruturado (AgentRuntime) para um Job.
 * CORE-007 §22/§23: `blocked: true` marca uma violação de policy (SCOPE_VIOLATION/
 * SCOPE_PATH_INVALID/JOB_SCOPE_REQUIRED) — NON-FALLBACKABLE, nunca cai pro legado, porque isso
 * deixaria o agente escapar da guarda determinística caindo num caminho sem ScopeValidator. */
type StructuredAttemptResult =
  | {
      ok: true;
      jobId: string;
      agentExecutionId: string;
      updatedFileContent: string;
      analysisText: string;
      planText: string;
      implementationSummary: string;
      provider: string | null;
      model: string | null;
      promptTokens: number;
      completionTokens: number;
      latencyMs: number;
      attemptCount: number;
      workspaceSessionId: string;
      executorAgentDefinitionKey: string;
      executorAgentDefinitionVersion: number;
    }
  | { ok: false; jobId: string; fallbackReason: string; blocked?: false }
  | { ok: false; jobId: string; agentExecutionId: string | null; blocked: true; errorCode: string };

/**
 * MISSÃO "Completar o fluxo pós-PromptMaster até geração e entrega real" — o motor real (nunca
 * fabricado) para o único StackPlugin implementado nesta missão: `stack.typescript.nestjs`
 * (BACKEND). Cada fase só avança com evidência real do child_process anterior — nunca marca READY
 * sem build+test+runtime realmente terem passado.
 */
@Injectable()
export class GenerationEngineService {
  private readonly previews = new Map<string, PreviewHandle>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly missionPersistence: MissionPersistenceService,
    private readonly workspace: WorkspaceService,
    private readonly runner: ProcessRunnerService,
    private readonly agentExecution: AgentExecutionService,
    private readonly securityScanner: SecurityScannerService,
    private readonly securityReview: SecurityReviewService,
    private readonly jobReview: JobReviewService,
    private readonly eventBus: EventBusService,
    private readonly catalog: AgentCatalogService,
    private readonly agentRuntime: AgentRuntimeService,
    private readonly eventLog: EventLogService,
    private readonly jobScope: JobScopeService,
    private readonly duplicateValidation: DuplicateValidationService,
    private readonly workspaceValidation: WorkspaceValidationService,
    @Optional() private readonly reviewOrchestrator?: ReviewOrchestrator
  ) {}

  async start(missionId: string): Promise<MissionGenerationRunDto> {
    const promptMaster = await this.prisma.promptMasterVersion.findFirst({ where: { missionId, status: 'LOCKED' }, orderBy: { version: 'desc' } });
    if (!promptMaster) throw new Error('MISSION_PROMPTMASTER_NOT_LOCKED');

    // MISSÃO "Arquitetura não pode seguir automaticamente para Entrega": nenhuma geração real
    // começa sem o gate de Architecture Review real (council + políticas) ter aprovado — nunca
    // reimplementa a lógica do gate aqui, só checa o veredito real já persistido.
    const architectureReview = await this.prisma.architectureReview.findFirst({
      where: { missionId, status: 'APPROVED' },
      orderBy: [{ reviewMode: 'desc' }, { updatedAt: 'desc' }],
    });
    if (!architectureReview || architectureReview.status !== 'APPROVED') throw new Error('ARCHITECTURE_REVIEW_NOT_APPROVED');

    const session = await this.missionPersistence.hydrate(missionId);
    const stored = session.resultStore.getCurrent();
    if (!stored) throw new Error('MISSION_NOT_GENERATED');
    const backendStack = stored.result.approvedSolution.selectedStacks.find((s) => s.deliveryTargetKind === 'BACKEND');

    const existing = await this.prisma.missionGenerationRun.findUnique({ where: { missionId } });
    const workspacePath = this.workspace.workspacePathFor(missionId);

    if (!backendStack || backendStack.stackKey !== SUPPORTED_STACK_KEY) {
      const row = await this.prisma.missionGenerationRun.upsert({
        where: { missionId },
        create: { id: randomUUID(), missionId, status: 'TARGET_NOT_SUPPORTED', targetKind: 'BACKEND', pluginId: backendStack?.stackKey ?? 'none', workspacePath, errorCode: 'TARGET_NOT_SUPPORTED' },
        update: { status: 'TARGET_NOT_SUPPORTED', pluginId: backendStack?.stackKey ?? 'none', errorCode: 'TARGET_NOT_SUPPORTED' },
      });
      return this.toDto(row);
    }

    const row = existing
      ? await this.prisma.missionGenerationRun.update({ where: { missionId }, data: { status: 'SCAFFOLDING', errorCode: null, buildJson: undefined, testJson: undefined, runtimeJson: undefined, downloadPath: null } })
      : await this.prisma.missionGenerationRun.create({ data: { id: randomUUID(), missionId, status: 'SCAFFOLDING', targetKind: 'BACKEND', pluginId: SUPPORTED_STACK_KEY, workspacePath } });

    // Fase 13 do brief: nunca bloqueia a resposta HTTP nos minutos reais de npm install/build/test
    // — o estado real fica em MissionGenerationRun, consultável via polling (mesmo princípio do
    // Operation pattern já usado pelo Generator).
    this.runPipeline(missionId, promptMaster.id).catch(() => { /* runPipeline já persiste toda falha real */ });

    return this.toDto(row);
  }

  async getStatus(missionId: string): Promise<MissionGenerationRunDto | null> {
    const row = await this.prisma.missionGenerationRun.findUnique({ where: { missionId } });
    return row ? this.toDto(row) : null;
  }

  async getArtifacts(missionId: string) {
    const run = await this.prisma.missionGenerationRun.findUnique({ where: { missionId } });
    if (!run) return [];
    return this.prisma.generatedArtifact.findMany({ where: { missionId, generationRunId: run.id }, orderBy: { path: 'asc' } });
  }

  async getJobs(missionId: string) {
    const run = await this.prisma.missionGenerationRun.findUnique({ where: { missionId } });
    if (!run) return [];
    return this.prisma.generationJob.findMany({ where: { missionId, generationRunId: run.id }, orderBy: { createdAt: 'asc' } });
  }

  async getDownloadPath(missionId: string): Promise<string> {
    const run = await this.prisma.missionGenerationRun.findUnique({ where: { missionId } });
    if (!run || run.status !== 'READY' || !run.downloadPath) throw new Error('GENERATION_NOT_READY');
    // MISSÃO "Verificação requisito-por-requisito + Delivery Eligibility": build/test/runtime
    // verdes não bastam — nunca entrega quando um requirement que estava no escopo desta versão
    // falhou de verdade (nunca bloqueia por requirement honestamente fora do teto).
    if (!run.deliveryEligible) throw new Error('DELIVERY_NOT_ELIGIBLE');
    // MISSÃO "Security Gate real antes da entrega": nunca entrega com uma vulnerabilidade CRITICAL
    // real, um segredo real no código gerado, ou um BLOCKER real do Security Reviewer.
    if (!run.securityPassed) throw new Error('SECURITY_GATE_FAILED');
    return run.downloadPath;
  }

  async startPreview(missionId: string): Promise<{ url: string }> {
    const run = await this.prisma.missionGenerationRun.findUnique({ where: { missionId } });
    if (!run || run.status !== 'READY') throw new Error('GENERATION_NOT_READY');
    const existingHandle = this.previews.get(missionId);
    if (existingHandle) return { url: `http://127.0.0.1:${existingHandle.port}` };

    const port = 4000 + (Math.abs(this.hash(missionId)) % 500);
    const child = this.runner.startLongRunning('node', ['dist/src/main.js'], run.workspacePath, { PORT: String(port) });
    this.previews.set(missionId, { child, port, startedAt: Date.now() });
    child.on('exit', () => this.previews.delete(missionId));

    await this.waitForHealth(port, 15_000);
    return { url: `http://127.0.0.1:${port}` };
  }

  async stopPreview(missionId: string): Promise<void> {
    const handle = this.previews.get(missionId);
    if (!handle) return;
    this.runner.stop(handle.child);
    this.previews.delete(missionId);
  }

  // --- pipeline real ---

  private async runPipeline(missionId: string, promptMasterId: string): Promise<void> {
    try {
      await this.eventLog.append({
        missionId, correlationId: missionId, actorType: 'GENERATION_ENGINE',
        type: 'mission.generation_started', payload: { promptMasterId },
      });

      const requirements = await this.prisma.requirement.findMany({ where: { promptMasterId, status: 'CONFIRMED' } });
      const promptMaster = await this.prisma.promptMasterVersion.findUniqueOrThrow({ where: { id: promptMasterId } });

      const scaffolded = scaffoldNestjsBackend({
        missionId, vision: promptMaster.vision, objective: promptMaster.objective,
        requirements: requirements.map((r) => ({ id: r.id, section: r.section, content: r.content })),
      });

      const written = await this.workspace.writeFiles(missionId, scaffolded.files);
      const run = await this.prisma.missionGenerationRun.update({
        where: { missionId },
        data: {
          status: 'JOBS_RUNNING',
          scaffoldJson: { fileCount: written.length, requirementIds: scaffolded.resources.map((r) => r.requirementId), skippedRequirementIds: scaffolded.skippedRequirementIds },
        },
      });

      await this.prisma.generatedArtifact.deleteMany({ where: { generationRunId: run.id } });
      await this.prisma.generatedArtifact.createMany({
        data: scaffolded.files.map((file, i) => ({
          id: randomUUID(), missionId, generationRunId: run.id, path: file.path, target: 'BACKEND', pluginId: SUPPORTED_STACK_KEY,
          ownerAgent: file.ownerAgent, hash: written[i].hash, sizeBytes: written[i].sizeBytes,
          symbolsJson: file.symbols, importsJson: file.imports, exportsJson: file.exports,
          provenance: file.provenance, validationStatus: 'UNVALIDATED',
        })),
      });
      this.eventBus.emit('generation.scaffolded', { fileCount: written.length }, { missionId });

      const workspacePath = this.workspace.workspacePathFor(missionId);

      // --- Job Planner + execução por agente cognitivo real ---
      // Fase não-fatal por design: um Job falhar não derruba a missão inteira — o arquivo
      // determinístico do scaffold continua valendo, e a falha real do agente fica visível em
      // GenerationJob (nunca escondida). A prova de correção de verdade continua sendo o
      // build/test que roda depois, sobre TUDO (scaffold + o que os agentes mudaram).
      const businessRules = requirements.filter((r) => r.section === 'businessRules');
      const { jobs } = planJobs(businessRules.map((r) => ({ id: r.id, content: r.content })), scaffolded.resources);
      const jobOutcomes: { requirementId: string; status: string }[] = [];
      const implementedFiles: { targetFile: string; requirementText: string; content: string }[] = [];
      let completedJobCount = 0;
      for (const job of jobs) {
        this.eventBus.emit('generation.job.started', { agentKey: job.agentKey, targetFile: job.targetFile, requirementText: job.requirementText }, { missionId });
        const currentContent = await this.workspace.readWorkspaceFile(missionId, job.targetFile);

        // CORE-005 §21/§22: caminho estruturado (AgentRuntime FSM, CORE-004) é preferencial para
        // todo agentKey já publicado no catálogo (CORE-002). Nunca fallback silencioso — toda
        // GenerationJob row grava executionMode + (quando LEGACY_COMPATIBILITY) fallbackReason.
        const eligible = Boolean(await this.catalog.getCurrentVersion(job.agentKey));
        const structuredAttempt = eligible ? await this.attemptStructuredJob(job, missionId, run) : null;

        let finalStatus: string;
        let finalErrorCode: string | null;
        let reviewerApproved: boolean | null = null;
        let reviewerFinding: string | null = null;
        let updatedFileContent: string | null = null;
        let analysisText: string | null = null;
        let planText: string | null = null;
        let implementationSummary: string | null = null;
        let provider: string | null = null;
        let model: string | null = null;
        let promptTokens: number | null = null;
        let completionTokens: number | null = null;
        let latencyMs = 0;
        let attemptCount = 1;
        let firstAttemptErrorCode: string | null = null;
        let executionMode: string;
        let agentExecutionIdForRow: string | null = null;
        let fallbackReason: string | null = null;
        let legacyJobId: string | null = null;
        let workspaceSessionId: string | null = null;
        let executorAgentDefinitionKey: string | null = null;
        let executorAgentDefinitionVersion: number | null = null;

        if (structuredAttempt?.ok) {
          executionMode = 'STRUCTURED_COGNITIVE';
          agentExecutionIdForRow = structuredAttempt.agentExecutionId;
          updatedFileContent = structuredAttempt.updatedFileContent;
          analysisText = structuredAttempt.analysisText;
          planText = structuredAttempt.planText;
          implementationSummary = structuredAttempt.implementationSummary;
          provider = structuredAttempt.provider;
          model = structuredAttempt.model;
          promptTokens = structuredAttempt.promptTokens;
          completionTokens = structuredAttempt.completionTokens;
          latencyMs = structuredAttempt.latencyMs;
          attemptCount = structuredAttempt.attemptCount;
          workspaceSessionId = structuredAttempt.workspaceSessionId;
          executorAgentDefinitionKey = structuredAttempt.executorAgentDefinitionKey;
          executorAgentDefinitionVersion = structuredAttempt.executorAgentDefinitionVersion;
          finalStatus = 'BUILD_TEST_VALIDATED';
          finalErrorCode = null;

          // --- Independent Reviewer real: idêntico ao caminho legado — mesmo agente reviewer,
          // mesma regra de aprovação, mesmo Job/updatedFileContent. ---
        } else if (structuredAttempt?.blocked) {
          // CORE-007 §22/§24: violação de policy — NUNCA cai pro legado (isso permitiria ao
          // agente escapar da guarda determinística). Job vai direto pra FAILED.
          executionMode = 'STRUCTURED_COGNITIVE';
          agentExecutionIdForRow = structuredAttempt.agentExecutionId;
          finalStatus = 'FAILED';
          finalErrorCode = structuredAttempt.errorCode;
        } else {
          executionMode = 'LEGACY_COMPATIBILITY';
          fallbackReason = eligible ? (structuredAttempt && 'fallbackReason' in structuredAttempt ? structuredAttempt.fallbackReason : 'STRUCTURED_EXECUTION_FAILED') : 'AGENT_NOT_IN_CATALOG';

          // CORE-007 REWORK: o legado cria e fixa o mesmo JobScope canônico antes de produzir
          // qualquer conteúdo. Não existe scope inline nem um segundo shape de policy.
          legacyJobId = randomUUID();
          await this.prisma.generationJob.create({
            data: {
              id: legacyJobId, missionId, generationRunId: run.id, requirementId: job.requirementId,
              requirementText: job.requirementText, targetResource: job.targetResource, targetFile: job.targetFile,
              agentKey: job.agentKey, status: 'PENDING',
            },
          });
          const legacyScope = await this.jobScope.ensureJobScope({
            missionId, generationJobId: legacyJobId, allowedPaths: [job.targetFile],
          });

          const result = await this.agentExecution.implementWithRepair(job, currentContent, { missionId, generationRunId: run.id, generationJobId: legacyJobId });
          agentExecutionIdForRow = result.agentExecutionId;
          const legacyExecution = await this.prisma.agentExecution.findUnique({ where: { id: result.agentExecutionId } });
          executorAgentDefinitionKey = legacyExecution?.agentDefinitionKey ?? null;
          executorAgentDefinitionVersion = legacyExecution?.agentDefinitionVersion ?? null;
          finalStatus = result.status;
          finalErrorCode = result.errorCode;
          updatedFileContent = result.updatedFileContent;
          analysisText = result.analysisText;
          planText = result.planText;
          implementationSummary = result.implementationSummary;
          provider = result.provider;
          model = result.model;
          promptTokens = result.promptTokens;
          completionTokens = result.completionTokens;
          latencyMs = result.latencyMs;
          attemptCount = result.attemptCount;
          firstAttemptErrorCode = result.firstAttemptErrorCode;

          // CORE-007 REWORK: representação mínima e determinística da escrita legada. O hash
          // prova exatamente qual conteúdo foi autorizado sem persistir conteúdo bruto.
          if (finalStatus === 'IMPLEMENTED' && updatedFileContent) {
            const legacyChanges = [{ operation: 'MODIFY' as const, path: job.targetFile, contentHash: canonicalHash(updatedFileContent) }];
            await this.eventLog.append({
              missionId, correlationId: legacyJobId, actorType: 'GENERATION_ENGINE',
              type: 'job.scope_validation_started',
              payload: { jobId: legacyJobId, scopeHash: legacyScope.scopeHash },
            });
            const { result: legacyScopeResult } = await this.jobScope.validateAndRecord({
              missionId, generationJobId: legacyJobId, jobScope: legacyScope, changes: legacyChanges,
            });
            if (legacyScopeResult.status === 'SCOPE_VIOLATION') {
              await this.eventLog.append({
                missionId, correlationId: legacyJobId, actorType: 'GENERATION_ENGINE',
                type: 'job.scope_validation_failed',
                payload: { jobId: legacyJobId, scopeHash: legacyScope.scopeHash, status: legacyScopeResult.status, findingCount: legacyScopeResult.findings.length },
              });
              finalStatus = 'FAILED';
              finalErrorCode = 'SCOPE_VIOLATION';
              updatedFileContent = null;
            } else {
              await this.eventLog.append({
                missionId, correlationId: legacyJobId, actorType: 'GENERATION_ENGINE',
                type: 'job.scope_validation_passed',
                payload: { jobId: legacyJobId, scopeHash: legacyScope.scopeHash, status: legacyScopeResult.status, findingCount: 0 },
              });

              const repositoryGuard = await this.runRepositoryGuard({
                missionId,
                generationJobId: legacyJobId,
                jobScope: legacyScope,
                changes: [{ operation: 'MODIFY', path: job.targetFile, content: updatedFileContent }],
              });
              if (repositoryGuard.status !== 'PASS') {
                finalStatus = 'FAILED';
                finalErrorCode = repositoryGuard.status;
                updatedFileContent = null;
              } else {
                const workspaceResult = await this.workspaceValidation.validate({
                  missionId, generationJobId: legacyJobId, changeSetHash: repositoryGuard.evidence.changeSetHash,
                  scopeHash: legacyScope.scopeHash, inspectionHash: repositoryGuard.evidence.inspectionHash,
                  repositoryFingerprint: repositoryGuard.evidence.repositoryFingerprint,
                  changes: this.toWorkspaceChanges([{ operation: 'MODIFY', path: job.targetFile, content: updatedFileContent }], repositoryGuard.inspections),
                });
                if (workspaceResult.status !== 'VALIDATED') {
                  finalStatus = 'FAILED';
                  finalErrorCode = workspaceResult.errorCode ?? workspaceResult.status;
                  updatedFileContent = null;
                } else {
                  finalStatus = 'BUILD_TEST_VALIDATED';
                  workspaceSessionId = workspaceResult.session.id;
                }
              }
            }
          }

        }

        if (finalStatus === 'BUILD_TEST_VALIDATED' && workspaceSessionId && executorAgentDefinitionKey && executorAgentDefinitionVersion !== null) {
          const reviewed = await this.runReviewAndExternalRework({
            missionId, job, generationJobId: structuredAttempt?.jobId ?? legacyJobId!,
            workspaceSessionId, executorAgentExecutionId: agentExecutionIdForRow!,
          });
          finalStatus = reviewed.status;
          finalErrorCode = reviewed.errorCode;
          reviewerApproved = reviewed.reviewerApproved;
          reviewerFinding = reviewed.reviewerFinding;
          updatedFileContent = reviewed.updatedFileContent ?? updatedFileContent;
          workspaceSessionId = reviewed.workspaceSessionId;
        } else if (finalStatus === 'BUILD_TEST_VALIDATED') {
          finalStatus = 'FAILED';
          finalErrorCode = 'REVIEW_EXECUTOR_IDENTITY_MISSING';
        }

        jobOutcomes.push({ requirementId: job.requirementId, status: finalStatus });
        this.eventBus.emit('generation.job.completed', { agentKey: job.agentKey, targetFile: job.targetFile, status: finalStatus, errorCode: finalErrorCode }, { missionId });
        if (finalStatus === 'REVIEW_APPROVED' && updatedFileContent) {
          implementedFiles.push({ targetFile: job.targetFile, requirementText: job.requirementText, content: updatedFileContent });
        }

        // A tentativa estruturada (se houve) já criou a GenerationJob row PENDING cedo — o
        // ContextLoader (CORE-003) exige que o Job já exista antes de compilar o primeiro prompt.
        // upsert por id: reaproveita essa mesma row (nunca duas rows pro mesmo Job).
        const jobRowId = structuredAttempt?.jobId ?? legacyJobId ?? randomUUID();

        completedJobCount++;
        await this.emitJobOutcomeEvents({
          missionId, jobId: jobRowId, agentKey: job.agentKey, targetFile: job.targetFile,
          executionMode, fallbackReason, agentExecutionId: agentExecutionIdForRow,
          finalStatus, finalErrorCode, completedJobCount, totalJobs: jobs.length,
        });
        const jobRowData = {
          status: finalStatus, analysisText, planText, implementationSummary, provider, model,
          promptTokens, completionTokens, latencyMs, errorCode: finalErrorCode, attemptCount,
          firstAttemptErrorCode, reviewerApproved, reviewerFinding, executionMode,
          agentExecutionId: agentExecutionIdForRow, fallbackReason,
        };
        const jobRow = await this.prisma.generationJob.upsert({
          where: { id: jobRowId },
          create: {
            id: jobRowId, missionId, generationRunId: run.id, requirementId: job.requirementId,
            requirementText: job.requirementText, targetResource: job.targetResource, targetFile: job.targetFile,
            agentKey: job.agentKey, ...jobRowData,
          },
          update: jobRowData,
        });
        // CORE-009: o candidato vive somente em WorkspaceSession. Nenhum write ou update de
        // GeneratedArtifact canônico ocorre antes dos gates futuros de promoção.
      }

      // --- MISSÃO "Verificação requisito-por-requisito + Delivery Eligibility" — computado aqui,
      // independente do build ainda passar ou não: cobertura é sobre o que os agentes/scaffold
      // produziram, não sobre se aquilo depois compila. ---
      const coverage = computeRequirementCoverage(
        requirements.map((r) => ({ id: r.id, section: r.section, content: r.content })),
        scaffolded,
        jobOutcomes
      );
      await this.prisma.missionGenerationRun.update({
        where: { missionId },
        data: { deliveryEligible: coverage.deliveryEligible, requirementCoverageJson: coverage.items as unknown as Prisma.InputJsonValue },
      });

      const terminalReviewStatus = jobOutcomes.find((outcome) => outcome.status === 'BLOCKED_NEEDS_HUMAN' || outcome.status === 'REVIEW_EXECUTION_FAILED');
      if (terminalReviewStatus) {
        await this.prisma.missionGenerationRun.update({
          where: { missionId }, data: { status: terminalReviewStatus.status, errorCode: terminalReviewStatus.status, deliveryEligible: false },
        });
        return;
      }

      if (jobOutcomes.some((outcome) => outcome.status === 'REVIEW_APPROVED')) {
        await this.prisma.missionGenerationRun.update({
          where: { missionId }, data: { status: 'CANDIDATES_PENDING_GATES', deliveryEligible: false },
        });
        return;
      }

      // --- Build real ---
      await this.prisma.missionGenerationRun.update({ where: { missionId }, data: { status: 'BUILD_RUNNING' } });
      this.eventBus.emit('generation.build.started', {}, { missionId });
      const install = await this.runner.runCommand(NPM_CMD, ['install', '--no-audit', '--no-fund'], workspacePath, 180_000);
      if (install.exitCode !== 0) {
        await this.fail(missionId, 'BUILD_FAILED', { buildJson: { command: install.command, exitCode: install.exitCode, durationMs: install.durationMs, logsExcerpt: install.logsExcerpt } });
        return;
      }
      const build = await this.runner.runCommand(NPM_CMD, ['run', 'build'], workspacePath, 90_000);
      await this.prisma.missionGenerationRun.update({ where: { missionId }, data: { buildJson: { command: build.command, exitCode: build.exitCode, durationMs: install.durationMs + build.durationMs, logsExcerpt: build.logsExcerpt } } });
      if (build.exitCode !== 0) {
        await this.fail(missionId, 'BUILD_FAILED', {});
        return;
      }
      this.eventBus.emit('generation.build.completed', { exitCode: build.exitCode, durationMs: install.durationMs + build.durationMs }, { missionId });
      await this.prisma.generatedArtifact.updateMany({ where: { generationRunId: run.id }, data: { validationStatus: 'VALID' } });

      // --- Test real --- (tsconfig.json usa rootDir "." — a saída real é dist/test/smoke.spec.js,
      // nunca dist/test/ como se fosse plano; confirmado nesta sessão que `node --test <dir>` não
      // faz auto-discovery de arquivo aqui, precisa do caminho explícito do arquivo compilado).
      await this.prisma.missionGenerationRun.update({ where: { missionId }, data: { status: 'TEST_RUNNING' } });
      this.eventBus.emit('generation.test.started', {}, { missionId });
      const test = await this.runner.runCommand('node', ['--test', 'dist/test/smoke.spec.js'], workspacePath, 60_000);
      const parsed = this.parseNodeTestOutput(test.logsExcerpt);
      await this.prisma.missionGenerationRun.update({
        where: { missionId },
        data: { testJson: { command: test.command, exitCode: test.exitCode, total: parsed.total, passed: parsed.passed, failed: parsed.failed, durationMs: test.durationMs, logsExcerpt: test.logsExcerpt } },
      });
      if (test.exitCode !== 0 || parsed.failed > 0) {
        await this.fail(missionId, 'TEST_FAILED', {});
        return;
      }
      this.eventBus.emit('generation.test.completed', { total: parsed.total, passed: parsed.passed, failed: parsed.failed }, { missionId });

      // --- Security Gate real --- ("Ferramenta mede. Validator verifica. Agente pensa com LLM.")
      await this.prisma.missionGenerationRun.update({ where: { missionId }, data: { status: 'SECURITY_SCANNING' } });
      this.eventBus.emit('generation.security.started', {}, { missionId });
      const npmAudit = await this.securityScanner.runNpmAudit(workspacePath);
      // Escaneia o conteúdo REAL atual — para arquivos que um agente reescreveu, isso já é o
      // conteúdo aplicado (writeWorkspaceFile), nunca a versão original do scaffold em memória.
      const implementedByPath = new Map(implementedFiles.map((f) => [f.targetFile, f.content]));
      const currentFiles = scaffolded.files.map((f) => ({ path: f.path, content: implementedByPath.get(f.path) ?? f.content }));
      const secretFindings = this.securityScanner.scanForSecrets(currentFiles);
      const reviewerResult = await this.securityReview.reviewAgentAuthoredCode(implementedFiles, missionId);
      const reviewerBlockers = reviewerResult.findings.filter((f) => f.severity === 'BLOCKER');
      // CRITICAL de framework herdado bloqueia (severidade alta o suficiente pra nunca ignorar);
      // HIGH/MODERATE/LOW ficam disclosed mas nunca bloqueiam sozinhos — são limitação já conhecida
      // das versões fixas do scaffold, não um achado desta missão específica.
      const securityPassed = npmAudit.critical === 0 && secretFindings.length === 0 && reviewerBlockers.length === 0;
      await this.prisma.missionGenerationRun.update({
        where: { missionId },
        data: {
          securityPassed,
          securityJson: {
            npmAudit, secretsFound: secretFindings.length,
            secrets: secretFindings, reviewerFindings: reviewerResult.findings, reviewerRan: reviewerResult.ran, reviewerErrorCode: reviewerResult.errorCode,
          } as unknown as Prisma.InputJsonValue,
        },
      });
      this.eventBus.emit('generation.security.completed', { securityPassed, critical: npmAudit.critical, secretsFound: secretFindings.length, blockerFindings: reviewerBlockers.length }, { missionId });

      // --- Runtime real ---
      await this.prisma.missionGenerationRun.update({ where: { missionId }, data: { status: 'RUNTIME_VALIDATING' } });
      this.eventBus.emit('generation.runtime.started', {}, { missionId });
      const validationPort = 3900 + (Math.abs(this.hash(missionId)) % 90);
      const startedAt = Date.now();
      const child = this.runner.startLongRunning('node', ['dist/src/main.js'], workspacePath, { PORT: String(validationPort) });
      let healthOk = false;
      let runtimeLogs = '';
      child.stdout?.on('data', (c) => { runtimeLogs += c.toString(); });
      child.stderr?.on('data', (c) => { runtimeLogs += c.toString(); });
      try {
        await this.waitForHealth(validationPort, 15_000);
        healthOk = true;
      } catch (err) {
        runtimeLogs += `\n[HEALTH CHECK FAILED: ${err instanceof Error ? err.message : String(err)}]`;
      } finally {
        this.runner.stop(child);
      }

      await this.prisma.missionGenerationRun.update({
        where: { missionId },
        data: { runtimeJson: { port: validationPort, healthCheckOk: healthOk, durationMs: Date.now() - startedAt, logsExcerpt: runtimeLogs.slice(-4000) } },
      });
      if (!healthOk) {
        await this.fail(missionId, 'RUNTIME_FAILED', {});
        return;
      }
      this.eventBus.emit('generation.runtime.completed', { healthCheckOk: healthOk, port: validationPort }, { missionId });

      // --- Download real ---
      const zipPath = await this.workspace.zipWorkspace(missionId);
      await this.prisma.missionGenerationRun.update({ where: { missionId }, data: { status: 'READY', downloadPath: zipPath } });
      this.eventBus.emit('generation.ready', {}, { missionId });
      await this.eventLog.append({
        missionId, correlationId: missionId, actorType: 'GENERATION_ENGINE',
        type: 'mission.generation_completed', payload: { totalJobs: jobs.length },
      });
    } catch (error) {
      await this.fail(missionId, 'INTERNAL_ERROR', { errorCode: error instanceof Error ? error.message : 'UNKNOWN' });
    }
  }

  /**
   * CORE-005 §21 — tenta o caminho estruturado real (AgentRuntime FSM → CORE-004) para um Job
   * elegível. Nunca materializa sem `content` utilizável (§28: proposta cognitiva não é
   * promoção de artifact por si só — só materializa aqui exatamente no mesmo nível que o
   * caminho legado sempre materializou: escrever o arquivo, ainda sob os mesmos gates de
   * build/test/security/runtime que rodam depois, iguais para os dois caminhos).
   */
  /**
   * CORE-006 §25 — nunca esconde qual caminho materializou o Job: `job.execution_mode_selected`
   * é emitido sempre (estruturado OU legado, com `reason` quando legado). Extraído em método
   * próprio para ser testável isoladamente (§Y do plano de testes) sem precisar rodar o
   * pipeline completo (scaffold+build+test+runtime).
   */
  private async emitJobOutcomeEvents(input: {
    missionId: string; jobId: string; agentKey: string; targetFile: string;
    executionMode: string; fallbackReason: string | null; agentExecutionId: string | null;
    finalStatus: string; finalErrorCode: string | null; completedJobCount: number; totalJobs: number;
  }): Promise<void> {
    const correlationId = input.agentExecutionId ?? input.jobId;
    await this.eventLog.append({
      missionId: input.missionId, correlationId, actorType: 'GENERATION_ENGINE',
      type: 'job.execution_mode_selected',
      payload: { jobId: input.jobId, agentKey: input.agentKey, mode: input.executionMode, reason: input.fallbackReason },
    });
    await this.eventLog.append({
      missionId: input.missionId, correlationId, actorType: 'GENERATION_ENGINE',
      type: input.finalStatus === 'FAILED' ? 'job.failed' : 'job.cognitive_completed',
      payload: { jobId: input.jobId, agentKey: input.agentKey, targetFile: input.targetFile, status: input.finalStatus, errorCode: input.finalErrorCode },
    });
    await this.eventLog.append({
      missionId: input.missionId, correlationId: input.missionId, actorType: 'GENERATION_ENGINE',
      type: 'mission.generation_progress', payload: { completed: input.completedJobCount, total: input.totalJobs },
    });
  }

  private async attemptStructuredJob(job: PlannedJob, missionId: string, run: { id: string }): Promise<StructuredAttemptResult> {
    const jobId = randomUUID();
    await this.prisma.generationJob.create({
      data: {
        id: jobId, missionId, generationRunId: run.id, requirementId: job.requirementId,
        requirementText: job.requirementText, targetResource: job.targetResource, targetFile: job.targetFile,
        agentKey: job.agentKey, status: 'PENDING',
      },
    });

    try {
      // CORE-007 §4: JobPlanner inteligente ainda não existe — o único scope real inferível
      // hoje é o targetFile que o planner determinístico já decidiu. Persistido ANTES do summon
      // (§3) para que PromptMaster (via ContextLoader) e ScopeValidator leiam o mesmo contrato.
      const scope = await this.jobScope.ensureJobScope({ missionId, generationJobId: jobId, allowedPaths: [job.targetFile] });

      const instance = await this.agentRuntime.ensureInstance({ missionId, agentDefinitionKey: job.agentKey });
      const outcome = await this.agentRuntime.summon({ missionId, jobId, agentInstanceId: instance.id });

      if (outcome.status !== 'SUCCEEDED') {
        const fallbackReason = 'errorCode' in outcome ? outcome.errorCode : 'STRUCTURED_EXECUTION_FAILED';
        return { ok: false, jobId, fallbackReason };
      }

      // CORE-007 §12/§13/§20: TODAS as changes do ChangeSet são validadas, all-or-nothing, ANTES
      // de qualquer materialização — nunca write-then-validate.
      await this.eventLog.append({
        missionId, correlationId: outcome.agentExecutionId, actorType: 'GENERATION_ENGINE',
        type: 'job.scope_validation_started', payload: { jobId, agentExecutionId: outcome.agentExecutionId, scopeHash: scope.scopeHash },
      });
      const { result: scopeResult } = await this.jobScope.validateAndRecord({
        missionId, generationJobId: jobId, agentExecutionId: outcome.agentExecutionId, jobScope: scope,
        changes: outcome.changeset.changes.map((c) => ({ operation: c.operation, path: c.path })),
      });
      if (scopeResult.status === 'SCOPE_VIOLATION') {
        await this.eventLog.append({
          missionId, correlationId: outcome.agentExecutionId, actorType: 'GENERATION_ENGINE',
          type: 'job.scope_validation_failed',
          payload: { jobId, agentExecutionId: outcome.agentExecutionId, scopeHash: scope.scopeHash, status: scopeResult.status, findingCount: scopeResult.findings.length },
        });
        // §22: NON-FALLBACKABLE — uma violação de policy nunca cai pro legado.
        return { ok: false, jobId, agentExecutionId: outcome.agentExecutionId, blocked: true, errorCode: 'SCOPE_VIOLATION' };
      }
      await this.eventLog.append({
        missionId, correlationId: outcome.agentExecutionId, actorType: 'GENERATION_ENGINE',
        type: 'job.scope_validation_passed',
        payload: { jobId, agentExecutionId: outcome.agentExecutionId, scopeHash: scope.scopeHash, status: scopeResult.status, findingCount: 0 },
      });

      const repositoryGuard = await this.runRepositoryGuard({
        missionId,
        generationJobId: jobId,
        agentExecutionId: outcome.agentExecutionId,
        jobScope: scope,
        changes: outcome.changeset.changes.map((change) => ({ operation: change.operation, path: change.path, content: change.content })),
      });
      if (repositoryGuard.status !== 'PASS') {
        return { ok: false, jobId, agentExecutionId: outcome.agentExecutionId, blocked: true, errorCode: repositoryGuard.status };
      }

      let workspaceResult;
      try {
        workspaceResult = await this.workspaceValidation.validate({
          missionId, generationJobId: jobId, agentExecutionId: outcome.agentExecutionId,
          changeSetHash: repositoryGuard.evidence.changeSetHash, scopeHash: scope.scopeHash,
          inspectionHash: repositoryGuard.evidence.inspectionHash,
          repositoryFingerprint: repositoryGuard.evidence.repositoryFingerprint,
          changes: this.toWorkspaceChanges(
            outcome.changeset.changes.map((change) => ({ operation: change.operation, path: change.path, content: change.content })),
            repositoryGuard.inspections
          ),
        });
      } catch (error) {
        return {
          ok: false, jobId, agentExecutionId: outcome.agentExecutionId, blocked: true,
          errorCode: error instanceof Error ? error.message : 'WORKSPACE_VALIDATION_FAILED',
        };
      }
      if (workspaceResult.status !== 'VALIDATED') {
        return { ok: false, jobId, agentExecutionId: outcome.agentExecutionId, blocked: true, errorCode: workspaceResult.errorCode ?? workspaceResult.status };
      }

      const materialized = outcome.changeset.changes.find(
        (c) => c.path === job.targetFile && (c.operation === 'CREATE' || c.operation === 'MODIFY') && !!c.content
      );
      if (!materialized?.content) {
        return { ok: false, jobId, fallbackReason: 'CHANGESET_CONTENT_MISSING' };
      }

      const metrics = await this.agentRuntime.getMetrics(outcome.agentExecutionId);
      const attemptCount = await this.prisma.agentCognitiveStep.count({ where: { agentExecutionId: outcome.agentExecutionId, phase: 'IMPLEMENTATION' } });
      const lastInvocation = await this.prisma.llmInvocationRecord.findFirst({
        where: { agentExecutionId: outcome.agentExecutionId, status: 'SUCCEEDED' },
        orderBy: { createdAt: 'desc' },
      });

      return {
        ok: true,
        jobId,
        agentExecutionId: outcome.agentExecutionId,
        updatedFileContent: materialized.content,
        analysisText: outcome.analysis.understanding,
        planText: outcome.plan.steps.map((s) => s.description).join(' '),
        implementationSummary: outcome.changeset.changes.map((c) => `${c.operation} ${c.path}: ${c.rationale}`).join(' '),
        provider: lastInvocation?.provider ?? null,
        model: lastInvocation?.model ?? null,
        promptTokens: metrics.tokensIn,
        completionTokens: metrics.tokensOut,
        latencyMs: metrics.elapsedMs ?? 0,
        attemptCount: Math.max(1, attemptCount),
        workspaceSessionId: workspaceResult.session?.id ?? 'WORKSPACE_SESSION_EVIDENCE_UNAVAILABLE',
        executorAgentDefinitionKey: outcome.agentDefinitionKey,
        executorAgentDefinitionVersion: outcome.agentDefinitionVersion,
      };
    } catch (err) {
      return { ok: false, jobId, fallbackReason: err instanceof Error ? err.message : 'STRUCTURED_EXECUTION_FAILED' };
    }
  }

  private async runReviewAndExternalRework(input: {
    missionId: string;
    job: PlannedJob;
    generationJobId: string;
    workspaceSessionId: string;
    executorAgentExecutionId: string;
  }): Promise<{ status: string; errorCode: string | null; reviewerApproved: boolean | null; reviewerFinding: string | null; updatedFileContent: string | null; workspaceSessionId: string }> {
    if (!this.reviewOrchestrator) throw new Error('REVIEW_ORCHESTRATOR_NOT_AVAILABLE');
    let workspaceSessionId = input.workspaceSessionId;
    let executorAgentExecutionId = input.executorAgentExecutionId;
    let reviewCycle = 1;

    for (;;) {
      let review;
      try {
        review = await this.reviewOrchestrator.startReview({ workspaceSessionId, reviewCycle, executorAgentExecutionId });
      } catch (error) {
        return { status: 'REVIEW_EXECUTION_FAILED', errorCode: error instanceof Error ? error.message : 'REVIEW_EXECUTION_FAILED', reviewerApproved: null, reviewerFinding: null, updatedFileContent: null, workspaceSessionId };
      }
      const reviewerFinding = review.result.findings.map((finding) => finding.message).join(' | ') || null;
      if (review.verdict === 'APPROVED') {
        const content = await this.workspace.readSessionFile((await this.prisma.workspaceSession.findUniqueOrThrow({ where: { id: workspaceSessionId } })).rootRef, input.job.targetFile);
        return { status: 'REVIEW_APPROVED', errorCode: null, reviewerApproved: true, reviewerFinding, updatedFileContent: content, workspaceSessionId };
      }
      if (reviewCycle > MAX_EXTERNAL_REWORKS) {
        await this.reviewOrchestrator.markBlocked({ reviewRecordId: review.reviewRecordId });
        return { status: 'BLOCKED_NEEDS_HUMAN', errorCode: 'BLOCKED_NEEDS_HUMAN', reviewerApproved: false, reviewerFinding, updatedFileContent: null, workspaceSessionId };
      }

      let rework;
      try {
        rework = await this.reviewOrchestrator.executeRework({ reviewRecordId: review.reviewRecordId });
      } catch (error) {
        return { status: 'FAILED', errorCode: error instanceof Error ? error.message : 'REWORK_EXECUTION_FAILED', reviewerApproved: false, reviewerFinding, updatedFileContent: null, workspaceSessionId };
      }
      const scope = await this.jobScope.requireJobScope(input.generationJobId);
      await this.eventLog.append({ missionId: input.missionId, correlationId: rework.agentExecutionId, actorType: 'GENERATION_ENGINE', type: 'job.scope_validation_started', payload: { jobId: input.generationJobId, agentExecutionId: rework.agentExecutionId, scopeHash: scope.scopeHash } });
      const scoped = await this.jobScope.validateAndRecord({ missionId: input.missionId, generationJobId: input.generationJobId, agentExecutionId: rework.agentExecutionId, jobScope: scope,
        changes: rework.changeset.changes.map((change) => ({ operation: change.operation, path: change.path })) });
      if (scoped.result.status !== 'PASS') {
        await this.eventLog.append({ missionId: input.missionId, correlationId: rework.agentExecutionId, actorType: 'GENERATION_ENGINE', type: 'job.scope_validation_failed', payload: { jobId: input.generationJobId, agentExecutionId: rework.agentExecutionId, scopeHash: scope.scopeHash, status: scoped.result.status, findingCount: scoped.result.findings.length } });
        await this.reviewOrchestrator.markReworkFailed({ reviewRecordId: review.reviewRecordId, agentExecutionId: rework.agentExecutionId, errorCode: 'SCOPE_VIOLATION' });
        return { status: 'FAILED', errorCode: 'SCOPE_VIOLATION', reviewerApproved: false, reviewerFinding, updatedFileContent: null, workspaceSessionId };
      }
      await this.eventLog.append({ missionId: input.missionId, correlationId: rework.agentExecutionId, actorType: 'GENERATION_ENGINE', type: 'job.scope_validation_passed', payload: { jobId: input.generationJobId, agentExecutionId: rework.agentExecutionId, scopeHash: scope.scopeHash, status: scoped.result.status, findingCount: 0 } });

      const proposed = rework.changeset.changes.map((change) => ({ operation: change.operation, path: change.path, content: change.content }));
      const guard = await this.runRepositoryGuard({ missionId: input.missionId, generationJobId: input.generationJobId, agentExecutionId: rework.agentExecutionId, jobScope: scope, changes: proposed });
      if (guard.status !== 'PASS') {
        await this.reviewOrchestrator.markReworkFailed({ reviewRecordId: review.reviewRecordId, agentExecutionId: rework.agentExecutionId, errorCode: guard.status });
        return { status: 'FAILED', errorCode: guard.status, reviewerApproved: false, reviewerFinding, updatedFileContent: null, workspaceSessionId };
      }
      const validated = await this.workspaceValidation.validate({ missionId: input.missionId, generationJobId: input.generationJobId, agentExecutionId: rework.agentExecutionId,
        changeSetHash: guard.evidence.changeSetHash, scopeHash: scope.scopeHash, inspectionHash: guard.evidence.inspectionHash,
        repositoryFingerprint: guard.evidence.repositoryFingerprint, changes: this.toWorkspaceChanges(proposed, guard.inspections), forceNew: true });
      if (validated.status !== 'VALIDATED') {
        const errorCode = validated.errorCode ?? validated.status;
        await this.reviewOrchestrator.markReworkFailed({ reviewRecordId: review.reviewRecordId, agentExecutionId: rework.agentExecutionId, errorCode });
        return { status: 'FAILED', errorCode, reviewerApproved: false, reviewerFinding, updatedFileContent: null, workspaceSessionId };
      }
      workspaceSessionId = validated.session.id;
      executorAgentExecutionId = rework.agentExecutionId;
      await this.reviewOrchestrator.markReworkCompleted({ reviewRecordId: review.reviewRecordId, workspaceSessionId, agentExecutionId: rework.agentExecutionId });
      reviewCycle++;
    }
  }

  private async runRepositoryGuard(input: {
    missionId: string;
    generationJobId: string;
    agentExecutionId?: string;
    jobScope: Awaited<ReturnType<JobScopeService['requireJobScope']>>;
    changes: ProposedRepositoryChange[];
  }) {
    const correlationId = input.agentExecutionId ?? input.generationJobId;
    const changeSetHash = canonicalHash(input.changes.map((change) => ({
      operation: change.operation,
      path: change.path,
      contentHash: change.content === undefined ? null : canonicalHash(change.content),
    })));
    await this.eventLog.append({
      missionId: input.missionId,
      correlationId,
      actorType: 'GENERATION_ENGINE',
      type: 'job.repository_inspection_started',
      payload: { jobId: input.generationJobId, agentExecutionId: input.agentExecutionId, changeSetHash },
    });
    const { inspections, result, evidence } = await this.duplicateValidation.inspectValidateAndRecord(input);
    const candidateCount = inspections.reduce((sum, inspection) => sum + inspection.candidateArtifacts.length, 0);
    await this.eventLog.append({
      missionId: input.missionId,
      correlationId,
      actorType: 'GENERATION_ENGINE',
      type: 'job.repository_inspection_completed',
      payload: {
        jobId: input.generationJobId,
        agentExecutionId: input.agentExecutionId,
        changeSetHash: evidence.changeSetHash,
        inspectionHash: evidence.inspectionHash,
        status: result.status,
        candidateCount,
        findingCount: result.findings.length,
      },
    });
    await this.eventLog.append({
      missionId: input.missionId,
      correlationId,
      actorType: 'GENERATION_ENGINE',
      type: result.status === 'PASS' ? 'job.duplicate_validation_passed' : 'job.duplicate_validation_failed',
      payload: {
        jobId: input.generationJobId,
        agentExecutionId: input.agentExecutionId,
        changeSetHash: evidence.changeSetHash,
        inspectionHash: evidence.inspectionHash,
        status: result.status,
        candidateCount,
        findingCount: result.findings.length,
      },
    });
    return { status: result.status, inspections, evidence };
  }

  private toWorkspaceChanges(changes: ProposedRepositoryChange[], inspections: RepositoryInspectionResult[]): WorkspaceCandidateChange[] {
    return changes.map((change, index) => ({
      operation: change.operation,
      path: change.path,
      content: change.content,
      expectedBeforeHash: inspections[index]?.exactPathMatch?.hash ?? null,
    }));
  }

  private async fail(missionId: string, status: string, extra: Partial<Prisma.MissionGenerationRunUpdateInput>): Promise<void> {
    await this.prisma.missionGenerationRun.update({ where: { missionId }, data: { status, ...extra } });
    this.eventBus.emit('generation.failed', { status }, { missionId });
    await this.eventLog.append({
      missionId, correlationId: missionId, actorType: 'GENERATION_ENGINE',
      type: 'mission.generation_failed', payload: { status },
    });
  }

  private parseNodeTestOutput(output: string): { total: number; passed: number; failed: number } {
    // O reporter "spec" padrão do Node 24 usa prefixo "ℹ " (nunca "# ", que era o formato TAP de
    // versões antigas do runner) — aceita os dois formatos para não depender da versão exata do Node.
    const passMatch = output.match(/[#ℹ]\s*pass (\d+)/);
    const failMatch = output.match(/[#ℹ]\s*fail (\d+)/);
    const totalMatch = output.match(/[#ℹ]\s*tests (\d+)/);
    return {
      total: totalMatch ? Number(totalMatch[1]) : 0,
      passed: passMatch ? Number(passMatch[1]) : 0,
      failed: failMatch ? Number(failMatch[1]) : 0,
    };
  }

  private async waitForHealth(port: number, timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        const res = await fetch(`http://127.0.0.1:${port}/health`);
        if (res.ok) return;
      } catch { /* ainda subindo */ }
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    throw new Error('HEALTH_CHECK_TIMEOUT');
  }

  private hash(value: string): number {
    let h = 0;
    for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) | 0;
    return h;
  }

  private toDto(row: {
    id: string; missionId: string; status: string; targetKind: string; pluginId: string;
    scaffoldJson: unknown; buildJson: unknown; testJson: unknown; runtimeJson: unknown;
    downloadPath: string | null; errorCode: string | null; createdAt: Date; updatedAt: Date;
    deliveryEligible: boolean; requirementCoverageJson: unknown;
    securityPassed: boolean; securityJson: unknown;
  }): MissionGenerationRunDto {
    return {
      id: row.id, missionId: row.missionId, status: row.status, targetKind: row.targetKind, pluginId: row.pluginId,
      scaffold: row.scaffoldJson as MissionGenerationRunDto['scaffold'],
      build: row.buildJson as MissionGenerationRunDto['build'],
      test: row.testJson as MissionGenerationRunDto['test'],
      runtime: row.runtimeJson as MissionGenerationRunDto['runtime'],
      downloadReady: row.status === 'READY' && !!row.downloadPath && row.deliveryEligible && row.securityPassed,
      deliveryEligible: row.deliveryEligible,
      requirementCoverage: row.requirementCoverageJson as MissionGenerationRunDto['requirementCoverage'],
      securityPassed: row.securityPassed,
      security: row.securityJson as MissionGenerationRunDto['security'],
      errorCode: row.errorCode, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
    };
  }
}
