import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { JobScope } from '@prisma/client';
import { PrismaService } from '../persistence/prisma.service';
import { canonicalHash } from './canonical-hash';
import { ChangeOperation } from './scope-validator';
import { normalizeScopePath } from './scope-path';
import { WorkspaceService } from './workspace.service';

export interface ProposedRepositoryChange {
  operation: ChangeOperation;
  path: string;
  content?: string;
}

/** Extração deliberadamente conservadora; não pretende ser parser/AST ou busca semântica. */
export function extractDeclaredExports(content: string): string[] {
  const symbols = new Set<string>();
  const pattern = /\bexport\s+(?:default\s+)?(?:abstract\s+)?(?:class|interface|function|const|let|var|type|enum)\s+([A-Za-z_$][\w$]*)/g;
  for (const match of content.matchAll(pattern)) symbols.add(match[1]);
  return [...symbols].sort();
}

export interface RepositoryCandidateRef {
  artifactId: string | null;
  path: string;
  hash: string | null;
  symbols: string[];
  exports: string[];
  signals: Array<'EXACT_PATH' | 'CONTENT_HASH' | 'SYMBOL' | 'EXPORT' | 'TARGET_RESOURCE' | 'FILESYSTEM'>;
}

export interface RepositoryInspectionResult {
  proposedPath: string;
  operation: ChangeOperation;
  proposedContentHash: string | null;
  proposedSymbols: string[];
  exactPathMatch: RepositoryCandidateRef | null;
  filesystemPathExists: boolean;
  sameContentHashMatches: RepositoryCandidateRef[];
  symbolMatches: RepositoryCandidateRef[];
  exportMatches: RepositoryCandidateRef[];
  resourceMatches: RepositoryCandidateRef[];
  candidateArtifacts: RepositoryCandidateRef[];
  indexDrift: { detected: boolean; reasons: string[] };
  coverage: {
    exactPath: 'ENFORCED';
    contentHash: 'ENFORCED' | 'NOT_AVAILABLE';
    symbols: 'ENFORCED' | 'NOT_AVAILABLE';
    exports: 'ENFORCED' | 'NOT_AVAILABLE';
    semantic: 'NOT_AVAILABLE';
  };
  repositoryFingerprint: string;
  inspectionHash: string;
}

interface IndexedArtifact {
  id: string;
  path: string;
  hash: string;
  symbols: string[];
  exports: string[];
  target: string;
}

@Injectable()
export class RepositoryInspector {
  constructor(private readonly prisma: PrismaService, private readonly workspace: WorkspaceService) {}

  async inspect(input: {
    missionId: string;
    generationJobId: string;
    proposedChange: ProposedRepositoryChange;
    jobScope: JobScope;
  }): Promise<RepositoryInspectionResult> {
    const normalized = normalizeScopePath(input.proposedChange.path);
    if (!normalized.ok) throw new Error('REPOSITORY_PATH_INVALID');

    const [rows, job, resourceJobs] = await Promise.all([
      this.prisma.generatedArtifact.findMany({
        where: { missionId: input.missionId },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        select: { id: true, path: true, hash: true, symbolsJson: true, exportsJson: true, target: true },
      }),
      this.prisma.generationJob.findUnique({ where: { id: input.generationJobId }, select: { missionId: true, targetResource: true } }),
      this.prisma.generationJob.findMany({
        where: { missionId: input.missionId, id: { not: input.generationJobId } },
        select: { targetResource: true, targetFile: true },
      }),
    ]);
    if (!job || job.missionId !== input.missionId) throw new Error('REPOSITORY_INSPECTION_MISSION_MISMATCH');

    const byPath = new Map<string, IndexedArtifact>();
    for (const row of rows) {
      const rowPath = normalizeScopePath(row.path);
      if (!rowPath.ok || byPath.has(rowPath.path)) continue;
      byPath.set(rowPath.path, {
        id: row.id,
        path: rowPath.path,
        hash: row.hash,
        symbols: this.stringArray(row.symbolsJson),
        exports: this.stringArray(row.exportsJson),
        target: row.target,
      });
    }
    const artifacts = [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path));
    const repositoryFingerprint = canonicalHash(artifacts.map((a) => ({
      id: a.id, path: a.path, hash: a.hash, symbols: [...a.symbols].sort(), exports: [...a.exports].sort(), target: a.target,
    })));
    const proposedContentHash = input.proposedChange.content === undefined ? null : this.contentHash(input.proposedChange.content);
    const proposedSymbols = extractDeclaredExports(input.proposedChange.content ?? '');
    const exactArtifact = byPath.get(normalized.path) ?? null;
    const exactFsPath = this.workspace.workspacePathFor(input.missionId) + '/' + normalized.path;
    const filesystemPathExists = await this.workspace.pathExists(exactFsPath);
    const driftReasons: string[] = [];

    if (filesystemPathExists !== Boolean(exactArtifact)) {
      driftReasons.push(filesystemPathExists ? 'FILESYSTEM_PATH_MISSING_FROM_INDEX' : 'INDEX_PATH_MISSING_FROM_FILESYSTEM');
    } else if (filesystemPathExists && exactArtifact) {
      const actualHash = this.contentHash(await this.workspace.readWorkspaceFile(input.missionId, normalized.path));
      if (actualHash !== exactArtifact.hash) driftReasons.push('INDEX_CONTENT_HASH_MISMATCH');
    }

