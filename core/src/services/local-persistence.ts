import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { GeneratorStateMachine } from './generator-state-machine';
import { IntelligentGeneratorCommandService } from './intelligent-generator-application';
import { JsonDecisionEventStore } from './json-decision-event-store';
import { JsonExecutionDispatchStore } from './json-execution-dispatch-store';
import { JsonFailureSnapshotStore, JsonRepairAdvisoryStore, JsonReviewGateEvaluationStore } from './json-runtime-record-stores';
import { JsonGeneratorStateRepository } from './json-generator-state-repository';
import { JsonLearningOutcomeStore } from './json-learning-outcome-store';
import { ExecutionRuntimePort } from './execution-dispatcher';
import { RuntimeLifecycleCoordinator } from './runtime-lifecycle-coordinator';
import { RuntimePolicyConfig } from '../domain';
import { JsonGenerationResultStore } from './generation-result-store';

export interface LocalPersistence {
  events: JsonDecisionEventStore;
  outcomes: JsonLearningOutcomeStore;
  dispatches: JsonExecutionDispatchStore;
  failures: JsonFailureSnapshotStore;
  advisories: JsonRepairAdvisoryStore;
  gates: JsonReviewGateEvaluationStore;
  states: JsonGeneratorStateRepository;
}

export function createLocalPersistence(directory: string): LocalPersistence {
  mkdirSync(directory, { recursive: true });
  return {
    events: new JsonDecisionEventStore(join(directory, 'decision-events.json')),
    outcomes: new JsonLearningOutcomeStore(join(directory, 'learning-outcomes.json')),
    dispatches: new JsonExecutionDispatchStore(join(directory, 'execution-dispatches.json')),
    failures: new JsonFailureSnapshotStore(join(directory, 'failure-snapshots.json')),
    advisories: new JsonRepairAdvisoryStore(join(directory, 'repair-advisories.json')),
    gates: new JsonReviewGateEvaluationStore(join(directory, 'review-gates.json')),
    states: new JsonGeneratorStateRepository(join(directory, 'generator-states.json')),
  };
}

export function createLocalGenerator(directory: string): IntelligentGeneratorCommandService {
  const persistence = createLocalPersistence(directory);
  return new IntelligentGeneratorCommandService(undefined, persistence.events, new GeneratorStateMachine(persistence.states), undefined, new JsonGenerationResultStore(join(directory, 'generation-results.json')));
}

export function createLocalRuntime(directory: string, runtime: ExecutionRuntimePort, policy?: RuntimePolicyConfig): RuntimeLifecycleCoordinator {
  const persistence = createLocalPersistence(directory);
  return new RuntimeLifecycleCoordinator(runtime, persistence.events, persistence.outcomes, persistence.dispatches, persistence.gates, persistence.advisories, persistence.failures, policy);
}
