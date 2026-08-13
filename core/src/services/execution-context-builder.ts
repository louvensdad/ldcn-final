import { createHash } from 'crypto';
import { ExecutionContextInput, ExecutionContextSnapshot } from '../domain';
import { generateId } from '../utils/id';

/** Builds the minimum executor context; it does not execute work or persist secrets. */
export class ExecutionContextBuilder {
  build(input: ExecutionContextInput): ExecutionContextSnapshot {
    if (!input.missionId || !input.taskId || !input.approvedSolutionId) throw new Error('EXECUTION_CONTEXT_INCOMPLETE');
    const normalized = {
      missionId: input.missionId,
      taskId: input.taskId,
      approvedSolutionId: input.approvedSolutionId,
      missionSummary: this.clean(input.missionSummary),
      contractRefs: this.refs(input.contractRefs),
      architectureDecisionRefs: this.refs(input.architectureDecisionRefs),
      taskDescription: this.clean(input.taskDescription),
      dependencies: this.refs(input.dependencies),
      affectedArtifacts: this.refs(input.affectedArtifacts),
      capabilityKeys: this.refs(input.capabilityKeys),
      territory: this.clean(input.territory),
      allowedTools: this.refs(input.allowedTools),
      previousEvidence: this.refs(input.previousEvidence ?? []),
      handoffPackageId: input.handoffPackageId,
      routingDecisionContextHash: input.routingDecisionContextHash,
    };
    const contextHash = createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
    return { id: generateId(), version: 1, ...normalized, contextHash };
  }

  private clean(value: string): string {
    return value.replace(/(?:api[_ -]?key|token|secret|password)\s*[:=]\s*[^\s,;]+/gi, '[REDACTED]')
      .replace(/chain.?of.?thought|hidden deliberation|private reasoning/gi, '[OMITTED]');
  }

  private refs(values: readonly string[]): string[] {
    return [...new Set(values.map((value) => this.clean(value)).filter(Boolean))];
  }
}
