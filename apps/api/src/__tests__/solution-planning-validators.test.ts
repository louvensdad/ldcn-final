import { canonicalHash } from '../requirements/canonical-hash';
import { SolutionPlanResultV1, validateSolutionPlanResultV1 } from '../solution-planning/solution-plan-result';
import { SolutionPolicyValidator } from '../solution-planning/solution-policy.validator';
import { SolutionRequirementCoverageValidator } from '../solution-planning/solution-requirement-coverage.validator';
import { StackCatalogService } from '../solution-planning/stack-catalog.service';

function result(keys: string[]): SolutionPlanResultV1 {
  return {
    solutionType: 'BACKEND', summary: 'Canonical backend solution',
    components: [{ key: 'backend-api', name: 'Backend API', kind: 'BACKEND', responsibilities: ['Serve business capabilities'], requirementKeys: keys }],
    stackSelections: [{ componentKey: 'backend-api', stackKey: 'stack.typescript.nestjs', stackVersion: '10', rationale: 'Only currently generated backend stack', requirementKeys: keys, confidence: 0.95 }],
    requirementDecisions: keys.map((requirementKey) => ({ requirementKey, disposition: 'COVERED', componentKeys: ['backend-api'], rationale: 'Covered by backend API' })),
    constraints: [], nonFunctionalStrategies: [], assumptions: [], risks: [], confidence: 0.95,
  };
}

describe('CORE-012 deterministic solution validators', () => {
  const coverage = new SolutionRequirementCoverageValidator();
  const stacks = new StackCatalogService();
  const policy = new SolutionPolicyValidator(stacks);

  it('validates strict SolutionPlanResultV1 and deterministic hashes', () => {
    const plan = result(['REQ-001']);
    expect(validateSolutionPlanResultV1(plan)).toEqual(plan);
    expect(validateSolutionPlanResultV1({ ...plan, confidence: 2 })).toBeNull();
    expect(canonicalHash(plan)).toBe(canonicalHash(JSON.parse(JSON.stringify(plan))));
  });

  it('proves 27 exact decisions without first-N truncation', () => {
    const keys = Array.from({ length: 27 }, (_, i) => `REQ-${String(i + 1).padStart(3, '0')}`);
    const plan = result(keys);
    expect(plan.requirementDecisions).toHaveLength(27);
    expect(plan.requirementDecisions[26].requirementKey).toBe('REQ-027');
    expect(coverage.validate(keys, plan)).toEqual({ status: 'PASS', missingRequirementKeys: [], duplicateRequirementKeys: [], unknownRequirementKeys: [], unsupportedRequirementKeys: [] });
  });

  it('detects missing, duplicate, invented and unsupported decisions independently', () => {
    const keys = ['REQ-001', 'REQ-002'];
    const missing = result(keys); missing.requirementDecisions.pop();
    expect(coverage.validate(keys, missing).missingRequirementKeys).toEqual(['REQ-002']);
    const duplicate = result(keys); duplicate.requirementDecisions.push({ ...duplicate.requirementDecisions[0] });
    expect(coverage.validate(keys, duplicate).duplicateRequirementKeys).toEqual(['REQ-001']);
    const unknown = result(keys); unknown.requirementDecisions.push({ requirementKey: 'REQ-999', disposition: 'COVERED', componentKeys: ['backend-api'], rationale: 'invented' });
    expect(coverage.validate(keys, unknown).unknownRequirementKeys).toEqual(['REQ-999']);
    const unsupported = result(keys); unsupported.requirementDecisions[1].disposition = 'UNSUPPORTED';
    expect(coverage.validate(keys, unsupported)).toMatchObject({ status: 'UNSUPPORTED', unsupportedRequirementKeys: ['REQ-002'] });
  });

  it('allows only the production-supported NestJS version and rejects unknown/unsupported/version/orphan selections', () => {
    expect(policy.validate(['REQ-001'], result(['REQ-001']))).toMatchObject({ status: 'PASS', capabilityValidation: 'NOT_AVAILABLE' });
    const unknown = result(['REQ-001']); unknown.stackSelections[0].stackKey = 'magic.framework';
    expect(policy.validate(['REQ-001'], unknown).errors).toContainEqual({ code: 'STACK_NOT_FOUND', ref: 'magic.framework' });
    const unsupported = result(['REQ-001']); unsupported.stackSelections[0].stackKey = 'stack.java.spring-boot'; unsupported.stackSelections[0].stackVersion = '21';
    expect(policy.validate(['REQ-001'], unsupported).errors).toContainEqual({ code: 'STACK_NOT_SUPPORTED', ref: 'stack.java.spring-boot' });
    const version = result(['REQ-001']); version.stackSelections[0].stackVersion = 'latest';
    expect(policy.validate(['REQ-001'], version).errors).toContainEqual({ code: 'STACK_VERSION_NOT_SUPPORTED', ref: 'stack.typescript.nestjs@latest' });
    const orphanStack = result(['REQ-001']); orphanStack.stackSelections[0].componentKey = 'missing-component';
    expect(policy.validate(['REQ-001'], orphanStack).errors).toContainEqual({ code: 'SOLUTION_ORPHAN_STACK_SELECTION', ref: 'missing-component' });
    const orphanComponent = result(['REQ-001']); orphanComponent.components.push({ key: 'future-cache', name: 'Future Cache', kind: 'OTHER', responsibilities: ['Future proofing'], requirementKeys: [] });
    expect(policy.validate(['REQ-001'], orphanComponent).errors).toContainEqual({ code: 'SOLUTION_ORPHAN_COMPONENT', ref: 'future-cache' });
  });

  it('keeps a non-functional requirement as an explicit decision and strategy', () => {
    const plan = result(['REQ-007']);
    plan.requirementDecisions[0].disposition = 'REQUIRES_ARCHITECTURE_DECISION';
    plan.nonFunctionalStrategies = [{ requirementKey: 'REQ-007', strategy: 'Define immutable audit trail in CORE-013' }];
    expect(coverage.validate(['REQ-007'], plan).status).toBe('PASS');
    expect(policy.validate(['REQ-007'], plan).status).toBe('PASS');
  });
});
