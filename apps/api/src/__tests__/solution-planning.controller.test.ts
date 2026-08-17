import { SolutionPlanningController } from '../solution-planning/solution-planning.controller';

describe('CORE-012 production application action', () => {
  it('POST start connects scope-ready input to the real SolutionPlanningService action', async () => {
    const planAndApprove = jest.fn().mockResolvedValue({ id: 'solution-1', status: 'APPROVED' });
    const controller = new SolutionPlanningController({ planAndApprove } as never);
    await expect(controller.start('mission-1', { requirementBaselineId: 'baseline-1' })).resolves.toMatchObject({ status: 'APPROVED' });
    expect(planAndApprove).toHaveBeenCalledWith('mission-1', 'baseline-1');
  });
});
