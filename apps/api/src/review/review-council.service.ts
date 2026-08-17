import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../persistence/prisma.service';
import { LLM_CLIENT, LlmClient, LlmCompletionResult } from '../assistant/deepseek-client';
import { ReviewFindingService, ReviewFindingSeverity } from './review-finding.service';
import { LlmInvocationLedgerService } from '../ledger/llm-invocation-ledger.service';

const PROMPT_TEMPLATE_VERSION = 'v1';
/** Fase 11 do brief: timeout por agente — sem isso, um reviewer travado prenderia o
 * Promise.allSettled inteiro indefinidamente (allSettled só resolve quando TODAS as promises
 * terminam, mesmo as penduradas). Cada reviewer é independente; um travar nunca deve custar aos
 * outros ou deixar o Review Council girando para sempre. */
const REVIEWER_TIMEOUT_MS = 45_000;

/** Fase 10 do brief: só os 4 reviewers de propósito geral são sempre obrigatórios — os outros 5 só rodam quando o próprio conteúdo do PromptMaster sinaliza que se aplicam (Fase 30: routing por custo). */
const CORE_REVIEWERS = ['requirements', 'consistency', 'architectureFeasibility', 'qa'] as const;
const CONDITIONAL_REVIEWERS = ['security', 'privacy', 'safety', 'abuseMisuse', 'dataGovernance'] as const;
export type ReviewerKey = (typeof CORE_REVIEWERS)[number] | (typeof CONDITIONAL_REVIEWERS)[number];
export const ALL_REVIEWER_KEYS: ReviewerKey[] = [...CORE_REVIEWERS, ...CONDITIONAL_REVIEWERS];

/**
 * MISSÃO "Auto-Governança por IA" (seção 10): um reviewer indisponível não pode ter o mesmo peso
 * que qualquer outro — Security/Privacy/Safety/Consistency guardam contra dano real; QA e Data
 * Governance são qualidade, não segurança. Só reviewers CRITICAL indisponíveis (mesmo depois de
 * retry/fallback) impedem a aprovação; HIGH/LOW indisponíveis apenas degradam a revisão,
 * de forma visível, nunca escondida.
 */
export type ReviewerCriticality = 'CRITICAL' | 'HIGH' | 'LOW';
export const REVIEWER_CRITICALITY: Record<ReviewerKey, ReviewerCriticality> = {
  consistency: 'CRITICAL',
  security: 'CRITICAL',
  privacy: 'CRITICAL',
  safety: 'CRITICAL',
  requirements: 'HIGH',
  architectureFeasibility: 'HIGH',
  abuseMisuse: 'HIGH',
  qa: 'LOW',
  dataGovernance: 'LOW',
};

/** Seção 8 do brief — estados reais de execução, nunca um SUCCEEDED/FAILED binário que esconde
 * "quase deu certo" (fallback) ou "não era crítico" (degraded) do usuário e do gate. */
export type ReviewerExecutionStatus = 'PASSED' | 'PASSED_WITH_FALLBACK' | 'DEGRADED' | 'FAILED_BLOCKING';

const ROUTING_SIGNALS: Partial<Record<ReviewerKey, RegExp>> = {
  security: /login|senha|autentic|autoriza|permiss[ãa]o|admin|pagamento|cart[ãa]o|upload|api externa|integra[çc][ãa]o|token|acesso restrito/i,
  privacy: /\bcpf\b|\brg\b|endere[çc]o|telefone|e-?mail|dados pessoais|sa[úu]de|m[ée]dic|prontu[áa]rio|menor|crian[çc]a|financeiro|localiza[çc][ãa]o|biometria/i,
  safety: /menor|crian[çc]a|adolescente|\baluno\b|estudante|sa[úu]de|m[ée]dic|emerg[êe]ncia/i,
  abuseMisuse: /mensagem|\bchat\b|coment[áa]rio|upload|compartilh|convite|conta an[ôo]nima|cadastro em massa|rede social|an[ôo]nimo|sem verifica[çc][ãa]o|spam/i,
};

interface PromptMasterContext {
  vision: string;
  objective: string;
  targetAudience: string;
  sections: Record<string, { id: string; content: string }[]>;
}

