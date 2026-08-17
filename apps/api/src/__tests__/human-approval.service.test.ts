import { HumanApprovalService } from '../approvals/human-approval.service';

function fixture() {
  const architecture: any = { id: 'arch-1', missionId: 'mission-1', architectureHash: 'hash-1', status: 'VALIDATED', humanApprovalRequestId: null, approvedAt: null };
  const approvals: any[] = [], controls: any[] = [];
  const prisma: any = {
    humanApprovalRequest: {
      findUnique: jest.fn(({ where }: any) => approvals.find((row) => row.id === where.id || (where.trigger_subjectType_subjectId_subjectHash && row.trigger === where.trigger_subjectType_subjectId_subjectHash.trigger && row.subjectId === where.trigger_subjectType_subjectId_subjectHash.subjectId && row.subjectHash === where.trigger_subjectType_subjectId_subjectHash.subjectHash)) ?? null),
      create: jest.fn(({ data }: any) => { const row = { ...data, status: data.status ?? 'PENDING', createdAt: new Date() }; approvals.push(row); return row; }),
      update: jest.fn(({ where, data }: any) => Object.assign(approvals.find((row) => row.id === where.id), data)),
      findMany: jest.fn(() => approvals),
    },
    architectureComposition: {
      findUnique: jest.fn(({ where }: any) => where.id === architecture.id ? architecture : null),
      update: jest.fn(({ data }: any) => Object.assign(architecture, data)),
      updateMany: jest.fn(() => ({ count: 0 })),
    },
    missionControl: { upsert: jest.fn(({ where, create, update }: any) => { const row = controls.find((item) => item.missionId === where.missionId); if (row) return Object.assign(row, update); controls.push(create); return create; }) },
    requirement: { findUnique: jest.fn(() => null) },
  };
  prisma.$transaction = jest.fn((callback: (tx: any) => unknown) => callback(prisma));
  const events = { append: jest.fn(async () => ({})) };
  return { service: new HumanApprovalService(prisma, events as never), architecture, approvals, controls, events };
}

describe('CORE-015 HumanApprovalService', () => {
  it('pauses architecture and requires an explicit decision', async () => { const fx = fixture(); const request: any = await fx.service.requestArchitectureApproval({ missionId: 'mission-1', architectureCompositionId: 'arch-1', architectureHash: 'hash-1' }); expect(request.status).toBe('PENDING'); expect(fx.architecture.status).toBe('AWAITING_HUMAN_APPROVAL'); expect(fx.controls[0].status).toBe('PAUSED_HUMAN'); });
  it('approves exact immutable subject and is idempotent for the same decision', async () => { const fx = fixture(); const request: any = await fx.service.requestArchitectureApproval({ missionId: 'mission-1', architectureCompositionId: 'arch-1', architectureHash: 'hash-1' }); const decision = { decision: 'APPROVED' as const, decidedBy: 'operator', rationale: 'Reviewed architecture' }; const first = await fx.service.decide('mission-1', request.id, decision); const second = await fx.service.decide('mission-1', request.id, decision); expect(second).toEqual(first); expect(fx.architecture.status).toBe('APPROVED'); expect(fx.events.append).toHaveBeenCalledTimes(2); });
  it('rejects reversal after a final decision', async () => { const fx = fixture(); const request: any = await fx.service.requestArchitectureApproval({ missionId: 'mission-1', architectureCompositionId: 'arch-1', architectureHash: 'hash-1' }); await fx.service.decide('mission-1', request.id, { decision: 'REJECTED', decidedBy: 'operator', rationale: 'Unsafe' }); await expect(fx.service.decide('mission-1', request.id, { decision: 'APPROVED', decidedBy: 'operator', rationale: 'Changed mind' })).rejects.toThrow('APPROVAL_ALREADY_DECIDED'); });
});
