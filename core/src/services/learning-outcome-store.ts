import { LearningOutcome } from '../domain';
import { generateId } from '../utils/id';

export interface LearningOutcomeInput extends Omit<LearningOutcome, 'id' | 'version'> {
  outcomeKey: string;
}

export interface LearningOutcomeRepository {
  append(input: LearningOutcomeInput): LearningOutcome;
  listByMission(missionId: string): readonly LearningOutcome[];
}

export class InMemoryLearningOutcomeStore implements LearningOutcomeRepository {
  private outcomes: LearningOutcome[] = [];
  private byKey = new Map<string, LearningOutcome>();

  append(input: LearningOutcomeInput): LearningOutcome {
    const existing = this.byKey.get(input.outcomeKey);
    if (existing) {
      if (existing.missionId !== input.missionId) throw new Error('LEARNING_OUTCOME_IDEMPOTENCY_CONFLICT');
      return existing;
    }
    const version = this.outcomes.filter((outcome) => outcome.missionId === input.missionId).length + 1;
    const outcome: LearningOutcome = { ...input, id: generateId(), version };
    this.outcomes.push(outcome);
    this.byKey.set(input.outcomeKey, outcome);
    return outcome;
  }

  listByMission(missionId: string): readonly LearningOutcome[] { return this.outcomes.filter((outcome) => outcome.missionId === missionId); }
}