interface ReviewerFindingResult {
  code: string;
  severity: ReviewFindingSeverity;
  section?: string | null;
  targetContent?: string[];
  finding: string;
  recommendedResolutions?: string[];
  requiresUserDecision?: boolean;
}

interface ReviewerResult {
  findings: ReviewerFindingResult[];
}

export interface ReviewerExecutionDto {
  reviewerKey: string;
  status: ReviewerExecutionStatus;
  criticality: ReviewerCriticality;
  provider: string | null;
  model: string | null;
  findingCount: number;
  promptTokens: number | null;
  completionTokens: number | null;
  latencyMs: number | null;
  errorCode: string | null;
  attemptCount: number;
  fallbackUsed: boolean;
  startedAt: string;
  finishedAt: string;
}

export interface ReviewCouncilRunResult {
  completion: 'REVIEW_COMPLETE' | 'REVIEW_PARTIALLY_COMPLETED';
  executions: ReviewerExecutionDto[];
}

const OUTPUT_SCHEMA = `Responda SOMENTE com um objeto JSON válido, sem markdown, sem texto fora do JSON, exatamente neste formato:
{"findings": [{"code": string, "severity": "INFO" | "ADVISORY" | "WARNING" | "BLOCKER", "section": string | null, "targetContent": string[], "finding": string, "recommendedResolutions": string[], "requiresUserDecision": boolean}]}

"code" é um identificador curto em MAIÚSCULAS_COM_UNDERSCORE (ex: "CHECKOUT_UNDEFINED"). "targetContent" lista o texto EXATO de itens já existentes no PromptMaster (fornecidos no contexto) aos quais o achado se refere — vazio se o achado for sobre o documento como um todo. "severity": use BLOCKER apenas para problemas que realmente impedem prosseguir com segurança; a maioria dos achados reais é WARNING ou ADVISORY. Se não encontrar nenhum problema real, retorne {"findings": []} — nunca invente um achado só para preencher.

"requiresUserDecision": use true APENAS quando resolver o achado exigir uma escolha real de produto/negócio que só o usuário pode fazer (ex: qual meio de pagamento usar, se uma integração deve existir, um trade-off entre duas abordagens igualmente válidas). Uma lacuna de segurança/privacidade com solução padrão conhecida (ex: "adicionar consentimento explícito", "adicionar criptografia em trânsito", "adicionar controle de acesso por perfil") deve ter requiresUserDecision=false — isso é um requisito técnico que a própria IA pode adicionar, não uma decisão. Uma lacuna assim mencionar LGPD/GDPR/compliance não a torna automaticamente uma decisão do usuário.`;

