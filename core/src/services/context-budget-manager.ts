import { ContextItem, ContextPack } from '../domain';

export interface ContextBudgetInput {
  items: ContextItem[];
  relevantTags?: string[];
  maxTokens: number;
}

/** Selects the smallest relevant context and strips forbidden content. */
export class ContextBudgetManager {
  build(input: ContextBudgetInput): ContextPack {
    if (input.maxTokens <= 0) throw new Error('Context budget must be positive');
    const tags = new Set(input.relevantTags ?? []);
    const sanitized = input.items.map((item) => ({ ...item, content: this.sanitize(item.content) }));
    const relevant = sanitized.filter((item) => item.required || tags.size === 0 || item.tags.some((tag) => tags.has(tag)));
    relevant.sort((a, b) => Number(b.required ?? false) - Number(a.required ?? false) || b.priority - a.priority);
    const selected: ContextItem[] = [];
    const omitted: string[] = [];
    let used = 0;
    for (const item of relevant) {
      const estimate = this.estimate(item.content);
      if (used + estimate <= input.maxTokens || item.required && selected.length === 0) {
        selected.push(item);
        used += estimate;
      } else omitted.push(item.id);
    }
    for (const item of sanitized) if (!relevant.some((candidate) => candidate.id === item.id)) omitted.push(item.id);
    return { items: selected, estimatedTokens: used, omittedItemIds: omitted, schemaVersion: 'context-v1' };
  }

  private estimate(content: string): number { return Math.max(1, Math.ceil(content.length / 4)); }
  private sanitize(content: string): string {
    return content
      .replace(/(?:api[_ -]?key|token|password|secret)\s*[:=]\s*[^\s,;]+/gi, '[REDACTED]')
      .replace(/\[?(?:chain[- ]of[- ]thought|hidden deliberation|private reasoning)\]?\s*[:=].*$/gim, '[REDACTED]');
  }
}
