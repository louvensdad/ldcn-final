import { Injectable } from '@nestjs/common';
import { StackRegistry } from 'ldcn-core';

export type StackAvailability = 'SUPPORTED' | 'KNOWN' | 'EXPERIMENTAL' | 'UNAVAILABLE';

export interface SolutionStackDefinition {
  stackKey: string;
  kind: string[];
  language: string;
  framework: string;
  supportedVersions: string[];
  capabilities: string[];
  runtimeProfile: string | null;
  availability: StackAvailability;
  catalogVersion: string;
}

/** Catalog projection over the existing StackRegistry, corrected by actual generation support.
 * CORE-009/GenerationEngine currently prove only NestJS/npm; legacy runtimeSupport is not treated
 * as proof that this repository can generate/build that stack. */
@Injectable()
export class StackCatalogService {
  private readonly registry = new StackRegistry();

  list(): SolutionStackDefinition[] {
    return this.registry.list().map((stack) => ({
      stackKey: stack.key,
      kind: [...stack.deliveryTargetKinds],
      language: stack.language,
      framework: stack.name,
      supportedVersions: stack.key === 'stack.typescript.nestjs' ? ['10'] : [],
      capabilities: [],
      runtimeProfile: stack.key === 'stack.typescript.nestjs' ? 'core009.npm.nestjs.v1' : null,
      availability: stack.key === 'stack.typescript.nestjs' ? 'SUPPORTED' : 'UNAVAILABLE',
      catalogVersion: 'core012.v1',
    }));
  }

  get(stackKey: string): SolutionStackDefinition | null {
    return this.list().find((stack) => stack.stackKey === stackKey) ?? null;
  }

  trustedPromptContext(): object[] {
    return this.list().map(({ stackKey, kind, language, framework, supportedVersions, runtimeProfile, availability, catalogVersion }) =>
      ({ stackKey, kind, language, framework, supportedVersions, runtimeProfile, availability, catalogVersion }));
  }
}
