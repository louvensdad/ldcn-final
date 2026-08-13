import { GeneratorMissionState, GeneratorStateRepository } from 'ldcn-core';

/** Same hydrate/flush rationale as HydratedDecisionEventStore, for the single GeneratorMissionState row per mission. */
export class HydratedGeneratorStateRepository implements GeneratorStateRepository {
  private value: GeneratorMissionState | undefined;
  private dirty = false;

  constructor(seed: GeneratorMissionState | undefined = undefined) {
    this.value = seed;
  }

  get(): GeneratorMissionState | undefined {
    return this.value;
  }

  save(state: GeneratorMissionState): void {
    this.value = state;
    this.dirty = true;
  }

  isDirty(): boolean {
    return this.dirty;
  }
}
