import { SolutionPlanResultV1 } from './solution-plan-result';
import { StackCatalogService } from './stack-catalog.service';

export interface SolutionPolicyValidation {
  status: 'PASS' | 'FAIL';
  errors: { code: string; ref?: string }[];
  capabilityValidation: 'NOT_AVAILABLE';
}

export class SolutionPolicyValidator {
  constructor(private readonly stacks: StackCatalogService) {}

  validate(inScopeKeys: string[], result: SolutionPlanResultV1): SolutionPolicyValidation {
    const errors: { code: string; ref?: string }[] = [];
    const expected = new Set(inScopeKeys);
    const componentKeys = new Set<string>();

    for (const component of result.components) {
      if (componentKeys.has(component.key)) errors.push({ code: 'SOLUTION_DUPLICATE_COMPONENT', ref: component.key });
      componentKeys.add(component.key);
      if (component.requirementKeys.length === 0) errors.push({ code: 'SOLUTION_ORPHAN_COMPONENT', ref: component.key });
      for (const key of component.requirementKeys) if (!expected.has(key)) errors.push({ code: 'SOLUTION_UNKNOWN_REQUIREMENT', ref: key });
    }

    for (const selection of result.stackSelections) {
      if (!componentKeys.has(selection.componentKey)) errors.push({ code: 'SOLUTION_ORPHAN_STACK_SELECTION', ref: selection.componentKey });
      const stack = this.stacks.get(selection.stackKey);
      if (!stack) errors.push({ code: 'STACK_NOT_FOUND', ref: selection.stackKey });
      else if (stack.availability !== 'SUPPORTED') errors.push({ code: 'STACK_NOT_SUPPORTED', ref: selection.stackKey });
      else if (!stack.supportedVersions.includes(selection.stackVersion)) errors.push({ code: 'STACK_VERSION_NOT_SUPPORTED', ref: `${selection.stackKey}@${selection.stackVersion}` });
      for (const key of selection.requirementKeys) if (!expected.has(key)) errors.push({ code: 'SOLUTION_UNKNOWN_REQUIREMENT', ref: key });
    }

    for (const decision of result.requirementDecisions) {
      if (decision.componentKeys.length === 0) errors.push({ code: 'SOLUTION_REQUIREMENT_COMPONENT_MISSING', ref: decision.requirementKey });
      for (const key of decision.componentKeys) if (!componentKeys.has(key)) errors.push({ code: 'SOLUTION_REQUIREMENT_COMPONENT_NOT_FOUND', ref: key });
    }
    for (const strategy of result.nonFunctionalStrategies) if (!expected.has(strategy.requirementKey)) errors.push({ code: 'SOLUTION_UNKNOWN_REQUIREMENT', ref: strategy.requirementKey });

    return { status: errors.length ? 'FAIL' : 'PASS', errors, capabilityValidation: 'NOT_AVAILABLE' };
  }
}
