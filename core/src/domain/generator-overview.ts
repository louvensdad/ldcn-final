export type GeneratorNextAction = 'START_EXECUTION' | 'RESOLVE_SCOPE_EXPANSION' | 'REVIEW_JOB' | 'NONE';

export interface GeneratorOverview {
  missionId: string;
  status: 'READY_FOR_EXECUTION' | 'BLOCKED' | 'ACTIVE';
  intentVersion: number;
  solutionVersion: number;
  architectureVersion: number;
  teamVersion: number;
  pipelineVersion: number;
  approvedStackCount: number;
  pipelineNodeCount: number;
  blockedPipelineNodeCount: number;
  nextAction: GeneratorNextAction;
}
