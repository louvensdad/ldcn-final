import { HandoffPackage } from '../domain';

export class HandoffValidator {
  validate(handoff: HandoffPackage, expectedMissionId: string): void {
    if (handoff.missionId !== expectedMissionId) throw new Error('HANDOFF_CROSS_MISSION');
    if (!handoff.taskId || !handoff.fromTeam || !handoff.toTeam) throw new Error('HANDOFF_INCOMPLETE');
    if (handoff.contractRefs.length === 0) throw new Error('HANDOFF_INCOMPLETE');
    if (!handoff.contextHash || handoff.contextHash.length !== 64) throw new Error('HANDOFF_INCOMPLETE');
    if (handoff.decisions.some((decision) => /chain.?of.?thought|hidden deliberation|private reasoning/i.test(decision))) throw new Error('HANDOFF_FORBIDDEN_CONTENT');
  }
}
