import { generateId } from '../utils/id';
import {
  ApprovedSolution,
  ApprovedSolutionInput,
  SelectedStack,
} from '../domain/approved-solution';
import { ApprovalPolicy } from '../policies/approval-policy';
import { SelectionMode } from '../domain/stack-selection';
import { createHash } from 'crypto';

export class ApprovedSolutionValidator {
  private approvedSolutions: Map<string, ApprovedSolution> = new Map();

  validateAndApprove(input: ApprovedSolutionInput): ApprovedSolution {
    const topology = input.topology;
    if (topology.status !== 'APPROVED') {
      throw new Error('Topology must be APPROVED');
    }

    const approvedTargets = topology.deliveryTargets.filter(
      (t) => t.status === 'APPROVED' || (t.status === 'PROPOSED' && t.required)
    );

    const requiredKinds = new Set(approvedTargets.map((t) => t.kind));
    const kindsRequiringStack = new Set(input.kindsRequiringStack ?? []);
    const selectedByKind = new Map<string, SelectedStack>();

    for (const selected of input.selectionProposal.selections) {
      if (!requiredKinds.has(selected.deliveryTargetKind as never)) {
        throw new Error(
          `Stack selected for non-approved target: ${selected.deliveryTargetKind}`
        );
      }
      if (selectedByKind.has(selected.deliveryTargetKind)) {
        throw new Error(
          `Duplicate stack selection for target: ${selected.deliveryTargetKind}`
        );
      }
      selectedByKind.set(selected.deliveryTargetKind, selected);
    }

    const approval = ApprovalPolicy.canApprove({
      mode: input.selectionProposal.mode,
      approvedExplicitly: input.approvedByPolicy ?? false,
      autoApproveAllowed: input.selectionProposal.mode === 'AUTO',
    });

    if (!approval.approvable) {
      throw new Error(`Solution not approvable: ${approval.reason}`);
    }

    for (const kind of requiredKinds) {
      if (kindsRequiringStack.has(kind as string) && !selectedByKind.has(kind as string)) {
        throw new Error(`Missing stack selection for required target: ${kind}`);
      }
    }

    const existing = this.approvedSolutions.get(input.missionId);
    if (existing && existing.status === 'ACTIVE' && existing.requirementsContractId === input.requirementsContractId && existing.selectionMode === input.selectionProposal.mode && JSON.stringify(existing.selectedStacks) === JSON.stringify(input.selectionProposal.selections) && existing.topology.contextHash === topology.contextHash) {
      return existing;
    }
    if (existing) {
      this.approvedSolutions.set(input.missionId, { ...existing, status: 'SUPERSEDED' });
    }

    const approvedSolution: ApprovedSolution = {
      id: generateId(),
      missionId: input.missionId,
      version: existing ? existing.version + 1 : 1,
      topology,
      deliveryTargets: approvedTargets,
      selectedStacks: input.selectionProposal.selections,
      selectionMode: input.selectionProposal.mode,
      requirementsContractId: input.requirementsContractId,
      complexityProfile: this.inferComplexity(approvedTargets),
      riskProfile: this.inferRisk(approvedTargets, input.selectionProposal.mode),
      approvedAt: new Date(),
      contextHash: createHash('sha256').update(JSON.stringify({ topologyId: topology.id, requirementsContractId: input.requirementsContractId, selections: input.selectionProposal.selections.map((selection) => [selection.deliveryTargetKind, selection.stackKey]) })).digest('hex'),
      status: 'ACTIVE',
    };

    this.approvedSolutions.set(input.missionId, approvedSolution);
    return approvedSolution;
  }

  getActive(missionId: string): ApprovedSolution | undefined {
    const solution = this.approvedSolutions.get(missionId);
    return solution?.status === 'ACTIVE' ? solution : undefined;
  }

  private inferComplexity(targets: { kind: string }[]): string {
    if (targets.length <= 1) return 'LOW';
    if (targets.length <= 3) return 'MEDIUM';
    return 'HIGH';
  }

  private inferRisk(targets: { kind: string }[], mode: SelectionMode): string {
    const base = targets.length > 2 ? 'HIGH' : targets.length > 1 ? 'MEDIUM' : 'LOW';
    if (mode === 'GUIDED') return `${base} (approval required)`;
    return base;
  }
}
