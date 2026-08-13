import {
  RuntimeEventQuery,
  RuntimeMissionQuery,
  RuntimeOperationalResponse,
  RuntimeTaskQuery,
  OperationalAction,
} from '../domain';
import { IntelligentGeneratorQueryService } from './intelligent-generator-application';

/** Framework-neutral API facade. HTTP/Nest adapters should delegate here. */
export class RuntimeApiController {
  constructor(private readonly queries: IntelligentGeneratorQueryService) {}

  getMission(input: RuntimeMissionQuery): RuntimeOperationalResponse {
    this.assertMission(input.missionId);
    return {
      overview: this.queries.getOperationalMissionOverview(input.missionId),
      actions: this.queries.getOperationalActions(input.missionId).flatMap((action): OperationalAction[] => {
        switch (action.action) {
          case 'WAIT_RUNTIME':
          case 'REVIEW':
          case 'REPAIR_ADVISORY':
          case 'RETRY_EXECUTION':
          case 'START_REPAIR':
          case 'APPROVE_REPAIR':
            return [action as OperationalAction];
          default:
            return [];
        }
      }),
      runtimeTasks: this.queries.getRuntimeMissionOverview(input.missionId),
      repairTasks: this.queries.getRepairMissionOverview(input.missionId),
    };
  }

  getTask(input: RuntimeTaskQuery) {
    this.assertMission(input.missionId);
    this.assertTask(input.taskId);
    return {
      runtime: this.queries.getRuntimeTaskOverview(input.missionId, input.taskId),
      repair: this.queries.getRepairOverview(input.missionId, input.taskId),
    };
  }

  getEvents(input: RuntimeEventQuery) {
    this.assertMission(input.missionId);
    if (input.taskId !== undefined) this.assertTask(input.taskId);
    return {
      runtime: this.queries.getRuntimeEvents(input.missionId, input.taskId),
      repair: this.queries.getRepairEvents(input.missionId, input.taskId),
    };
  }

  private assertMission(missionId: string): void {
    if (!missionId.trim()) throw new Error('MISSION_ID_REQUIRED');
  }

  private assertTask(taskId: string): void {
    if (!taskId.trim()) throw new Error('TASK_ID_REQUIRED');
  }
}
