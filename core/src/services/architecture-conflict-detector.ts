import { generateId } from '../utils/id';
import { ArchitectureConflict } from '../domain/approved-architecture-composition';
import { StackArchitectureProposal } from '../domain/stack-architecture-proposal';

export class ArchitectureConflictDetector {
  detect(proposals: StackArchitectureProposal[]): ArchitectureConflict[] {
    const conflicts: ArchitectureConflict[] = [];

    conflicts.push(...this.detectStyleConflicts(proposals));
    conflicts.push(...this.detectCommunicationConflicts(proposals));
    conflicts.push(...this.detectPersistenceConflicts(proposals));

    return conflicts;
  }

  private detectStyleConflicts(proposals: StackArchitectureProposal[]): ArchitectureConflict[] {
    const conflicts: ArchitectureConflict[] = [];

    const microservices = proposals.filter((p) => p.architectureStyle === 'microservices');
    const monoliths = proposals.filter((p) => p.architectureStyle !== 'microservices');

    if (microservices.length > 0 && monoliths.length > 0) {
      conflicts.push({
        id: generateId(),
        severity: 'HIGH',
        topic: 'architecture-style',
        description:
          'Some stacks propose microservices while others propose monolithic styles. Mission-wide consistency should be reviewed.',
        involvedStacks: [...microservices.map((p) => p.stackKey), ...monoliths.map((p) => p.stackKey)],
      });
    }

    return conflicts;
  }

  private detectCommunicationConflicts(proposals: StackArchitectureProposal[]): ArchitectureConflict[] {
    const conflicts: ArchitectureConflict[] = [];

    const restStacks = proposals.filter((p) =>
      p.communication.some((c) => c.toLowerCase().includes('rest'))
    );
    const graphqlStacks = proposals.filter((p) =>
      p.communication.some((c) => c.toLowerCase().includes('graphql'))
    );

    if (restStacks.length > 0 && graphqlStacks.length > 0) {
      conflicts.push({
        id: generateId(),
        severity: 'MEDIUM',
        topic: 'communication-protocol',
        description:
          'Mixed REST and GraphQL communication styles across stacks. Integration contract must decide the canonical protocol.',
        involvedStacks: [...restStacks.map((p) => p.stackKey), ...graphqlStacks.map((p) => p.stackKey)],
      });
    }

    return conflicts;
  }

  private detectPersistenceConflicts(proposals: StackArchitectureProposal[]): ArchitectureConflict[] {
    const conflicts: ArchitectureConflict[] = [];

    const perServiceDb = proposals.filter((p) =>
      p.persistence?.toLowerCase().includes('per-service')
    );
    const sharedDb = proposals.filter((p) =>
      p.persistence?.toLowerCase().includes('single') || p.persistence?.toLowerCase().includes('relational database')
    );

    if (perServiceDb.length > 0 && sharedDb.length > 0) {
      conflicts.push({
        id: generateId(),
        severity: 'HIGH',
        topic: 'data-ownership',
        description:
          'Some stacks use per-service databases while others use a shared database. Data ownership and consistency model must be aligned.',
        involvedStacks: [...perServiceDb.map((p) => p.stackKey), ...sharedDb.map((p) => p.stackKey)],
      });
    }

    return conflicts;
  }
}
