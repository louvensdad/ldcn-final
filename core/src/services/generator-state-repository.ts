import { GeneratorMissionState } from '../domain';

export interface GeneratorStateRepository {
  get(missionId: string): GeneratorMissionState | undefined;
  save(state: GeneratorMissionState): void;
}

export class InMemoryGeneratorStateRepository implements GeneratorStateRepository {
  private states = new Map<string, GeneratorMissionState>();
  get(missionId: string): GeneratorMissionState | undefined { return this.states.get(missionId); }
  save(state: GeneratorMissionState): void { this.states.set(state.missionId, state); }
}
