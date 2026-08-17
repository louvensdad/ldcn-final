import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ApprovedArchitectureComposition, ApprovedSolution, StackArchitectureProposal } from 'ldcn-core';
import { PrismaService } from '../persistence/prisma.service';
import { MissionPersistenceService } from '../persistence/mission-persistence.service';
import { LLM_CLIENT, LlmClient, LlmCompletionResult } from '../assistant/deepseek-client';
import { EventBusService } from '../events/event-bus.service';
import { LlmInvocationLedgerService } from '../ledger/llm-invocation-ledger.service';

const REVIEWER_TIMEOUT_MS = 45_000;
const PROMPT_TEMPLATE_VERSION = 'v1';
/** Único stack real que o generation-engine consegue construir hoje (Fase 17 da missão anterior) —
 * usado aqui só para uma achado informativo, nunca para bloquear a arquitetura em si. */
const GENERATABLE_STACKS = new Set(['stack.typescript.nestjs']);

const CORE_REVIEWERS = ['solutionArchitect', 'stackArchitect'] as const;
const CONDITIONAL_REVIEWERS = ['securityArchitect'] as const;
export type ArchitectureReviewerKey = (typeof CORE_REVIEWERS)[number] | (typeof CONDITIONAL_REVIEWERS)[number];
const ALL_REVIEWER_KEYS: ArchitectureReviewerKey[] = [...CORE_REVIEWERS, ...CONDITIONAL_REVIEWERS];

type ReviewerCriticality = 'CRITICAL' | 'HIGH';
const REVIEWER_CRITICALITY: Record<ArchitectureReviewerKey, ReviewerCriticality> = {
  solutionArchitect: 'CRITICAL',
  stackArchitect: 'CRITICAL',
  securityArchitect: 'HIGH',
};

const SECURITY_SIGNAL = /auth|jwt|oauth|login|senha|credential|secret|token|payment|pagamento|cart[ãa]o|pii|lgpd|gdpr|criptograf|encrypt/i;

type ReviewerExecutionStatus = 'PASSED' | 'DEGRADED' | 'FAILED_BLOCKING';
type FindingSeverity = 'INFO' | 'ADVISORY' | 'WARNING' | 'BLOCKER';

export interface ArchitectureReviewFindingDto {
  id: string;
  reviewerKey: string;
  code: string;
  severity: FindingSeverity;
  finding: string;
  recommendedResolutions: string[];
  requiresUserDecision: boolean;
  status: 'OPEN' | 'RESOLVED';
  resolvedBy: string | null;
  resolvedAt: string | null;
  chosenOption: string | null;
  createdAt: string;
}

export interface ArchitectureReviewerExecutionDto {
  reviewerKey: string;
  status: ReviewerExecutionStatus;
  criticality: ReviewerCriticality;
  findingCount: number;
  latencyMs: number | null;
  errorCode: string | null;
}

export interface ArchitectureReviewSessionDto {
  missionId: string;
  status: 'PENDING' | 'APPROVED' | 'REWORK_REQUIRED' | 'BLOCKED';
  findings: ArchitectureReviewFindingDto[];
  executions: ArchitectureReviewerExecutionDto[];
}

interface ReviewerFindingResult {
  code: string;
  severity: FindingSeverity;
  finding: string;
  recommendedResolutions?: string[];
  requiresUserDecision?: boolean;
}

const OUTPUT_SCHEMA = `Responda SOMENTE com um objeto JSON válido, sem markdown, exatamente neste formato:
{"findings": [{"code": string, "severity": "INFO" | "ADVISORY" | "WARNING" | "BLOCKER", "finding": string, "recommendedResolutions": string[], "requiresUserDecision": boolean}]}
Use BLOCKER apenas para problemas que realmente impedem prosseguir com segurança, sempre com pelo menos uma recommendedResolutions. Se não encontrar problema real, retorne {"findings": []} — nunca invente um achado só para preencher.`;

