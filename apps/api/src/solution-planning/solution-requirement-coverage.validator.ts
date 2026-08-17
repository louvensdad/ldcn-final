import { SolutionPlanResultV1 } from './solution-plan-result';

export interface SolutionRequirementCoverageValidation {
  status: 'PASS' | 'INCOMPLETE' | 'UNSUPPORTED';
  missingRequirementKeys: string[];
  duplicateRequirementKeys: string[];
  unknownRequirementKeys: string[];
  unsupportedRequirementKeys: string[];
}

export class SolutionRequirementCoverageValidator {
  validate(inScopeRequirementKeys: string[], result: SolutionPlanResultV1): SolutionRequirementCoverageValidation {
    const expected = new Set(inScopeRequirementKeys);
    const counts = new Map<string, number>();
    for (const decision of result.requirementDecisions) counts.set(decision.requirementKey, (counts.get(decision.requirementKey) ?? 0) + 1);

    const missingRequirementKeys = inScopeRequirementKeys.filter((key) => !counts.has(key));
    const duplicateRequirementKeys = [...counts].filter(([, count]) => count > 1).map(([key]) => key).sort();
    const unknownRequirementKeys = [...counts.keys()].filter((key) => !expected.has(key)).sort();
    const unsupportedRequirementKeys = result.requirementDecisions
      .filter((decision) => expected.has(decision.requirementKey) && decision.disposition === 'UNSUPPORTED')
      .map((decision) => decision.requirementKey).sort();

    return {
      status: unsupportedRequirementKeys.length > 0 ? 'UNSUPPORTED' :
        missingRequirementKeys.length || duplicateRequirementKeys.length || unknownRequirementKeys.length ? 'INCOMPLETE' : 'PASS',
      missingRequirementKeys,
      duplicateRequirementKeys,
      unknownRequirementKeys,
      unsupportedRequirementKeys,
    };
  }
}
