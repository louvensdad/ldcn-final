export type GeneratorNextAction = 'START_EXECUTION' | 'RESOLVE_SCOPE_EXPANSION' | 'REVIEW_JOB' | 'RESOLVE_SOLUTION_SELECTION' | 'NONE';

export interface GeneratorOverview {
  missionId: string;
  status: 'READY_FOR_EXECUTION' | 'BLOCKED' | 'ACTIVE' | 'SOLUTION_SELECTION_REQUIRED';
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
