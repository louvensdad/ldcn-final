/**
 * CORE-004 — structured output contracts. Sem zod: não é dependência padrão do projeto hoje
 * (auditoria confirmou zero uso em qualquer package.json), então validação é hand-rolled — mesmo
 * estilo do `validateStructure()` já existente em agent-execution.service.ts (checagem mecânica
 * de shape, sem framework). Cada `validate*` retorna o resultado tipado ou `null` — nunca lança —
 * quem chama decide o que fazer com `null` (repair).
 */

export type Severity = 'LOW' | 'MEDIUM' | 'HIGH';

export interface AnalysisResultV1 {
  understanding: string;
  affectedAreas: string[];
  risks: { description: string; severity: Severity }[];
  assumptions: string[];
  ambiguities: string[];
  confidence: number;
}

export interface ImplementationPlanV1 {
  steps: { order: number; description: string; targetPaths: string[]; dependsOnStep?: number[] }[];
  expectedCreates: string[];
  expectedModifies: string[];
  expectedReuses: string[];
  validationPlan: string[];
  confidence: number;
}

export type ChangeOperation = 'CREATE' | 'MODIFY' | 'REUSE' | 'NO_CHANGE';

export interface ChangeSetProposalV1 {
  changes: { operation: ChangeOperation; path: string; content?: string; diff?: string; rationale: string }[];
  requirementCoverageSummary: { requirementId: string; implementationNote: string }[];
  confidence: number;
}

export type RequirementCheckStatus = 'SATISFIED' | 'PARTIAL' | 'UNSATISFIED';

export interface SelfCheckResultV1 {
  verdict: 'READY' | 'NEEDS_REPAIR';
  findings: { category: string; path?: string; issue: string; severity: Severity }[];
  requirementCheck: { requirementId: string; status: RequirementCheckStatus; evidenceSummary: string }[];
  confidence: number;
}

export type CodeReviewCategory = 'CORRECTNESS' | 'REQUIREMENT' | 'ARCHITECTURE' | 'MAINTAINABILITY' | 'TESTING' | 'OTHER';
export type CodeReviewSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'BLOCKER';

export interface CodeReviewResultV1 {
  verdict: 'APPROVED' | 'REWORK_REQUIRED';
  summary: string;
  findings: {
    id: string;
    category: CodeReviewCategory;
    severity: CodeReviewSeverity;
    path?: string;
    message: string;
    requirementIds?: string[];
  }[];
  requirementAssessment: {
    requirementId: string;
    status: RequirementCheckStatus;
    evidenceSummary: string;
  }[];
  confidence: number;
}

const SEVERITIES: Severity[] = ['LOW', 'MEDIUM', 'HIGH'];
const OPERATIONS: ChangeOperation[] = ['CREATE', 'MODIFY', 'REUSE', 'NO_CHANGE'];
const REQUIREMENT_STATUSES: RequirementCheckStatus[] = ['SATISFIED', 'PARTIAL', 'UNSATISFIED'];
const REVIEW_CATEGORIES: CodeReviewCategory[] = ['CORRECTNESS', 'REQUIREMENT', 'ARCHITECTURE', 'MAINTAINABILITY', 'TESTING', 'OTHER'];
const REVIEW_SEVERITIES: CodeReviewSeverity[] = ['LOW', 'MEDIUM', 'HIGH', 'BLOCKER'];

function isString(v: unknown): v is string {
  return typeof v === 'string';
}
function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every(isString);
}
function isConfidence(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
}
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function validateAnalysisResult(raw: unknown): AnalysisResultV1 | null {
  if (!isRecord(raw)) return null;
  if (!isString(raw.understanding) || raw.understanding.trim().length === 0) return null;
  if (!isStringArray(raw.affectedAreas)) return null;
  if (!Array.isArray(raw.risks) || !raw.risks.every((r) => isRecord(r) && isString(r.description) && SEVERITIES.includes(r.severity as Severity))) return null;
  if (!isStringArray(raw.assumptions)) return null;
  if (!isStringArray(raw.ambiguities)) return null;
  if (!isConfidence(raw.confidence)) return null;
  return {
    understanding: raw.understanding,
    affectedAreas: raw.affectedAreas,
    risks: raw.risks as AnalysisResultV1['risks'],
    assumptions: raw.assumptions,
    ambiguities: raw.ambiguities,
    confidence: raw.confidence,
  };
}

