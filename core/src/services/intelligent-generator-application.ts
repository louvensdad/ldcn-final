import { Generator, GenerationResult } from '../generator';
import { GeneratorOverview, GeneratorMissionState, IntentInput, LearningOutcome, ReplanReason } from '../domain';
import { DecisionEventRepository, InMemoryDecisionEventStore } from './decision-event-store';
import { GeneratorStateMachine } from './generator-state-machine';
import { PipelineReadModel } from './pipeline-read-model';
import { ObservabilityTracer } from './observability-tracer';
import { LearningSignalInterpreter } from './learning-signal-interpreter';
import { createHash } from 'crypto';
import { LearningOutcomeReadPort, RuntimeReadModel } from './runtime-read-model';
import { RepairReadModel } from './repair-read-model';
import { GenerationResultRepository, InMemoryGenerationResultStore } from './generation-result-store';

export class IntelligentGeneratorCommandService {
  private readonly generator: Generator;
  private readonly results = new Map<string, GenerationResult>();
  private readonly commandFingerprints = new Map<string, string>();

  constructor(generator = new Generator({ mode: 'AUTO' }), private readonly events: DecisionEventRepository = new InMemoryDecisionEventStore(), private readonly stateMachine = new GeneratorStateMachine(), private readonly tracer = new ObservabilityTracer(), private readonly resultRepository: GenerationResultRepository = new InMemoryGenerationResultStore()) {
    this.generator = generator;
  }

  generate(input: IntentInput): GenerationResult {
    const stored = this.results.get(input.missionId) ? undefined : this.resultRepository.get(input.missionId);
    if (stored) this.results.set(input.missionId, stored.result), this.commandFingerprints.set(input.missionId, stored.fingerprint);
    const existing = this.results.get(input.missionId);
    const fingerprint = createHash('sha256').update(JSON.stringify(input)).digest('hex');
    if (existing) {
      if (this.commandFingerprints.get(input.missionId) !== fingerprint) throw new Error('GENERATOR_COMMAND_CONFLICT');
      return existing;
    }
    const result = this.generator.generate(input);
    this.results.set(input.missionId, result);
    this.commandFingerprints.set(input.missionId, fingerprint);
    this.resultRepository.save(input.missionId, { fingerprint, result });
    const finalState = this.advanceState(input.missionId, result.governance.allowed);
    const recorded = [
      this.events.append({ missionId: input.missionId, eventType: 'INTENT_ANALYZED', aggregateType: 'ProjectIntent', aggregateId: result.intent.id, idempotencyKey: `intent:${input.missionId}:${result.intent.version}` }),
      this.events.append({ missionId: input.missionId, eventType: 'REQUIREMENTS_APPROVED', aggregateType: 'RequirementsContract', aggregateId: result.contract.id, idempotencyKey: `requirements:${input.missionId}:${result.contract.version}` }),
      this.events.append({ missionId: input.missionId, eventType: 'TOPOLOGY_APPROVED', aggregateType: 'SolutionTopology', aggregateId: result.topology.id, idempotencyKey: `topology:${input.missionId}:${result.topology.version}` }),
      ...result.approvedSolution.selectedStacks.map((selection) => this.events.append({ missionId: input.missionId, eventType: 'STACK_SELECTED' as const, aggregateType: 'ApprovedStackSelection', aggregateId: selection.stackKey, idempotencyKey: `stack:${input.missionId}:${selection.deliveryTargetKind}:${result.approvedSolution.version}`, payload: { deliveryTargetKind: selection.deliveryTargetKind, stackKey: selection.stackKey } })),
      this.events.append({ missionId: input.missionId, eventType: 'SOLUTION_APPROVED', aggregateType: 'ApprovedSolution', aggregateId: result.approvedSolution.id, idempotencyKey: `solution:${input.missionId}:${result.approvedSolution.version}` }),
      this.events.append({ missionId: input.missionId, eventType: 'ARCHITECTURE_DECIDED', aggregateType: 'ApprovedArchitectureComposition', aggregateId: result.architectureComposition.id, idempotencyKey: `architecture:${input.missionId}:${result.architectureComposition.version}` }),
      this.events.append({ missionId: input.missionId, eventType: 'TEAM_COMPOSED', aggregateType: 'AgentTeam', aggregateId: result.agentTeam.id, idempotencyKey: `team:${input.missionId}:${result.agentTeam.version}` }),
      this.events.append({ missionId: input.missionId, eventType: 'PIPELINE_COMPOSED', aggregateType: 'MissionPipelinePlan', aggregateId: result.pipeline.id, idempotencyKey: `pipeline:${input.missionId}:${result.pipeline.version}` }),
    ];
    for (const event of recorded) this.tracer.audit({ traceId: event.id, missionId: event.missionId, eventType: event.eventType, stage: this.stageFor(event.eventType), entityId: event.aggregateId, entityVersion: event.version });
    const stateEvent = this.events.append({ missionId: input.missionId, eventType: 'GENERATOR_STATE_CHANGED', aggregateType: 'GeneratorMissionState', aggregateId: input.missionId, idempotencyKey: `state:${input.missionId}:${finalState.version}`, payload: { state: finalState.state, version: finalState.version } });
    this.tracer.audit({ traceId: stateEvent.id, missionId: input.missionId, eventType: stateEvent.eventType, stage: 'pipeline', entityId: stateEvent.aggregateId, entityVersion: stateEvent.version, attributes: { state: finalState.state } });
    return result;
  }