    const sameHash = proposedContentHash
      ? artifacts.filter((a) => a.path !== normalized.path && a.hash === proposedContentHash)
      : [];
    const symbolMatches = proposedSymbols.length
      ? artifacts.filter((a) => a.path !== normalized.path && a.symbols.some((s) => proposedSymbols.includes(s)))
      : [];
    const exportMatches = proposedSymbols.length
      ? artifacts.filter((a) => a.path !== normalized.path && a.exports.some((s) => proposedSymbols.includes(s)))
      : [];
    const canonicalResource = this.canonicalResource(job.targetResource);
    const resourcePaths = new Set(resourceJobs
      .filter((candidate) => this.canonicalResource(candidate.targetResource) === canonicalResource)
      .map((candidate) => normalizeScopePath(candidate.targetFile))
      .filter((candidate): candidate is { ok: true; path: string } => candidate.ok)
      .map((candidate) => candidate.path));
    const resourceMatches = artifacts.filter((a) => a.path !== normalized.path && resourcePaths.has(a.path));

    const relevantDbCandidates = this.uniqueArtifacts([...(exactArtifact ? [exactArtifact] : []), ...sameHash, ...symbolMatches, ...exportMatches]);
    for (const candidate of relevantDbCandidates) {
      if (candidate.path === normalized.path) continue;
      const exists = await this.workspace.pathExists(this.workspace.workspacePathFor(input.missionId) + '/' + candidate.path);
      if (!exists) {
        driftReasons.push(`INDEX_CANDIDATE_MISSING_FROM_FILESYSTEM:${candidate.path}`);
        continue;
      }
      const actualHash = this.contentHash(await this.workspace.readWorkspaceFile(input.missionId, candidate.path));
      if (actualHash !== candidate.hash) driftReasons.push(`INDEX_CANDIDATE_HASH_MISMATCH:${candidate.path}`);
    }

    const signals = new Map<string, RepositoryCandidateRef>();
    const add = (artifact: IndexedArtifact, signal: RepositoryCandidateRef['signals'][number]): void => {
      const current = signals.get(artifact.path) ?? this.toCandidate(artifact);
      if (!current.signals.includes(signal)) current.signals.push(signal);
      signals.set(artifact.path, current);
    };
    if (exactArtifact) add(exactArtifact, 'EXACT_PATH');
    for (const artifact of sameHash) add(artifact, 'CONTENT_HASH');
    for (const artifact of symbolMatches) add(artifact, 'SYMBOL');
    for (const artifact of exportMatches) add(artifact, 'EXPORT');
    for (const artifact of resourceMatches) add(artifact, 'TARGET_RESOURCE');
    if (filesystemPathExists && !exactArtifact) {
      signals.set(normalized.path, { artifactId: null, path: normalized.path, hash: null, symbols: [], exports: [], signals: ['FILESYSTEM'] });
    }

    const resultWithoutHash = {
      proposedPath: normalized.path,
      operation: input.proposedChange.operation,
      proposedContentHash,
      proposedSymbols,
      exactPathMatch: exactArtifact ? this.toCandidate(exactArtifact, 'EXACT_PATH') : null,
      filesystemPathExists,
      sameContentHashMatches: sameHash.map((a) => this.toCandidate(a, 'CONTENT_HASH')),
      symbolMatches: symbolMatches.map((a) => this.toCandidate(a, 'SYMBOL')),
      exportMatches: exportMatches.map((a) => this.toCandidate(a, 'EXPORT')),
      resourceMatches: resourceMatches.map((a) => this.toCandidate(a, 'TARGET_RESOURCE')),
      candidateArtifacts: [...signals.values()].sort((a, b) => a.path.localeCompare(b.path)),
      indexDrift: { detected: driftReasons.length > 0, reasons: [...new Set(driftReasons)].sort() },
      coverage: {
        exactPath: 'ENFORCED' as const,
        contentHash: proposedContentHash ? 'ENFORCED' as const : 'NOT_AVAILABLE' as const,
        symbols: proposedSymbols.length ? 'ENFORCED' as const : 'NOT_AVAILABLE' as const,
        exports: proposedSymbols.length ? 'ENFORCED' as const : 'NOT_AVAILABLE' as const,
        semantic: 'NOT_AVAILABLE' as const,
      },
      repositoryFingerprint,
    };
    return { ...resultWithoutHash, inspectionHash: canonicalHash({ ...resultWithoutHash, scopeHash: input.jobScope.scopeHash }) };
  }

  private stringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  }

  private contentHash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  private canonicalResource(value: string): string {
    return value.trim().toLocaleLowerCase('en-US');
  }

  private uniqueArtifacts(artifacts: IndexedArtifact[]): IndexedArtifact[] {
    return [...new Map(artifacts.map((artifact) => [artifact.id, artifact])).values()];
  }

  private toCandidate(artifact: IndexedArtifact, signal?: RepositoryCandidateRef['signals'][number]): RepositoryCandidateRef {
    return { artifactId: artifact.id, path: artifact.path, hash: artifact.hash, symbols: artifact.symbols, exports: artifact.exports, signals: signal ? [signal] : [] };
  }
}
