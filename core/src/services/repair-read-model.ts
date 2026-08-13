import { RepairOverview } from '../domain';
import { DecisionEventRepository } from './decision-event-store';

export class RepairReadModel {
  constructor(private readonly events: DecisionEventRepository) {}

  getTask(missionId: string, taskId: string): RepairOverview | undefined {
    const events = this.events.list(missionId).filter((event) => event.payload.taskId === taskId);
    if (events.length === 0) return undefined;
    const failure = this.last(events, 'FAILURE_CLASSIFIED');
    const advisory = this.last(events, 'REPAIR_ADVISORY_CREATED');
    const eligibility = this.last(events, 'REPAIR_ELIGIBILITY_EVALUATED');
    const completed = this.last(events, 'REPAIR_COMPLETED');
    const lastRepairIndex = events.reduce((index, event, current) => event.eventType === 'REPAIR_COMPLETED' ? current : index, -1);
    const lastDispatchIndex = events.reduce((index, event, current) => event.eventType === 'EXECUTION_DISPATCHED' ? current : index, -1);
    const eligibilityStatus = eligibility?.payload.status as 'ELIGIBLE' | 'BLOCKED' | undefined;
    const repairCompleted = completed?.payload.success === true;
    const nextAction = !failure ? 'CLASSIFY_FAILURE'
      : !advisory ? 'REVIEW_ADVISORY'
        : lastDispatchIndex > lastRepairIndex ? 'NONE'
        : eligibilityStatus === 'BLOCKED' && eligibility?.payload.requiresApproval === true ? 'APPROVE_REPAIR'
          : eligibilityStatus === 'ELIGIBLE' ? 'START_REPAIR'
            : repairCompleted && lastRepairIndex > lastDispatchIndex ? 'RETRY_EXECUTION' : 'NONE';
    return { missionId, taskId, failureSnapshotId: failure?.payload.snapshotId as string | undefined, failureCategory: failure?.payload.category as RepairOverview['failureCategory'], failureCode: failure?.payload.failureCode as string | undefined, advisory: advisory ? { id: advisory.aggregateId, missionId, version: advisory.version, taskId, approvedSolutionId: '', failureCode: String(advisory.payload.failureCode ?? ''), likelyCapabilities: [], likelySpecialistRole: String(advisory.payload.specialistRole ?? ''), estimatedSuccess: 0, risk: advisory.payload.risk as RepairOverview['risk'] extends infer R ? R & string : never, rationale: '', status: 'ADVISORY_ONLY', contextHash: advisory.aggregateId } : undefined, eligibility: eligibility ? { id: eligibility.aggregateId, missionId, version: eligibility.version, taskId, attemptCount: Number(eligibility.payload.attemptCount ?? 0), maxAttempts: Number(eligibility.payload.maxAttempts ?? 0), status: eligibilityStatus ?? 'BLOCKED', reason: '', requiresApproval: eligibility.payload.requiresApproval === true } : undefined, repairCompleted, nextAction };
  }

  listMission(missionId: string): RepairOverview[] {
    const taskIds = new Set<string>();
    for (const event of this.events.list(missionId)) if (typeof event.payload.taskId === 'string') taskIds.add(event.payload.taskId);
    return [...taskIds].sort().map((taskId) => this.getTask(missionId, taskId)).filter((overview): overview is RepairOverview => !!overview);
  }

  private last(events: readonly { eventType: string }[], type: string) { for (let index = events.length - 1; index >= 0; index -= 1) if (events[index].eventType === type) return events[index] as typeof events[number] & { aggregateId: string; version: number; payload: Record<string, string | number | boolean | null> }; return undefined; }
}
