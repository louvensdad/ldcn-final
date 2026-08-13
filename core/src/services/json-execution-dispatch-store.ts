import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { ExecutionDispatchResult } from '../domain';
import { ExecutionDispatchRepository } from './execution-dispatcher';

export class JsonExecutionDispatchStore implements ExecutionDispatchRepository {
  private records: Array<{ key: string; result: ExecutionDispatchResult }>;
  private byKey = new Map<string, ExecutionDispatchResult>();

  constructor(private readonly filePath: string) {
    this.records = this.read();
    for (const record of this.records) this.byKey.set(record.key, record.result);
  }

  findByIdempotencyKey(key: string): ExecutionDispatchResult | undefined { return this.byKey.get(key); }

  save(key: string, result: ExecutionDispatchResult): ExecutionDispatchResult {
    const existing = this.byKey.get(key);
    if (existing) return existing;
    this.records.push({ key, result }); this.byKey.set(key, result); this.persist();
    return result;
  }

  private read(): Array<{ key: string; result: ExecutionDispatchResult }> {
    try {
      const value = JSON.parse(readFileSync(this.filePath, 'utf8')) as unknown;
      if (!Array.isArray(value) || value.some((record) => !record || typeof record !== 'object' || typeof (record as { key?: unknown }).key !== 'string' || !(record as { result?: unknown }).result)) throw new Error('EXECUTION_DISPATCH_STORE_INVALID');
      return value as Array<{ key: string; result: ExecutionDispatchResult }>;
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
