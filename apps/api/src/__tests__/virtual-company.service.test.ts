import { VirtualCompanyService } from '../virtual-company/virtual-company.service';

const now = new Date('2026-08-17T00:00:00.000Z');

function fixture(architectureStatus = 'APPROVED') {
  const companies: any[] = [], teams: any[] = [], instances: any[] = [], decisions: any[] = [];
  const architecture = {
    id: 'architecture-1', missionId: 'mission-1', version: 1, status: architectureStatus,
    architectureHash: 'architecture-hash', approvedSolutionId: 'solution-1',
    exactStackSelectionsJson: [{ stackKey: 'stack.typescript.nestjs', stackVersion: '10' }],
    modulesJson: [{ key: 'api', responsibilities: ['Persist orders in PostgreSQL'] }],
    decisionsJson: [], securityBoundariesJson: [{ key: 'api-boundary' }],
  };
  const implementationPlan = { id: 'plan-1', missionId: 'mission-1', version: 1, architectureCompositionId: 'architecture-1', architectureHash: 'architecture-hash', status: 'VALIDATED', workPackagesJson: [{ requiredCapabilities: ['data.persistence', 'security.application'] }] };
  const definitions = [
    ['architect', false, true], ['lead', true, true], ['developer', true, false],
    ['data-specialist', true, false], ['security-specialist', false, true],
    ['test-engineer', true, false], ['reviewer', false, true],
  ].map(([suffix, canExecute, canReview], index) => ({ id: `definition-${index}`, key: `backend.nestjs.${suffix}`, unitDefinitionId: 'unit-id', currentVersion: 1, status: 'ACTIVE', canExecute, canReview }));
  const prisma: any = {
    virtualCompany: {
      findUnique: jest.fn(({ where }: any) => companies.find((item) => item.architectureCompositionId === where.architectureCompositionId || item.id === where.id) ?? null),
      findUniqueOrThrow: jest.fn(({ where }: any) => companies.find((item) => item.id === where.id) ?? Promise.reject(new Error('NOT_FOUND'))),
      findFirst: jest.fn(({ where }: any) => companies.find((item) => item.missionId === where.missionId && item.status === where.status) ?? null),
      aggregate: jest.fn(() => ({ _max: { version: companies.length ? Math.max(...companies.map((item) => item.version)) : null } })),
      updateMany: jest.fn(({ where, data }: any) => { companies.filter((item) => item.missionId === where.missionId && item.status === where.status).forEach((item) => Object.assign(item, data)); }),
      create: jest.fn(({ data }: any) => { const row = { ...data, createdAt: now }; companies.push(row); return row; }),
      update: jest.fn(({ where, data }: any) => Object.assign(companies.find((item) => item.id === where.id), data)),
    },
    architectureComposition: { findUnique: jest.fn(({ where }: any) => where.id === architecture.id ? architecture : null) },
    implementationPlan: { findUnique: jest.fn(({ where }: any) => where.id === implementationPlan.id ? implementationPlan : null) },
    unitDefinition: { findMany: jest.fn(() => [{ id: 'unit-id', key: 'unit.web.nestjs', name: 'NestJS Unit', status: 'ACTIVE', stackKeysJson: ['stack.typescript.nestjs'] }]) },
    agentDefinition: { findMany: jest.fn(() => definitions) },
    agentDefVersion: { findUnique: jest.fn(({ where }: any) => { const definition = definitions.find((item) => item.id === where.agentDefinitionId_version.agentDefinitionId)!; const suffix = definition.key.split('.').at(-1); const capabilities = suffix === 'data-specialist' ? ['data.persistence'] : suffix === 'security-specialist' ? ['security.application'] : [`capability.${suffix}`]; return { version: 1, identityJson: { role: suffix }, capabilityKeysJson: capabilities, canExecute: definition.canExecute, canReview: definition.canReview, publishedAt: now }; }) },
    teamInstance: {
      create: jest.fn(({ data }: any) => { teams.push(data); return data; }),
      findMany: jest.fn(({ where }: any) => teams.filter((item) => item.virtualCompanyId === where.virtualCompanyId)),
    },
    agentInstance: {
      findUnique: jest.fn(({ where }: any) => instances.find((item) => item.missionId === where.missionId_agentDefinitionKey.missionId && item.agentDefinitionKey === where.missionId_agentDefinitionKey.agentDefinitionKey) ?? null),
      upsert: jest.fn(({ where, update, create }: any) => { const current = instances.find((item) => item.missionId === where.missionId_agentDefinitionKey.missionId && item.agentDefinitionKey === where.missionId_agentDefinitionKey.agentDefinitionKey); if (current) return Object.assign(current, update); instances.push(create); return create; }),
      findMany: jest.fn(({ where }: any) => instances.filter((item) => item.virtualCompanyId === where.virtualCompanyId)),
    },
    teamCompositionDecision: {
      create: jest.fn(({ data }: any) => { decisions.push(data); return data; }),
      findMany: jest.fn(({ where }: any) => decisions.filter((item) => item.virtualCompanyId === where.virtualCompanyId)),
    },
  };
  prisma.$transaction = jest.fn((callback: (tx: any) => unknown) => callback(prisma));
  const events = { append: jest.fn(async () => ({})) };
  return { service: new VirtualCompanyService(prisma, events as never), prisma, events, companies, teams, instances, decisions };
}

describe('CORE-014 VirtualCompanyService', () => {
  it('freezes a minimum stack team with independent review and architecture-backed specialists', async () => {
    const fx = fixture();
    const company: any = await fx.service.compose('mission-1', 'architecture-1', 'plan-1');

    expect(company).toMatchObject({ missionId: 'mission-1', version: 1, architectureHash: 'architecture-hash', status: 'APPROVED' });
    expect(company.teams).toHaveLength(1);
    expect(company.teams[0].agents.map((agent: any) => agent.agentDefinitionKey)).toEqual(expect.arrayContaining([
      'backend.nestjs.developer', 'backend.nestjs.reviewer', 'backend.nestjs.data-specialist', 'backend.nestjs.security-specialist',
    ]));
    const executor = company.teams[0].agents.find((agent: any) => agent.agentDefinitionKey === 'backend.nestjs.developer');
    const reviewer = company.teams[0].agents.find((agent: any) => agent.agentDefinitionKey === 'backend.nestjs.reviewer');
    expect(reviewer.id).not.toBe(executor.id);
    expect(fx.decisions.every((decision) => decision.agentDefinitionVersion === 1)).toBe(true);
    expect(fx.events.append).toHaveBeenCalledWith(expect.objectContaining({ type: 'company.ready', payload: expect.objectContaining({ teamCount: 1, agentCount: 7 }) }));
  });

  it('is idempotent for the same approved architecture', async () => {
    const fx = fixture();
    const first: any = await fx.service.compose('mission-1', 'architecture-1', 'plan-1');
    const second: any = await fx.service.compose('mission-1', 'architecture-1', 'plan-1');
    expect(second.id).toBe(first.id);
    expect(fx.companies).toHaveLength(1);
    expect(fx.events.append).toHaveBeenCalledTimes(2);
  });

  it('rejects composition before deterministic architecture approval', async () => {
    const fx = fixture('ARCHITECTURE_CONFLICT');
    await expect(fx.service.compose('mission-1', 'architecture-1', 'plan-1')).rejects.toThrow('ARCHITECTURE_COMPOSITION_NOT_APPROVED');
    expect(fx.companies).toHaveLength(0);
  });
});
