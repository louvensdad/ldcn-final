import { IntelligentGeneratorCommandService, IntelligentGeneratorQueryService } from '../services/intelligent-generator-application';

describe('GeneratorOverview', () => {
  it('builds a console read model without orchestration concerns', () => {
    const command = new IntelligentGeneratorCommandService();
    const result = command.generate({ missionId: 'overview-1', rawUserIdea: 'Quero uma API backend.' });
    const overview = new IntelligentGeneratorQueryService(new Map([['overview-1', result]])).getGeneratorOverview('overview-1');
    expect(overview?.status).toBe('READY_FOR_EXECUTION');
    expect(overview?.nextAction).toBe('START_EXECUTION');
    expect(overview?.pipelineNodeCount).toBeGreaterThan(0);
    expect(new IntelligentGeneratorQueryService(new Map([['overview-1', result]])).getNextActions('overview-1').length).toBeGreaterThan(0);
    const query = new IntelligentGeneratorQueryService(new Map([['overview-1', result]]));
    expect(query.getRequirements('overview-1')?.id).toBe(result.contract.id);
    expect(query.getTopology('overview-1')?.id).toBe(result.topology.id);
    expect(query.getArchitecture('overview-1')?.id).toBe(result.architectureComposition.id);
    expect(query.getTeamComposition('overview-1')?.id).toBe(result.agentTeam.id);
    expect(query.getLearningSignals('overview-1').sampleCount).toBe(0);
  });

  // Regressão: doc 34 exige que uma Executable Mission nunca reporte READY_FOR_EXECUTION com
  // zero stacks/pipeline. A correção original (topology-resolver.ts) só cobria a frase exata
  // "landing page" — um typo como "lading page" (achado manualmente pelo usuário testando o
  // frontend) escapava por não bater em nenhuma keyword e ainda assim reportava
  // READY_FOR_EXECUTION/START_EXECUTION com approvedStackCount=0 e pipelineNodeCount=0. Este
  // teste garante o guardrail no nível certo (o read model), não em keywords específicas.
  it('never reports READY_FOR_EXECUTION with zero stacks/pipeline, regardless of why the idea was too vague to infer a target', () => {
    const command = new IntelligentGeneratorCommandService();
    const result = command.generate({ missionId: 'overview-vague', rawUserIdea: 'eu quero um lading page para produtos' });
    const overview = new IntelligentGeneratorQueryService(new Map([['overview-vague', result]])).getGeneratorOverview('overview-vague');
    expect(result.approvedSolution.selectedStacks).toHaveLength(0);
    expect(result.pipeline.nodes).toHaveLength(0);
    expect(overview?.status).not.toBe('READY_FOR_EXECUTION');
    expect(overview?.nextAction).not.toBe('START_EXECUTION');
    expect(overview?.status).toBe('SOLUTION_SELECTION_REQUIRED');
    expect(overview?.nextAction).toBe('RESOLVE_SOLUTION_SELECTION');
  });

  // Follow-up: the read model (getGeneratorOverview) and the *persisted* GeneratorMissionState
  // were computed by two different code paths (getGeneratorOverview's own logic vs
  // IntelligentGeneratorCommandService#advanceState). Fixing only the read model left
  // generatorState — what the frontend's Stage Rail renders — still saying
  // READY_FOR_EXECUTION for the exact same mission, which is what the user's screenshot caught
  // next. Both must agree.
  it('persists BLOCKED (not READY_FOR_EXECUTION) in GeneratorMissionState when the solution ended up empty', () => {
    const command = new IntelligentGeneratorCommandService();
    command.generate({ missionId: 'overview-vague-state', rawUserIdea: 'eu quero um lading page para produtos' });
    expect(command.getState('overview-vague-state')?.state).toBe('BLOCKED');
  });
});