const REVIEWER_PROMPTS: Record<ReviewerKey, string> = {
  requirements: `Você é o Requirements Reviewer do LDCN OS. Revise o PromptMaster fornecido em busca de: ambiguidades, requisitos vagos, duplicidades, requisitos incompletos, dependências não declaradas, comportamento indefinido, requisitos contraditórios entre si, funcionalidade sem fluxo correspondente, fluxo sem requisito que o sustente, e requisito sem critério de aceite. ${OUTPUT_SCHEMA}`,

  consistency: `Você é o Consistency Reviewer do LDCN OS. Cruze TODAS as seções do PromptMaster entre si em busca de contradições reais — o exemplo clássico é um fluxo que depende de uma ação (ex: pagamento) que a seção "fora do escopo" explicitamente exclui. Toda contradição real detectada deve ter severity BLOCKER e requiresUserDecision=true, com recommendedResolutions oferecendo pelo menos 2 caminhos concretos de resolução. ${OUTPUT_SCHEMA}`,

  architectureFeasibility: `Você é o Architecture Feasibility Reviewer do LDCN OS. Você NÃO escolhe arquitetura — isso é decidido depois, automaticamente. Sua função é só verificar se os requisitos, juntos, formam um sistema tecnicamente coerente e realizável: identifique incompatibilidades entre requisitos, dependências técnicas ausentes, requisitos tecnicamente impossíveis ou contraditórios entre si, e capacidades que exigem componentes que o documento nunca especificou. Fale em nível de requisito, nunca proponha uma tecnologia específica. ${OUTPUT_SCHEMA}`,

  security: `Você é o Security Reviewer do LDCN OS. Analise necessidades de segurança em nível de REQUISITO (nunca implementação específica) nas áreas: autenticação, autorização, controle de acesso por perfil, segredos/credenciais, uploads, pagamentos, comunicação externa, APIs, dados confidenciais, auditoria, funções administrativas, limitação de taxa, proteção contra abuso. Para cada lacuna real, proponha o requisito de segurança que falta. ${OUTPUT_SCHEMA}`,

  privacy: `Você é o Privacy Reviewer do LDCN OS. Detecte uso de dados pessoais ou sensíveis no PromptMaster: documentos (CPF, RG), localização, biometria, dados financeiros, dados de saúde, dados de menores, informação confidencial. Para cada dado sensível identificado sem tratamento adequado já declarado, proponha o requisito apropriado de: minimização de dados, consentimento quando aplicável, controle de acesso, retenção, auditoria, proteção de exportações, exclusão, finalidade declarada. ${OUTPUT_SCHEMA}`,

  safety: `Você é o Safety Reviewer do LDCN OS. Classifique o risco geral do sistema descrito como SAFE, SAFE_WITH_CONTROLS, NEEDS_USER_CLARIFICATION, HIGH_RISK ou BLOCKED, mencionando a classificação no texto do achado — mas NUNCA bloqueie automaticamente só porque um termo sensível (ex: "menor", "saúde") aparece. Avalie o contexto e a capacidade real solicitada. Sistemas que envolvem menores, saúde ou dados sensíveis tipicamente são SAFE_WITH_CONTROLS: proponha os controles necessários (proteção de dados, permissões, moderação quando aplicável) como achados WARNING ou ADVISORY, não BLOCKER, a menos que exista um risco real e concreto de dano. ${OUTPUT_SCHEMA}`,

  abuseMisuse: `Você é o Abuse & Misuse Reviewer do LDCN OS. Identifique funcionalidades do PromptMaster que possam facilitar abuso de usuários, contas, sistemas, infraestrutura, dados ou comunicação (ex: mensagens sem moderação, criação de conta em massa, compartilhamento anônimo). Quando uma funcionalidade legítima precisar de controles adicionais, proponha o requisito de controle correspondente em vez de bloquear a funcionalidade — só use BLOCKER se a funcionalidade como descrita não tiver uso legítimo plausível. ${OUTPUT_SCHEMA}`,

  dataGovernance: `Você é o Data Governance Reviewer do LDCN OS. Avalie o ciclo de vida dos dados do PromptMaster: classificação, propriedade, retenção, backup, qualidade e necessidade real de cada integração/dado externo declarado. Não repita achados que já são responsabilidade do Privacy Reviewer (dados pessoais) — foque em governança de dados de forma mais ampla (todos os tipos de dado, não só pessoais). ${OUTPUT_SCHEMA}`,

  qa: `Você é o QA / Acceptance Criteria Reviewer do LDCN OS. Transforme critérios de aceite vagos em critérios verificáveis — sinalize frases genéricas como "deve ser rápido" ou "deve ser fácil de usar" sem um jeito claro de verificar. Verifique também se as funcionalidades principais cobrem: caminho feliz, casos de borda, tratamento de erro, estados vazios, carregamento, timeout/retry quando aplicável, permissões, validações. ${OUTPUT_SCHEMA}`,
};

@Injectable()
export class ReviewCouncilService {
  /** Test-only override (see review-council.service.test.ts) — keeps the timeout genuinely
   * real (no fake timers, which fight Prisma's own internal use of setTimeout) while letting the
   * timeout test run in milliseconds instead of REVIEWER_TIMEOUT_MS real seconds. */
  private reviewerTimeoutMs = REVIEWER_TIMEOUT_MS;
  /** Seção 10 do brief: retry automático obrigatório antes de desistir de um reviewer — 2
   * tentativas reais (não 1) é o que resolve a maioria das falhas transitórias de rede/rate-limit
   * sem dobrar o custo em todo request (só paga o retry quando algo realmente falhou). */
  private maxAttempts = 2;
  private retryBackoffMs = 400;

  constructor(
    private readonly prisma: PrismaService,
    private readonly findings: ReviewFindingService,
    @Inject(LLM_CLIENT) private readonly llm: LlmClient,
    private readonly ledger: LlmInvocationLedgerService
  ) {}

