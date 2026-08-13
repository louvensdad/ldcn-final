export interface StackFitPrediction { stackKey: string; score: number; confidence: number; predictorVersion: string; }
export interface AgentRanking { agentInstanceId: string; score: number; confidence: number; predictorVersion: string; }
export interface CapabilityRanking { capabilityKey: string; score: number; confidence: number; predictorVersion: string; }
export interface RepairSuccessPrediction { estimate: number; confidence: number; predictorVersion: string; }
export interface CostPrediction { amount: number; currency: string; confidence: number; predictorVersion: string; }
