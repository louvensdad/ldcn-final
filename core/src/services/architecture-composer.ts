import { generateId } from '../utils/id';
import {
  ApprovedArchitectureComposition,
  ArchitectureConflict,
} from '../domain/approved-architecture-composition';
import { ApprovedSolution } from '../domain/approved-solution';
import { RequirementsContract } from '../domain/requirements-contract';
import { StackArchitectureProposal } from '../domain/stack-architecture-proposal';
import { StackRegistry } from '../registry/stack-registry';
import { ArchitectureConflictDetector } from './architecture-conflict-detector';
import { StackArchitect } from './stack-architect';
import { createHash } from 'crypto';

export interface ArchitectureComposerInput {
  approvedSolution: ApprovedSolution;
  contract: RequirementsContract;
  registry: StackRegistry;
}

export class ArchitectureComposer {
  private stackArchitect = new StackArchitect();
  private conflictDetector = new ArchitectureConflictDetector();

  compose(input: ArchitectureComposerInput): ApprovedArchitectureComposition {
    const proposals: StackArchitectureProposal[] = [];

    const uniqueSelections = [...new Map(input.approvedSolution.selectedStacks.map((selection) => [selection.stackKey, selection])).values()];
    for (const selectedStack of uniqueSelections) {
      const stackDefinition = input.registry.get(selectedStack.stackKey);
      if (!stackDefinition) {
        throw new Error(`Stack ${selectedStack.stackKey} not found in registry`);
      }

      const proposal = this.stackArchitect.design({
        approvedSolution: input.approvedSolution,
        selectedStack,
        stackDefinition,
        contract: input.contract,
      });

      proposals.push(proposal);
    }

    const conflicts = this.conflictDetector.detect(proposals);
    const hasCritical = conflicts.some((c) => c.severity === 'CRITICAL');

    return {
      id: generateId(),
      missionId: input.approvedSolution.missionId,
      version: 1,
      approvedSolutionId: input.approvedSolution.id,
      proposals,
      conflicts,
      contextHash: createHash('sha256').update(JSON.stringify({ approvedSolutionId: input.approvedSolution.id, proposals: proposals.map((proposal) => [proposal.stackKey, proposal.architectureStyle]), conflicts: conflicts.map((conflict) => [conflict.severity, conflict.topic]) })).digest('hex'),
      status: hasCritical ? 'BLOCKED_BY_CONFLICT' : 'APPROVED',
      approvedAt: hasCritical ? undefined : new Date(),
    };
  }

  detectConflicts(proposals: StackArchitectureProposal[]): ArchitectureConflict[] {
    return this.conflictDetector.detect(proposals);
  }
}
