import { Injectable } from '@nestjs/common';
import { PrismaService } from '../persistence/prisma.service';
import { ArtifactContext, ContextLoadInput, LoadedContext } from './types';

const SENSITIVE_FIELD_NAMES = new Set([
  'apikey', 'api_key', 'access_token', 'accesstoken', 'token', 'password', 'passwd',
  'authorization', 'credential', 'credentials', 'secret', 'client_secret', 'clientsecret',
]);

const CREDENTIAL_VALUE_PATTERNS = [
  /^bearer\s+\S+/i,
  /^eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/,
  /^(?:gh[pousr]_|github_pat_|sk-|AKIA)[A-Za-z0-9_\-]{8,}$/,
];

/**
 * CORE-003 §3/§4/§5. Carrega o CONTEXTO MÍNIMO SUFICIENTE para um Job + AgentDefVersion — nunca
 * a Mission inteira, nunca outros Jobs, nunca outras stacks, nunca credentials/EventLog/logs
 * completos. Fonte de dados é o pipeline REAL já persistido (GenerationJob/Requirement/
 * GeneratedArtifact/ArchitectureReview/DiscoveryConversation) — não o pipeline em memória de
 * ApprovedSolution/RequirementsContract do core/ (nunca persistido, auditoria CORE-003 §H/§M).
 */
@Injectable()
export class ContextLoaderService {
  constructor(private readonly prisma: PrismaService) {}

  async load(input: ContextLoadInput): Promise<LoadedContext> {
    const job = await this.prisma.generationJob.findUnique({ where: { id: input.jobId } });
    if (!job) throw new Error('CONTEXT_JOB_NOT_FOUND');

    // Invariante crítica (§5): Mission isolation. Mesmo que os ids tenham sido passados
    // manualmente, um Job de outra Mission nunca vaza contexto para esta.
    if (job.missionId !== input.missionId) throw new Error('CONTEXT_MISSION_MISMATCH');

    const requirement = await this.prisma.requirement.findUnique({ where: { id: job.requirementId } });
    if (!requirement || requirement.missionId !== input.missionId) throw new Error('CONTEXT_MISSION_MISMATCH');

    const discovery = await this.prisma.discoveryConversation.findUnique({ where: { missionId: input.missionId } });
    const architectureReview = await this.prisma.architectureReview.findFirst({
      where: { missionId: input.missionId },
      orderBy: [{ reviewMode: 'desc' }, { updatedAt: 'desc' }],
    });
    const jobScopeRow = await this.prisma.jobScope.findUnique({ where: { generationJobId: job.id } });

    // Prioridade 1 do §16 apenas (target artifact do Job) — não carrega repositório inteiro,
    // nem required contracts/dependências/símbolos relacionados (fora de escopo desta CORE).
    const targetArtifacts = await this.prisma.generatedArtifact.findMany({
      where: { missionId: input.missionId, path: job.targetFile },
      orderBy: { version: 'desc' },
      take: 1,
    });

    const context: LoadedContext = {
      missionId: input.missionId,
      jobId: input.jobId,
      mission: discovery
        ? { available: true, missionId: input.missionId, purpose: discovery.goal ?? discovery.interpretedIntent, domain: discovery.domain, goal: discovery.goal }
        : { available: false, reason: 'DiscoveryConversation não existe para esta Mission.' },
      requirements: [
        { id: requirement.id, section: requirement.section, content: requirement.content, status: requirement.status },
      ],
      approvedSolution: architectureReview
        ? { available: true, approvedSolutionId: architectureReview.approvedSolutionId, architectureCompositionId: architectureReview.architectureCompositionId, status: architectureReview.status }
        : { available: false, reason: 'ArchitectureReview não existe para esta Mission (ApprovedSolution do core/ não é persistida hoje — auditoria CORE-003 §H).' },
      architecture: architectureReview
        ? { available: true, approvedSolutionId: architectureReview.approvedSolutionId, architectureCompositionId: architectureReview.architectureCompositionId, status: architectureReview.status }
        : { available: false, reason: 'ArchitectureReview não existe para esta Mission.' },
      job: {
        id: job.id,
        requirementId: job.requirementId,
        requirementText: job.requirementText,
        targetResource: job.targetResource,
        targetFile: job.targetFile,
        status: job.status,
        attemptCount: job.attemptCount,
        firstAttemptErrorCode: job.firstAttemptErrorCode,
      },
      // CORE-007 §3/§18: mesmo scope canônico que o ScopeValidator vai aplicar depois — nunca um
      // shape independente. Sem JobScope persistido (Jobs antigos/fixtures pré-CORE-007): cai
      // para o mínimo inferível [targetFile], nunca "**" (proibido pelo doc §4).
      jobScope: jobScopeRow
        ? {
            available: true,
            targetFile: job.targetFile,
            targetResource: job.targetResource,
            allowedPaths: jobScopeRow.allowedPathsJson as unknown as string[],
            forbiddenPaths: jobScopeRow.forbiddenPathsJson as unknown as string[],
            acceptanceCriteria: jobScopeRow.acceptanceCriteriaJson as unknown as string[],
            scopeHash: jobScopeRow.scopeHash,
          }
        : {
            available: true,
            targetFile: job.targetFile,
            targetResource: job.targetResource,
            allowedPaths: [job.targetFile],
            forbiddenPaths: [],
            acceptanceCriteria: [],
            scopeHash: null,
          },
      artifacts: targetArtifacts.map(
        (a): ArtifactContext => ({ id: a.id, path: a.path, target: a.target, hash: a.hash, version: a.version, symbols: a.symbolsJson as unknown[] })
      ),
      contracts: { available: false, reason: 'Nenhum Contract registry existe hoje (auditoria CORE-003 §L) — não implementado nesta CORE.' },
      dependencyEvidence: [],
      policies: [],
    };

    this.assertNoCredentials(context);
    return context;
  }

  /** Defesa ativa (§30) — mesmo que nenhuma tabela de credential seja consultada aqui, o
   * contexto é escaneado antes de sair do loader. */
  private assertNoCredentials(context: LoadedContext): void {
    this.assertValueHasNoCredential(context);
  }

  /** Inspeciona a semântica de cada campo, nunca o JSON serializado. Assim, nomes de domínio
   * como `secrets/**` ou `password-reset.service.ts` continuam sendo apenas paths legítimos. */
  private assertValueHasNoCredential(value: unknown, key?: string): void {
    const normalizedKey = key?.toLowerCase().replace(/[^a-z0-9_]/g, '') ?? '';
    if (normalizedKey && SENSITIVE_FIELD_NAMES.has(normalizedKey)) {
      if (value !== null && value !== undefined && value !== '') {
        throw new Error(`CONTEXT_CREDENTIAL_NOT_ALLOWED: sensitive field "${key}" is not allowed in loaded context`);
      }
      return;
    }

    if (typeof value === 'string') {
      if (CREDENTIAL_VALUE_PATTERNS.some((pattern) => pattern.test(value.trim()))) {
        throw new Error('CONTEXT_CREDENTIAL_NOT_ALLOWED: credential-shaped value is not allowed in loaded context');
      }
      return;
    }

    if (Array.isArray(value)) {
      for (const item of value) this.assertValueHasNoCredential(item);
      return;
    }

    if (value && typeof value === 'object') {
      for (const [childKey, childValue] of Object.entries(value)) {
        this.assertValueHasNoCredential(childValue, childKey);
      }
    }
  }
}
