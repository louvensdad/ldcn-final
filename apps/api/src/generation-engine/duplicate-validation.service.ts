import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { DuplicateValidation, JobScope, Prisma } from '@prisma/client';
import { PrismaService } from '../persistence/prisma.service';
import { canonicalHash } from './canonical-hash';
import { DuplicateValidationResult, DuplicateValidator } from './duplicate-validator';
import { ProposedRepositoryChange, RepositoryInspectionResult, RepositoryInspector } from './repository-inspector';

@Injectable()
export class DuplicateValidationService {
  private readonly validator = new DuplicateValidator();

  constructor(private readonly prisma: PrismaService, private readonly inspector: RepositoryInspector) {}

  async inspectValidateAndRecord(input: {
    missionId: string;
    generationJobId: string;
    agentExecutionId?: string;
    jobScope: JobScope;
    changes: ProposedRepositoryChange[];
  }): Promise<{ inspections: RepositoryInspectionResult[]; result: DuplicateValidationResult; evidence: DuplicateValidation }> {
    const inspections: RepositoryInspectionResult[] = [];
    for (const proposedChange of input.changes) {
      inspections.push(await this.inspector.inspect({ ...input, proposedChange }));
    }
    const result = this.validator.validate(inspections);
    const changeSetHash = canonicalHash(input.changes.map((change) => ({
      operation: change.operation,
      path: change.path,
      contentHash: change.content === undefined ? null : canonicalHash(change.content),
    })));
    const inspectionHash = canonicalHash(inspections.map((inspection) => inspection.inspectionHash));
    const repositoryFingerprint = canonicalHash([...new Set(inspections.map((inspection) => inspection.repositoryFingerprint))].sort());
    const candidateRefs = inspections.flatMap((inspection) => inspection.candidateArtifacts.map((candidate) => ({
      proposedPath: inspection.proposedPath,
      artifactId: candidate.artifactId,
      path: candidate.path,
      hash: candidate.hash,
      symbols: candidate.symbols,
      exports: candidate.exports,
      signals: candidate.signals,
    })));
    const safeInspections = inspections.map((inspection) => ({
      proposedPath: inspection.proposedPath,
      operation: inspection.operation,
      proposedContentHash: inspection.proposedContentHash,
      proposedSymbols: inspection.proposedSymbols,
      filesystemPathExists: inspection.filesystemPathExists,
      indexDrift: inspection.indexDrift,
      coverage: inspection.coverage,
      inspectionHash: inspection.inspectionHash,
      candidateCount: inspection.candidateArtifacts.length,
    }));
    const evidence = await this.prisma.duplicateValidation.create({
      data: {
        id: randomUUID(),
        missionId: input.missionId,
        generationJobId: input.generationJobId,
        agentExecutionId: input.agentExecutionId ?? null,
        changeSetHash,
        inspectionHash,
        repositoryFingerprint,
        status: result.status,
        findingsJson: result.findings as unknown as Prisma.InputJsonValue,
        candidateRefsJson: candidateRefs as unknown as Prisma.InputJsonValue,
        coverageJson: inspections.map((inspection) => ({ path: inspection.proposedPath, ...inspection.coverage })) as unknown as Prisma.InputJsonValue,
        inspectionsJson: safeInspections as unknown as Prisma.InputJsonValue,
      },
    });
    return { inspections, result, evidence };
  }
}