  /** Fase 30: nem todo PromptMaster aciona os 9 — calcula quais reviewers condicionais se aplicam a partir do próprio conteúdo. */
  routeReviewers(context: PromptMasterContext): ReviewerKey[] {
    const blob = [
      context.vision, context.objective, context.targetAudience,
      ...Object.values(context.sections).flatMap((items) => items.map((i) => i.content)),
    ].join(' ').toLowerCase();

    const routed: ReviewerKey[] = [...CORE_REVIEWERS];
    for (const key of CONDITIONAL_REVIEWERS) {
      const signal = ROUTING_SIGNALS[key];
      if (signal && signal.test(blob)) {
        routed.push(key);
        continue;
      }
      // dataGovernance has no keyword regex — it's routed structurally instead (real data/integration volume).
      if (key === 'dataGovernance' && ((context.sections.data?.length ?? 0) >= 2 || (context.sections.integrations?.length ?? 0) >= 1)) {
        routed.push(key);
      }
    }
    return routed;
  }

  async runCouncil(missionId: string, promptMasterId: string): Promise<ReviewCouncilRunResult> {
    const context = await this.buildContext(promptMasterId);
    const requirementByContent = await this.buildContentIndex(missionId, promptMasterId);
    const reviewerKeys = this.routeReviewers(context);
    const contextJson = JSON.stringify(
      {
        vision: context.vision,
        objective: context.objective,
        targetAudience: context.targetAudience,
        sections: Object.fromEntries(Object.entries(context.sections).map(([section, items]) => [section, items.map((i) => i.content)])),
      },
      null,
      2
    );

    const settled = await Promise.allSettled(
      reviewerKeys.map((key) => this.executeReviewer(missionId, promptMasterId, key, contextJson, requirementByContent, context))
    );
    const executions = settled.map((result, i) =>
      result.status === 'fulfilled'
        ? result.value
        : this.toFailedExecution(reviewerKeys[i], 'REVIEWER_EXECUTION_THREW')
    );

    // Nunca binário: só reviewers CRITICAL ainda com problema (mesmo após retry/fallback) tornam
    // a revisão incompleta de verdade — HIGH/LOW degradados contam como concluída (com aviso).
    const hasCriticalGap = executions.some((e) => REVIEWER_CRITICALITY[e.reviewerKey as ReviewerKey] === 'CRITICAL' && e.status === 'FAILED_BLOCKING');
    return {
      completion: hasCriticalGap ? 'REVIEW_PARTIALLY_COMPLETED' : 'REVIEW_COMPLETE',
      executions,
    };
  }

  /** Fase 29: reexecutar só o reviewer que falhou, não o council inteiro. */
  async retryReviewer(missionId: string, promptMasterId: string, reviewerKey: ReviewerKey): Promise<ReviewerExecutionDto> {
    const context = await this.buildContext(promptMasterId);
    const requirementByContent = await this.buildContentIndex(missionId, promptMasterId);
    const contextJson = JSON.stringify(
      {
        vision: context.vision,
        objective: context.objective,
        targetAudience: context.targetAudience,
        sections: Object.fromEntries(Object.entries(context.sections).map(([section, items]) => [section, items.map((i) => i.content)])),
      },
      null,
      2
    );
    return this.executeReviewer(missionId, promptMasterId, reviewerKey, contextJson, requirementByContent, context);
  }

  /** listExecutions() is a full audit trail — a retried reviewer leaves its old row in place
   * alongside the new one (Fase 28: every attempt, never overwritten). Both the Discovery gate and
   * the Marketplace review gate need only each reviewer's MOST RECENT attempt — one shared,
   * authoritative implementation instead of two that could drift apart. */
  latestExecutionPerReviewer(executions: ReviewerExecutionDto[]): ReviewerExecutionDto[] {
    const byKey = new Map<string, ReviewerExecutionDto>();
    for (const e of executions) byKey.set(e.reviewerKey, e);
    return [...byKey.values()];
  }