const REVIEWER_PROMPTS: Record<ArchitectureReviewerKey, string> = {
  solutionArchitect: `Você é o Solution Architect do LDCN OS revisando uma composição de arquitetura já proposta (você não escolhe stack nem estilo — isso já foi decidido). Avalie coerência geral: módulos com responsabilidades sobrepostas ou ambíguas, boundaries mal definidos, dependências circulares entre módulos, funcionalidades do contrato sem módulo correspondente. ${OUTPUT_SCHEMA}`,
  stackArchitect: `Você é o Stack Architect do LDCN OS. Avalie se o estilo de arquitetura, build/test/deploy strategy e riscos declarados são realistas e coerentes para o stack escolhido — nunca proponha um stack diferente. ${OUTPUT_SCHEMA}`,
  securityArchitect: `Você é o Security Architect do LDCN OS. Avalie as necessidades de segurança implícitas pelos módulos, comunicação e persistência descritos (autenticação, autorização, proteção de segredos, dados sensíveis) — em nível de arquitetura, nunca implementação específica. ${OUTPUT_SCHEMA}`,
};

/**
 * MISSÃO "Arquitetura não pode seguir automaticamente para Entrega" — o gate real entre a
 * ApprovedArchitectureComposition (já real, determinística, produzida por core/ArchitectureComposer)
 * e o resto da jornada (Team/Pipeline/Entrega). Mesmo padrão real já provado pelo
 * ReviewCouncilService do PromptMaster (council cognitivo real + política determinística → gate),
 * duplicado aqui em menor escala porque o artefato revisado (arquitetura, não texto de requisitos)
 * tem forma completamente diferente — nunca generalizado às cegas sobre um sistema já testado.
 * "Agente pensa com LLM. Ferramenta mede. Validator verifica. Gate decide."
 */
@Injectable()
export class ArchitectureReviewService {
  private reviewerTimeoutMs = REVIEWER_TIMEOUT_MS;

  constructor(
    private readonly prisma: PrismaService,
    private readonly missionPersistence: MissionPersistenceService,
    private readonly eventBus: EventBusService,
    @Inject(LLM_CLIENT) private readonly llm: LlmClient,
    private readonly ledger: LlmInvocationLedgerService
  ) {}

  async start(missionId: string): Promise<ArchitectureReviewSessionDto> {
    this.eventBus.emit('architecture_review.started', {}, { missionId });
    const session = await this.missionPersistence.hydrate(missionId);
    const stored = session.resultStore.getCurrent();
    if (!stored) throw new Error('MISSION_NOT_GENERATED');
    const { approvedSolution, architectureComposition } = stored.result;

    // LEGACY_COMPATIBILITY only: canonical CORE-013 lives in ArchitecturePlanningService and
    // points to the Prisma ApprovedSolution. Keep this endpoint for old generator missions.
    const existingLegacy = await this.prisma.architectureReview.findFirst({ where: { missionId, reviewMode: 'LEGACY_COMPATIBILITY' } });
    const row = existingLegacy
      ? await this.prisma.architectureReview.update({ where: { id: existingLegacy.id }, data: { status: 'PENDING', approvedSolutionId: approvedSolution.id, architectureCompositionId: architectureComposition.id } })
      : await this.prisma.architectureReview.create({ data: { id: randomUUID(), missionId, approvedSolutionId: approvedSolution.id, architectureCompositionId: architectureComposition.id, reviewMode: 'LEGACY_COMPATIBILITY', status: 'PENDING' } });

    // Uma nova rodada nunca herda achados de uma composição anterior — cada start() é uma
    // avaliação real e completa da composição atual, nunca um acúmulo de estados antigos.
    await this.prisma.architectureReviewFinding.deleteMany({ where: { architectureReviewId: row.id } });
    await this.prisma.architectureReviewerExecution.deleteMany({ where: { architectureReviewId: row.id } });

    for (const f of this.runDeterministicPolicies(architectureComposition)) {
      await this.persistFinding(missionId, row.id, 'policy', f);
    }

    const reviewerKeys = this.routeReviewers(architectureComposition);
    const contextJson = this.buildContext(approvedSolution, architectureComposition);
    // SLICE C1: o id da execução é gerado ANTES da chamada ao LLM (não só no persistExecution() no
    // final) para que LlmInvocationRecord.architectureReviewerExecutionId aponte para a linha certa
    // mesmo esta ainda não estar persistida — persistExecution() reusa este mesmo id.
    const executionIds = reviewerKeys.map(() => randomUUID());
    const settled = await Promise.allSettled(
      reviewerKeys.map((key, i) => this.executeReviewer(missionId, row.id, key, contextJson, executionIds[i]))
    );
    await Promise.all(settled.map((result, i) =>
      result.status === 'rejected' ? this.persistExecution(executionIds[i], missionId, row.id, reviewerKeys[i], 'FAILED_BLOCKING', 0, 'REVIEWER_EXECUTION_THREW', 0) : Promise.resolve()
    ));

    const status = await this.computeVerdict(row.id);
    await this.prisma.architectureReview.update({ where: { id: row.id }, data: { status } });
    this.eventBus.emit('architecture_review.completed', { status }, { missionId });
    return this.getSession(missionId);
  }

