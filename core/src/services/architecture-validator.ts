import { generateId } from '../utils/id';
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
