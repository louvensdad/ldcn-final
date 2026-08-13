import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { GenerationResult } from '../generator';

export interface StoredGenerationResult { fingerprint: string; result: GenerationResult; }
export interface GenerationResultRepository { get(missionId: string): StoredGenerationResult | undefined; save(missionId: string, value: StoredGenerationResult): void; }

export class InMemoryGenerationResultStore implements GenerationResultRepository {
  private values = new Map<string, StoredGenerationResult>();
  get(missionId: string): StoredGenerationResult | undefined { return this.values.get(missionId); }
  save(missionId: string, value: StoredGenerationResult): void { this.values.set(missionId, value); }
}

export class JsonGenerationResultStore implements GenerationResultRepository {
  private values: Record<string, StoredGenerationResult>;
  constructor(private readonly filePath: string) { this.values = this.read(); }
  get(missionId: string): StoredGenerationResult | undefined { return this.values[missionId]; }
  save(missionId: string, value: StoredGenerationResult): void { this.values[missionId] = value; this.persist(); }
  private read(): Record<string, StoredGenerationResult> {
    try {
      const value = JSON.parse(readFileSync(this.filePath, 'utf8')) as unknown;
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('GENERATION_RESULT_STORE_INVALID');
      return this.revive(value as Record<string, StoredGenerationResult>);
    } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {}; throw error; }
  }

  private revive(values: Record<string, StoredGenerationResult>): Record<string, StoredGenerationResult> {
    for (const stored of Object.values(values)) {
      const result = stored.result as GenerationResult & { approvedSolution?: { approvedAt?: string | Date }; architectureComposition?: { approvedAt?: string | Date } };
      if (result.approvedSolution?.approvedAt && typeof result.approvedSolution.approvedAt === 'string') result.approvedSolution.approvedAt = new Date(result.approvedSolution.approvedAt);
      if (result.architectureComposition?.approvedAt && typeof result.architectureComposition.approvedAt === 'string') result.architectureComposition.approvedAt = new Date(result.architectureComposition.approvedAt);
    }
    return values;
  }
  private persist(): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.${process.pid}.tmp`;
    writeFileSync(temporary, JSON.stringify(this.values), 'utf8'); renameSync(temporary, this.filePath);
  }
}
