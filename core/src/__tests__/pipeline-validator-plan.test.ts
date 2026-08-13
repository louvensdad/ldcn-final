import { PipelineValidator } from '../services/pipeline-validator';
import { MissionPipelinePlan } from '../domain';

describe('PipelineValidator plan graph', () => {
  it('rejects a plan whose normalized dependencies disagree with nodes', () => {
    const plan = { status: 'APPROVED', approvedSolutionId: 's', architectureCompositionId: 'a', agentTeamId: 't', nodes: [{ id: 'a', key: 'a', type: 'GENERATION', required: true, dependsOn: [], ownerRole: 'LEAD', contractRefs: ['c'], gateRefs: [], state: 'PENDING' }], dependencies: [{ fromNodeKey: 'missing', toNodeKey: 'a' }] } as unknown as MissionPipelinePlan;
    const solution = { status: 'ACTIVE', requirementsContractId: 'c', selectedStacks: [], deliveryTargets: [] } as never;
    expect(() => new PipelineValidator().validatePlan(plan, solution)).toThrow('inconsistent');
  });
});