  async getSession(missionId: string): Promise<ArchitectureReviewSessionDto> {
    const row = await this.prisma.architectureReview.findFirst({ where: { missionId, reviewMode: 'LEGACY_COMPATIBILITY' }, orderBy: { createdAt: 'desc' } });
    if (!row) throw new Error('ARCHITECTURE_REVIEW_NOT_STARTED');
    const [findingRows, executionRows] = await Promise.all([
      this.prisma.architectureReviewFinding.findMany({ where: { architectureReviewId: row.id }, orderBy: { createdAt: 'asc' } }),
      this.prisma.architectureReviewerExecution.findMany({ where: { architectureReviewId: row.id } }),
    ]);
    return {
      missionId,
      status: row.status as ArchitectureReviewSessionDto['status'],
      findings: findingRows.map((f) => ({
        id: f.id, reviewerKey: f.reviewerKey, code: f.code, severity: f.severity as FindingSeverity,
        finding: f.finding, recommendedResolutions: f.recommendedResolutionsJson as string[],
        requiresUserDecision: f.requiresUserDecision, status: f.status as 'OPEN' | 'RESOLVED',
        resolvedBy: f.resolvedBy, resolvedAt: f.resolvedAt?.toISOString() ?? null, chosenOption: f.chosenOption,
        createdAt: f.createdAt.toISOString(),
      })),
      executions: executionRows.map((e) => ({
        reviewerKey: e.reviewerKey, status: e.status as ReviewerExecutionStatus,
        criticality: REVIEWER_CRITICALITY[e.reviewerKey as ArchitectureReviewerKey] ?? 'HIGH',
        findingCount: e.findingCount, latencyMs: e.latencyMs, errorCode: e.errorCode,
      })),
    };
  }

  async resolveFinding(missionId: string, findingId: string): Promise<ArchitectureReviewSessionDto> {
    await this.prisma.architectureReviewFinding.update({ where: { id: findingId }, data: { status: 'RESOLVED', resolvedBy: 'user', resolvedAt: new Date() } });
    return this.recompute(missionId);
  }

  async decideFinding(missionId: string, findingId: string, chosenOption: string): Promise<ArchitectureReviewSessionDto> {
    await this.prisma.architectureReviewFinding.update({ where: { id: findingId }, data: { status: 'RESOLVED', resolvedBy: 'user', resolvedAt: new Date(), chosenOption } });
    return this.recompute(missionId);
  }

  private async recompute(missionId: string): Promise<ArchitectureReviewSessionDto> {
    const row = await this.prisma.architectureReview.findFirst({ where: { missionId, reviewMode: 'LEGACY_COMPATIBILITY' }, orderBy: { createdAt: 'desc' } });
    if (!row) throw new Error('ARCHITECTURE_REVIEW_NOT_STARTED');
    const status = await this.computeVerdict(row.id);
    await this.prisma.architectureReview.update({ where: { id: row.id }, data: { status } });
    this.eventBus.emit('architecture_review.completed', { status }, { missionId });
    return this.getSession(missionId);
  }

