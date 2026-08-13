import { AgentInstance } from '../domain';

export interface ReviewerResolution {
  candidateIds: string[];
  selectedReviewerId?: string;
  blocked: boolean;
}

export class ReviewerResolver {
  resolve(candidates: AgentInstance[], executorId?: string): ReviewerResolution {
    const eligible = candidates.filter((agent) => this.isReviewer(agent) && agent.id !== executorId);
    return { candidateIds: eligible.map((agent) => agent.id), selectedReviewerId: eligible[0]?.id, blocked: eligible.length === 0 };
  }

  private isReviewer(agent: AgentInstance): boolean { return agent.role === 'REVIEWER' || agent.role === 'INTEGRATION_REVIEWER'; }
}
