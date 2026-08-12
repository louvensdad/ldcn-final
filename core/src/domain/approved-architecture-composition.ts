import { StackArchitectureProposal } from './stack-architecture-proposal';
import { VersionedEntity } from './shared';

export interface ArchitectureConflict {
  id: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  topic: string;
  description: string;
  involvedStacks: string[];
  resolution?: string;
}

export interface ApprovedArchitectureComposition extends VersionedEntity {
  approvedSolutionId: string;
  proposals: StackArchitectureProposal[];
  conflicts: ArchitectureConflict[];
  status: 'APPROVED' | 'BLOCKED_BY_CONFLICT';
  approvedAt?: Date;
}

export interface ArchitectureCompositionInput {
  missionId: string;
  approvedSolutionId: string;
  proposals: StackArchitectureProposal[];
  conflicts: ArchitectureConflict[];
}
