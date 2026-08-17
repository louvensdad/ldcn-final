export interface StackRef { stackKey: string; stackVersion: string }
export interface ArchitectureProposalV1 {
  architectureStyle: string; summary: string;
  modules: { key: string; name: string; responsibilities: string[]; componentKeys: string[]; requirementKeys: string[]; stackRefs: StackRef[]; dependsOn: string[] }[];
  decisions: { key: string; title: string; decision: string; rationale: string; requirementKeys: string[]; componentKeys: string[]; moduleKeys: string[]; stackRefs: StackRef[] }[];
  integrations: { key: string; fromModuleKey: string; toModuleKey?: string; externalSystem?: string; interactionType: string; requirementKeys: string[] }[];
  dataFlows: { key: string; description: string; moduleKeys: string[]; requirementKeys: string[] }[];
  securityBoundaries: { key: string; description: string; moduleKeys: string[]; requirementKeys: string[] }[];
  requirementMappings: { requirementKey: string; moduleKeys: string[]; decisionKeys: string[] }[];
  risks: { description: string; severity: 'LOW' | 'MEDIUM' | 'HIGH' }[]; assumptions: string[]; confidence: number;
}

export interface ArchitectureReviewResultV1 {
  verdict: 'APPROVED' | 'CHANGES_REQUIRED' | 'CONFLICT'; summary: string;
  findings: { id: string; category: 'STRUCTURE' | 'DEPENDENCY' | 'REQUIREMENT' | 'STACK' | 'SECURITY' | 'DATA' | 'INTEGRATION' | 'OPERABILITY' | 'OTHER'; severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'BLOCKER'; message: string; moduleKeys?: string[]; decisionKeys?: string[]; requirementKeys?: string[]; proposedResolution?: string }[];
  requirementAssessment: { requirementKey: string; status: 'SATISFIED' | 'PARTIAL' | 'UNSATISFIED'; evidenceSummary: string }[]; confidence: number;
}

export interface ArchitectureArbitrationResultV1 {
  verdict: 'RESOLVED' | 'BLOCKED_NEEDS_HUMAN'; resolutionSummary: string;
  resolutions: { findingId: string; action: 'ACCEPT_PROPOSAL' | 'MODIFY_ARCHITECTURE' | 'REJECT_RECOMMENDATION'; rationale: string }[];
  unresolvedFindingIds: string[]; finalArchitecture?: ArchitectureProposalV1; confidence: number;
}

const rec = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const strs = (v: unknown): v is string[] => Array.isArray(v) && v.every(str);
const conf = (v: unknown): v is number => typeof v === 'number' && v >= 0 && v <= 1;
const stackRefs = (v: unknown) => Array.isArray(v) && v.every((x) => rec(x) && str(x.stackKey) && str(x.stackVersion));

export function validateArchitectureProposalV1(v: unknown): ArchitectureProposalV1 | null {
  if (!rec(v) || !str(v.architectureStyle) || !str(v.summary) || !conf(v.confidence) || !strs(v.assumptions)) return null;
  if (!Array.isArray(v.modules) || !v.modules.length || !v.modules.every((x) => rec(x) && str(x.key) && str(x.name) && strs(x.responsibilities) && x.responsibilities.length && strs(x.componentKeys) && strs(x.requirementKeys) && stackRefs(x.stackRefs) && strs(x.dependsOn))) return null;
  if (!Array.isArray(v.decisions) || !v.decisions.every((x) => rec(x) && str(x.key) && str(x.title) && str(x.decision) && str(x.rationale) && strs(x.requirementKeys) && strs(x.componentKeys) && strs(x.moduleKeys) && stackRefs(x.stackRefs))) return null;
  if (!Array.isArray(v.integrations) || !v.integrations.every((x) => rec(x) && str(x.key) && str(x.fromModuleKey) && (x.toModuleKey === undefined || str(x.toModuleKey)) && (x.externalSystem === undefined || str(x.externalSystem)) && str(x.interactionType) && strs(x.requirementKeys))) return null;
  if (!Array.isArray(v.dataFlows) || !v.dataFlows.every((x) => rec(x) && str(x.key) && str(x.description) && strs(x.moduleKeys) && strs(x.requirementKeys))) return null;
  if (!Array.isArray(v.securityBoundaries) || !v.securityBoundaries.every((x) => rec(x) && str(x.key) && str(x.description) && strs(x.moduleKeys) && strs(x.requirementKeys))) return null;
  if (!Array.isArray(v.requirementMappings) || !v.requirementMappings.every((x) => rec(x) && str(x.requirementKey) && strs(x.moduleKeys) && strs(x.decisionKeys))) return null;
  if (!Array.isArray(v.risks) || !v.risks.every((x) => rec(x) && str(x.description) && ['LOW','MEDIUM','HIGH'].includes(x.severity as string))) return null;
  return v as unknown as ArchitectureProposalV1;
}

