import { GeneratorMissionState, GeneratorState, ReplanReason } from '../domain';
import { GeneratorStateRepository, InMemoryGeneratorStateRepository } from './generator-state-repository';

const transitions: Record<GeneratorState, GeneratorState[]> = {
  INTENT_PENDING: ['INTENT_READY', 'CANCELLED'], INTENT_READY: ['REQUIREMENTS_DRAFT'],
  REQUIREMENTS_DRAFT: ['REQUIREMENTS_APPROVED', 'BLOCKED'], REQUIREMENTS_APPROVED: ['TOPOLOGY_PROPOSED'],
  TOPOLOGY_PROPOSED: ['TOPOLOGY_APPROVED', 'BLOCKED'], TOPOLOGY_APPROVED: ['SOLUTION_PLANNING'],
  SOLUTION_PLANNING: ['SOLUTION_PROPOSED', 'BLOCKED'], SOLUTION_PROPOSED: ['SOLUTION_APPROVED', 'BLOCKED'],
  SOLUTION_APPROVED: ['ARCHITECTURE_COMPOSING', 'SOLUTION_PLANNING'], ARCHITECTURE_COMPOSING: ['ARCHITECTURE_REVIEW', 'BLOCKED'],
  ARCHITECTURE_REVIEW: ['ARCHITECTURE_APPROVED', 'BLOCKED'], ARCHITECTURE_APPROVED: ['TEAM_COMPOSING'],
  TEAM_COMPOSING: ['TEAM_READY', 'BLOCKED'], TEAM_READY: ['PIPELINE_PLANNING'], PIPELINE_PLANNING: ['READY_FOR_EXECUTION', 'BLOCKED'],
  READY_FOR_EXECUTION: ['ACTIVE', 'CANCELLED'], ACTIVE: ['COMPLETED', 'BLOCKED', 'CANCELLED'], BLOCKED: ['SOLUTION_PLANNING', 'TEAM_COMPOSING', 'PIPELINE_PLANNING', 'CANCELLED'],
  CANCELLED: [], COMPLETED: [],
};

export class GeneratorStateMachine {
  constructor(private readonly repository: GeneratorStateRepository = new InMemoryGeneratorStateRepository()) {}

  initialize(missionId: string): GeneratorMissionState {
    const current = this.repository.get(missionId);
    if (current) return current;
    const state = { missionId, state: 'INTENT_PENDING' as const, version: 1 };
    this.repository.save(state);
    return state;
  }

  transition(missionId: string, next: GeneratorState, expectedVersion?: number): GeneratorMissionState {
    const current = this.initialize(missionId);
    if (expectedVersion !== undefined && expectedVersion !== current.version) throw new Error('GENERATOR_CONTEXT_STALE');
    if (current.state === next) return current;
    if (!transitions[current.state].includes(next)) throw new Error(`Invalid generator transition: ${current.state} -> ${next}`);
    const updated = { ...current, state: next, version: current.version + 1 };
    this.repository.save(updated);
    return updated;
  }

  replan(missionId: string, reason: ReplanReason, expectedVersion?: number): GeneratorMissionState {
    const current = this.initialize(missionId);
    if (expectedVersion !== undefined && expectedVersion !== current.version) throw new Error('GENERATOR_CONTEXT_STALE');
    if (current.state === 'SOLUTION_PLANNING' && current.lastReason === reason) return current;
    if (!['SOLUTION_APPROVED', 'ARCHITECTURE_APPROVED', 'TEAM_READY', 'READY_FOR_EXECUTION', 'ACTIVE', 'BLOCKED'].includes(current.state)) throw new Error(`Cannot replan from ${current.state}`);
    const updated = { ...current, state: 'SOLUTION_PLANNING' as const, version: current.version + 1, lastReason: reason };
    this.repository.save(updated);
    return updated;
  }

  get(missionId: string): GeneratorMissionState | undefined { return this.repository.get(missionId); }
}
