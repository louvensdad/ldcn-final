import { ExecutionContextBuilder } from '../services/execution-context-builder';

describe('ExecutionContextBuilder', () => {
  it('builds a minimal sanitized snapshot for the existing runtime', () => {
    const snapshot = new ExecutionContextBuilder().build({
      missionId: 'context-1', missionSummary: 'API com api_key=hidden', approvedSolutionId: 'solution-1',
      contractRefs: ['contract-1'], architectureDecisionRefs: ['architecture-1'], taskId: 'task-1',
      taskDescription: 'Implementar endpoint', dependencies: ['task-0'], affectedArtifacts: ['src/api.ts'],
      capabilityKeys: ['typescript'], territory: 'backend', allowedTools: ['test'], previousEvidence: ['build passed'],
    });
    expect(snapshot.missionSummary).toContain('[REDACTED]');
    expect(snapshot.contextHash).toHaveLength(64);
    expect(JSON.stringify(snapshot)).not.toContain('hidden');
    expect(JSON.stringify(snapshot)).not.toMatch(/chain.?of.?thought|private reasoning/i);
  });

  it('rejects an incomplete runtime context', () => {
    expect(() => new ExecutionContextBuilder().build({} as never)).toThrow('EXECUTION_CONTEXT_INCOMPLETE');
  });
});