  /** Fase constitucional: nunca `APPROVED` com um achado BLOCKER ou requiresUserDecision ainda
   * OPEN, e nunca `APPROVED` se um reviewer CRITICAL falhou sem sequer rodar de verdade. */
  private async computeVerdict(architectureReviewId: string): Promise<'APPROVED' | 'REWORK_REQUIRED' | 'BLOCKED'> {
    const open = await this.prisma.architectureReviewFinding.findMany({ where: { architectureReviewId, status: 'OPEN' } });
    const deadEnd = open.some((f) => f.severity === 'BLOCKER' && (f.recommendedResolutionsJson as string[]).length === 0);
    if (deadEnd) return 'BLOCKED';

    const executions = await this.prisma.architectureReviewerExecution.findMany({ where: { architectureReviewId } });
    const criticalReviewerFailed = executions.some((e) => REVIEWER_CRITICALITY[e.reviewerKey as ArchitectureReviewerKey] === 'CRITICAL' && e.status === 'FAILED_BLOCKING');
    const needsDecision = open.some((f) => f.severity === 'BLOCKER' || f.requiresUserDecision);
    if (criticalReviewerFailed || needsDecision) return 'REWORK_REQUIRED';
    return 'APPROVED';
  }

  private routeReviewers(composition: ApprovedArchitectureComposition): ArchitectureReviewerKey[] {
    const blob = composition.proposals.flatMap((p) => [...p.security, ...p.communication, p.persistence ?? '']).join(' ').toLowerCase();
    const routed: ArchitectureReviewerKey[] = [...CORE_REVIEWERS];
    if (SECURITY_SIGNAL.test(blob)) routed.push('securityArchitect');
    return routed;
  }

  private buildContext(approvedSolution: ApprovedSolution, composition: ApprovedArchitectureComposition): string {
    return JSON.stringify(
      {
        selectedStacks: approvedSolution.selectedStacks,
        proposals: composition.proposals.map((p) => this.toProposalSummary(p)),
        conflicts: composition.conflicts,
      },
      null,
      2
    );
  }

  private toProposalSummary(p: StackArchitectureProposal) {
    return {
      stackKey: p.stackKey, deliveryTargetKind: p.deliveryTargetKind, architectureStyle: p.architectureStyle,
      modules: p.modules, boundaries: p.boundaries, dependencies: p.dependencies, persistence: p.persistence,
      security: p.security, communication: p.communication, buildStrategy: p.buildStrategy,
      testStrategy: p.testStrategy, deploymentStrategy: p.deploymentStrategy, risks: p.risks,
    };
  }

  /** "Ferramenta mede. Validator verifica." — nunca LLM para uma checagem mecânica. */
  private runDeterministicPolicies(composition: ApprovedArchitectureComposition): ReviewerFindingResult[] {
    const findings: ReviewerFindingResult[] = [];

    for (const p of composition.proposals) {
      if (!GENERATABLE_STACKS.has(p.stackKey)) {
        findings.push({
          code: 'STACK_NOT_GENERATABLE',
          severity: 'ADVISORY',
          finding: `O stack ${p.stackKey} (${p.deliveryTargetKind}) não é suportado pelo motor de geração real desta versão do LDCN OS (hoje só stack.typescript.nestjs gera código real). A arquitetura pode ser aprovada normalmente, mas a geração de código para este alvo não estará disponível.`,
          recommendedResolutions: [],
          requiresUserDecision: false,
        });
      }
    }

    // CRITICAL já bloqueou antes de chegar aqui (core/ArchitectureValidator) — só LOW/MEDIUM/HIGH sobrevivem.
    for (const c of composition.conflicts) {
      findings.push({
        code: `CONFLICT_${c.topic.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`,
        severity: c.severity === 'HIGH' ? 'BLOCKER' : c.severity === 'MEDIUM' ? 'WARNING' : 'ADVISORY',
        finding: c.description,
        recommendedResolutions: c.resolution ? [c.resolution] : [],
        requiresUserDecision: c.severity === 'HIGH',
      });
    }

    return findings;
  }