  /** Fase 29 do brief: PENDING (nunca rodou) | REVIEW_COMPLETE | REVIEW_COMPLETE_DEGRADED
   * (HIGH/LOW indisponíveis, disclosed) | REVIEW_PARTIALLY_COMPLETED (algum reviewer CRITICAL
   * ainda travado, mesmo após retry/fallback). Mesma regra para Discovery e Marketplace. */
  computeReviewStatus(executions: ReviewerExecutionDto[]): 'PENDING' | 'REVIEW_COMPLETE' | 'REVIEW_COMPLETE_DEGRADED' | 'REVIEW_PARTIALLY_COMPLETED' {
    const latest = this.latestExecutionPerReviewer(executions);
    if (latest.length === 0) return 'PENDING';
    const hasCriticalGap = latest.some((e) => e.criticality === 'CRITICAL' && e.status === 'FAILED_BLOCKING');
    if (hasCriticalGap) return 'REVIEW_PARTIALLY_COMPLETED';
    const hasDegradation = latest.some((e) => e.status !== 'PASSED');
    return hasDegradation ? 'REVIEW_COMPLETE_DEGRADED' : 'REVIEW_COMPLETE';
  }

  async listExecutions(promptMasterId: string): Promise<ReviewerExecutionDto[]> {
    const rows = await this.prisma.reviewerExecution.findMany({ where: { promptMasterId }, orderBy: { createdAt: 'asc' } });
    return rows.map((r) => ({
      reviewerKey: r.reviewerKey,
      status: r.status as ReviewerExecutionStatus,
      criticality: REVIEWER_CRITICALITY[r.reviewerKey as ReviewerKey] ?? 'HIGH',
      provider: r.provider,
      model: r.model,
      findingCount: r.findingCount,
      promptTokens: r.promptTokens,
      completionTokens: r.completionTokens,
      latencyMs: r.latencyMs,
      errorCode: r.errorCode,
      attemptCount: r.attemptCount,
      fallbackUsed: r.fallbackUsed,
      startedAt: r.startedAt.toISOString(),
      finishedAt: r.finishedAt.toISOString(),
    }));
  }

  // --- internals ---

  private async buildContext(promptMasterId: string): Promise<PromptMasterContext> {
    const version = await this.prisma.promptMasterVersion.findUnique({ where: { id: promptMasterId } });
    if (!version) throw new Error('DISCOVERY_NOT_FOUND');
    const requirements = await this.prisma.requirement.findMany({ where: { promptMasterId, status: { not: 'REJECTED' } } });
    const sections: Record<string, { id: string; content: string }[]> = {};
    for (const r of requirements) {
      (sections[r.section] ??= []).push({ id: r.id, content: r.content });
    }
    return { vision: version.vision, objective: version.objective, targetAudience: version.targetAudience, sections };
  }

  private async buildContentIndex(missionId: string, promptMasterId: string): Promise<Map<string, string>> {
    const requirements = await this.prisma.requirement.findMany({ where: { missionId, promptMasterId, status: { not: 'REJECTED' } } });
    return new Map(requirements.map((r) => [r.content, r.id]));
  }

