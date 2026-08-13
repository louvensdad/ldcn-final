import { GenerationResultRepository, StoredGenerationResult } from 'ldcn-core';

/** Same hydrate/flush rationale as HydratedDecisionEventStore, for the single GenerationResult row per mission. */
export class HydratedGenerationResultStore implements GenerationResultRepository {
  private value: StoredGenerationResult | undefined;
  private dirty = false;

  constructor(seed: StoredGenerationResult | undefined = undefined) {
    this.value = seed;
  }

  /** One instance is scoped to a single missionId per request, so the argument is not re-checked here. */
  get(): StoredGenerationResult | undefined {
    return this.value;
  }

  save(_missionId: string, value: StoredGenerationResult): void {
    this.value = value;
    this.dirty = true;
  }

  /** Whether save() was called during this request — signals the caller must flush to Postgres. */
  isDirty(): boolean {
    return this.dirty;
  }

  getCurrent(): StoredGenerationResult | undefined {
    return this.value;
  }
}
