import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { FailureSnapshot, RepairAdvisory, ReviewGateEvaluation } from '../domain';
import { FailureSnapshotRepository } from './failure-classifier';
import { RepairAdvisoryRepository } from './repair-advisor';
import { ReviewGateEvaluationRepository } from './review-gate-evaluator';

class JsonMapStore<T> {
  private values: T[];
  constructor(private readonly filePath: string, private readonly keyOf: (value: T) => string) { this.values = this.read(); }
  get(key: string): T | undefined { return this.values.find((value) => this.keyOf(value) === key); }
  put(value: T): T { if (!this.get(this.keyOf(value))) { this.values.push(value); this.persist(); } return this.get(this.keyOf(value))!; }
  private read(): T[] {
    try {
      const value = JSON.parse(readFileSync(this.filePath, 'utf8')) as unknown;
      if (!Array.isArray(value)) throw new Error('RUNTIME_RECORD_STORE_INVALID');
      return value as T[];
    } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
  }
  private persist(): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.${process.pid}.tmp`;
    writeFileSync(temporary, JSON.stringify(this.values), 'utf8'); renameSync(temporary, this.filePath);
  }
}

export class JsonFailureSnapshotStore implements FailureSnapshotRepository {
  private readonly store: JsonMapStore<FailureSnapshot>;
  constructor(filePath: string) { this.store = new JsonMapStore(filePath, (value) => value.contextHash); }
  findByContextHash(contextHash: string): FailureSnapshot | undefined { return this.store.get(contextHash); }
  save(snapshot: FailureSnapshot): FailureSnapshot { return this.store.put(snapshot); }
}

export class JsonRepairAdvisoryStore implements RepairAdvisoryRepository {
  private readonly store: JsonMapStore<RepairAdvisory>;
  constructor(filePath: string) { this.store = new JsonMapStore(filePath, (value) => value.contextHash); }
  findByContextHash(contextHash: string): RepairAdvisory | undefined { return this.store.get(contextHash); }
  save(advisory: RepairAdvisory): RepairAdvisory { return this.store.put(advisory); }
}

export class JsonReviewGateEvaluationStore implements ReviewGateEvaluationRepository {
  private readonly store: JsonMapStore<{ key: string; value: ReviewGateEvaluation }>;
  constructor(filePath: string) { this.store = new JsonMapStore(filePath, (value) => value.key); }
  findByIdempotencyKey(key: string): ReviewGateEvaluation | undefined { return this.store.get(key)?.value; }
  save(key: string, evaluation: ReviewGateEvaluation): ReviewGateEvaluation { return this.store.put({ key, value: evaluation }).value; }
}
