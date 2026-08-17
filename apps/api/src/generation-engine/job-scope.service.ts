import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { JobScope, JobScopeValidation, Prisma } from '@prisma/client';
import { PrismaService } from '../persistence/prisma.service';
import { canonicalHash } from './canonical-hash';
import { ScopeValidationResult, ScopeValidator, ScopeValidatorChangeInput } from './scope-validator';

export interface EnsureJobScopeInput {
  missionId: string;
  generationJobId: string;
  allowedPaths: string[];
  forbiddenPaths?: string[];
  allowedModules?: string[];
  allowedSymbols?: string[];
  requiredContracts?: string[];
  acceptanceCriteria?: string[];
}

/**
 * CORE-007 §2/§3/§14/§15/§16 — dono do contrato canônico de escopo (persistência) e do
 * ScopeValidator determinístico (puro). Nenhum método de mutação além da criação inicial é
 * exposto — "scope usado por uma execução não muda silenciamente" (§17) porque não existe
 * caminho de escrita nenhum além de `ensureJobScope()`, que é idempotente (get-or-create).
 */
@Injectable()
export class JobScopeService {
  private readonly validator = new ScopeValidator();

  constructor(private readonly prisma: PrismaService) {}

  /** Idempotente: um JobScope por GenerationJob. Nunca sobrescreve um scope já persistido —
   * reexecuções retornam a linha existente intacta (doc §17). */
  async ensureJobScope(input: EnsureJobScopeInput): Promise<JobScope> {
    const existing = await this.prisma.jobScope.findUnique({ where: { generationJobId: input.generationJobId } });
    if (existing) return existing;

    const scopeContent = {
      allowedPaths: input.allowedPaths,
      allowedModules: input.allowedModules ?? [],
      allowedSymbols: input.allowedSymbols ?? [],
      forbiddenPaths: input.forbiddenPaths ?? [],
      requiredContracts: input.requiredContracts ?? [],
      acceptanceCriteria: input.acceptanceCriteria ?? [],
    };
    const scopeHash = canonicalHash(scopeContent);

    return this.prisma.jobScope.create({
      data: {
        id: randomUUID(),
        missionId: input.missionId,
        generationJobId: input.generationJobId,
        version: 1,
        allowedPathsJson: scopeContent.allowedPaths as Prisma.InputJsonValue,
        allowedModulesJson: scopeContent.allowedModules as Prisma.InputJsonValue,
        allowedSymbolsJson: scopeContent.allowedSymbols as Prisma.InputJsonValue,
        forbiddenPathsJson: scopeContent.forbiddenPaths as Prisma.InputJsonValue,
        requiredContractsJson: scopeContent.requiredContracts as Prisma.InputJsonValue,
        acceptanceCriteriaJson: scopeContent.acceptanceCriteria as Prisma.InputJsonValue,
        scopeHash,
      },
    });
  }

  async getJobScope(generationJobId: string): Promise<JobScope | null> {
    return this.prisma.jobScope.findUnique({ where: { generationJobId } });
  }

  /** §5 — defesa explícita: "sem scope = tudo permitido" nunca é uma leitura válida. O caminho
   * de produção (`attemptStructuredJob`) sempre chama `ensureJobScope` antes de summon, então
   * nunca chega a precisar disto na prática — mas qualquer chamador futuro que tente validar um
   * ChangeSet sem ter garantido um scope primeiro é bloqueado aqui, nunca silenciosamente. */
  async requireJobScope(generationJobId: string): Promise<JobScope> {
    const scope = await this.getJobScope(generationJobId);
    if (!scope) throw new Error('JOB_SCOPE_REQUIRED');
    return scope;
  }

  /**
   * Valida um ChangeSet completo contra o JobScope persistido de um Job, e SEMPRE persiste a
   * evidência (§15) antes de retornar — PASS ou SCOPE_VIOLATION, nunca silencioso.
   */
  async validateAndRecord(input: {
    missionId: string;
    generationJobId: string;
    agentExecutionId?: string;
    jobScope: JobScope;
    changes: ScopeValidatorChangeInput[];
  }): Promise<{ result: ScopeValidationResult; evidence: JobScopeValidation }> {
    const result = this.validator.validate(
      {
        allowedPaths: input.jobScope.allowedPathsJson as unknown as string[],
        forbiddenPaths: input.jobScope.forbiddenPathsJson as unknown as string[],
      },
      input.changes
    );
    const changeSetHash = canonicalHash(input.changes);

    const evidence = await this.prisma.jobScopeValidation.create({
      data: {
        id: randomUUID(),
        missionId: input.missionId,
        generationJobId: input.generationJobId,
        agentExecutionId: input.agentExecutionId ?? null,
        jobScopeId: input.jobScope.id,
        scopeHash: input.jobScope.scopeHash,
        changeSetHash,
        status: result.status,
        findingsJson: result.findings as unknown as Prisma.InputJsonValue,
      },
    });

    return { result, evidence };
  }
}