export function validateImplementationPlan(raw: unknown): ImplementationPlanV1 | null {
  if (!isRecord(raw)) return null;
  if (
    !Array.isArray(raw.steps) ||
    raw.steps.length === 0 ||
    !raw.steps.every(
      (s) =>
        isRecord(s) &&
        typeof s.order === 'number' &&
        isString(s.description) &&
        isStringArray(s.targetPaths) &&
        (s.dependsOnStep === undefined || (Array.isArray(s.dependsOnStep) && s.dependsOnStep.every((n) => typeof n === 'number')))
    )
  )
    return null;
  if (!isStringArray(raw.expectedCreates)) return null;
  if (!isStringArray(raw.expectedModifies)) return null;
  if (!isStringArray(raw.expectedReuses)) return null;
  if (!isStringArray(raw.validationPlan)) return null;
  if (!isConfidence(raw.confidence)) return null;
  return {
    steps: raw.steps as ImplementationPlanV1['steps'],
    expectedCreates: raw.expectedCreates,
    expectedModifies: raw.expectedModifies,
    expectedReuses: raw.expectedReuses,
    validationPlan: raw.validationPlan,
    confidence: raw.confidence,
  };
}

export function validateChangeSetProposal(raw: unknown): ChangeSetProposalV1 | null {
  if (!isRecord(raw)) return null;
  if (
    !Array.isArray(raw.changes) ||
    raw.changes.length === 0 ||
    !raw.changes.every(
      (c) =>
        isRecord(c) &&
        OPERATIONS.includes(c.operation as ChangeOperation) &&
        isString(c.path) &&
        isString(c.rationale) &&
        (c.content === undefined || isString(c.content)) &&
        (c.diff === undefined || isString(c.diff))
    )
  )
    return null;
  if (
    !Array.isArray(raw.requirementCoverageSummary) ||
    !raw.requirementCoverageSummary.every((r) => isRecord(r) && isString(r.requirementId) && isString(r.implementationNote))
  )
    return null;
  if (!isConfidence(raw.confidence)) return null;
  return {
    changes: raw.changes as ChangeSetProposalV1['changes'],
    requirementCoverageSummary: raw.requirementCoverageSummary as ChangeSetProposalV1['requirementCoverageSummary'],
    confidence: raw.confidence,
  };
}

export function validateSelfCheckResult(raw: unknown): SelfCheckResultV1 | null {
  if (!isRecord(raw)) return null;
  if (raw.verdict !== 'READY' && raw.verdict !== 'NEEDS_REPAIR') return null;
  if (
    !Array.isArray(raw.findings) ||
    !raw.findings.every(
      (f) => isRecord(f) && isString(f.category) && isString(f.issue) && SEVERITIES.includes(f.severity as Severity) && (f.path === undefined || isString(f.path))
    )
  )
    return null;
  if (
    !Array.isArray(raw.requirementCheck) ||
    !raw.requirementCheck.every(
      (r) => isRecord(r) && isString(r.requirementId) && REQUIREMENT_STATUSES.includes(r.status as RequirementCheckStatus) && isString(r.evidenceSummary)
    )
  )
    return null;
  if (!isConfidence(raw.confidence)) return null;
  return {
    verdict: raw.verdict,
    findings: raw.findings as SelfCheckResultV1['findings'],
    requirementCheck: raw.requirementCheck as SelfCheckResultV1['requirementCheck'],
    confidence: raw.confidence,
  };
}

export function validateCodeReviewResult(raw: unknown): CodeReviewResultV1 | null {
  if (!isRecord(raw)) return null;
  if (raw.verdict !== 'APPROVED' && raw.verdict !== 'REWORK_REQUIRED') return null;
  if (!isString(raw.summary) || raw.summary.trim().length === 0) return null;
  if (!Array.isArray(raw.findings) || !raw.findings.every((finding) =>
    isRecord(finding) && isString(finding.id) && isString(finding.message) &&
    REVIEW_CATEGORIES.includes(finding.category as CodeReviewCategory) &&
    REVIEW_SEVERITIES.includes(finding.severity as CodeReviewSeverity) &&
    (finding.path === undefined || isString(finding.path)) &&
    (finding.requirementIds === undefined || isStringArray(finding.requirementIds)))) return null;
  if (!Array.isArray(raw.requirementAssessment) || !raw.requirementAssessment.every((assessment) =>
    isRecord(assessment) && isString(assessment.requirementId) &&
    REQUIREMENT_STATUSES.includes(assessment.status as RequirementCheckStatus) &&
    isString(assessment.evidenceSummary))) return null;
  if (!isConfidence(raw.confidence)) return null;
  return raw as unknown as CodeReviewResultV1;
}