  getEvents(missionId: string) { return this.events.list(missionId); }
  restore(missionId: string): GenerationResult | undefined {
    const stored = this.results.get(missionId) ? undefined : this.resultRepository.get(missionId);
    if (stored) { this.results.set(missionId, stored.result); this.commandFingerprints.set(missionId, stored.fingerprint); }
    return this.results.get(missionId);
  }
  getEventStore(): DecisionEventRepository { return this.events; }
  getEventsByType(missionId: string, eventType: Parameters<InMemoryDecisionEventStore['listByType']>[1]) { return this.events.listByType(missionId, eventType); }
  getEventsByAggregate(missionId: string, aggregateType: string, aggregateId?: string) { return this.events.listByAggregate(missionId, aggregateType, aggregateId); }
  getState(missionId: string): GeneratorMissionState | undefined { return this.stateMachine.get(missionId); }
  getStateMachine(): GeneratorStateMachine { return this.stateMachine; }
  getAuditEvents(missionId: string) { return this.tracer.getAuditEvents(missionId); }

  createQueryService(outcomes: readonly LearningOutcome[] = []): IntelligentGeneratorQueryService {
    return new IntelligentGeneratorQueryService(this.results, this.events, outcomes, this.stateMachine);
  }

  replan(missionId: string, reason: ReplanReason, expectedVersion?: number): GeneratorMissionState {
    const state = this.stateMachine.replan(missionId, reason, expectedVersion);
    this.events.append({ missionId, eventType: 'GENERATOR_STATE_CHANGED', aggregateType: 'GeneratorMissionState', aggregateId: missionId, idempotencyKey: `replan:${missionId}:${state.version}`, payload: { state: state.state, version: state.version, reason } });
    return state;
  }

  private stageFor(eventType: string): 'intent' | 'requirements' | 'topology' | 'solution' | 'architecture' | 'team' | 'pipeline' {
    if (eventType === 'INTENT_ANALYZED') return 'intent';
    if (eventType === 'REQUIREMENTS_APPROVED') return 'requirements';
    if (eventType === 'TOPOLOGY_APPROVED') return 'topology';
    if (eventType === 'STACK_SELECTED' || eventType === 'SOLUTION_APPROVED') return 'solution';
    if (eventType === 'ARCHITECTURE_DECIDED') return 'architecture';
    if (eventType === 'TEAM_COMPOSED') return 'team';
    return 'pipeline';
  }

  private advanceState(missionId: string, ready: boolean): GeneratorMissionState {
    const stages = ['INTENT_READY', 'REQUIREMENTS_DRAFT', 'REQUIREMENTS_APPROVED', 'TOPOLOGY_PROPOSED', 'TOPOLOGY_APPROVED', 'SOLUTION_PLANNING', 'SOLUTION_PROPOSED', 'SOLUTION_APPROVED', 'ARCHITECTURE_COMPOSING', 'ARCHITECTURE_REVIEW', 'ARCHITECTURE_APPROVED', 'TEAM_COMPOSING', 'TEAM_READY', 'PIPELINE_PLANNING'] as const;
    this.stateMachine.initialize(missionId);
    for (const stage of stages) this.stateMachine.transition(missionId, stage);
    return this.stateMachine.transition(missionId, ready ? 'READY_FOR_EXECUTION' : 'BLOCKED');
  }
}

export class IntelligentGeneratorQueryService {
  private readonly pipelineReadModel = new PipelineReadModel();
  private readonly learningInterpreter = new LearningSignalInterpreter();
  private readonly runtimeReadModel?: RuntimeReadModel;
  private readonly repairReadModel?: RepairReadModel;
  constructor(private readonly results: Map<string, GenerationResult>, private readonly events?: DecisionEventRepository, private readonly outcomes: readonly LearningOutcome[] = [], private readonly stateMachine?: GeneratorStateMachine) {
    if (events) {
      this.runtimeReadModel = new RuntimeReadModel(events, { listByMission: (missionId) => outcomes.filter((outcome) => outcome.missionId === missionId) } satisfies LearningOutcomeReadPort);
      this.repairReadModel = new RepairReadModel(events);
    }
  }

