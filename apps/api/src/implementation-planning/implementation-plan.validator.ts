import { ImplementationPlanV1 } from './implementation-plan.contracts';

export class ImplementationPlanValidator {
  validate(input: { plan: ImplementationPlanV1; moduleKeys: string[]; inScopeRequirementKeys: string[]; capabilityKeys: string[] }) {
    const errors: string[] = [];
    const keys = input.plan.workPackages.map((work) => work.key);
    if (new Set(keys).size !== keys.length) errors.push('IMPLEMENTATION_PLAN_DUPLICATE_JOB_KEY');
    const known = new Set(keys), modules = new Set(input.moduleKeys), requirements = new Set(input.inScopeRequirementKeys), capabilities = new Set(input.capabilityKeys);
    const covered = new Set<string>();
    for (const work of input.plan.workPackages) {
      if (!modules.has(work.moduleKey)) errors.push('IMPLEMENTATION_PLAN_UNKNOWN_MODULE');
      if (work.requirementKeys.some((key) => !requirements.has(key))) errors.push('IMPLEMENTATION_PLAN_UNKNOWN_REQUIREMENT');
      work.requirementKeys.forEach((key) => covered.add(key));
      if (work.requiredCapabilities.some((key) => !capabilities.has(key))) errors.push('IMPLEMENTATION_PLAN_UNKNOWN_CAPABILITY');
      if (work.dependsOn.some((key) => !known.has(key) || key === work.key)) errors.push('IMPLEMENTATION_PLAN_INVALID_DEPENDENCY');
      if (work.allowedModules.some((key) => !modules.has(key))) errors.push('IMPLEMENTATION_PLAN_UNKNOWN_ALLOWED_MODULE');
      if (work.allowedPaths.some((path) => !this.safePath(path))) errors.push('IMPLEMENTATION_PLAN_UNSAFE_PATH');
    }
    if (input.inScopeRequirementKeys.some((key) => !covered.has(key))) errors.push('IMPLEMENTATION_PLAN_REQUIREMENT_COVERAGE_INCOMPLETE');
    if (this.hasCycle(input.plan)) errors.push('IMPLEMENTATION_PLAN_DEPENDENCY_CYCLE');
    return { status: errors.length ? 'FAIL' as const : 'PASS' as const, errors: [...new Set(errors)] };
  }

  private safePath(path: string) { return !!path && !path.startsWith('/') && !path.startsWith('\\') && !/^[A-Za-z]:/.test(path) && !path.split(/[\\/]/).includes('..') && !path.includes('\\'); }
  private hasCycle(plan: ImplementationPlanV1) {
    const graph = new Map(plan.workPackages.map((work) => [work.key, work.dependsOn]));
    const visiting = new Set<string>(), visited = new Set<string>();
    const visit = (key: string): boolean => { if (visiting.has(key)) return true; if (visited.has(key)) return false; visiting.add(key); for (const dependency of graph.get(key) ?? []) if (visit(dependency)) return true; visiting.delete(key); visited.add(key); return false; };
    return [...graph.keys()].some(visit);
  }
}
