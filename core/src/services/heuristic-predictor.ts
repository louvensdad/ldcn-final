import { AgentRanking, CapabilityRanking, CostPrediction, JobComplexityPrediction, JobRiskPrediction, LearningOutcome, RepairSuccessPrediction, StackFitPrediction } from '../domain';
import { generateId } from '../utils/id';

export interface PredictionGateway {
  predictJobComplexity(input: { features: Record<string, unknown> }): Promise<JobComplexityPrediction>;
  predictJobRisk(input: { features: Record<string, unknown> }): Promise<JobRiskPrediction>;
  predictStackFit(input: { stackKeys: string[]; features: Record<string, unknown> }): Promise<StackFitPrediction[]>;
  rankAgents(input: { agentInstanceIds: string[]; features: Record<string, unknown> }): Promise<AgentRanking[]>;
  rankCapabilities(input: { capabilityKeys: string[]; features: Record<string, unknown> }): Promise<CapabilityRanking[]>;
  predictRepairSuccess(input: { features: Record<string, unknown> }): Promise<RepairSuccessPrediction>;
  estimateCost(input: { features: Record<string, unknown> }): Promise<CostPrediction>;
}

/** Shadow-only predictor. Its signals are advisory and never mutate policy decisions. */
export class HeuristicPredictor implements PredictionGateway {
  private outcomes: LearningOutcome[] = [];
  private readonly version = 'heuristic-v1';

  recordOutcome(input: Omit<LearningOutcome, 'id' | 'version' | 'featureSchemaVersion' | 'features'> & { features: Record<string, unknown> }): LearningOutcome {
    const outcome: LearningOutcome = {
      ...input,
      id: generateId(), version: 1, featureSchemaVersion: 'features-v1',
      features: this.sanitize(input.features),
    };
    this.outcomes.push(outcome);
    return outcome;
  }

  async predictJobComplexity(input: { features: Record<string, unknown> }): Promise<JobComplexityPrediction> {
    const text = JSON.stringify(input.features).toLowerCase();
    const value = /migration|cross.?stack|distributed|production/.test(text) ? 'HIGH' : /security|database|integration|performance/.test(text) ? 'MEDIUM' : 'LOW';
    return { value, confidence: this.confidence(), predictorVersion: this.version };
  }

  async predictJobRisk(input: { features: Record<string, unknown> }): Promise<JobRiskPrediction> {
    const text = JSON.stringify(input.features).toLowerCase();
    const value = /payment|production|critical/.test(text) ? 'HIGH' : /security|migration|auth/.test(text) ? 'MEDIUM' : 'LOW';
    return { value, confidence: this.confidence(), predictorVersion: this.version };
  }

  async predictStackFit(input: { stackKeys: string[]; features: Record<string, unknown> }): Promise<StackFitPrediction[]> { return input.stackKeys.map((stackKey, index) => ({ stackKey, score: Math.max(0, 1 - index * 0.1), confidence: this.confidence(), predictorVersion: this.version })); }
  async rankAgents(input: { agentInstanceIds: string[]; features: Record<string, unknown> }): Promise<AgentRanking[]> { return input.agentInstanceIds.map((agentInstanceId, index) => ({ agentInstanceId, score: Math.max(0, 1 - index * 0.1), confidence: this.confidence(), predictorVersion: this.version })); }
  async rankCapabilities(input: { capabilityKeys: string[]; features: Record<string, unknown> }): Promise<CapabilityRanking[]> { return input.capabilityKeys.map((capabilityKey, index) => ({ capabilityKey, score: Math.max(0, 1 - index * 0.1), confidence: this.confidence(), predictorVersion: this.version })); }
  async predictRepairSuccess(input: { features: Record<string, unknown> }): Promise<RepairSuccessPrediction> { return { estimate: /security|critical|production/i.test(JSON.stringify(input.features)) ? 0.35 : 0.5, confidence: this.confidence(), predictorVersion: this.version }; }
  async estimateCost(input: { features: Record<string, unknown> }): Promise<CostPrediction> { return { amount: /high|critical|distributed/i.test(JSON.stringify(input.features)) ? 100 : 50, currency: 'USD', confidence: this.confidence(), predictorVersion: this.version }; }

  getOutcomes(): readonly LearningOutcome[] { return this.outcomes; }
  private confidence(): number { return this.outcomes.length === 0 ? 0.5 : Math.min(0.95, 0.5 + this.outcomes.length * 0.05); }

  private sanitize(features: Record<string, unknown>): Record<string, string | number | boolean | null> {
    const safe: Record<string, string | number | boolean | null> = {};
    for (const [key, value] of Object.entries(features)) {
      if (/secret|token|password|api.?key|chain.?of.?thought|cot|reasoning/i.test(key)) continue;
      if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') safe[key] = value;
    }
    return safe;
  }
}
