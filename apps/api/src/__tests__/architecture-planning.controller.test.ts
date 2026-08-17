import { ArchitecturePlanningController } from '../architecture-planning/architecture-planning.controller';

describe('CORE-013 production controller', () => {
  it('routes POST start and GET active to the real planning service', async () => {
    const planning = { start: jest.fn().mockResolvedValue({ id: 'arch-1' }), getActive: jest.fn().mockResolvedValue({ id: 'arch-1' }) };
    const controller = new ArchitecturePlanningController(planning as never);
    await expect(controller.start('mission-1', { approvedSolutionId: 'solution-1' })).resolves.toEqual({ id: 'arch-1' });
    await expect(controller.active('mission-1')).resolves.toEqual({ id: 'arch-1' });
    expect(planning.start).toHaveBeenCalledWith('mission-1', 'solution-1');
  });
});