  /** Fase 11: raça contra um timeout — nunca deixa uma chamada travada seguntar o reviewer (e, por
   * causa do Promise.allSettled, o Council inteiro) indefinidamente. */
  private completeWithTimeout(system: string, user: string): Promise<LlmCompletionResult> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('REVIEWER_TIMEOUT')), this.reviewerTimeoutMs);
      this.llm.complete({ system, user, responseFormat: 'json_object' }).then(
        (result) => {
          clearTimeout(timer);
          resolve(result);
        },
        (err) => {
          clearTimeout(timer);
          reject(err);
        }
      );
    });
  }

  /**
   * MISSÃO "Auto-Governança por IA" (seções 8/9): a causa raiz do `REVIEWER_AI_UNAVAILABLE`
   * deixando o Council em "7/8" era uma única tentativa, sem retry, sem fallback — qualquer falha
   * transitória (rede, rate limit) virava um FAILED permanente que só um clique manual do usuário
   * resolvia. Agora: até `maxAttempts` tentativas reais com backoff; se todas falharem, um fallback
   * determinístico (sem LLM) tenta cobrir o mínimo para o Consistency Reviewer; se nem isso for
   * aplicável, o resultado final depende da criticidade do reviewer (nunca escondido).
   */
  private async executeReviewer(
    missionId: string,
    promptMasterId: string,
    reviewerKey: ReviewerKey,
    contextJson: string,
    requirementByContent: Map<string, string>,
    context: PromptMasterContext
  ): Promise<ReviewerExecutionDto> {
    const startedAt = new Date();
    const user = `PromptMaster a revisar (JSON):\n${contextJson}`;
    let completion: LlmCompletionResult | null = null;
    let parsed: ReviewerResult | null = null;
    let attempt = 0;
    let lastErrorCode = 'REVIEWER_AI_UNAVAILABLE';

    while (attempt < this.maxAttempts) {
      attempt++;
      try {
        const result = await this.ledger.recordLlmCall(
          {
            missionId,
            purpose: `review-council.${reviewerKey}`,
            phase: 'EVIDENCE',
            promptType: 'review-council',
            promptVersion: PROMPT_TEMPLATE_VERSION,
            contextForHash: { reviewerKey, contextJson },
            system: REVIEWER_PROMPTS[reviewerKey],
            user,
            refs: { promptMasterId, reviewerKey },
          },
          () => this.completeWithTimeout(REVIEWER_PROMPTS[reviewerKey], user)
        );
        const candidate = this.parseJson<ReviewerResult>(result.text);
        if (candidate && Array.isArray(candidate.findings)) {
          completion = result;
          parsed = candidate;
          break;
        }
        completion = result;
        lastErrorCode = 'REVIEWER_MALFORMED_RESPONSE';
      } catch (err) {
        lastErrorCode = err instanceof Error && err.message === 'REVIEWER_TIMEOUT' ? 'REVIEWER_TIMEOUT' : 'REVIEWER_AI_UNAVAILABLE';
      }
      if (attempt < this.maxAttempts) await this.delay(this.retryBackoffMs);
    }

    if (!parsed) {
      const fallbackFindings = reviewerKey === 'consistency' ? this.deterministicConsistencyFallback(context) : null;
      if (fallbackFindings) {
        let findingCount = 0;
        for (const f of fallbackFindings) {
          await this.persistFinding(missionId, promptMasterId, reviewerKey, f, requirementByContent);
          findingCount++;
        }
        return this.persistExecution(missionId, promptMasterId, reviewerKey, 'PASSED_WITH_FALLBACK', startedAt, {
          errorCode: lastErrorCode, findingCount, attemptCount: attempt, fallbackUsed: true,
        });
      }
      const criticality = REVIEWER_CRITICALITY[reviewerKey];
      const status: ReviewerExecutionStatus = criticality === 'CRITICAL' ? 'FAILED_BLOCKING' : 'DEGRADED';
      return this.persistExecution(missionId, promptMasterId, reviewerKey, status, startedAt, { errorCode: lastErrorCode, attemptCount: attempt });
    }

    let findingCount = 0;
    for (const f of parsed.findings) {
      if (!f.code || !f.severity || !f.finding) continue;
      await this.persistFinding(missionId, promptMasterId, reviewerKey, f, requirementByContent);
      findingCount++;
    }

    return this.persistExecution(missionId, promptMasterId, reviewerKey, 'PASSED', startedAt, {
      provider: 'deepseek',
      model: completion!.model,
      promptTokens: completion!.promptTokens,
      completionTokens: completion!.completionTokens,
      findingCount,
      attemptCount: attempt,
    });
  }

  private async persistFinding(
    missionId: string,
    promptMasterId: string,
    reviewerKey: ReviewerKey,
    f: ReviewerFindingResult,
    requirementByContent: Map<string, string>
  ): Promise<void> {
    const requirementIds = (f.targetContent ?? [])
      .map((content) => requirementByContent.get(content))
      .filter((id): id is string => !!id);
    await this.findings.create({
      missionId,
      promptMasterId,
      reviewerKey,
      code: f.code,
      severity: f.severity,
      section: f.section ?? undefined,
      requirementIds,
      finding: f.finding,
      recommendedResolutions: f.recommendedResolutions ?? [],
      requiresUserDecision: f.requiresUserDecision ?? false,
    });
  }

  /**
   * Fallback determinístico (seção 9 do brief: "regra determinística mínima" quando a IA está
   * indisponível) — nunca finge que um LLM revisou quando não revisou (por isso sempre marca
   * `PASSED_WITH_FALLBACK`, nunca `PASSED`). Só existe para o Consistency Reviewer, que é o único
   * caso onde uma checagem puramente léxica (sobreposição de palavras entre uma funcionalidade/
   * fluxo e o texto de "fora de escopo") tem chance real de pegar a contradição clássica sem
   * precisar de compreensão semântica de verdade.
   */
  private deterministicConsistencyFallback(context: PromptMasterContext): ReviewerFindingResult[] | null {
    const outOfScopeText = (context.sections.outOfScope ?? []).map((i) => i.content.toLowerCase());
    // Nada para checar contra — a checagem lexical não tem nenhum valor de verificação real aqui,
    // então nunca finge ter "passado com fallback" (isso é diferente de "passou, nada encontrado").
    if (outOfScopeText.length === 0) return null;

    const findings: ReviewerFindingResult[] = [];
    for (const section of ['features', 'flows'] as const) {
      for (const item of context.sections[section] ?? []) {
        const words = item.content.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
        const overlap = outOfScopeText.some((scope) => words.some((w) => scope.includes(w)));
        if (overlap) {
          findings.push({
            code: 'POSSIBLE_SCOPE_CONTRADICTION_FALLBACK',
            severity: 'BLOCKER',
            section,
            targetContent: [item.content],
            finding: `Verificação automática sem IA disponível: "${item.content}" pode depender de algo listado como fora de escopo. Revise manualmente — esta checagem é apenas lexical, não semântica.`,
            recommendedResolutions: [
              'Ajustar o escopo para incluir a dependência necessária',
              'Reescrever o item para não depender do que está fora de escopo',
              'Confirmar que não há contradição real e manter como está',
            ],
            requiresUserDecision: true,
          });
        }
      }
    }
    return findings;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async persistExecution(
    missionId: string,
    promptMasterId: string,
    reviewerKey: ReviewerKey,
    status: ReviewerExecutionStatus,
    startedAt: Date,
    extra: { errorCode?: string; provider?: string; model?: string; promptTokens?: number; completionTokens?: number; findingCount?: number; attemptCount: number; fallbackUsed?: boolean }
  ): Promise<ReviewerExecutionDto> {
    const finishedAt = new Date();
    const latencyMs = finishedAt.getTime() - startedAt.getTime();
    await this.prisma.reviewerExecution.create({
      data: {
        id: randomUUID(),
        missionId,
        promptMasterId,
        reviewerKey,
        status,
        provider: extra.provider ?? null,
        model: extra.model ?? null,
        promptTemplateVersion: PROMPT_TEMPLATE_VERSION,
        findingCount: extra.findingCount ?? 0,
        promptTokens: extra.promptTokens ?? null,
        completionTokens: extra.completionTokens ?? null,
        latencyMs,
        errorCode: extra.errorCode ?? null,
        attemptCount: extra.attemptCount,
        fallbackUsed: extra.fallbackUsed ?? false,
        startedAt,
        finishedAt,
      },
    });
    return {
      reviewerKey,
      status,
      criticality: REVIEWER_CRITICALITY[reviewerKey],
      provider: extra.provider ?? null,
      model: extra.model ?? null,
      findingCount: extra.findingCount ?? 0,
      promptTokens: extra.promptTokens ?? null,
      completionTokens: extra.completionTokens ?? null,
      latencyMs,
      errorCode: extra.errorCode ?? null,
      attemptCount: extra.attemptCount,
      fallbackUsed: extra.fallbackUsed ?? false,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
    };
  }

  private toFailedExecution(reviewerKey: ReviewerKey, errorCode: string): ReviewerExecutionDto {
    const now = new Date().toISOString();
    const criticality = REVIEWER_CRITICALITY[reviewerKey];
    const status: ReviewerExecutionStatus = criticality === 'CRITICAL' ? 'FAILED_BLOCKING' : 'DEGRADED';
    return {
      reviewerKey, status, criticality, provider: null, model: null, findingCount: 0, promptTokens: null,
      completionTokens: null, latencyMs: null, errorCode, attemptCount: 0, fallbackUsed: false, startedAt: now, finishedAt: now,
    };
  }

  private parseJson<T>(text: string): T | null {
    try {
      const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '');
      return JSON.parse(cleaned) as T;
    } catch {
      return null;
    }
  }
}
