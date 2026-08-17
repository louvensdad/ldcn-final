import {
  AgentTeam,
  MissionPipelinePlan,
  GovernanceCheck,
  ApprovedArchitectureComposition,
  ApprovedSolution,
  DeliveryTargetKind,
  GenerationReuseScope,
  GenerationScopeEscalation,
  IntentInput,
  ProjectIntent,
  RequirementsContract,
  SelectionMode,
  SolutionProposal,
  SolutionTopology,
  StackSelectionProposal,
} from './domain';
import { generateId } from './utils/id';
import { StackRegistry } from './registry/stack-registry';
import {
  ApprovedSolutionValidator,
  ArchitectureComposer,
  ArchitectureValidator,
  IntentAnalyzer,
  RequirementsIntelligence,
  SolutionPlanner,
  TeamComposer,
  TeamValidator,
  PipelineComposer,
  GovernanceGuard,
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
  architectureComposition: ApprovedArchitectureComposition;
  agentTeam: AgentTeam;
  pipeline: MissionPipelinePlan;
  governance: GovernanceCheck;
}

/** MISSÃO "Targeted Generation" — o mesmo `GenerationResult`, mais o que realmente foi
 * reaproveitado vs recomputado (nunca inferido depois, sempre o registro real de `generateTargeted`). */
export interface TargetedGenerationResult extends GenerationResult {
  actualReuse: GenerationReuseScope;
  escalations: GenerationScopeEscalation[];
}

export class Generator {
  private intentAnalyzer = new IntentAnalyzer();
  private requirements = new RequirementsIntelligence();
  private topologyResolver = new TopologyResolver();
  private solutionPlanner = new SolutionPlanner();
  private technologySelector = new TechnologySelector();
  private approvedSolutionValidator = new ApprovedSolutionValidator();
  private architectureComposer = new ArchitectureComposer();
  private architectureValidator = new ArchitectureValidator();
  private teamComposer = new TeamComposer();
  private teamValidator = new TeamValidator();
  private pipelineComposer = new PipelineComposer();
  private governanceGuard = new GovernanceGuard();
  private registry = new StackRegistry();

  constructor(private config: GeneratorConfig = {}) {}

