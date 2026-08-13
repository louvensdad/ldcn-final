import { RuntimeTaskOverview } from '../domain';
import { DecisionEventRepository } from './decision-event-store';
export interface LearningOutcomeReadPort {
  listByMission(missionId: string): readonly { taskId?: string }[];
}

function lastMatching<T>(items: readonly T[], predicate: (item: T) => boolean): T | undefined {
  for (let index = items.length - 1; index >= 0; index -= 1) if (predicate(items[index])) return items[index];
  return undefined;
}

function lastEventOfTypes<T extends { eventType: string }>(items: readonly T[], types: readonly string[]): T | undefined {
  const accepted = new Set(types);
  return lastMatching(items, (event) => accepted.has(event.eventType));
}

export class RuntimeReadModel {
  constructor(private readonly events: DecisionEventRepository, private readonly outcomes: LearningOutcomeReadPort) {}

  getTask(missionId: string, taskId: string): RuntimeTaskOverview | undefined {
    const taskEvents = this.events.list(missionId).filter((event) => event.payload.taskId === taskId);
    const taskOutcomes = this.outcomes.listByMission(missionId).filter((outcome) => outcome.taskId === taskId);
    if (taskEvents.length === 0 && taskOutcomes.length === 0) return undefined;
    const terminal = lastEventOfTypes(taskEvents, ['EXECUTION_COMPLETED', 'EXECUTION_FAILED']);
    const dispatched = lastMatching(taskEvents, (event) => event.eventType === 'EXECUTION_DISPATCHED');
    const latestExecutionEvent = lastEventOfTypes(taskEvents, ['EXECUTION_DISPATCHED', 'EXECUTION_COMPLETED', 'EXECUTION_FAILED']);
    const gate = lastMatching(taskEvents, (event) => event.eventType === 'GATE_EVALUATED');
    const repair = lastMatching(taskEvents, (event) => event.eventType === 'REPAIR_COMPLETED');
    const lastDispatchIndex = taskEvents.reduce((index, event, current) => event.eventType === 'EXECUTION_DISPATCHED' ? current : index, -1);
    const lastRepairIndex = taskEvents.reduce((index, event, current) => event.eventType === 'REPAIR_COMPLETED' ? current : index, -1);
    const advisoryCount = taskEvents.filter((event) => event.eventType === 'REPAIR_ADVISORY_CREATED').length;
    const attemptCount = taskEvents.filter((event) => event.eventType === 'EXECUTION_DISPATCHED').length;
    const executionStatus = latestExecutionEvent?.eventType === 'EXECUTION_FAILED' ? 'FAILED' : latestExecutionEvent?.eventType === 'EXECUTION_COMPLETED' ? 'COMPLETED' : latestExecutionEvent?.eventType === 'EXECUTION_DISPATCHED' ? 'DISPATCHED' : 'UNKNOWN';
    const gateStatus = gate?.payload.status as RuntimeTaskOverview['lastGateStatus'];
    const nextAction = repair?.payload.success === true && lastRepairIndex > lastDispatchIndex
      ? 'RETRY_EXECUTION'
      : executionStatus === 'DISPATCHED'
      ? 'WAIT_RUNTIME'
      : executionStatus === 'FAILED' || gateStatus === 'FAILED' || gateStatus === 'BLOCKED'
        ? 'REPAIR_ADVISORY'
        : executionStatus === 'COMPLETED' && !gateStatus
          ? 'REVIEW'
          : 'NONE';
    return { missionId, taskId, executionId: (latestExecutionEvent ?? terminal ?? dispatched)?.payload.executionId as string | undefined, executionStatus, attemptCount, lastGateStatus: gateStatus, advisoryCount, outcomeCount: taskOutcomes.length, nextAction };
  }

  listMission(missionId: string): RuntimeTaskOverview[] {
    const taskIds = new Set<string>();
    for (const event of this.events.list(missionId)) if (typeof event.payload.taskId === 'string') taskIds.add(event.payload.taskId);
    for (const outcome of this.outcomes.listByMission(missionId)) if (outcome.taskId) taskIds.add(outcome.taskId);
    return [...taskIds].sort().map((taskId) => this.getTask(missionId, taskId)).filter((overview): overview is RuntimeTaskOverview => !!overview);
  }
}