  private completeWithTimeout(system: string, user: string): Promise<LlmCompletionResult> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('REVIEWER_TIMEOUT')), this.reviewerTimeoutMs);
      this.llm.complete({ system, user, responseFormat: 'json_object' }).then(
        (result) => { clearTimeout(timer); resolve(result); },
        (err) => { clearTimeout(timer); reject(err); }
      );
    });
  }

  private async executeReviewer(missionId: string, architectureReviewId: string, reviewerKey: ArchitectureReviewerKey, contextJson: string, executionId: string): Promise<void> {
    const startedAt = Date.now();
    const system = REVIEWER_PROMPTS[reviewerKey];
    const user = `Arquitetura a revisar (JSON):\n${contextJson}`;

    const promptSnapshotId = await this.ledger.snapshotPrompt({
      missionId,
      promptType: 'architecture.review',
      promptVersion: PROMPT_TEMPLATE_VERSION,
      contextForHash: { reviewerKey, contextJson },
      system,
      user,
      refs: { architectureReviewId, reviewerKey },
    });
    const invocationId = await this.ledger.startInvocation({
      missionId,
      architectureReviewerExecutionId: executionId,
      purpose: 'architecture.review',
      promptSnapshotId,
    });

    try {
      const result = await this.completeWithTimeout(system, user);
      await this.ledger.completeInvocation(invocationId, {
        provider: 'deepseek',
        model: result.model,
        inputTokens: result.promptTokens,
        outputTokens: result.completionTokens,
      });

      const parsed = this.parseJson<{ findings: ReviewerFindingResult[] }>(result.text);
      if (!parsed || !Array.isArray(parsed.findings)) {
        await this.persistExecution(executionId, missionId, architectureReviewId, reviewerKey, 'DEGRADED', Date.now() - startedAt, 'REVIEWER_MALFORMED_RESPONSE', 0);
        return;
      }
      let findingCount = 0;
      for (const f of parsed.findings) {
        if (!f.code || !f.severity || !f.finding) continue;
        await this.persistFinding(missionId, architectureReviewId, reviewerKey, f);
        findingCount++;
      }
      await this.persistExecution(executionId, missionId, architectureReviewId, reviewerKey, 'PASSED', Date.now() - startedAt, null, findingCount);
    } catch (err) {
      const errorCode = err instanceof Error && err.message === 'REVIEWER_TIMEOUT' ? 'REVIEWER_TIMEOUT' : 'REVIEWER_AI_UNAVAILABLE';
      await this.ledger.failInvocation(invocationId, errorCode);
      const criticality = REVIEWER_CRITICALITY[reviewerKey];
      await this.persistExecution(executionId, missionId, architectureReviewId, reviewerKey, criticality === 'CRITICAL' ? 'FAILED_BLOCKING' : 'DEGRADED', Date.now() - startedAt, errorCode, 0);
    }
  }

  private async persistFinding(missionId: string, architectureReviewId: string, reviewerKey: string, f: ReviewerFindingResult): Promise<void> {
    await this.prisma.architectureReviewFinding.create({
      data: {
        id: randomUUID(), missionId, architectureReviewId, reviewerKey, code: f.code, severity: f.severity,
        finding: f.finding, recommendedResolutionsJson: f.recommendedResolutions ?? [], requiresUserDecision: f.requiresUserDecision ?? false,
      },
    });
  }

  private async persistExecution(id: string, missionId: string, architectureReviewId: string, reviewerKey: string, status: ReviewerExecutionStatus, latencyMs: number, errorCode: string | null, findingCount: number): Promise<void> {
    const now = new Date();
    await this.prisma.architectureReviewerExecution.create({
      data: {
        id, missionId, architectureReviewId, reviewerKey, status, findingCount, latencyMs, errorCode,
        attemptCount: 1, startedAt: new Date(now.getTime() - latencyMs), finishedAt: now,
      },
    });
  }

  private parseJson<T>(text: string): T | null {
    try {
      const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '');
      return JSON.parse(cleaned) as T;
    } catch {
      return null;
    }
  }
}

export { ALL_REVIEWER_KEYS };
