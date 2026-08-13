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
});
