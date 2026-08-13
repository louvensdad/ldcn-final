import { ReviewerResolver } from '../services/reviewer-resolver';
import { AgentInstance } from '../domain';

describe('ReviewerResolver', () => {
  const executor: AgentInstance = { id: 'executor', agentKey: 'backend.java.developer', role: 'DEVELOPER', stackKey: 'stack.java.spring-boot', reason: 'test' };
  const reviewer: AgentInstance = { id: 'reviewer', agentKey: 'backend.java.reviewer', role: 'REVIEWER', stackKey: 'stack.java.spring-boot', reason: 'test' };

  it('selects an independent reviewer', () => {
    const result = new ReviewerResolver().resolve([executor, reviewer], executor.id);
    expect(result.blocked).toBe(false);
    expect(result.selectedReviewerId).toBe('reviewer');
    expect(result.candidateIds).not.toContain('executor');
  });

  it('blocks when no reviewer is available', () => {
    expect(new ReviewerResolver().resolve([executor], executor.id).blocked).toBe(true);
  });
});
