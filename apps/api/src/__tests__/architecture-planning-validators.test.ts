import { ArchitectureProposalV1, ArchitectureReviewResultV1, validateArchitectureArbitrationResultV1, validateArchitectureProposalV1, validateArchitectureReviewResultV1 } from '../architecture-planning/architecture-contracts';
import { ArchitectureCouncilPolicy, ArchitectureProposalValidator } from '../architecture-planning/architecture-validators';

const keys = (count = 2) => Array.from({ length: count }, (_, i) => `REQ-${String(i + 1).padStart(3, '0')}`);
const proposal = (requirements = keys()): ArchitectureProposalV1 => ({
  architectureStyle: 'modular monolith', summary: 'Explicit NestJS architecture',
  modules: [{ key: 'api', name: 'API', responsibilities: ['serve approved scope'], componentKeys: ['backend-api'], requirementKeys: requirements, stackRefs: [{ stackKey: 'stack.typescript.nestjs', stackVersion: '10' }], dependsOn: [] }],
  decisions: [{ key: 'audit', title: 'Audit trail', decision: 'Append-only audit log', rationale: 'Required traceability', requirementKeys: [requirements[0]], componentKeys: ['backend-api'], moduleKeys: ['api'], stackRefs: [{ stackKey: 'stack.typescript.nestjs', stackVersion: '10' }] }],
  integrations: [], dataFlows: [], securityBoundaries: [{ key: 'auth', description: 'API trust boundary', moduleKeys: ['api'], requirementKeys: requirements }],
  requirementMappings: requirements.map((requirementKey, i) => ({ requirementKey, moduleKeys: ['api'], decisionKeys: i === 0 ? ['audit'] : [] })),
  risks: [{ description: 'operational complexity', severity: 'LOW' }], assumptions: [], confidence: 0.95,
});

const validate = (candidate: ArchitectureProposalV1, requirements = keys(), requiredDecisionKeys = [requirements[0]]) => new ArchitectureProposalValidator().validate({
  proposal: candidate, componentKeys: ['backend-api'], stackSelections: [{ stackKey: 'stack.typescript.nestjs', stackVersion: '10' }], inScopeKeys: requirements, requiredDecisionKeys,
});

describe('CORE-013 deterministic architecture contracts and policies', () => {
  it('accepts the structured contracts and exact 27-requirement trace including REQ-027/NFR', () => {
    const requirements = keys(27); const candidate = proposal(requirements);
    expect(validateArchitectureProposalV1(candidate)).toEqual(candidate);
    expect(validate(candidate, requirements).status).toBe('PASS');
    expect(candidate.requirementMappings).toHaveLength(27);
    expect(candidate.requirementMappings.at(-1)?.requirementKey).toBe('REQ-027');
  });

  it.each([
    ['ARCHITECTURE_UNKNOWN_COMPONENT', (p: ArchitectureProposalV1) => { p.modules[0].componentKeys = ['unknown']; }],
    ['ARCHITECTURE_STACK_OUTSIDE_APPROVED_SOLUTION', (p: ArchitectureProposalV1) => { p.modules[0].stackRefs[0].stackKey = 'stack.redis'; }],
    ['ARCHITECTURE_STACK_OUTSIDE_APPROVED_SOLUTION', (p: ArchitectureProposalV1) => { p.modules[0].stackRefs[0].stackVersion = 'latest'; }],
    ['ARCHITECTURE_UNKNOWN_MODULE', (p: ArchitectureProposalV1) => { p.modules[0].dependsOn = ['missing']; }],
    ['ARCHITECTURE_SELF_DEPENDENCY', (p: ArchitectureProposalV1) => { p.modules[0].dependsOn = ['api']; }],
    ['ARCHITECTURE_DEPENDENCY_CYCLE', (p: ArchitectureProposalV1) => { p.modules.push({ ...p.modules[0], key: 'data', name: 'Data', dependsOn: ['api'] }); p.modules[0].dependsOn = ['data']; }],
    ['ARCHITECTURE_REQUIREMENT_COVERAGE_INCOMPLETE', (p: ArchitectureProposalV1) => { p.requirementMappings.pop(); }],
    ['ARCHITECTURE_UNKNOWN_REQUIREMENT', (p: ArchitectureProposalV1) => { p.requirementMappings.push({ requirementKey: 'REQ-999', moduleKeys: ['api'], decisionKeys: [] }); }],
    ['ARCHITECTURE_REQUIRED_DECISION_MISSING', (p: ArchitectureProposalV1) => { p.requirementMappings[0].decisionKeys = []; }],
    ['ARCHITECTURE_ORPHAN_MODULE', (p: ArchitectureProposalV1) => { p.modules.push({ ...p.modules[0], key: 'future', name: 'Future', componentKeys: [], requirementKeys: [], dependsOn: [] }); }],
  ])('%s blocks invalid architecture', (code, mutate) => { const p = proposal(); mutate(p); expect(validate(p).errors.map(e => e.code)).toContain(code); });

  it('rejects invalid proposal/review/arbitration schemas', () => {
    expect(validateArchitectureProposalV1({})).toBeNull();
    expect(validateArchitectureReviewResultV1({ verdict: 'APPROVED' })).toBeNull();
    expect(validateArchitectureArbitrationResultV1({ verdict: 'RESOLVED' })).toBeNull();
  });

  it('aggregates reviewers deterministically and never lets APPROVED override HIGH/BLOCKER/UNSATISFIED', () => {
    const review = (severity?: 'LOW'|'HIGH'|'BLOCKER', status: 'SATISFIED'|'UNSATISFIED' = 'SATISFIED'): ArchitectureReviewResultV1 => ({ verdict: 'APPROVED', summary: 'review', findings: severity ? [{ id: `f-${severity}`, category: 'STRUCTURE', severity, message: 'finding' }] : [], requirementAssessment: [{ requirementKey: 'REQ-001', status, evidenceSummary: 'evidence' }], confidence: 0.9 });
    const policy = new ArchitectureCouncilPolicy();
    expect(policy.evaluate([review(), review('LOW')]).status).toBe('APPROVED');
    expect(policy.evaluate([review('HIGH')]).status).toBe('RESOLUTION_REQUIRED');
    expect(policy.evaluate([review('BLOCKER')]).status).toBe('RESOLUTION_REQUIRED');
    expect(policy.evaluate([review(undefined, 'UNSATISFIED')]).status).toBe('RESOLUTION_REQUIRED');
  });
});
