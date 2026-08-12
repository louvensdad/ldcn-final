import {
  ApprovedSolution,
  IntentInput,
  ProjectIntent,
  RequirementsContract,
  SelectionMode,
  SolutionProposal,
  SolutionTopology,
  StackSelectionProposal,
} from './domain';
import { StackRegistry } from './registry/stack-registry';
import {
  ApprovedSolutionValidator,
  IntentAnalyzer,
  RequirementsIntelligence,
  SolutionPlanner,
  TechnologySelector,
  TopologyResolver,
} from './services';

export interface GeneratorConfig {
  mode?: SelectionMode;
  autoApprove?: boolean;
  fixedSelections?: Record<string, string>;
}

export interface GenerationResult {
  intent: ProjectIntent;
  contract: RequirementsContract;
  topology: SolutionTopology;
  proposal: SolutionProposal;
  selection: StackSelectionProposal;
  approvedSolution: ApprovedSolution;
}

export class Generator {
  private intentAnalyzer = new IntentAnalyzer();
  private requirements = new RequirementsIntelligence();
  private topologyResolver = new TopologyResolver();
  private solutionPlanner = new SolutionPlanner();
  private technologySelector = new TechnologySelector();
  private approvedSolutionValidator = new ApprovedSolutionValidator();
  private registry = new StackRegistry();

  constructor(private config: GeneratorConfig = {}) {}

  generate(input: IntentInput): GenerationResult {
    const mode = this.config.mode ?? 'AUTO';

    const intent = this.intentAnalyzer.analyze(input);
    const contractDraft = this.requirements.buildContract(intent);
    const contract = this.requirements.approve(contractDraft);

    const topologyProposed = this.topologyResolver.resolve({
      contract,
      forbiddenTargets: intent.forbiddenDeliveryTargets,
    });
    const topology = this.topologyResolver.approve(topologyProposed);

    const proposal = this.solutionPlanner.plan({ contract, topology });

    const selection = this.technologySelector.select({
      contract,
      topology,
      registry: this.registry,
      mode,
      fixedSelections: this.config.fixedSelections,
    });

    const kindsRequiringStack = Array.from(
      new Set(this.registry.list().flatMap((s) => s.deliveryTargetKinds))
    );

    const approvedSolution = this.approvedSolutionValidator.validateAndApprove({
      missionId: input.missionId,
      topology,
      selectionProposal: {
        mode,
        selections: selection.selections
          .filter((s) => s.selectedStackKey)
          .map((s) => ({
            deliveryTargetKind: s.deliveryTargetKind,
            stackKey: s.selectedStackKey!,
            rationale: s.rationale,
          })),
      },
      requirementsContractId: contract.id,
      approvedByPolicy: mode === 'AUTO' || this.config.autoApprove,
      kindsRequiringStack,
    });

    return {
      intent,
      contract,
      topology,
      proposal,
      selection,
      approvedSolution,
    };
  }
}
