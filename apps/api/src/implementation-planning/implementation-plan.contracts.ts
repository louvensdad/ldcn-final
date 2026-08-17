export type WorkLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export interface ImplementationWorkPackageV1 {
  key: string;
  title: string;
  moduleKey: string;
  objective: string;
  requirementKeys: string[];
  requiredCapabilities: string[];
  dependsOn: string[];
  complexity: WorkLevel;
  risk: WorkLevel;
  allowedPaths: string[];
  allowedModules: string[];
  acceptanceCriteria: string[];
}
export interface ImplementationPlanV1 {
  summary: string;
  workPackages: ImplementationWorkPackageV1[];
  risks: { description: string; severity: WorkLevel }[];
  assumptions: string[];
  confidence: number;
}

const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string' && item.trim().length > 0);
export function parseImplementationPlan(value: unknown): ImplementationPlanV1 | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.summary !== 'string' || !Array.isArray(raw.workPackages) || raw.workPackages.length === 0 || !Array.isArray(raw.risks) || !strings(raw.assumptions) || typeof raw.confidence !== 'number' || raw.confidence < 0 || raw.confidence > 1) return null;
  const levels = ['LOW', 'MEDIUM', 'HIGH'];
  const validPackages = raw.workPackages.every((item) => {
    if (!item || typeof item !== 'object') return false;
    const work = item as Record<string, unknown>;
    return ['key', 'title', 'moduleKey', 'objective'].every((key) => typeof work[key] === 'string' && (work[key] as string).trim())
      && strings(work.requirementKeys) && strings(work.requiredCapabilities) && Array.isArray(work.dependsOn) && work.dependsOn.every((x) => typeof x === 'string')
      && levels.includes(work.complexity as string) && levels.includes(work.risk as string)
      && strings(work.allowedPaths) && strings(work.allowedModules) && strings(work.acceptanceCriteria);
  });
  const validRisks = raw.risks.every((item) => item && typeof item === 'object' && typeof (item as any).description === 'string' && levels.includes((item as any).severity));
  return validPackages && validRisks ? raw as unknown as ImplementationPlanV1 : null;
}

export const IMPLEMENTATION_PLAN_V1_SCHEMA = `Return ONLY JSON:
{"summary":string,"workPackages":[{"key":string,"title":string,"moduleKey":string,"objective":string,"requirementKeys":[string],"requiredCapabilities":[string],"dependsOn":[workPackageKey],"complexity":"LOW|MEDIUM|HIGH","risk":"LOW|MEDIUM|HIGH","allowedPaths":[relativeGlob],"allowedModules":[string],"acceptanceCriteria":[string]}],"risks":[{"description":string,"severity":"LOW|MEDIUM|HIGH"}],"assumptions":[string],"confidence":number_0_to_1}`;
