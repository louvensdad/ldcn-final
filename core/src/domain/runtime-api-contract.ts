import { OperationalAction, OperationalMissionOverview, RepairOverview, RuntimeTaskOverview } from './index';

export interface RuntimeTaskQuery {
  missionId: string;
  taskId: string;
}

export interface RuntimeMissionQuery {
  missionId: string;
}

export interface RuntimeOperationalResponse {
  overview: OperationalMissionOverview;
  actions: OperationalAction[];
  runtimeTasks: RuntimeTaskOverview[];
  repairTasks: RepairOverview[];
}

export interface RuntimeEventQuery {
  missionId: string;
  taskId?: string;
}
