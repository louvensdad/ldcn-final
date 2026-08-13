import { generateId } from '../utils/id';
import { createHash } from 'crypto';
import {
  ApprovedArchitectureComposition,
  ArchitectureCompositionInput,
} from '../domain/approved-architecture-composition';

export class ArchitectureValidator {
  private compositions: Map<string, ApprovedArchitectureComposition> = new Map();

  validateAndApprove(input: ArchitectureCompositionInput): ApprovedArchitectureComposition {
    const criticalConflicts = input.conflicts.filter((c) => c.severity === 'CRITICAL');
    if (criticalConflicts.length > 0) {
      throw new Error(
        `Architecture composition blocked by ${criticalConflicts.length} critical conflict(s)`
      );
    }

    const existing = this.compositions.get(input.missionId);
    if (existing && existing.status === 'APPROVED' && existing.approvedSolutionId === input.approvedSolutionId && JSON.stringify(existing.proposals.map((p) => [p.stackKey, p.architectureStyle])) === JSON.stringify(input.proposals.map((p) => [p.stackKey, p.architectureStyle]))) return existing;
    if (existing) {
      this.compositions.set(input.missionId, { ...existing, status: 'BLOCKED_BY_CONFLICT' });
    }

    const composition: ApprovedArchitectureComposition = {
      id: generateId(),
      missionId: input.missionId,
      version: existing ? existing.version + 1 : 1,
      approvedSolutionId: input.approvedSolutionId,
      proposals: input.proposals.map((p) => ({ ...p, status: 'APPROVED' as const })),
      conflicts: input.conflicts,
      contextHash: createHash('sha256').update(JSON.stringify({ approvedSolutionId: input.approvedSolutionId, proposals: input.proposals.map((proposal) => proposal.id), conflicts: input.conflicts.map((conflict) => conflict.id) })).digest('hex'),
      status: 'APPROVED',
      approvedAt: new Date(),
    };

    this.compositions.set(input.missionId, composition);
    return composition;
  }

  getActive(missionId: string): ApprovedArchitectureComposition | undefined {
    const composition = this.compositions.get(missionId);
    return composition?.status === 'APPROVED' ? composition : undefined;
  }
}
