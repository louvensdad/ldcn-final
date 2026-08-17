import { ScaffoldedResource } from './scaffolders/nestjs-backend.scaffolder';

export interface JobPlanningRequirement {
  id: string;
  content: string;
}

export interface PlannedJob {
  requirementId: string;
  requirementText: string;
  targetResource: string;
  targetFile: string;
  agentKey: string;
}

export interface JobPlanResult {
  jobs: PlannedJob[];
  /** Requirement de businessRules sem recurso correspondente entre os já gerados — nunca vira Job
   * fantasma; fica de fora de modo explicito em skippedRequirementIds. */
  skippedRequirementIds: string[];
}

/**
 * MISSÃO "Job Planner + execução por agente cognitivo real" — determinístico de propósito (Fase
 * 8 do brief geral: "não usar LLM para validações determinísticas quando ferramenta apropriada
 * existir"). Mapear um requirement de regra de negócio ao recurso que ele descreve é uma
 * transformação mecânica de texto, igual à extração de nome de entidade que o scaffolder já faz —
 * nunca gasta uma chamada de LLM nisso. Casa só quando exatamente um recurso é mencionado no
 * texto da regra; ambíguo (0 ou >1 recursos) fica honestamente de fora, nunca advinha.
 */
export function planJobs(businessRules: JobPlanningRequirement[], resources: ScaffoldedResource[]): JobPlanResult {
  const jobs: PlannedJob[] = [];
  const skippedRequirementIds: string[] = [];

  for (const rule of businessRules) {
    const text = rule.content.trim();
    if (!text) { skippedRequirementIds.push(rule.id); continue; }

    const matches = resources.filter((r) => mentionsResource(text, r.entityName));
    if (matches.length !== 1) { skippedRequirementIds.push(rule.id); continue; }

    const resource = matches[0];
    jobs.push({
      requirementId: rule.id,
      requirementText: text,
      targetResource: resource.entityName,
      targetFile: `src/${resource.resourcePath}/${resource.resourcePath}.service.ts`,
      // Fase real do StackAgentCatalog (Missão 3) — mesmo agente que já é dono do arquivo de
      // service no manifest/artifact registry, nunca um papel inventado à parte.
      agentKey: 'backend.nestjs.data-specialist',
    });
  }

  return { jobs, skippedRequirementIds };
}

function mentionsResource(ruleText: string, entityName: string): boolean {
  const lowerRule = ruleText.toLowerCase();
  const lowerEntity = entityName.toLowerCase();
  // A singularização do scaffolder é mecânica (só remove um "s" final) — "Vendedores" vira
  // "Vendedore", não "Vendedor". Aceita o nome como está E com o "e" final solto removido, para
  // não perder o casamento óbvio só por causa dessa imperfeição já conhecida e documentada.
  const variants = [lowerEntity, lowerEntity.endsWith('e') ? lowerEntity.slice(0, -1) : lowerEntity];
  return variants.some((variant) => variant.length > 2 && lowerRule.includes(variant));
}
