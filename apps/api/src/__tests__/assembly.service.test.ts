import { AssemblyService } from '../assembly/assembly.service';

function fixture(approved = true) {
  const architecture = { id: 'arch-1', missionId: 'mission-1', status: approved ? 'APPROVED' : 'AWAITING_HUMAN_APPROVAL', humanApprovalRequestId: approved ? 'approval-1' : null, architectureHash: 'arch-hash' };
  const approval = approved ? { id: 'approval-1', status: 'APPROVED', subjectHash: 'arch-hash' } : null;
  let assembly: any = null;
  const plan = { id: 'plan-1' }, company = { id: 'company-1' }, jobs = [{ id: 'job-1' }];
  const prisma: any = {
    architectureComposition: { findUnique: jest.fn(() => architecture) }, humanApprovalRequest: { findUnique: jest.fn(() => approval) },
    missionAssembly: {
      findUnique: jest.fn(() => assembly), findFirst: jest.fn(() => assembly), findUniqueOrThrow: jest.fn(() => assembly),
      create: jest.fn(({ data }: any) => assembly = { ...data, implementationPlanId: null, virtualCompanyId: null, completedAt: null }),
      update: jest.fn(({ data }: any) => assembly = { ...assembly, ...data }),
    },
    missionControl: { upsert: jest.fn(async () => ({})), update: jest.fn(async () => ({})) },
    implementationPlan: { findUnique: jest.fn(() => plan) }, virtualCompany: { findUnique: jest.fn(() => company) }, missionJob: { findMany: jest.fn(() => jobs) },
  };
  const planning = { plan: jest.fn(async () => plan) }, companies = { compose: jest.fn(async () => company) }, jobService = { createFromPlan: jest.fn(async () => jobs) }, events = { append: jest.fn(async () => ({})) };
  return { service: new AssemblyService(prisma, planning as never, companies as never, jobService as never, events as never), planning, companies, jobService, events };
}

describe('CORE-015 AssemblyService', () => {
  it('runs the approved sequence once and returns READY on idempotent retry', async () => { const fx = fixture(); const first: any = await fx.service.start('mission-1', 'arch-1'); const second: any = await fx.service.start('mission-1', 'arch-1'); expect(first.status).toBe('READY'); expect(second.status).toBe('READY'); expect(fx.planning.plan).toHaveBeenCalledTimes(1); expect(fx.companies.compose).toHaveBeenCalledTimes(1); expect(fx.jobService.createFromPlan).toHaveBeenCalledTimes(1); expect(fx.events.append).toHaveBeenCalledWith(expect.objectContaining({ type: 'mission.assembly_ready' })); });
  it('never starts without the exact human approval', async () => { const fx = fixture(false); await expect(fx.service.start('mission-1', 'arch-1')).rejects.toThrow('ARCHITECTURE_HUMAN_APPROVAL_REQUIRED'); expect(fx.planning.plan).not.toHaveBeenCalled(); });
});
