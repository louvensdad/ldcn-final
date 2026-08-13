import { HeuristicPredictor } from '../services/heuristic-predictor';

describe('HeuristicPredictor', () => {
  it('records sanitized shadow outcomes without secrets or hidden reasoning', async () => {
    const predictor = new HeuristicPredictor();
    const outcome = predictor.recordOutcome({ missionId: 'learning-1', taskId: 'task-1', outcomeType: 'JOB_ROUTING', features: { stack: 'java', apiKey: 'secret', chainOfThought: 'hidden' }, decision: 'POLICY_JAVA', result: 'ROUTED', success: true });
    expect(outcome.features).toEqual({ stack: 'java' });
    expect((await predictor.predictJobRisk({ features: { security: true } })).value).toBe('MEDIUM');
  });

  it('keeps predictions advisory and versioned', async () => {
    const predictor = new HeuristicPredictor();
    const prediction = await predictor.predictJobComplexity({ features: { migration: true } });
    expect(prediction.value).toBe('HIGH');
    expect(prediction.predictorVersion).toBe('heuristic-v1');
    expect(predictor.getOutcomes()).toHaveLength(0);
  });

  it('implements the complete shadow prediction gateway', async () => {
    const predictor = new HeuristicPredictor();
    await expect(predictor.predictStackFit({ stackKeys: ['stack-a', 'stack-b'], features: {} })).resolves.toHaveLength(2);
    await expect(predictor.rankAgents({ agentInstanceIds: ['agent-a'], features: {} })).resolves.toHaveLength(1);
    await expect(predictor.rankCapabilities({ capabilityKeys: ['testing'], features: {} })).resolves.toHaveLength(1);
    await expect(predictor.predictRepairSuccess({ features: {} })).resolves.toEqual(expect.objectContaining({ estimate: 0.5 }));
    await expect(predictor.estimateCost({ features: {} })).resolves.toEqual(expect.objectContaining({ currency: 'USD' }));
  });
});
