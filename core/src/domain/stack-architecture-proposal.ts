import { ArchitectureDecision } from './architecture-decision';

export interface ArchitectureModule {
  name: string;
  responsibility: string;
  exposes: string[];
  dependsOn: string[];
}

export interface StackArchitectureProposal {
  id: string;
  missionId: string;
  approvedSolutionId: string;
  stackKey: string;
  deliveryTargetKind: string;
  architectureStyle: string;
  modules: ArchitectureModule[];
  boundaries: string[];
  dependencies: string[];
  persistence?: string;
  security: string[];
  communication: string[];
  observability: string[];
  buildStrategy: string;
  testStrategy: string;
  deploymentStrategy: string;
  decisions: ArchitectureDecision[];
  alternatives: string[];
  tradeoffs: string[];
  risks: string[];
  status: 'PROPOSED' | 'APPROVED';
}
