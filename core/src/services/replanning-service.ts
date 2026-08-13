import { GeneratorMissionState, ReplanReason } from '../domain';
import { GeneratorStateMachine } from './generator-state-machine';

export interface ReplanRequest {
  missionId: string;
  reason: ReplanReason;
  expectedVersion?: number;
}

export class ReplanningService {
  constructor(private readonly stateMachine = new GeneratorStateMachine()) {}

  replan(request: ReplanRequest): GeneratorMissionState {
    if (!request.reason) throw new Error('REPLAN_REASON_REQUIRED');
    return this.stateMachine.replan(request.missionId, request.reason, request.expectedVersion);
  }

  getState(missionId: string): GeneratorMissionState | undefined { return this.stateMachine.get(missionId); }
}
