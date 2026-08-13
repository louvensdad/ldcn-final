import { ContextBudgetManager } from '../services/context-budget-manager';

describe('ContextBudgetManager', () => {
  it('keeps required and relevant context within the budget', () => {
    const pack = new ContextBudgetManager().build({ maxTokens: 12, relevantTags: ['java'], items: [
      { id: 'contract', kind: 'CONTRACT', content: 'Java API contract', priority: 10, tags: ['java'], required: true },
      { id: 'flutter', kind: 'DECISION', content: 'Flutter unrelated context', priority: 10, tags: ['flutter'] },
      { id: 'evidence', kind: 'EVIDENCE', content: 'Build passed', priority: 5, tags: ['java'] },
    ] });
    expect(pack.items.map((item) => item.id)).toContain('contract');
    expect(pack.omittedItemIds).toContain('flutter');
    expect(pack.estimatedTokens).toBeLessThanOrEqual(12);
  });

  it('redacts secrets and hidden reasoning', () => {
    const pack = new ContextBudgetManager().build({ maxTokens: 100, items: [{ id: 'x', kind: 'SUMMARY', content: 'apiKey=abc123\nchain-of-thought: private', priority: 1, tags: [] }] });
    expect(pack.items[0].content).not.toContain('abc123');
    expect(pack.items[0].content).toContain('[REDACTED]');
  });
});
