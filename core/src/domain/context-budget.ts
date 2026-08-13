export type ContextItemKind = 'CONTRACT' | 'DECISION' | 'ARTIFACT' | 'EVIDENCE' | 'CONSTRAINT' | 'SUMMARY' | 'TASK';

export interface ContextItem {
  id: string;
  kind: ContextItemKind;
  content: string;
  priority: number;
  tags: string[];
  required?: boolean;
}

export interface ContextPack {
  items: ContextItem[];
  estimatedTokens: number;
  omittedItemIds: string[];
  schemaVersion: string;
}
