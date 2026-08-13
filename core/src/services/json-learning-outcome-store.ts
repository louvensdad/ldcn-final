import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { LearningOutcome } from '../domain';
import { generateId } from '../utils/id';
import { LearningOutcomeInput, LearningOutcomeRepository } from './learning-outcome-store';

/** Durable local learning adapter; outcomes remain append-only and mission-scoped. */
export class JsonLearningOutcomeStore implements LearningOutcomeRepository {
  private records: Array<{ outcomeKey: string; outcome: LearningOutcome }>;
  private byKey = new Map<string, LearningOutcome>();

  constructor(private readonly filePath: string) {
    this.records = this.read();
    for (const record of this.records) this.byKey.set(`${record.outcome.missionId}:${record.outcomeKey}`, record.outcome);
  }

  append(input: LearningOutcomeInput): LearningOutcome {
    const key = `${input.missionId}:${input.outcomeKey}`;
    const existing = this.byKey.get(key);
    if (existing) return existing;
    if ([...this.byKey.keys()].some((candidate) => candidate.endsWith(`:${input.outcomeKey}`) && !candidate.startsWith(`${input.missionId}:`))) {
      throw new Error('LEARNING_OUTCOME_IDEMPOTENCY_CONFLICT');
    }
    const version = this.records.filter((record) => record.outcome.missionId === input.missionId).length + 1;
    const outcome: LearningOutcome = { ...input, id: generateId(), version };
    this.records.push({ outcomeKey: input.outcomeKey, outcome }); this.byKey.set(key, outcome); this.persist();
    return outcome;
  }

  listByMission(missionId: string): readonly LearningOutcome[] { return this.records.filter((record) => record.outcome.missionId === missionId).map((record) => record.outcome); }

  private read(): Array<{ outcomeKey: string; outcome: LearningOutcome }> {
    try {
      const value = JSON.parse(readFileSync(this.filePath, 'utf8')) as unknown;
      if (!Array.isArray(value)) throw new Error('LEARNING_OUTCOME_STORE_INVALID');
      if (value.some((record) => !record || typeof record !== 'object' || typeof (record as { outcomeKey?: unknown }).outcomeKey !== 'string' || !(record as { outcome?: unknown }).outcome)) throw new Error('LEARNING_OUTCOME_STORE_INVALID');
      return value as Array<{ outcomeKey: string; outcome: LearningOutcome }>;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
  }

  private persist(): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.${process.pid}.tmp`;
    writeFileSync(temporary, JSON.stringify(this.records), 'utf8');
    renameSync(temporary, this.filePath);
  }
}