export function validateArchitectureReviewResultV1(v: unknown): ArchitectureReviewResultV1 | null {
  if (!rec(v) || !['APPROVED','CHANGES_REQUIRED','CONFLICT'].includes(v.verdict as string) || !str(v.summary) || !conf(v.confidence)) return null;
  if (!Array.isArray(v.findings) || !v.findings.every((x) => rec(x) && str(x.id) && ['STRUCTURE','DEPENDENCY','REQUIREMENT','STACK','SECURITY','DATA','INTEGRATION','OPERABILITY','OTHER'].includes(x.category as string) && ['LOW','MEDIUM','HIGH','BLOCKER'].includes(x.severity as string) && str(x.message) && (x.moduleKeys === undefined || strs(x.moduleKeys)) && (x.decisionKeys === undefined || strs(x.decisionKeys)) && (x.requirementKeys === undefined || strs(x.requirementKeys)) && (x.proposedResolution === undefined || str(x.proposedResolution)))) return null;
  if (!Array.isArray(v.requirementAssessment) || !v.requirementAssessment.every((x) => rec(x) && str(x.requirementKey) && ['SATISFIED','PARTIAL','UNSATISFIED'].includes(x.status as string) && str(x.evidenceSummary))) return null;
  return v as unknown as ArchitectureReviewResultV1;
}

export function validateArchitectureArbitrationResultV1(v: unknown): ArchitectureArbitrationResultV1 | null {
  if (!rec(v) || !['RESOLVED','BLOCKED_NEEDS_HUMAN'].includes(v.verdict as string) || !str(v.resolutionSummary) || !conf(v.confidence) || !strs(v.unresolvedFindingIds)) return null;
  if (!Array.isArray(v.resolutions) || !v.resolutions.every((x) => rec(x) && str(x.findingId) && ['ACCEPT_PROPOSAL','MODIFY_ARCHITECTURE','REJECT_RECOMMENDATION'].includes(x.action as string) && str(x.rationale))) return null;
  if (v.finalArchitecture !== undefined && !validateArchitectureProposalV1(v.finalArchitecture)) return null;
  return v as unknown as ArchitectureArbitrationResultV1;
}

export const ARCHITECTURE_PROPOSAL_SCHEMA = `Return ONLY one JSON object (no markdown) with every field in this exact ArchitectureProposalV1 shape:
{"architectureStyle":"string","summary":"string","modules":[{"key":"string","name":"string","responsibilities":["string"],"componentKeys":["string"],"requirementKeys":["REQ-001"],"stackRefs":[{"stackKey":"exact supplied key","stackVersion":"exact supplied version"}],"dependsOn":["existing module key"]}],"decisions":[{"key":"string","title":"string","decision":"string","rationale":"string","requirementKeys":["REQ-001"],"componentKeys":["string"],"moduleKeys":["string"],"stackRefs":[{"stackKey":"exact supplied key","stackVersion":"exact supplied version"}]}],"integrations":[],"dataFlows":[],"securityBoundaries":[],"requirementMappings":[{"requirementKey":"REQ-001","moduleKeys":["string"],"decisionKeys":["string"]}],"risks":[{"description":"string","severity":"LOW"}],"assumptions":[],"confidence":0.9}
Arrays may be empty only when semantically optional. Every IN_SCOPE requirement must occur exactly once in requirementMappings and be mapped to a module or decision. Use only exact supplied components and stackKey/stackVersion pairs. Do not output files, jobs, implementation order, code, explanations, or chain-of-thought.`;
export const ARCHITECTURE_REVIEW_SCHEMA = `Return ONLY one JSON object (no markdown) with every field in this exact ArchitectureReviewResultV1 shape:
{"verdict":"APPROVED","summary":"string","findings":[{"id":"unique-string","category":"STRUCTURE|DEPENDENCY|REQUIREMENT|STACK|SECURITY|DATA|INTEGRATION|OPERABILITY|OTHER","severity":"LOW|MEDIUM|HIGH|BLOCKER","message":"safe concise string","moduleKeys":[],"decisionKeys":[],"requirementKeys":[],"proposedResolution":"string"}],"requirementAssessment":[{"requirementKey":"REQ-001","status":"SATISFIED|PARTIAL|UNSATISFIED","evidenceSummary":"string"}],"confidence":0.9}
Use verdict APPROVED, CHANGES_REQUIRED, or CONFLICT. Include every supplied IN_SCOPE requirement in requirementAssessment. findings may be empty. Omit proposedResolution only when no resolution applies. Do not output code, jobs, explanations, or chain-of-thought.`;
export const ARCHITECTURE_ARBITRATION_SCHEMA = `Return ONLY one JSON object (no markdown) with every field in this exact ArchitectureArbitrationResultV1 shape:
{"verdict":"RESOLVED","resolutionSummary":"string","resolutions":[{"findingId":"exact finding id","action":"ACCEPT_PROPOSAL|MODIFY_ARCHITECTURE|REJECT_RECOMMENDATION","rationale":"string"}],"unresolvedFindingIds":[],"finalArchitecture":{"architectureStyle":"string","summary":"string","modules":[],"decisions":[],"integrations":[],"dataFlows":[],"securityBoundaries":[],"requirementMappings":[],"risks":[],"assumptions":[],"confidence":0.9},"confidence":0.9}
RESOLVED requires a complete ArchitectureProposalV1 finalArchitecture and zero unresolvedFindingIds. BLOCKED_NEEDS_HUMAN must list unresolved finding ids and may omit finalArchitecture. Never add a stack outside ApprovedSolution. Do not output code, jobs, explanations, or chain-of-thought.`;