  generate(input: IntentInput): GenerationResult {
    const mode = this.config.mode ?? 'AUTO';

    const intent = this.intentAnalyzer.analyze(input);
    const contractDraft = this.requirements.buildContract(intent);
    const contract = this.requirements.approve(contractDraft);

    const explicitTargets = this.config.fixedSelections
      ? (Object.keys(this.config.fixedSelections) as DeliveryTargetKind[])
      : undefined;

    const topologyProposed = this.topologyResolver.resolve({
      contract,
      forbiddenTargets: intent.forbiddenDeliveryTargets,
      explicitTargets,
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

    const compositionProposal = this.architectureComposer.compose({
      approvedSolution,
      contract,
      registry: this.registry,
    });

    const architectureComposition = this.architectureValidator.validateAndApprove({
      missionId: input.missionId,
      approvedSolutionId: approvedSolution.id,
      proposals: compositionProposal.proposals,
      conflicts: compositionProposal.conflicts,
    });

    const teamDraft = this.teamComposer.compose({
      approvedSolution,
      architectureComposition,
      contract,
      registry: this.registry,
    });

    const agentTeam = this.teamValidator.validateAndApprove({
      missionId: input.missionId,
      approvedSolutionId: approvedSolution.id,
      architectureCompositionId: architectureComposition.id,
      complexityProfile: approvedSolution.complexityProfile,
      riskProfile: approvedSolution.riskProfile,
      instances: teamDraft.instances,
      decisions: teamDraft.decisions,
    });

    const pipeline = this.pipelineComposer.compose({
      approvedSolution,
      architectureComposition,
      agentTeam,
      contract,
      registry: this.registry,
    });

    const governance = this.governanceGuard.check({
      intent,
      contract,
      topology,
      solution: approvedSolution,
      architecture: architectureComposition,
      team: agentTeam,
      pipeline,
    });

    return {
      intent,
      contract,
      topology,
      proposal,
      selection,
      approvedSolution,
      architectureComposition,
      agentTeam,
      pipeline,
      governance,
    };
  }

  /**
   * MISSÃO "Targeted Generation no Marketplace" — nunca duplica `generate()`: intent/requirements/
   * topology/proposal são SEMPRE recomputados do zero a partir do `input` (são exatamente a
   * personalização nova — reaproveitá-los seria produzir um PromptMaster híbrido). O que pode ser
   * reaproveitado são as decisões de PLANEJAMENTO já governadas de uma `reference` — stack,
   * arquitetura, equipe — passando pelos MESMOS validators reais (nunca copiadas sem checagem).
   * Se uma revalidação falhar, cai para o mesmo composer que `generate()` usaria — nunca finge um
   * reuso que não se sustenta (Fase 25 do brief, na forma real que este sistema pode provar).
   */
  generateTargeted(input: IntentInput, reference: GenerationResult, scope: GenerationReuseScope): TargetedGenerationResult {
    const mode = this.config.mode ?? 'AUTO';

    const intent = this.intentAnalyzer.analyze(input);
    const contractDraft = this.requirements.buildContract(intent);
    const contract = this.requirements.approve(contractDraft);

    const explicitTargets = this.config.fixedSelections
      ? (Object.keys(this.config.fixedSelections) as DeliveryTargetKind[])
      : undefined;

    const topologyProposed = this.topologyResolver.resolve({
      contract,
      forbiddenTargets: intent.forbiddenDeliveryTargets,
      explicitTargets,
    });
    const topology = this.topologyResolver.approve(topologyProposed);

    const proposal = this.solutionPlanner.plan({ contract, topology });

    const kindsRequiringStack = Array.from(
      new Set(this.registry.list().flatMap((s) => s.deliveryTargetKinds))
    );

    const escalations: GenerationScopeEscalation[] = [];
    const actualReuse: GenerationReuseScope = { reuseStackSelection: false, reuseArchitecture: false, reuseTeam: false };

    // --- Stack selection ---
    let selection: StackSelectionProposal;
    let approvedSolution: ApprovedSolution;
    if (scope.reuseStackSelection) {
      try {
        approvedSolution = this.approvedSolutionValidator.validateAndApprove({
          missionId: input.missionId,
          topology,
          selectionProposal: { mode: reference.approvedSolution.selectionMode, selections: reference.approvedSolution.selectedStacks },
          requirementsContractId: contract.id,
          approvedByPolicy: mode === 'AUTO' || this.config.autoApprove,
          kindsRequiringStack,
        });
        selection = this.rebind(reference.selection, input.missionId);
        actualReuse.reuseStackSelection = true;
      } catch (error) {
        escalations.push({ stage: 'STACK_SELECTION', reason: error instanceof Error ? error.message : String(error) });
        ({ selection, approvedSolution } = this.selectAndApproveFresh(input, contract, topology, mode, kindsRequiringStack));
      }
    } else {
      ({ selection, approvedSolution } = this.selectAndApproveFresh(input, contract, topology, mode, kindsRequiringStack));
    }

    // --- Architecture ---
    // As proposals reaproveitadas foram compostas para a stack selection ORIGINAL da referência —
    // reaproveitá-las só é válido quando o approvedSolution desta mission tem exatamente o mesmo
    // conteúdo (isto é, a própria stack selection também foi reaproveitada com sucesso). Se a
    // stack teve que escalar para recomputação, a arquitetura antiga referenciaria stacks que
    // podem não existir mais no approvedSolution novo — nunca reaproveitar às cegas aqui (foi
    // exatamente isto que um teste real pegou: "Architecture contains a stack outside
    // ApprovedSolution" no PipelineComposer, um crash tardio e opaco em vez de uma escalation clara).
    let architectureComposition: ApprovedArchitectureComposition;
    if (scope.reuseArchitecture && !actualReuse.reuseStackSelection) {
      escalations.push({ stage: 'ARCHITECTURE', reason: 'Stack selection escalou para recomputação — arquitetura reaproveitada da referência não seria mais válida para a stack nova.' });
    }
    if (scope.reuseArchitecture && actualReuse.reuseStackSelection) {
      try {
        architectureComposition = this.architectureValidator.validateAndApprove({
          missionId: input.missionId,
          approvedSolutionId: approvedSolution.id,
          proposals: reference.architectureComposition.proposals,
          conflicts: reference.architectureComposition.conflicts,
        });
        actualReuse.reuseArchitecture = true;
      } catch (error) {
        escalations.push({ stage: 'ARCHITECTURE', reason: error instanceof Error ? error.message : String(error) });
        architectureComposition = this.composeArchitectureFresh(approvedSolution, contract, input.missionId);
      }
    } else {
      architectureComposition = this.composeArchitectureFresh(approvedSolution, contract, input.missionId);
    }

    // --- Team ---
    // Mesmo raciocínio: instances antigas podem referenciar stackKeys que só existiam na stack
    // selection original.
    let agentTeam: AgentTeam;
    if (scope.reuseTeam && !actualReuse.reuseStackSelection) {
      escalations.push({ stage: 'TEAM', reason: 'Stack selection escalou para recomputação — equipe reaproveitada da referência não seria mais válida para a stack nova.' });
    }
    if (scope.reuseTeam && actualReuse.reuseStackSelection) {
      try {
        agentTeam = this.teamValidator.validateAndApprove({
          missionId: input.missionId,
          approvedSolutionId: approvedSolution.id,
          architectureCompositionId: architectureComposition.id,
          complexityProfile: approvedSolution.complexityProfile,
          riskProfile: approvedSolution.riskProfile,
          instances: reference.agentTeam.instances,
          decisions: reference.agentTeam.decisions,
        });
        actualReuse.reuseTeam = true;
      } catch (error) {
        escalations.push({ stage: 'TEAM', reason: error instanceof Error ? error.message : String(error) });
        agentTeam = this.composeTeamFresh(approvedSolution, architectureComposition, contract, input.missionId);
      }
    } else {
      agentTeam = this.composeTeamFresh(approvedSolution, architectureComposition, contract, input.missionId);
    }

    const pipeline = this.pipelineComposer.compose({
      approvedSolution,
      architectureComposition,
      agentTeam,
      contract,
      registry: this.registry,
    });

    const governance = this.governanceGuard.check({
      intent,
      contract,
      topology,
      solution: approvedSolution,
      architecture: architectureComposition,
      team: agentTeam,
      pipeline,
    });

    return {
      intent, contract, topology, proposal, selection, approvedSolution, architectureComposition,
      agentTeam, pipeline, governance, actualReuse, escalations,
    };
  }

  private selectAndApproveFresh(
    input: IntentInput, contract: RequirementsContract, topology: SolutionTopology, mode: SelectionMode, kindsRequiringStack: string[]
  ): { selection: StackSelectionProposal; approvedSolution: ApprovedSolution } {
    const selection = this.technologySelector.select({
      contract, topology, registry: this.registry, mode, fixedSelections: this.config.fixedSelections,
    });
    const approvedSolution = this.approvedSolutionValidator.validateAndApprove({
      missionId: input.missionId,
      topology,
      selectionProposal: {
        mode,
        selections: selection.selections
          .filter((s) => s.selectedStackKey)
          .map((s) => ({ deliveryTargetKind: s.deliveryTargetKind, stackKey: s.selectedStackKey!, rationale: s.rationale })),
      },
      requirementsContractId: contract.id,
      approvedByPolicy: mode === 'AUTO' || this.config.autoApprove,
      kindsRequiringStack,
    });
    return { selection, approvedSolution };
  }

  private composeArchitectureFresh(approvedSolution: ApprovedSolution, contract: RequirementsContract, missionId: string): ApprovedArchitectureComposition {
    const compositionProposal = this.architectureComposer.compose({ approvedSolution, contract, registry: this.registry });
    return this.architectureValidator.validateAndApprove({
      missionId,
      approvedSolutionId: approvedSolution.id,
      proposals: compositionProposal.proposals,
      conflicts: compositionProposal.conflicts,
    });
  }

  private composeTeamFresh(
    approvedSolution: ApprovedSolution, architectureComposition: ApprovedArchitectureComposition, contract: RequirementsContract, missionId: string
  ): AgentTeam {
    const teamDraft = this.teamComposer.compose({ approvedSolution, architectureComposition, contract, registry: this.registry });
    return this.teamValidator.validateAndApprove({
      missionId,
      approvedSolutionId: approvedSolution.id,
      architectureCompositionId: architectureComposition.id,
      complexityProfile: approvedSolution.complexityProfile,
      riskProfile: approvedSolution.riskProfile,
      instances: teamDraft.instances,
      decisions: teamDraft.decisions,
    });
  }

  /** `selection` nunca passa por um validator (é só informativo no `GenerationResult`) — ao
   * reaproveitar, ainda assim nunca deve carregar o `missionId`/`id` da mission de referência. */
  private rebind(selection: StackSelectionProposal, missionId: string): StackSelectionProposal {
    return { ...selection, id: generateId(), missionId, version: 1 };
  }
}
