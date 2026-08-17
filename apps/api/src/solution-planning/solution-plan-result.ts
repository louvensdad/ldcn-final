export type SolutionType = 'BACKEND' | 'FRONTEND' | 'FULLSTACK' | 'AUTOMATION' | 'DATA' | 'OTHER';
export type SolutionComponentKind = 'BACKEND' | 'FRONTEND' | 'DATABASE' | 'INTEGRATION' | 'WORKER' | 'OTHER';
export type RequirementDisposition = 'COVERED' | 'REQUIRES_ARCHITECTURE_DECISION' | 'UNSUPPORTED';

export interface SolutionPlanResultV1 {
  solutionType: SolutionType;
  summary: string;
  components: {
    key: string;
    name: string;
    kind: SolutionComponentKind;
    responsibilities: string[];
    requirementKeys: string[];
  }[];
  stackSelections: {
    componentKey: string;
    stackKey: string;
    stackVersion: string;
    rationale: string;
    requirementKeys: string[];
    confidence: number;
  }[];
  requirementDecisions: {
    requirementKey: string;
    disposition: RequirementDisposition;
    componentKeys: string[];
    rationale: string;
  }[];
  constraints: string[];
  nonFunctionalStrategies: { requirementKey: string; strategy: string }[];
  assumptions: string[];
  risks: { description: string; severity: 'LOW' | 'MEDIUM' | 'HIGH' }[];
  confidence: number;
}

const SOLUTION_TYPES: SolutionType[] = ['BACKEND', 'FRONTEND', 'FULLSTACK', 'AUTOMATION', 'DATA', 'OTHER'];
const COMPONENT_KINDS: SolutionComponentKind[] = ['BACKEND', 'FRONTEND', 'DATABASE', 'INTEGRATION', 'WORKER', 'OTHER'];
const DISPOSITIONS: RequirementDisposition[] = ['COVERED', 'REQUIRES_ARCHITECTURE_DECISION', 'UNSUPPORTED'];
const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH'];

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function string(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(string);
}
function confidence(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

/** Strict structural validation only. Semantic/stack/coverage policies live in pure validators. */
export function validateSolutionPlanResultV1(raw: unknown): SolutionPlanResultV1 | null {
  if (!record(raw) || !SOLUTION_TYPES.includes(raw.solutionType as SolutionType) || !string(raw.summary)) return null;
  if (!Array.isArray(raw.components) || raw.components.length === 0 || !raw.components.every((item) =>
    record(item) && string(item.key) && string(item.name) && COMPONENT_KINDS.includes(item.kind as SolutionComponentKind) &&
    strings(item.responsibilities) && item.responsibilities.length > 0 && strings(item.requirementKeys))) return null;
  if (!Array.isArray(raw.stackSelections) || !raw.stackSelections.every((item) =>
    record(item) && string(item.componentKey) && string(item.stackKey) && string(item.stackVersion) && string(item.rationale) &&
    strings(item.requirementKeys) && confidence(item.confidence))) return null;
  if (!Array.isArray(raw.requirementDecisions) || !raw.requirementDecisions.every((item) =>
    record(item) && string(item.requirementKey) && DISPOSITIONS.includes(item.disposition as RequirementDisposition) &&
    strings(item.componentKeys) && string(item.rationale))) return null;
  if (!strings(raw.constraints) || !strings(raw.assumptions)) return null;
  if (!Array.isArray(raw.nonFunctionalStrategies) || !raw.nonFunctionalStrategies.every((item) =>
    record(item) && string(item.requirementKey) && string(item.strategy))) return null;
  if (!Array.isArray(raw.risks) || !raw.risks.every((item) =>
    record(item) && string(item.description) && SEVERITIES.includes(item.severity as string))) return null;
  if (!confidence(raw.confidence)) return null;
  return raw as unknown as SolutionPlanResultV1;
}

export const SOLUTION_PLAN_RESULT_V1_SCHEMA = `Return ONLY valid JSON matching SolutionPlanResultV1:
{"solutionType":"BACKEND|FRONTEND|FULLSTACK|AUTOMATION|DATA|OTHER","summary":string,"components":[{"key":string,"name":string,"kind":"BACKEND|FRONTEND|DATABASE|INTEGRATION|WORKER|OTHER","responsibilities":[string],"requirementKeys":[string]}],"stackSelections":[{"componentKey":string,"stackKey":string,"stackVersion":string,"rationale":string,"requirementKeys":[string],"confidence":number_0_to_1}],"requirementDecisions":[{"requirementKey":string,"disposition":"COVERED|REQUIRES_ARCHITECTURE_DECISION|UNSUPPORTED","componentKeys":[string],"rationale":string}],"constraints":[string],"nonFunctionalStrategies":[{"requirementKey":string,"strategy":string}],"assumptions":[string],"risks":[{"description":string,"severity":"LOW|MEDIUM|HIGH"}],"confidence":number_0_to_1}.
Every IN_SCOPE requirement must occur exactly once in requirementDecisions. Use only supplied requirement keys, component keys and catalog stack keys/versions. Do not include deferred/not-applicable requirements as implementation decisions. Do not provide chain-of-thought.`;
