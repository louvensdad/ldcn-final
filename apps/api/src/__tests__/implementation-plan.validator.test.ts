import { ImplementationPlanV1 } from '../implementation-planning/implementation-plan.contracts';
import { ImplementationPlanValidator } from '../implementation-planning/implementation-plan.validator';

const base = (): ImplementationPlanV1 => ({
  summary: 'Implement approved API',
  workPackages: [{ key: 'job-api', title: 'API', moduleKey: 'api', objective: 'Implement endpoint', requirementKeys: ['REQ-001'], requiredCapabilities: ['backend.api'], dependsOn: [], complexity: 'MEDIUM', risk: 'LOW', allowedPaths: ['src/api/**'], allowedModules: ['api'], acceptanceCriteria: ['Endpoint responds successfully'] }],
  risks: [], assumptions: [], confidence: 0.9,
});
const validate = (plan: ImplementationPlanV1) => new ImplementationPlanValidator().validate({ plan, moduleKeys: ['api'], inScopeRequirementKeys: ['REQ-001'], capabilityKeys: ['backend.api'] });

describe('CORE-015 ImplementationPlanValidator', () => {
  it('accepts a fully traced, safe and acyclic plan', () => expect(validate(base())).toEqual({ status: 'PASS', errors: [] }));
  it('rejects missing IN_SCOPE coverage', () => { const plan = base(); plan.workPackages[0].requirementKeys = []; expect(validate(plan).errors).toContain('IMPLEMENTATION_PLAN_REQUIREMENT_COVERAGE_INCOMPLETE'); });
  it('rejects path traversal and unknown capabilities', () => { const plan = base(); plan.workPackages[0].allowedPaths = ['../secrets']; plan.workPackages[0].requiredCapabilities = ['unknown']; expect(validate(plan).errors).toEqual(expect.arrayContaining(['IMPLEMENTATION_PLAN_UNSAFE_PATH', 'IMPLEMENTATION_PLAN_UNKNOWN_CAPABILITY'])); });
  it('rejects dependency cycles', () => { const plan = base(); plan.workPackages.push({ ...plan.workPackages[0], key: 'job-db', title: 'DB', dependsOn: ['job-api'] }); plan.workPackages[0].dependsOn = ['job-db']; expect(validate(plan).errors).toContain('IMPLEMENTATION_PLAN_DEPENDENCY_CYCLE'); });
});
