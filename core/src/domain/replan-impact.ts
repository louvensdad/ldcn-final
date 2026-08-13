import { ReplanReason } from './generator-state';

export interface ReplanImpact {
  reason: ReplanReason;
  requirements: boolean;
  topology: boolean;
  solution: boolean;
  architecture: boolean;
  team: boolean;
  pipeline: boolean;
  explanation: string;
}
