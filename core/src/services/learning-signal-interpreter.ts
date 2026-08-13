import { LearningOutcome, LearningSignals } from '../domain';

export class LearningSignalInterpreter {
  interpret(outcomes: readonly LearningOutcome[]): LearningSignals {
    if (outcomes.length === 0) return { sampleCount: 0, successRate: 0, repairRate: 0 };
    const average = (values: number[]): number | undefined => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined;
    const optionalRate = (values: Array<boolean | undefined>): number | undefined => {
      const known = values.filter((value): value is boolean => value !== undefined);
      return known.length ? known.filter(Boolean).length / known.length : undefined;
    };
    return {
      sampleCount: outcomes.length,
      successRate: outcomes.filter((outcome) => outcome.success).length / outcomes.length,
      repairRate: outcomes.filter((outcome) => (outcome.repairCount ?? 0) > 0).length / outcomes.length,
      averageCost: average(outcomes.flatMap((outcome) => outcome.cost === undefined ? [] : [outcome.cost])),
      averageDurationMs: average(outcomes.flatMap((outcome) => outcome.durationMs === undefined ? [] : [outcome.durationMs])),
      userAcceptanceRate: optionalRate(outcomes.map((outcome) => outcome.userAccepted)),
      buildPassRate: optionalRate(outcomes.map((outcome) => outcome.buildPassed)),
      testPassRate: optionalRate(outcomes.map((outcome) => outcome.testsPassed)),
    };
  }
}
