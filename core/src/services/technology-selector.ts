import { generateId } from '../utils/id';
import { RequirementsContract } from '../domain/requirements-contract';
import { SolutionTopology } from '../domain/solution-topology';
import {
  SelectionMode,
  StackCandidateEvaluation,
  StackSelectionProposal,
  TargetStackSelection,
} from '../domain/stack-selection';
import { StackDefinition, StackRegistry } from '../registry/stack-registry';

export interface TechnologySelectorInput {
  contract: RequirementsContract;
  topology: SolutionTopology;
  registry: StackRegistry;
  mode: SelectionMode;
  fixedSelections?: Record<string, string>;
  userConstraints?: string[];
}

export class TechnologySelector {
  select(input: TechnologySelectorInput): StackSelectionProposal {
    if (input.topology.status !== 'APPROVED') {
      throw new Error('SolutionTopology must be APPROVED before stack selection');
    }

    const approvedTargets = input.topology.deliveryTargets.filter(
      (t) => t.status === 'APPROVED' || (t.status === 'PROPOSED' && t.required)
    );

    const selections: TargetStackSelection[] = approvedTargets.map((target) => {
      const candidates = input.registry
        .findByDeliveryTarget(target.kind)
        .map((stack) => this.evaluateStack(stack, input));

      candidates.sort((a, b) => b.fitScore - a.fitScore);

      let selected: string | undefined;
      if (input.mode === 'FIXED' && input.fixedSelections?.[target.kind]) {
        selected = input.fixedSelections[target.kind];
      } else if (input.mode === 'AUTO' && candidates.length > 0) {
        selected = candidates[0].stackKey;
      }

      return {
        deliveryTargetKind: target.kind,
        candidates,
        selectedStackKey: selected,
        rationale: this.buildRationale(target.kind, candidates, input.mode),
      };
    });

    return {
      id: generateId(),
      missionId: input.contract.missionId,
      version: 1,
      mode: input.mode,
      selections,
    };
  }

  private evaluateStack(
    stack: StackDefinition,
    input: TechnologySelectorInput
  ): StackCandidateEvaluation {
    let score = 0.5;

    if (stack.runtimeSupport) score += 0.1;
    if (input.contract.items.some((i) => i.category === 'scale') && stack.strengths.includes('scalable')) {
      score += 0.1;
    }
    if (input.contract.items.some((i) => i.category === 'timeToMarket') && stack.strengths.includes('fast')) {
      score += 0.1;
    }
    if (input.userConstraints?.some((c) => stack.name.toLowerCase().includes(c.toLowerCase()))) {
      score += 0.15;
    }
    if (stack.strengths.includes('ecosystem')) score += 0.05;

    return {
      stackKey: stack.key,
      fitScore: Math.min(1.0, parseFloat(score.toFixed(2))),
      requirementsCoverage: stack.deliveryTargetKinds,
      strengths: stack.strengths,
      tradeoffs: stack.tradeoffs,
      risks: ['Pode exigir especialistas disponíveis'],
      rejectedBecause: [],
      constraintsSatisfied: [],
      runtimeSupport: stack.runtimeSupport,
    };
  }

  private buildRationale(
    kind: string,
    candidates: StackCandidateEvaluation[],
    mode: SelectionMode
  ): string {
    if (candidates.length === 0) return `Nenhuma stack disponível para ${kind}.`;
    const top = candidates[0];
    if (mode === 'GUIDED') {
      return `Recomendação: ${top.stackKey} (fit ${top.fitScore}). Aguardando aprovação.`;
    }
    if (mode === 'AUTO') {
      return `Seleção automática: ${top.stackKey} (fit ${top.fitScore}).`;
    }
    return `Seleção fixa para ${kind}.`;
  }
}
