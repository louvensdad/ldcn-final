import { RepositoryInspectionResult } from './repository-inspector';

export type DuplicateValidationStatus =
  | 'PASS'
  | 'MODIFY_REQUIRED'
  | 'REUSE_REQUIRED'
  | 'DUPLICATE_ARTIFACT_DETECTED'
  | 'REPOSITORY_INDEX_DRIFT'
  | 'MODIFY_TARGET_NOT_FOUND'
  | 'REUSE_TARGET_NOT_FOUND';

export interface DuplicateValidationFinding {
  path: string;
  operation: string;
  code: Exclude<DuplicateValidationStatus, 'PASS'>;
  candidatePaths: string[];
  reason: string;
}

export interface DuplicateValidationResult {
  status: DuplicateValidationStatus;
  findings: DuplicateValidationFinding[];
}

/** Puro e determinístico: RepositoryInspector coleta fatos; esta classe somente aplica policy. */
export class DuplicateValidator {
  validate(inspections: RepositoryInspectionResult[]): DuplicateValidationResult {
    const findings: DuplicateValidationFinding[] = [];
    for (const inspection of inspections) {
      const candidatePaths = inspection.candidateArtifacts.map((candidate) => candidate.path).sort();
      if (inspection.operation === 'NO_CHANGE') continue;
      if (inspection.indexDrift.detected) {
        findings.push({ path: inspection.proposedPath, operation: inspection.operation, code: 'REPOSITORY_INDEX_DRIFT', candidatePaths, reason: inspection.indexDrift.reasons.join(', ') });
        continue;
      }
      if (inspection.operation === 'CREATE') {
        if (inspection.exactPathMatch || inspection.filesystemPathExists) {
          findings.push({ path: inspection.proposedPath, operation: inspection.operation, code: 'MODIFY_REQUIRED', candidatePaths: [inspection.proposedPath], reason: 'CREATE target already exists' });
        } else if (inspection.sameContentHashMatches.length > 0) {
          findings.push({ path: inspection.proposedPath, operation: inspection.operation, code: 'REUSE_REQUIRED', candidatePaths: inspection.sameContentHashMatches.map((candidate) => candidate.path).sort(), reason: 'identical content already exists' });
        } else if (inspection.exportMatches.length > 0 || inspection.symbolMatches.length > 0) {
          findings.push({ path: inspection.proposedPath, operation: inspection.operation, code: 'DUPLICATE_ARTIFACT_DETECTED', candidatePaths, reason: 'declared symbol or export already exists' });
        }
      } else if (inspection.operation === 'MODIFY') {
        if (!inspection.exactPathMatch && !inspection.filesystemPathExists) {
          findings.push({ path: inspection.proposedPath, operation: inspection.operation, code: 'MODIFY_TARGET_NOT_FOUND', candidatePaths: [], reason: 'MODIFY target does not exist' });
        }
      } else if (inspection.operation === 'REUSE') {
        if (!inspection.exactPathMatch || !inspection.filesystemPathExists) {
          findings.push({ path: inspection.proposedPath, operation: inspection.operation, code: 'REUSE_TARGET_NOT_FOUND', candidatePaths: [], reason: 'REUSE target does not exist in index and filesystem' });
        }
      }
    }

    const precedence: DuplicateValidationStatus[] = [
      'REPOSITORY_INDEX_DRIFT', 'MODIFY_TARGET_NOT_FOUND', 'REUSE_TARGET_NOT_FOUND',
      'MODIFY_REQUIRED', 'REUSE_REQUIRED', 'DUPLICATE_ARTIFACT_DETECTED',
    ];
    return { status: precedence.find((status) => findings.some((finding) => finding.code === status)) ?? 'PASS', findings };
  }
}