  getCurrentIntent(missionId: string) { return this.results.get(missionId)?.intent; }
  getRequirements(missionId: string) { return this.results.get(missionId)?.contract; }
  getTopology(missionId: string) { return this.results.get(missionId)?.topology; }
  getSolutionProposal(missionId: string) { return this.results.get(missionId)?.proposal; }
  getStackCandidates(missionId: string) { return this.results.get(missionId)?.selection; }
  getApprovedSolution(missionId: string) { return this.results.get(missionId)?.approvedSolution; }
  getArchitecture(missionId: string) { return this.results.get(missionId)?.architectureComposition; }
  getTeamComposition(missionId: string) { return this.results.get(missionId)?.agentTeam; }
  getPipeline(missionId: string) { return this.results.get(missionId)?.pipeline; }
  getNextActions(missionId: string) {
    const pipeline = this.results.get(missionId)?.pipeline;
    return pipeline ? this.pipelineReadModel.nextActions(pipeline) : [];
  }
  getDecisionEvents(missionId: string) { return this.events?.list(missionId) ?? []; }
  getDecisionEventsByType(missionId: string, eventType: Parameters<InMemoryDecisionEventStore['listByType']>[1]) { return this.events?.listByType(missionId, eventType) ?? []; }
  getLearningSignals(missionId: string) { return this.learningInterpreter.interpret(this.outcomes.filter((outcome) => outcome.missionId === missionId)); }
  getMissionState(missionId: string) { return this.stateMachine?.get(missionId); }
  getRuntimeTaskOverview(missionId: string, taskId: string) { return this.runtimeReadModel?.getTask(missionId, taskId); }
  getRuntimeMissionOverview(missionId: string) { return this.runtimeReadModel?.listMission(missionId) ?? []; }
  getRepairOverview(missionId: string, taskId: string) { return this.repairReadModel?.getTask(missionId, taskId); }
  getRepairMissionOverview(missionId: string) { return this.repairReadModel?.listMission(missionId) ?? []; }
  getOperationalMissionOverview(missionId: string) {
    const runtime = this.getRuntimeMissionOverview(missionId);
    const repair = this.getRepairMissionOverview(missionId);
    return {
      missionId,
      runtimeTaskCount: runtime.length,
      runningTaskCount: runtime.filter((task) => task.executionStatus === 'DISPATCHED').length,
      failedTaskCount: runtime.filter((task) => task.executionStatus === 'FAILED').length,
      reviewPendingCount: runtime.filter((task) => task.nextAction === 'REVIEW').length,
      repairPendingCount: repair.filter((task) => task.nextAction === 'START_REPAIR' || task.nextAction === 'APPROVE_REPAIR').length,
      retryPendingCount: runtime.filter((task) => task.nextAction === 'RETRY_EXECUTION').length,
    };
  }
  getOperationalActions(missionId: string) {
    const repairs = this.getRepairMissionOverview(missionId);
    const repairTaskIds = new Set(repairs.filter((task) => task.nextAction !== 'NONE').map((task) => task.taskId));
    const runtimeActions = this.getRuntimeMissionOverview(missionId).filter((task) => task.nextAction !== 'NONE' && !(task.nextAction === 'REPAIR_ADVISORY' && repairTaskIds.has(task.taskId))).map((task) => ({ missionId, taskId: task.taskId, action: task.nextAction, source: 'RUNTIME' as const }));
    const repairActions = repairs.filter((task) => task.nextAction !== 'NONE').map((task) => ({ missionId, taskId: task.taskId, action: task.nextAction, source: 'REPAIR' as const }));
    return [...runtimeActions, ...repairActions].sort((left, right) => `${left.taskId}:${left.action}`.localeCompare(`${right.taskId}:${right.action}`));
  }
  getRuntimeEvents(missionId: string, taskId?: string) {
    const events = this.events?.list(missionId) ?? [];
    return taskId ? events.filter((event) => event.payload.taskId === taskId) : events;
  }
  getRepairEvents(missionId: string, taskId?: string) {
    const events = this.events?.list(missionId).filter((event) => ['FAILURE_CLASSIFIED', 'REPAIR_ADVISORY_CREATED', 'REPAIR_ELIGIBILITY_EVALUATED', 'REPAIR_COMPLETED'].includes(event.eventType)) ?? [];
    return taskId ? events.filter((event) => event.payload.taskId === taskId) : events;
  }
  getGeneratorOverview(missionId: string): GeneratorOverview | undefined {
    const result = this.results.get(missionId);
    if (!result) return undefined;
    const blockedPipelineNodeCount = result.pipeline.nodes.filter((node) => node.state === 'BLOCKED_UNSUPPORTED_RUNTIME').length;
    return {
      missionId,
      status: blockedPipelineNodeCount > 0 || !result.governance.allowed ? 'BLOCKED' : 'READY_FOR_EXECUTION',
      intentVersion: result.intent.version,
      solutionVersion: result.approvedSolution.version,
      architectureVersion: result.architectureComposition.version,
      teamVersion: result.agentTeam.version,
      pipelineVersion: result.pipeline.version,
      approvedStackCount: result.approvedSolution.selectedStacks.length,
      pipelineNodeCount: result.pipeline.nodes.length,
      blockedPipelineNodeCount,
      nextAction: blockedPipelineNodeCount > 0 || !result.governance.allowed ? 'NONE' : 'START_EXECUTION',
    };
  }
}
