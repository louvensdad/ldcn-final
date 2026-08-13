import { ExecutionContextBuilder } from '../services/execution-context-builder';
import { RuntimeBoundaryGuard } from '../services/runtime-boundary-guard';

describe('RuntimeBoundaryGuard', () => {
  const context = () => new ExecutionContextBuilder().build({ missionId: 'boundary-1', missionSummary: 'summary', approvedSolutionId: 'solution-1', contractRefs: [], architectureDecisionRefs: [], taskId: 'task-1', taskDescription: 'task', dependencies: [], affectedArtifacts: [], capabilityKeys: [], territory: 'backend', allowedTools: ['test', 'build'] });

  it('allows tools inside the execution territory', () => {
    expect(() => new RuntimeBoundaryGuard().assertAllowed({ context: context(), requestedTerritory: 'backend', requestedTools: ['test'] })).not.toThrow();
  });

  it('blocks territory and tool violations', () => {
    const guard = new RuntimeBoundaryGuard();
    expect(() => guard.assertAllowed({ context: context(), requestedTerritory: 'frontend', requestedTools: [] })).toThrow('RUNTIME_TERRITORY_FORBIDDEN');
    expect(() => guard.assertAllowed({ context: context(), requestedTerritory: 'backend', requestedTools: ['deploy'] })).toThrow('RUNTIME_TOOLS_FORBIDDEN');
  });
});
