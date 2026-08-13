import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { GeneratorMissionState } from '../domain';
import { GeneratorStateRepository } from './generator-state-repository';

export class JsonGeneratorStateRepository implements GeneratorStateRepository {
  private states: GeneratorMissionState[];

  constructor(private readonly filePath: string) { this.states = this.read(); }

  get(missionId: string): GeneratorMissionState | undefined { return this.states.find((state) => state.missionId === missionId); }

  save(state: GeneratorMissionState): void {
    const index = this.states.findIndex((candidate) => candidate.missionId === state.missionId);
    if (index < 0) this.states.push(state); else this.states[index] = state;
    this.persist();
  }

  private read(): GeneratorMissionState[] {
    try {
      const value = JSON.parse(readFileSync(this.filePath, 'utf8')) as unknown;
      if (!Array.isArray(value)) throw new Error('GENERATOR_STATE_STORE_INVALID');
      return value as GeneratorMissionState[];
    } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
  }

  private persist(): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.${process.pid}.tmp`;
    writeFileSync(temporary, JSON.stringify(this.states), 'utf8'); renameSync(temporary, this.filePath);
  }
}
