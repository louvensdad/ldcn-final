import { createHash } from 'crypto';
import { FailureCategory, FailureSnapshot } from '../domain';
import { generateId } from '../utils/id';

export interface FailureSnapshotRepository {
  findByContextHash(contextHash: string): FailureSnapshot | undefined;
  save(snapshot: FailureSnapshot): FailureSnapshot;
}

export class InMemoryFailureSnapshotStore implements FailureSnapshotRepository {
  private snapshots = new Map<string, FailureSnapshot>();
  findByContextHash(contextHash: string): FailureSnapshot | undefined { return this.snapshots.get(contextHash); }
  save(snapshot: FailureSnapshot): FailureSnapshot {
    const existing = this.snapshots.get(snapshot.contextHash);
    if (existing) return existing;
    this.snapshots.set(snapshot.contextHash, snapshot);
    return snapshot;
  }
}

export interface FailureClassifierInput {
  missionId: string;
  taskId: string;
  executionId: string;
  summary: string;
  evidenceRefs?: string[];
  affectedStack?: string;
  failedGateKey?: string;
}

export class FailureClassifier {
  constructor(private readonly repository: FailureSnapshotRepository = new InMemoryFailureSnapshotStore()) {}

  classify(input: FailureClassifierInput): FailureSnapshot {
    if (!input.missionId || !input.taskId || !input.executionId || !input.summary) throw new Error('FAILURE_SNAPSHOT_INCOMPLETE');
    const text = `${input.summary} ${input.failedGateKey ?? ''}`.toLowerCase();
    const category: FailureCategory = /security|auth|permission|secret|vulnerability/.test(text) ? 'SECURITY'
      : /integrat|contract|api|cross.?stack/.test(text) ? 'INTEGRATION'
        : /test|assert|coverage|spec/.test(text) ? 'TEST'
          : /build|compile|type.?check|dependency/.test(text) ? 'BUILD'
            : /runtime|timeout|memory|process|crash/.test(text) ? 'RUNTIME' : 'UNKNOWN';
    const failureCode = `${category}_${text.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 48).toUpperCase() || 'UNKNOWN'}`;
    const normalized = { missionId: input.missionId, taskId: input.taskId, executionId: input.executionId, summary: input.summary, evidenceRefs: [...new Set(input.evidenceRefs ?? [])], affectedStack: input.affectedStack, failedGateKey: input.failedGateKey, category, failureCode };
    const contextHash = createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
    const existing = this.repository.findByContextHash(contextHash);
    if (existing) return existing;
    return this.repository.save({ id: generateId(), missionId: input.missionId, version: 1, taskId: input.taskId, executionId: input.executionId, category, failureCode, summary: input.summary, evidenceRefs: normalized.evidenceRefs, affectedStack: input.affectedStack, failedGateKey: input.failedGateKey, contextHash });
  }
}
