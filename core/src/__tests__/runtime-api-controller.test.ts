import { RuntimeApiController } from '../services/runtime-api-controller';

describe('RuntimeApiController', () => {
  it('normalizes internal NONE actions before exposing the API response', () => {
    const queries = {
      getOperationalMissionOverview: () => ({ missionId: 'm1', runtimeTaskCount: 0, runningTaskCount: 0, failedTaskCount: 0, reviewPendingCount: 0, repairPendingCount: 0, retryPendingCount: 0 }),
      getOperationalActions: () => [
        { missionId: 'm1', taskId: 't1', action: 'NONE', source: 'RUNTIME' },
        { missionId: 'm1', taskId: 't2', action: 'REVIEW', source: 'RUNTIME' },
      ],
      getRuntimeMissionOverview: () => [],
      getRepairMissionOverview: () => [],
      getRuntimeTaskOverview: () => undefined,
      getRepairOverview: () => undefined,
      getRuntimeEvents: () => [],
      getRepairEvents: () => [],
    };

    const response = new RuntimeApiController(queries as never).getMission({ missionId: 'm1' });
    expect(response.actions).toEqual([{ missionId: 'm1', taskId: 't2', action: 'REVIEW', source: 'RUNTIME' }]);
  });

  it('rejects empty identifiers', () => {
    const controller = new RuntimeApiController({} as never);
    expect(() => controller.getMission({ missionId: ' ' })).toThrow('MISSION_ID_REQUIRED');
    expect(() => controller.getTask({ missionId: 'm1', taskId: ' ' })).toThrow('TASK_ID_REQUIRED');
  });
});
