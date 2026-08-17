import { ScaffoldResult } from './scaffolders/nestjs-backend.scaffolder';

/**
 * CORE-011 §30 audit note (não é uma mudança de comportamento): `OUT_OF_SCOPE_THIS_VERSION` aqui
 * é EVIDÊNCIA DE EXECUÇÃO ("nenhum artefato/Job encontrado para este requirement nesta rodada de
 * geração"), calculada DEPOIS que Jobs já rodaram — nunca uma decisão de escopo. A decisão de
 * escopo real e canônica (se um Requirement deveria ou não ser considerado por esta versão) agora
 * vive em `requirements/scope-coverage.service.ts` (ScopeCoverageDecision: IN_SCOPE |
 * DEFERRED_USER_APPROVED | NOT_APPLICABLE | BLOCKED), calculada ANTES de qualquer Job existir
 * (§29). Este módulo não foi alterado funcionalmente — apenas documentado — porque já não fabrica
 * decisão de escopo nenhuma (só relata ausência de evidência de implementação).
 */
export interface CoverageRequirement {
  id: string;
  section: string;
  content: string;
}

export interface CoverageJob {
  requirementId: string;
  status: string;
}

export type RequirementEvidenceStatus = 'EVIDENCED' | 'OUT_OF_SCOPE_THIS_VERSION' | 'FAILED';

export interface RequirementCoverageItem {
  requirementId: string;
  section: string;
  content: string;
  status: RequirementEvidenceStatus;
}

export interface RequirementCoverageResult {
  items: RequirementCoverageItem[];
  deliveryEligible: boolean;
}

/**
 * MISSÃO "Verificação requisito-por-requisito + Delivery Eligibility" — nunca declara uma missão
 * pronta para entrega só porque build/test/runtime passaram; cada Requirement CONFIRMED que este
 * motor de geração REALMENTE se propõe a implementar (hoje: `data` e `businessRules` — nunca os
 * outros, que esta versão nunca prometeu implementar de verdade) precisa de evidência real
 * (artifact ou Job real) para contar. Um requirement sem recurso correspondente (por exemplo,
 * duplicata determinística explicitamente listada em skippedRequirementIds) é honestamente OUT_OF_SCOPE_THIS_VERSION
 * — isso nunca bloqueia a entrega, porque nunca foi prometido. Só um requirement que ESTAVA no
 * escopo e falhou de verdade (Job FAILED) bloqueia — "mesmo que o build esteja verde".
 */
export function computeRequirementCoverage(
  confirmedRequirements: CoverageRequirement[],
  scaffold: ScaffoldResult,
  jobs: CoverageJob[]
): RequirementCoverageResult {
  const scaffoldedRequirementIds = new Set(scaffold.resources.map((r) => r.requirementId));
  const jobByRequirementId = new Map(jobs.map((j) => [j.requirementId, j.status]));

  const items: RequirementCoverageItem[] = [];
  for (const req of confirmedRequirements) {
    if (req.section === 'data') {
      items.push({
        requirementId: req.id, section: req.section, content: req.content,
        status: scaffoldedRequirementIds.has(req.id) ? 'EVIDENCED' : 'OUT_OF_SCOPE_THIS_VERSION',
      });
      continue;
    }
    if (req.section === 'businessRules') {
      const jobStatus = jobByRequirementId.get(req.id);
      const status: RequirementEvidenceStatus =
        jobStatus === 'IMPLEMENTED' || jobStatus === 'BUILD_TEST_VALIDATED' || jobStatus === 'REVIEW_APPROVED'
          ? 'EVIDENCED'
          : jobStatus === 'FAILED' || jobStatus === 'BLOCKED_NEEDS_HUMAN' || jobStatus === 'REVIEW_EXECUTION_FAILED'
            ? 'FAILED'
            : 'OUT_OF_SCOPE_THIS_VERSION';
      items.push({ requirementId: req.id, section: req.section, content: req.content, status });
      continue;
    }
    // Outras seções (features, flows, security, privacy, nonFunctional, acceptanceCriteria,
    // outOfScope, users) nunca entram aqui — esta versão do motor de geração nunca prometeu
    // implementá-las de verdade, então não seria honesto cobrá-las nesta checagem.
  }

  const deliveryEligible = !items.some((item) => item.status === 'FAILED');
  return { items, deliveryEligible };
}
