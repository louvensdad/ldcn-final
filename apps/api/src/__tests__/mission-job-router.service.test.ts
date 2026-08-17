import { MissionJobRouterService } from '../mission-routing/mission-job-router.service';

function fixture(options: { required?: string[]; reviewer?: boolean; jobStatus?: string } = {}) {
  const required = options.required ?? ['backend.api', 'data.persistence'];
  const job: any = { id: 'job-1', missionId: 'mission-1', implementationPlanId: 'plan-1', moduleKey: 'api', requiredCapabilitiesJson: required, complexity: 'MEDIUM', risk: 'LOW', status: options.jobStatus ?? 'READY', jobKey: 'job-api' };
  const plan = { id: 'plan-1', missionId: 'mission-1', status: 'VALIDATED', architectureCompositionId: 'arch-1', architectureHash: 'arch-hash', planHash: 'plan-hash' };
  const company = { id: 'company-1', missionId: 'mission-1', implementationPlanId: 'plan-1', architectureHash: 'arch-hash', compositionHash: 'company-hash', status: 'APPROVED', version: 1 };
  const agents = [
    { id: 'developer-1', agentDefinitionKey: 'backend.nestjs.developer', agentDefinitionVersion: 1, teamInstanceId: 'team-1', virtualCompanyId: 'company-1' },
    { id: 'data-1', agentDefinitionKey: 'backend.nestjs.data-specialist', agentDefinitionVersion: 1, teamInstanceId: 'team-1', virtualCompanyId: 'company-1' },
    ...(options.reviewer === false ? [] : [{ id: 'reviewer-1', agentDefinitionKey: 'backend.nestjs.reviewer', agentDefinitionVersion: 1, teamInstanceId: 'team-1', virtualCompanyId: 'company-1' }]),
  ];
  const capabilityByKey: Record<string, string[]> = { 'backend.nestjs.developer': ['backend.api'], 'backend.nestjs.data-specialist': ['data.persistence'], 'backend.nestjs.reviewer': ['review.code'] };
  const definitions = agents.map((agent, index) => ({ id: `definition-${index}`, key: agent.agentDefinitionKey }));
  const decisions = agents.map((agent) => ({ agentDefinitionKey: agent.agentDefinitionKey, agentDefinitionVersion: 1, capabilityKeysJson: capabilityByKey[agent.agentDefinitionKey] }));
  const routings: any[] = [];
  const prisma: any = {
    missionJobRouting: { findUnique: jest.fn(() => routings[0] ?? null), create: jest.fn(({ data }: any) => { routings.push(data); return data; }) },
    missionJob: { findUnique: jest.fn(() => job), findMany: jest.fn(() => [job]), update: jest.fn(({ data }: any) => Object.assign(job, data)) },
    implementationPlan: { findUnique: jest.fn(() => plan) }, virtualCompany: { findFirst: jest.fn(() => company) },
    architectureComposition: { findUnique: jest.fn(() => ({ id: 'arch-1', architectureHash: 'arch-hash', modulesJson: [{ key: 'api', stackRefs: [{ stackKey: 'stack.typescript.nestjs' }] }] })) },
    teamInstance: { findMany: jest.fn(() => [{ id: 'team-1', stackKeysJson: ['stack.typescript.nestjs'] }]) }, agentInstance: { findMany: jest.fn(() => agents) }, teamCompositionDecision: { findMany: jest.fn(() => decisions) },
    agentDefinition: { findUnique: jest.fn(({ where }: any) => definitions.find((item) => item.key === where.key) ?? null) },
    agentDefVersion: { findUnique: jest.fn(({ where }: any) => { const definition = definitions.find((item) => item.id === where.agentDefinitionId_version.agentDefinitionId)!; const key = definition.key; return { publishedAt: new Date(), canExecute: !key.endsWith('.reviewer'), canReview: key.endsWith('.reviewer') }; }) },
  };
  prisma.$transaction = jest.fn((callback: (tx: any) => unknown) => callback(prisma));
  const events = { append: jest.fn(async () => ({})) };
  return { service: new MissionJobRouterService(prisma, events as never), job, routings, events };
}

describe('CORE-016 MissionJobRouterService', () => {
  it('selects the minimum capability-covering team and an independent reviewer', async () => { const fx = fixture(); const route: any = await fx.service.route('mission-1', 'job-1'); expect(route.status).toBe('ROUTED'); expect(route.executorAgentInstanceId).toBe('developer-1'); expect(route.reviewerAgentInstanceId).toBe('reviewer-1'); expect(route.selectedAgentIds).toEqual(['developer-1', 'data-1', 'reviewer-1']); expect(fx.job.status).toBe('ROUTED'); });
  it('is idempotent and never emits or persists a second decision', async () => { const fx = fixture(); const first: any = await fx.service.route('mission-1', 'job-1'); const second: any = await fx.service.route('mission-1', 'job-1'); expect(second.id).toBe(first.id); expect(fx.routings).toHaveLength(1); expect(fx.events.append).toHaveBeenCalledTimes(1); });
  it('detects context drift instead of replaying a stale decision', async () => { const fx = fixture(); await fx.service.route('mission-1', 'job-1'); fx.job.requiredCapabilitiesJson = ['security.application']; await expect(fx.service.route('mission-1', 'job-1')).rejects.toThrow('MISSION_JOB_ROUTING_STALE'); });
  it('blocks an uncovered capability without assigning a partial team', async () => { const fx = fixture({ required: ['backend.api', 'cloud.kubernetes'] }); const route: any = await fx.service.route('mission-1', 'job-1'); expect(route.status).toBe('BLOCKED_CAPABILITY_GAP'); expect(route.selectedAgentIds).toEqual([]); expect(route.missingCapabilities).toEqual(['cloud.kubernetes']); expect(fx.job.status).toBe('BLOCKED'); });
  it('blocks when no independent reviewer exists', async () => { const route: any = await fixture({ reviewer: false }).service.route('mission-1', 'job-1'); expect(route.status).toBe('BLOCKED_NO_REVIEWER'); });
  it('does not route dependency-blocked jobs', async () => { const fx = fixture({ jobStatus: 'PLANNED' }); await expect(fx.service.route('mission-1', 'job-1')).rejects.toThrow('MISSION_JOB_NOT_READY'); expect(fx.routings).toHaveLength(0); });
});
