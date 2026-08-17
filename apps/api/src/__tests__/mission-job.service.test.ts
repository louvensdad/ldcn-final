import { MissionJobService } from '../assembly/mission-job.service';

describe('CORE-015 MissionJobService', () => {
  it('creates canonical Jobs and scopes, making only dependency-free work READY', async () => {
    const jobs: any[] = [], scopes: any[] = [];
    const workPackages = [
      { key: 'job-api', title: 'API', moduleKey: 'api', objective: 'Implement API', requirementKeys: ['REQ-001'], requiredCapabilities: ['backend.api'], dependsOn: [], complexity: 'MEDIUM', risk: 'LOW', allowedPaths: ['src/api/**'], allowedModules: ['api'], acceptanceCriteria: ['API works'] },
      { key: 'job-tests', title: 'Tests', moduleKey: 'api', objective: 'Test API', requirementKeys: ['REQ-001'], requiredCapabilities: ['testing.unit'], dependsOn: ['job-api'], complexity: 'LOW', risk: 'LOW', allowedPaths: ['src/api/**'], allowedModules: ['api'], acceptanceCriteria: ['Tests pass'] },
    ];
    const prisma: any = {
      implementationPlan: { findUnique: jest.fn(() => ({ id: 'plan-1', missionId: 'mission-1', status: 'VALIDATED', workPackagesJson: workPackages })) },
      missionJob: { findMany: jest.fn(() => jobs), create: jest.fn(({ data }: any) => { jobs.push(data); return data; }) },
      jobScope: { create: jest.fn(({ data }: any) => { scopes.push(data); return data; }) },
    };
    prisma.$transaction = jest.fn((callback: (tx: any) => unknown) => callback(prisma));
    const events = { append: jest.fn(async () => ({})) };
    const result = await new MissionJobService(prisma, events as never).createFromPlan('mission-1', 'plan-1');
    expect(result.map((job) => [job.jobKey, job.status])).toEqual([['job-api', 'READY'], ['job-tests', 'PLANNED']]);
    expect(scopes).toHaveLength(2); expect(scopes.every((scope) => scope.generationJobId === null && scope.missionJobId)).toBe(true);
    expect(events.append).toHaveBeenCalledTimes(2);
  });
});
