import { LearningOutcome } from '../domain';
import { LearningOutcomeInput, LearningOutcomeRepository } from './learning-outcome-store';

export class RuntimeLearningRecorder {
  constructor(private readonly outcomes: LearningOutcomeRepository) {}

  recordExecution(input: { missionId: string; taskId: string; routingDecisionId: string; success: boolean; durationMs?: number; buildPassed?: boolean; testsPassed?: boolean }): LearningOutcome {
    return this.outcomes.append(this.input({ outcomeKey: `execution:${input.missionId}:${input.taskId}:${input.routingDecisionId}`, missionId: input.missionId, taskId: input.taskId, outcomeType: 'AGENT_EXECUTION', decision: input.routingDecisionId, result: input.success ? 'SUCCESS' : 'FAILED', success: input.success, durationMs: input.durationMs, buildPassed: input.buildPassed, testsPassed: input.testsPassed, features: { routingDecisionId: input.routingDecisionId, buildPassed: input.buildPassed ?? null, testsPassed: input.testsPassed ?? null } }));
  }

  recordGate(input: { missionId: string; taskId: string; evaluationId: string; status: 'PASSED' | 'FAILED' | 'BLOCKED'; gateCount: number }): LearningOutcome {
    const success = input.status === 'PASSED';
    return this.outcomes.append(this.input({ outcomeKey: `gate:${input.missionId}:${input.evaluationId}`, missionId: input.missionId, taskId: input.taskId, outcomeType: 'GATE', decision: input.evaluationId, result: input.status, success, features: { evaluationId: input.evaluationId, gateCount: input.gateCount, status: input.status } }));
  }

  recordRepair(input: { missionId: string; taskId: string; advisoryContextHash: string; failureCode: string; success: boolean; repairCount?: number }): LearningOutcome {
    return this.outcomes.append(this.input({ outcomeKey: `repair:${input.missionId}:${input.taskId}:${input.advisoryContextHash}`, missionId: input.missionId, taskId: input.taskId, outcomeType: 'REPAIR', decision: input.advisoryContextHash, result: input.success ? 'FIXED' : 'FAILED', success: input.success, repairCount: input.repairCount, features: { failureCode: input.failureCode, advisoryContextHash: input.advisoryContextHash } }));
  }

  private input(value: Omit<LearningOutcomeInput, 'featureSchemaVersion'>): LearningOutcomeInput {
    return { ...value, featureSchemaVersion: 'runtime-v1' };
  }
}
