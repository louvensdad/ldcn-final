import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../persistence/prisma.service';
import { LLM_CLIENT, LlmClient } from '../assistant/deepseek-client';
import { LlmInvocationLedgerService } from '../ledger/llm-invocation-ledger.service';
import { ReviewFindingService, ReviewFindingDto } from './review-finding.service';
import { ReviewCouncilService, ReviewerKey } from './review-council.service';
import { PromptMasterDecisionPolicy } from './decision-policy.service';

const REQUIREMENT_SECTIONS = [
  'users', 'features', 'businessRules', 'flows', 'data', 'integrations',
  'security', 'privacy', 'nonFunctional', 'acceptanceCriteria', 'outOfScope',
] as const;
export type RequirementSection = (typeof REQUIREMENT_SECTIONS)[number];

/** Fase 5 do Discovery — o LDCN Copilot nunca aplica direto: propõe, o usuário (ou o Auto-Repair
 * Loop) revisa o diff, só então entra no documento. */
export type CopilotChangeAction = 'ADD' | 'EDIT' | 'REMOVE';

export interface CopilotChangeDto {
  action: CopilotChangeAction;
  section: RequirementSection;
  targetRequirementId: string | null;
  beforeContent: string | null;
  afterContent: string | null;
  reason: string;
}

export interface CopilotProposalDto {
  summary: string;
  changes: CopilotChangeDto[];
}

interface CopilotProposalResult {
  summary: string;
  changes: {
    action: CopilotChangeAction;
    section: string;
    targetContent?: string;
    newContent?: string;
    reason: string;
  }[];
}

// Fase 5 — Copilot dentro do editor: nunca aplica a mudança direto, sempre propõe um diff que
// quem chamou revisa. O "targetContent" precisa bater com um item já existente (resolvido no
// código, não pelo modelo) para nunca editar/remover algo que não existe de verdade no documento.
const COPILOT_EDIT_SYSTEM_PROMPT = `Você é o LDCN Copilot, ajudando a editar um PromptMaster já existente a partir de um pedido em linguagem natural. Você NUNCA aplica a mudança diretamente — só propõe um diff estruturado que é revisado antes de aceitar.

Responda SOMENTE com um objeto JSON válido, sem markdown, sem texto fora do JSON, exatamente neste formato:
{"summary": string, "changes": [{"action": "ADD" | "EDIT" | "REMOVE", "section": string, "targetContent": string | null, "newContent": string | null, "reason": string}]}

- "section" deve ser exatamente um destes valores: users, features, businessRules, flows, data, integrations, security, privacy, nonFunctional, acceptanceCriteria, outOfScope.
- "summary": uma frase curta explicando o impacto geral do pedido (ex: "Essa mudança afeta pagamentos, segurança, persistência e critérios de aceite.").
- "ADD": targetContent é null; newContent é o novo item.
- "EDIT": targetContent é o texto EXATO de um item já existente (fornecido no contexto) que está sendo alterado; newContent é o novo texto.
- "REMOVE": targetContent é o texto EXATO do item a remover; newContent é null.
- Só proponha mudanças diretamente relacionadas ao pedido — nunca invente escopo novo não solicitado. Se o pedido envolver uma decisão de negócio que não foi dada (preço, provedor específico, stack técnica), não presuma: proponha o requisito em nível de negócio (ex: "Aceitar pagamento via Pix") sem inventar detalhes de implementação.`;

/** Auto-Repair Loop (seção 30 do brief — custo): teto de achados corrigidos automaticamente por
 * rodada, para nunca virar uma cadeia sequencial de dezenas de chamadas de IA sem limite. */
const AUTO_REPAIR_MAX_FINDINGS = 20;

export interface AutoRepairResultDto {
  patched: number;
  touchedReviewers: string[];
}

/**
 * MISSÃO "Completar o fluxo de compra/personalização do Marketplace" — Fase 1 do audit: o motor
 * de edição do PromptMaster (propor diff / aplicar diff / Auto-Repair Loop / classificar achados
 * abertos) vivia inteiro dentro de DiscoveryService, acoplado a DiscoveryConversation.status. Uma
 * missão de customização do Marketplace não tem (nem deveria ganhar) uma DiscoveryConversation —
 * criar isso seria replicar o Discovery inteiro, exatamente o que a missão proíbe.
 *
 * Este serviço é esse mesmo motor, extraído para operar só sobre (missionId, promptMasterId) —
 * sem nenhuma noção de conversa. DiscoveryService continua com sua própria validação de estado
 * (PROMPTMASTER_READY etc.) como uma casca fina por cima disto; MarketplaceReviewService faz o
 * mesmo com sua própria noção de estado (o MarketplaceCustomizationPlan). Nenhum dos dois
 * reimplementa a lógica de propor/aplicar diff ou o Auto-Repair Loop — um único motor real.
 */
