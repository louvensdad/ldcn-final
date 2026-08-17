import { ApprovalsController } from '../approvals/approvals.controller';
import { AssemblyController } from '../assembly/assembly.controller';
import { MissionJobRoutingController } from '../mission-routing/mission-job-routing.controller';

describe('CORE-015 public controllers', () => {
  it('exposes approval listing, requesting and deciding with exact audit fields', async () => {
    const approvals = { list: jest.fn().mockResolvedValue([]), requestRequirementWaiver: jest.fn().mockResolvedValue({ id: 'approval-1' }), decide: jest.fn().mockResolvedValue({ status: 'APPROVED' }) };
    const controller = new ApprovalsController(approvals as never);
    await controller.list('mission-1', 'PENDING');
    await controller.request('mission-1', { trigger: 'REQUIREMENT_WAIVER', subjectId: 'req-1', requestedBy: 'operator', requestNote: 'Defer' });
    await controller.decide('mission-1', 'approval-1', { decision: 'APPROVED', decidedBy: 'operator', rationale: 'Reviewed' });
    expect(approvals.list).toHaveBeenCalledWith('mission-1', 'PENDING');
    expect(approvals.requestRequirementWaiver).toHaveBeenCalledWith({ missionId: 'mission-1', requirementId: 'req-1', requestedBy: 'operator', requestNote: 'Defer' });
    expect(approvals.decide).toHaveBeenCalledWith('mission-1', 'approval-1', { decision: 'APPROVED', decidedBy: 'operator', rationale: 'Reviewed' });
  });
  it('exposes separate idempotent assembly start and active reads', async () => {
    const service = { start: jest.fn().mockResolvedValue({ status: 'READY' }), getActive: jest.fn().mockResolvedValue({ status: 'READY' }) };
    const controller = new AssemblyController(service as never);
    await controller.start('mission-1', { architectureCompositionId: 'arch-1' }); await controller.active('mission-1');
    expect(service.start).toHaveBeenCalledWith('mission-1', 'arch-1'); expect(service.getActive).toHaveBeenCalledWith('mission-1');
  });
  it('exposes single-job and ready-batch routing commands', async () => { const router = { route: jest.fn().mockResolvedValue({ status: 'ROUTED' }), routeReady: jest.fn().mockResolvedValue([]), get: jest.fn().mockResolvedValue({ status: 'ROUTED' }) }; const controller = new MissionJobRoutingController(router as never); await controller.route('mission-1', 'job-1'); await controller.routeReady('mission-1'); await controller.get('mission-1', 'job-1'); expect(router.route).toHaveBeenCalledWith('mission-1', 'job-1'); expect(router.routeReady).toHaveBeenCalledWith('mission-1'); });
});
