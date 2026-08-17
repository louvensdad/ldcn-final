/**
 * CORE-011 §8 — contrato estruturado de extração de Requirements a partir da ideia do usuário.
 * Mesmo estilo hand-rolled de cognitive-schemas.ts (sem zod, não é dependência do projeto):
 * `validateDiscoveryRequirementsResult` retorna o resultado tipado ou `null` — nunca lança.
 */

export type RequirementCategory =
  | 'FUNCTIONAL'
  | 'NON_FUNCTIONAL'
  | 'CONSTRAINT'
  | 'DATA'
  | 'INTEGRATION'
  | 'SECURITY'
  | 'UX'
  | 'OPERATIONS'
  | 'COMPLIANCE'
  | 'OTHER';

/** §9 — nunca "USER_EXPLICIT" para algo que o modelo inferiu; a IA só pode marcar o que ela mesma
 * derivou como DISCOVERY_DERIVED. Mapeado depois para Requirement.source (§7). */
export type DiscoveryRequirementSourceBasis = 'USER_EXPLICIT' | 'DISCOVERY_DERIVED';

export interface DiscoveryRequirementItemV1 {
  statement: string;
  category: RequirementCategory;
  priority?: string;
  sourceBasis: DiscoveryRequirementSourceBasis;
}

export interface DiscoveryAmbiguityV1 {
  description: string;
  affectedRequirementIndexes?: number[];
}

export interface DiscoveryRequirementsResultV1 {
  missionSummary: string;
  requirements: DiscoveryRequirementItemV1[];
  ambiguities: DiscoveryAmbiguityV1[];
  assumptions: string[];
}

const CATEGORIES: RequirementCategory[] = [
  'FUNCTIONAL', 'NON_FUNCTIONAL', 'CONSTRAINT', 'DATA', 'INTEGRATION',
  'SECURITY', 'UX', 'OPERATIONS', 'COMPLIANCE', 'OTHER',
];
const SOURCE_BASES: DiscoveryRequirementSourceBasis[] = ['USER_EXPLICIT', 'DISCOVERY_DERIVED'];

function isString(v: unknown): v is string {
  return typeof v === 'string';
}
function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every(isString);
}
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function validateDiscoveryRequirementsResult(raw: unknown): DiscoveryRequirementsResultV1 | null {
  if (!isRecord(raw)) return null;
  if (!isString(raw.missionSummary) || raw.missionSummary.trim().length === 0) return null;

  if (!Array.isArray(raw.requirements) || raw.requirements.length === 0) return null;
  for (const item of raw.requirements) {
    if (!isRecord(item)) return null;
    if (!isString(item.statement) || item.statement.trim().length === 0) return null;
    if (!CATEGORIES.includes(item.category as RequirementCategory)) return null;
    if (item.priority !== undefined && !isString(item.priority)) return null;
    if (!SOURCE_BASES.includes(item.sourceBasis as DiscoveryRequirementSourceBasis)) return null;
  }

  if (!Array.isArray(raw.ambiguities)) return null;
  for (const a of raw.ambiguities) {
    if (!isRecord(a)) return null;
    if (!isString(a.description)) return null;
    if (a.affectedRequirementIndexes !== undefined) {
      if (!Array.isArray(a.affectedRequirementIndexes) || !a.affectedRequirementIndexes.every((n) => typeof n === 'number')) return null;
    }
  }

  if (!isStringArray(raw.assumptions)) return null;

  return raw as unknown as DiscoveryRequirementsResultV1;
}

/** §10 — deduplicação básica: normalização textual, nunca semantic search. */
export function normalizeStatement(statement: string): string {
  return statement.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.,;!?]+$/g, '');
}