@Injectable()
export class PromptMasterEditingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reviewFindings: ReviewFindingService,
    private readonly reviewCouncil: ReviewCouncilService,
    private readonly decisionPolicy: PromptMasterDecisionPolicy,
    @Inject(LLM_CLIENT) private readonly llm: LlmClient,
    private readonly ledger: LlmInvocationLedgerService
  ) {}

  /** Autoridade central (seção 7 do brief "Auto-Governança por IA"): nenhum outro lugar do código
   * decide "isso bloqueia?" por conta própria — nem Discovery, nem Marketplace. */
  async classifyOpenFindings(promptMasterId: string): Promise<{ finding: ReviewFindingDto; classification: ReturnType<PromptMasterDecisionPolicy['classify']> }[]> {
    const open = (await this.reviewFindings.listForVersion(promptMasterId)).filter((f) => f.status === 'OPEN');
    return open.map((finding) => ({
      finding,
      classification: this.decisionPolicy.classify({
        severity: finding.severity,
        requiresUserDecision: finding.requiresUserDecision,
        finding: finding.finding,
        recommendedResolutions: finding.recommendedResolutions,
        requirementIds: finding.requirementIds,
      }),
    }));
  }

  /**
   * Primeira metade do fluxo Copilot: propõe, nunca aplica. targetContent é resolvido aqui
   * contra requirements reais da versão fornecida; uma proposta que não bate com nada real é
   * descartada silenciosamente (nunca editamos algo que não existe de verdade no documento).
   */
  async proposeChange(promptMasterId: string, message: string): Promise<CopilotProposalDto> {
    if (!message?.trim()) throw new Error('INVALID_DISCOVERY_INPUT');
    const promptMaster = await this.prisma.promptMasterVersion.findUnique({ where: { id: promptMasterId } });
    if (!promptMaster) throw new Error('DISCOVERY_NOT_FOUND');

    const currentRequirements = await this.prisma.requirement.findMany({
      where: { promptMasterId, status: { not: 'REJECTED' } },
    });
    const currentBySection = REQUIREMENT_SECTIONS.reduce<Record<string, string[]>>((acc, section) => {
      acc[section] = currentRequirements.filter((r) => r.section === section).map((r) => r.content);
      return acc;
    }, {});

    const context = {
      vision: promptMaster.vision,
      objective: promptMaster.objective,
      targetAudience: promptMaster.targetAudience,
      currentContent: currentBySection,
    };
    const user = `PromptMaster atual (JSON):\n${JSON.stringify(context, null, 2)}\n\nPedido: "${message.trim()}"`;

    let completion;
    try {
      completion = await this.ledger.recordLlmCall(
        {
          missionId: promptMaster.missionId,
          purpose: 'prompt-master.edit',
          phase: 'IMPLEMENTATION_PROPOSAL',
          promptType: 'prompt-master-edit',
          promptVersion: 'v1',
          contextForHash: { promptMasterId, context },
          system: COPILOT_EDIT_SYSTEM_PROMPT,
          user,
          refs: { promptMasterId },
        },
        () => this.llm.complete({ system: COPILOT_EDIT_SYSTEM_PROMPT, user, responseFormat: 'json_object' })
      );
    } catch {
      throw new Error('DISCOVERY_AI_UNAVAILABLE');
    }
    const parsed = this.parseJson<CopilotProposalResult>(completion.text);
    if (!parsed || !Array.isArray(parsed.changes)) throw new Error('DISCOVERY_AI_UNAVAILABLE');

    const requirementByContent = new Map(currentRequirements.map((r) => [`${r.section}:${r.content}`, r]));
    const changes: CopilotChangeDto[] = parsed.changes
      .filter((c) => (REQUIREMENT_SECTIONS as readonly string[]).includes(c.section))
      .map((c) => {
        const target = c.targetContent ? requirementByContent.get(`${c.section}:${c.targetContent}`) : undefined;
        return {
          action: c.action,
          section: c.section as RequirementSection,
          targetRequirementId: target?.id ?? null,
          beforeContent: c.targetContent ?? null,
          afterContent: c.newContent ?? null,
          reason: c.reason,
        };
      })
      // EDIT/REMOVE without a resolved real target are dropped — never act on a hallucinated reference.
      .filter((c) => c.action === 'ADD' || c.targetRequirementId !== null);

    return { summary: parsed.summary, changes };
  }

  /**
   * Segunda metade: só o que foi aceito entra no documento, e entra já como CONFIRMED — revisar
   * o diff individualmente É a aprovação, não precisa de um segundo gate. EDIT em algo já
   * CONFIRMED sempre versiona a nível de Requirement (nunca reescreve a linha original) — a
   * PromptMasterVersion em si só é imutável depois de LOCKED (Fase 3 da governança), então
   * corrigir um achado enquanto ainda é DRAFT nunca precisa de uma PromptMasterVersion nova.
   */
  async applyChanges(
    missionId: string,
    promptMasterId: string,
    decisions: (CopilotChangeDto & { accepted: boolean })[],
    actor: 'user' | 'ai-auto-repair' = 'user'
  ): Promise<void> {
    const createdBy = actor === 'ai-auto-repair' ? 'auto-repair-agent' : 'promptmaster-copilot';
    const now = new Date();
    for (const change of decisions) {
      if (!change.accepted) continue;

      if (change.action === 'ADD' && change.afterContent) {
        await this.prisma.requirement.create({
          data: {
            id: randomUUID(),
            missionId,
            promptMasterId,
            section: change.section,
            content: change.afterContent,
            origin: 'AI_SUGGESTED',
            status: 'CONFIRMED',
            createdBy,
            approvedBy: actor,
            approvedAt: now,
            reasoningSummary: change.reason,
          },
        });
      } else if (change.action === 'REMOVE' && change.targetRequirementId) {
        await this.prisma.requirement.update({
          where: { id: change.targetRequirementId },
          data: { status: 'REJECTED', approvedBy: actor, approvedAt: now },
        });
      } else if (change.action === 'EDIT' && change.targetRequirementId && change.afterContent) {
        const target = await this.prisma.requirement.findUnique({ where: { id: change.targetRequirementId } });
        if (!target || target.missionId !== missionId) continue;
        await this.prisma.requirement.update({ where: { id: target.id }, data: { status: 'SUPERSEDED' } });
        await this.prisma.requirement.create({
          data: {
            id: randomUUID(),
            missionId,
            promptMasterId,
            section: target.section,
            content: change.afterContent,
            origin: target.origin,
            status: 'CONFIRMED',
            createdBy,
            approvedBy: actor,
            approvedAt: now,
            version: target.version + 1,
            parentRequirementId: target.id,
            reasoningSummary: change.reason,
          },
        });
      }
    }
  }

  /**
   * MISSÃO "Auto-Governança por IA" — Auto-Repair Loop (seção 17): todo achado que a
   * PromptMasterDecisionPolicy classificou como resolvível sem decisão humana
   * (AUTO / AUTO_WITH_DISCLOSURE / USER_CONFIRMATION) é corrigido de verdade, pelo mesmo motor
   * de diff do Copilot. Achados sem alvo mecânico são apenas marcados resolvidos com a própria
   * classificação como motivo. Só os reviewers cujos achados foram realmente corrigidos voltam a
   * rodar ("Affected Reviewers rerun") — nunca o Council inteiro.
   */
  async autoRepair(missionId: string, promptMasterId: string): Promise<AutoRepairResultDto> {
    const classified = await this.classifyOpenFindings(promptMasterId);
    const autoResolvable = classified.filter(
      (c) => c.classification.outcome !== 'USER_DECISION_REQUIRED' && c.classification.outcome !== 'BLOCKED'
    );

    const touchedReviewers = new Set<string>();
    let patched = 0;
    for (const { finding, classification } of autoResolvable) {
      if (patched >= AUTO_REPAIR_MAX_FINDINGS) break;

      if (!classification.autoFixable || finding.requirementIds.length === 0) {
        await this.reviewFindings.resolve(finding.id, 'ai-auto-repair', `Sem correção mecânica necessária (${classification.outcome}): ${classification.reason}`);
        continue;
      }

      const instruction = `Correção automática de baixo risco (${classification.outcome}) para o problema identificado pela revisão "${finding.reviewerKey}": ${finding.finding}${finding.recommendedResolutions[0] ? ` Sugestão: ${finding.recommendedResolutions[0]}` : ''}`;
      try {
        const proposal = await this.proposeChange(promptMasterId, instruction);
        if (proposal.changes.length === 0) continue; // nada concreto encontrado — permanece OPEN, nunca finge corrigir
        await this.applyChanges(missionId, promptMasterId, proposal.changes.map((c) => ({ ...c, accepted: true })), 'ai-auto-repair');
        await this.reviewFindings.resolve(finding.id, 'ai-auto-repair', `Corrigido automaticamente (${classification.outcome}): ${classification.reason}`);
        touchedReviewers.add(finding.reviewerKey);
        patched++;
      } catch {
        // IA de correção indisponível não pode travar o fluxo — o achado continua OPEN, nunca escondido.
        continue;
      }
    }

    if (touchedReviewers.size > 0) {
      const stillDraft = await this.prisma.promptMasterVersion.findFirst({ where: { id: promptMasterId, status: 'DRAFT' } });
      if (stillDraft) {
        await Promise.allSettled(
          [...touchedReviewers].map((key) => this.reviewCouncil.retryReviewer(missionId, promptMasterId, key as ReviewerKey))
        );
      }
    }

    return { patched, touchedReviewers: [...touchedReviewers] };
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
