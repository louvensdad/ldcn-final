import { randomUUID } from 'node:crypto';
import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../persistence/prisma.service';
import { LLM_CLIENT, LlmClient } from '../assistant/deepseek-client';
import { MarketplaceSolutionService } from './marketplace-solution.service';
import { ReviewCouncilService } from '../review/review-council.service';
import { PromptMasterEditingService } from '../review/prompt-master-editing.service';
import { MarketplaceReviewService, MarketplaceReviewSessionDto } from './marketplace-review.service';
import { MarketplaceSolutionRevalidationService } from './marketplace-solution-revalidation.service';
import { MarketplaceGenerationScopeService } from './marketplace-generation-scope.service';
import { GeneratorService } from '../generator/generator.service';
import { LlmInvocationLedgerService } from '../ledger/llm-invocation-ledger.service';

const REQUIREMENT_SECTIONS = [
  'users', 'features', 'businessRules', 'flows', 'data', 'integrations',
  'security', 'privacy', 'nonFunctional', 'acceptanceCriteria', 'outOfScope',
] as const;

/** Fase 20 — mesmo padrão do Review Council: 2 tentativas reais antes de reportar indisponível. */
const CUSTOMIZER_MAX_ATTEMPTS = 2;
const CUSTOMIZER_RETRY_BACKOFF_MS = 400;

export type ChangeType = 'COSMETIC' | 'CONTENT' | 'CONFIGURATION' | 'MODULE' | 'BUSINESS_RULE' | 'INTEGRATION' | 'DATA_MODEL' | 'ARCHITECTURAL';
export type ArchitectureImpact = 'PATCH' | 'REVIEW_REQUIRED' | 'NEW_ARCHITECTURE_REQUIRED';
export type ComplexityClass = 'LOW' | 'MEDIUM' | 'HIGH';

interface CustomizerAddItem { section: string; content: string; type: ChangeType }
interface CustomizerModifyItem { targetContent: string; newContent: string; type: ChangeType }
interface CustomizerRemoveItem { targetContent: string; type: ChangeType }

interface CustomizerResult {
  businessContext: string;
  keep: string[];
  remove: CustomizerRemoveItem[];
  modify: CustomizerModifyItem[];
  add: CustomizerAddItem[];
  missingInformation: string[];
  assumptions: string[];
  confidence: number;
  /** Fase 13/14 do audit "Completar o fluxo de compra/personalização": null quando o pedido é só
   * um ajuste de módulo/regra — preenchido só quando o pedido é uma transformação real de domínio
   * (ex: clínica → distribuidora), para o PromptMaster derivado nunca ficar híbrido (visão de um
   * negócio, requisitos de outro). Nunca inventado fora desse caso. */
  visionUpdate: string | null;
  objectiveUpdate: string | null;
  targetAudienceUpdate: string | null;
}

export interface CustomizationPlanDto {
  id: string;
  solutionId: string;
  solutionVersionId: string;
  missionId: string;
  asIs: boolean;
  businessContext: string;
  keep: string[];
  remove: CustomizerRemoveItem[];
  modify: CustomizerModifyItem[];
  add: CustomizerAddItem[];
  droppedForPolicy: { item: string; type: ChangeType }[];
  architecturalChangesDetected: string[];
  missingInformation: string[];
  assumptions: string[];
  complexity: ComplexityClass;
  architectureImpact: ArchitectureImpact;
  requiresArchitectureReview: boolean;
  requiresUserDecision: boolean;
  /** Fase 19 — quando a descrição do comprador é material demais insuficiente para um plano real
   * (baixa confiança + nada de concreto pra mudar), nunca produz silenciosamente um plano vazio ou
   * inventado: sinaliza aqui e sugere uma pergunta, sem abrir uma state machine conversacional
   * paralela ao Discovery — o comprador só reenvia a descrição do "describe" step com mais detalhe. */
  needsClarification: boolean;
  clarificationQuestion: string | null;
  status: 'DRAFT' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  approvedAt: string | null;
  /** Fase 6/8/9/17 — presente sempre que o Review Council já rodou ao menos uma vez para esta
   * personalização (nunca antes de approvePlan()); é isto que a UI usa para mostrar Decision
   * Center / Findings / gate em vez de um erro técnico cru quando `status` continua DRAFT. */
  review: MarketplaceReviewSessionDto | null;
}

/**
 * MISSÃO "Marketplace de Sistemas Completos" seção 9/10/11/12 — MarketplaceSolutionCustomizerAI.
 * Reaproveita 100% da infraestrutura real já construída: mesmo LLM_CLIENT, mesmo modelo de
 * proveniência do Requirement (Fase 2 da governança do PromptMaster), mesmo ReviewCouncilService/
 * PromptMasterDecisionPolicy (Fase 6/7 daquela missão) para validar o PromptMaster derivado, e o
 * mesmo GeneratorService.start() (Architecture Office) pra gerar de verdade — nunca um caminho
 * paralelo (seção 52 do brief).
 *
 * Simplificação deliberada de escopo (ver relatório): a "Discovery de customização" (seção 10) é
 * single-shot aqui (uma descrição de negócio → um plano), não multi-turn como o Discovery normal
 * — reconstruir um motor conversacional inteiro paralelo ao Discovery já existente não se pagava
 * dentro do orçamento desta missão. O plano ainda é 100% real: IA real comparando manifesto real
 * contra o pedido real do usuário.
 */
const CUSTOMIZER_SYSTEM_PROMPT = `Você é o MarketplaceSolutionCustomizerAI do LDCN OS. Compara um sistema já existente e verificado (fornecido como JSON: manifesto + funcionalidades/regras/dados atuais) com o que um comprador descreveu sobre o próprio negócio, e produz um plano de personalização.

Regras obrigatórias:
- NUNCA remova ou modifique algo que o comprador não pediu, mesmo que pareça razoável.
- "keep": liste os itens do sistema atual que continuam fazendo sentido sem nenhuma mudança — a maioria dos itens do sistema deve continuar aqui.
- "remove"/"modify"/"add": só o que é uma consequência real e direta do que o comprador descreveu.
- Classifique CADA item de remove/modify/add com um "type": COSMETIC (visual/marca), CONTENT (texto/conteúdo), CONFIGURATION (parâmetro/opção), MODULE (uma funcionalidade inteira), BUSINESS_RULE (regra de negócio), INTEGRATION (integração externa), DATA_MODEL (estrutura de dado), ARCHITECTURAL (mudança de stack técnica/tecnologia — ex: trocar linguagem, framework, ou plataforma completamente).
- "add": cada item precisa de "section" (uma destas: users, features, businessRules, flows, data, integrations, security, privacy, nonFunctional, acceptanceCriteria, outOfScope), "content" (o texto do novo item) e "type".
- "missingInformation": dados que faltam para personalizar direito e o comprador ainda não informou (ex: preço, depoimentos, checkout, branding) — NUNCA invente esses dados.
- "assumptions": suposições razoáveis que você fez, deixadas explícitas para o comprador confirmar.
- "confidence": 0 a 1, quão confiante você está no plano.
- "visionUpdate"/"objectiveUpdate"/"targetAudienceUpdate": o sistema existente tem uma visão/objetivo/público-alvo próprios (fornecidos no contexto). Se o pedido do comprador for só um ajuste de módulo, regra ou conteúdo dentro do MESMO negócio, deixe os três como null (a visão original continua correta). Se o pedido for uma TRANSFORMAÇÃO DE DOMÍNIO/NEGÓCIO real (ex: o sistema é de uma clínica e o comprador descreve uma distribuidora de bebidas — um negócio genuinamente diferente), preencha os três com o texto atualizado e coerente refletindo o NOVO negócio — nunca deixe a visão antiga contradizendo os requisitos novos.

Responda SOMENTE com um objeto JSON válido, sem markdown, sem texto fora do JSON, exatamente neste formato:
{"businessContext": string, "keep": string[], "remove": [{"targetContent": string, "type": string}], "modify": [{"targetContent": string, "newContent": string, "type": string}], "add": [{"section": string, "content": string, "type": string}], "missingInformation": string[], "assumptions": string[], "confidence": number, "visionUpdate": string | null, "objectiveUpdate": string | null, "targetAudienceUpdate": string | null}`;

@Injectable()
export class MarketplaceCustomizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly solutions: MarketplaceSolutionService,
    private readonly reviewCouncil: ReviewCouncilService,
    private readonly editing: PromptMasterEditingService,
    private readonly review: MarketplaceReviewService,
    private readonly revalidation: MarketplaceSolutionRevalidationService,
    private readonly generationScope: MarketplaceGenerationScopeService,
    private readonly generator: GeneratorService,
    @Inject(LLM_CLIENT) private readonly llm: LlmClient,
    private readonly ledger: LlmInvocationLedgerService
  ) {}

  /**
   * Fase E/F: clona o PromptMaster de referência para uma missão nova (nunca edita o original —
   * seção 19), roda o Customizer AI (ou pula, para "comprar como está" — seção 28), classifica
   * cada mudança, detecta impacto arquitetural (seção 15/21) e nunca aplica mudança de stack em
   * silêncio.
   */
  async createCustomizationPlan(input: { solutionSlug: string; rawBusinessDescription?: string; asIs?: boolean }): Promise<CustomizationPlanDto> {
    const { solution, currentVersion } = await this.solutions.getSolutionBySlug(input.solutionSlug);
    if (!currentVersion || solution.status !== 'VERIFIED') throw new Error('MARKETPLACE_SOLUTION_NOT_FOUND');

    const referencePromptMaster = await this.prisma.promptMasterVersion.findUnique({ where: { id: currentVersion.referencePromptMasterVersionId } });
    if (!referencePromptMaster) throw new Error('MARKETPLACE_SOLUTION_NOT_FOUND');
    const referenceRequirements = await this.prisma.requirement.findMany({
      where: { promptMasterId: currentVersion.referencePromptMasterVersionId, status: 'CONFIRMED' },
    });

    const missionId = randomUUID();
    const asIs = Boolean(input.asIs) || !input.rawBusinessDescription?.trim();

    let raw: CustomizerResult;
    if (asIs) {
      raw = {
        businessContext: 'Compra sem personalização — sistema mantido como está.',
        keep: referenceRequirements.map((r) => r.content), remove: [], modify: [], add: [],
        missingInformation: [], assumptions: [], confidence: 1,
        visionUpdate: null, objectiveUpdate: null, targetAudienceUpdate: null,
      };
    } else {
      const context = {
        manifest: currentVersion.manifest,
        currentVision: referencePromptMaster.vision,
        currentObjective: referencePromptMaster.objective,
        currentTargetAudience: referencePromptMaster.targetAudience,
        currentContent: referenceRequirements.map((r) => ({ section: r.section, content: r.content })),
      };
      const user = `Sistema existente (JSON):\n${JSON.stringify(context, null, 2)}\n\nO que o comprador descreveu sobre o próprio negócio: "${input.rawBusinessDescription!.trim()}"`;
      raw = await this.completeCustomizerWithRetry(user, missionId);
    }

    // Fase 13/14 do audit: CustomizationConsistencyPreparation — quando o pedido é uma
    // transformação real de domínio (não um ajuste de módulo), o Customizer já devolveu uma
    // vision/objective/targetAudience coerentes com o NOVO negócio (nunca a IA do Review Council
    // resolvendo isso depois — na hora certa é aqui, antes do PromptMaster derivado existir).
    const newPromptMasterId = randomUUID();
    await this.prisma.promptMasterVersion.create({
      data: {
        id: newPromptMasterId, missionId, version: 1,
        vision: raw.visionUpdate?.trim() || referencePromptMaster.vision,
        objective: raw.objectiveUpdate?.trim() || referencePromptMaster.objective,
        targetAudience: raw.targetAudienceUpdate?.trim() || referencePromptMaster.targetAudience,
        fullMarkdown: referencePromptMaster.fullMarkdown, hash: randomUUID(), status: 'DRAFT', createdBy: 'marketplace-customizer',
        provider: 'deepseek', model: 'n/a', promptTokens: 0, completionTokens: 0, latencyMs: 0,
        sourceSolutionId: solution.id, sourceSolutionVersionId: currentVersion.id,
      },
    });
    if (referenceRequirements.length > 0) {
      await this.prisma.requirement.createMany({
        data: referenceRequirements.map((r) => ({
          id: randomUUID(), missionId, promptMasterId: newPromptMasterId, section: r.section, content: r.content,
          origin: 'USER_IMPORTED', status: 'CONFIRMED', createdBy: 'marketplace-customizer', approvedBy: 'user', approvedAt: new Date(),
          sourceSolutionId: solution.id, sourceRequirementId: r.id,
        })),
      });
    }

    const policy = currentVersion.manifest.customizationPolicy;
    const droppedForPolicy: { item: string; type: ChangeType }[] = [];
    const architecturalChangesDetected: string[] = [];

    const isAllowedByPolicy = (type: ChangeType): boolean => {
      switch (type) {
        case 'MODULE': return policy.modules;
        case 'BUSINESS_RULE': return policy.businessRules;
        case 'INTEGRATION': return policy.integrations;
        case 'DATA_MODEL': return policy.databaseChange;
        case 'COSMETIC': return policy.branding;
        case 'CONTENT': return policy.content;
        default: return true; // CONFIGURATION sempre permitido — nunca decisão de produto/negócio
      }
    };

    const remove = raw.remove.filter((c) => {
      if (c.type === 'ARCHITECTURAL') { architecturalChangesDetected.push(c.targetContent); return false; }
      if (!isAllowedByPolicy(c.type)) { droppedForPolicy.push({ item: c.targetContent, type: c.type }); return false; }
      return true;
    });
    const modify = raw.modify.filter((c) => {
      if (c.type === 'ARCHITECTURAL') { architecturalChangesDetected.push(c.targetContent); return false; }
      if (!isAllowedByPolicy(c.type)) { droppedForPolicy.push({ item: c.targetContent, type: c.type }); return false; }
      return true;
    });
    const add = raw.add.filter((c) => {
      if (c.type === 'ARCHITECTURAL') { architecturalChangesDetected.push(c.content); return false; }
      if (!(REQUIREMENT_SECTIONS as readonly string[]).includes(c.section)) return false;
      if (!isAllowedByPolicy(c.type)) { droppedForPolicy.push({ item: c.content, type: c.type }); return false; }
      return true;
    });

    const totalChanges = remove.length + modify.length + add.length;
    const hasDataOrIntegration = [...remove, ...modify, ...add].some((c) => c.type === 'DATA_MODEL' || c.type === 'INTEGRATION');
    const complexity: ComplexityClass = totalChanges > 6 || hasDataOrIntegration ? 'HIGH' : totalChanges > 2 ? 'MEDIUM' : 'LOW';
    const architectureImpact: ArchitectureImpact =
      architecturalChangesDetected.length > 0 ? 'NEW_ARCHITECTURE_REQUIRED' : hasDataOrIntegration ? 'REVIEW_REQUIRED' : 'PATCH';

    // Fase 19 do audit — MarketplaceCustomizationClarification (deliberadamente determinístico,
    // sem uma segunda chamada de IA nem uma state machine conversacional paralela ao Discovery):
    // baixa confiança + nada de concreto pra mudar + dados faltando é o sinal real de que a
    // descrição foi insuficiente, nunca "o comprador só queria manter quase tudo".
    const needsClarification = !asIs && raw.confidence < 0.35 && totalChanges === 0 && raw.missingInformation.length > 0;
    const clarificationQuestion = needsClarification
      ? 'Não entendi o suficiente sobre o seu negócio para montar um plano de personalização. Que tipo de negócio é e o que exatamente você precisa mudar no sistema?'
      : null;

    const planId = randomUUID();
    await this.prisma.marketplaceCustomizationPlan.create({
      data: {
        id: planId, solutionId: solution.id, solutionVersionId: currentVersion.id, missionId,
        requestedBy: 'user', asIs,
        businessContextJson: {
          description: raw.businessContext, missingInformation: raw.missingInformation, assumptions: raw.assumptions,
          confidence: raw.confidence, needsClarification, clarificationQuestion,
        } as unknown as object,
        keepJson: raw.keep as unknown as object,
        removeJson: remove as unknown as object,
        modifyJson: modify as unknown as object,
        addJson: add as unknown as object,
        architectureImpactsJson: architecturalChangesDetected as unknown as object,
        complexity, architectureImpact,
        requiresArchitectureReview: architectureImpact !== 'PATCH',
        requiresUserDecision: architecturalChangesDetected.length > 0 || droppedForPolicy.length > 0,
        status: 'DRAFT',
      },
    });

    await this.prisma.promptMasterVersion.update({ where: { id: newPromptMasterId }, data: { customizationPlanId: planId } });

    return this.toPlanDto(planId, droppedForPolicy);
  }

  async getPlan(planId: string): Promise<CustomizationPlanDto> {
    return this.toPlanDto(planId, undefined);
  }

  /**
   * Fase F/G/1 do audit "Completar o fluxo de compra/personalização": aplica de verdade
   * keep/remove/modify/add no PromptMaster derivado (nunca no original, nunca duas vezes — guarda
   * de idempotência via reviewAttemptCount), roda o Review Council de verdade e então entrega ao
   * mesmo ciclo Auto-Repair/gate que Discovery usa (MarketplaceReviewService.runCycle). Só marca
   * aprovado quando o gate estiver realmente limpo; quando sobrar algo, NUNCA lança um erro técnico
   * cru — devolve o plano (ainda DRAFT) com a sessão de revisão anexada, para o comprador resolver
   * sem sair do Marketplace (Fase 6/8/17).
   */
  async approvePlan(planId: string): Promise<CustomizationPlanDto> {
    const plan = await this.prisma.marketplaceCustomizationPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new Error('MARKETPLACE_CUSTOMIZATION_PLAN_NOT_FOUND');
    if (plan.architectureImpact === 'NEW_ARCHITECTURE_REQUIRED') {
      throw new Error('MARKETPLACE_CUSTOMIZATION_POLICY_VIOLATION');
    }
    if (plan.status === 'APPROVED') return this.toPlanDto(planId, undefined);
    if (plan.status === 'REJECTED') throw new Error('MARKETPLACE_CUSTOMIZATION_PLAN_REJECTED');

    const promptMaster = await this.prisma.promptMasterVersion.findFirst({ where: { missionId: plan.missionId, status: 'DRAFT' }, orderBy: { version: 'desc' } });
    if (!promptMaster) throw new Error('MARKETPLACE_CUSTOMIZATION_PLAN_NOT_FOUND');

    // Primeira chamada real (reviewAttemptCount só é incrementado por runCycle) — aplica o diff do
    // Customizer e roda o Council uma única vez. Uma segunda chamada a approvePlan (o comprador
    // clicando de novo, ou o frontend chamando resume) nunca reaplica o mesmo diff duas vezes.
    if (plan.reviewAttemptCount === 0) {
      const currentRequirements = await this.prisma.requirement.findMany({ where: { promptMasterId: promptMaster.id, status: { not: 'REJECTED' } } });
      const bySection = new Map(currentRequirements.map((r) => [`${r.section}:${r.content}`, r]));
      const now = new Date();

      for (const c of plan.removeJson as unknown as CustomizerRemoveItem[]) {
        const match = [...bySection.values()].find((r) => r.content === c.targetContent);
        if (match) await this.prisma.requirement.update({ where: { id: match.id }, data: { status: 'REJECTED', approvedBy: 'user', approvedAt: now } });
      }
      for (const c of plan.modifyJson as unknown as CustomizerModifyItem[]) {
        const match = [...bySection.values()].find((r) => r.content === c.targetContent);
        if (!match) continue;
        await this.prisma.requirement.update({ where: { id: match.id }, data: { status: 'SUPERSEDED' } });
        await this.prisma.requirement.create({
          data: {
            id: randomUUID(), missionId: plan.missionId, promptMasterId: promptMaster.id, section: match.section, content: c.newContent,
            origin: 'AI_REFINED', status: 'CONFIRMED', createdBy: 'marketplace-customizer', approvedBy: 'user', approvedAt: now,
            version: match.version + 1, parentRequirementId: match.id, sourceSolutionId: match.sourceSolutionId, sourceRequirementId: match.sourceRequirementId,
          },
        });
      }
      for (const c of plan.addJson as unknown as CustomizerAddItem[]) {
        await this.prisma.requirement.create({
          data: {
            id: randomUUID(), missionId: plan.missionId, promptMasterId: promptMaster.id, section: c.section, content: c.content,
            origin: 'AI_REFINED', status: 'CONFIRMED', createdBy: 'marketplace-customizer', approvedBy: 'user', approvedAt: now,
          },
        });
      }

      // Fase G/20: o mesmo Review Council que valida qualquer PromptMaster — nunca confia
      // cegamente no Customizer AI (seção 20 do brief).
      await this.reviewCouncil.runCouncil(plan.missionId, promptMaster.id);
    }

    const session = await this.review.runCycle(planId);

    if (session.status !== 'READY' && plan.asIs) {
      // Fase 15: "comprar como está" nunca deveria introduzir mudança nenhuma — um BLOCKER
      // real aqui significa que a própria solução VERIFIED publicada tem uma inconsistência de
      // origem. Nunca pedir ao comprador para consertar o produto do publisher.
      const stillBlocked = !session.gate.conditions.find((c) => c.code === 'NO_UNRESOLVED_BLOCKERS')?.passed
        || !session.gate.conditions.find((c) => c.code === 'NO_PENDING_USER_DECISIONS')?.passed;
      if (stillBlocked) {
        const blockers = session.findings.filter((f) => f.status === 'OPEN' && (f.decisionOutcome === 'BLOCKED' || f.decisionOutcome === 'USER_DECISION_REQUIRED'));
        const note = blockers.map((f) => `[${f.reviewerKey}] ${f.code}: ${f.finding}`).join('\n') || 'Review Council encontrou BLOCKER numa compra "como está".';
        await this.revalidation.flagForRevalidation(plan.solutionVersionId, note);
        await this.prisma.marketplaceCustomizationPlan.update({ where: { id: planId }, data: { status: 'REJECTED' } });
        throw new Error('MARKETPLACE_PUBLISHED_SOLUTION_REVIEW_DRIFT');
      }
    }

    return this.toPlanDto(planId, undefined);
  }

  /**
   * Fase H/J: só depois da compra confirmada (ver marketplace-billing.service.ts) — cria o
   * Project derivado real. MISSÃO "Targeted Generation": nunca chama `generator.start()` (que
   * redecide stack/arquitetura/equipe do zero) sem antes calcular o impacto real da customização
   * — quando o `CustomizationPlan` não exige recompor arquitetura/equipe, reaproveita as decisões
   * já governadas da solução de referência (`generator.startTargeted`), sempre revalidadas de
   * verdade pelo mesmo Generator (nunca copiadas às cegas). Nunca um caminho de geração paralelo.
   */
  async deriveProjectAndGenerate(planId: string, projectId: string): Promise<{
    operationId: string; status: string; generationMode: 'TARGETED' | 'FULL'; impactScore: number; reusedRequirements: number; totalRequirements: number;
  }> {
    const plan = await this.prisma.marketplaceCustomizationPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new Error('MARKETPLACE_CUSTOMIZATION_PLAN_NOT_FOUND');
    const promptMaster = await this.prisma.promptMasterVersion.findFirst({ where: { missionId: plan.missionId, status: 'LOCKED' } });
    if (!promptMaster) throw new Error('MARKETPLACE_CUSTOMIZATION_PLAN_NOT_APPROVED');

    const confirmedFeatures = await this.prisma.requirement.findMany({ where: { promptMasterId: promptMaster.id, section: 'features', status: 'CONFIRMED' } });
    const enrichedIdea = [promptMaster.vision, promptMaster.objective, confirmedFeatures.length ? `Funcionalidades: ${confirmedFeatures.map((r) => r.content).join(', ')}.` : '']
      .filter(Boolean).join(' ');

    await this.prisma.projectMission.upsert({ where: { missionId: plan.missionId }, create: { missionId: plan.missionId, projectId }, update: { projectId } });

    const scopeDto = await this.generationScope.computeAndPersist(planId, projectId);

    let operationId: string;
    let status: string;
    if (scopeDto.generationMode === 'FULL') {
      const result = await this.generator.start(plan.missionId, { rawUserIdea: enrichedIdea });
      operationId = result.operationId; status = result.status;
      await this.generationScope.recordOutcome(planId, { reuseStackSelection: false, reuseArchitecture: false, reuseTeam: false }, []);
    } else {
      const result = await this.generator.startTargeted(plan.missionId, { rawUserIdea: enrichedIdea }, scopeDto.referenceMissionId, this.generationScope.toReuseScope(scopeDto));
      operationId = result.operationId; status = result.status;
      await this.generationScope.recordOutcome(planId, result.actualReuse, result.escalations);
    }

    return {
      operationId, status, generationMode: scopeDto.generationMode,
      impactScore: scopeDto.impactScore, reusedRequirements: scopeDto.reusedRequirements, totalRequirements: scopeDto.totalRequirements,
    };
  }

  /**
   * Fase 20 do audit "Completar o fluxo de compra/personalização": mesmo espírito do retry do
   * Review Council (review-council.service.ts) — uma falha transitória de rede/rate-limit nunca
   * deveria virar AI_UNAVAILABLE permanente na primeira tentativa. Roda ANTES de qualquer escrita
   * no banco (o CustomizationPlan só é criado depois deste resultado) — nada a preservar/perder em
   * caso de falha, o comprador só tenta de novo com a mesma descrição.
   */
  private async completeCustomizerWithRetry(user: string, missionId: string): Promise<CustomizerResult> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= CUSTOMIZER_MAX_ATTEMPTS; attempt++) {
      try {
        const completion = await this.ledger.recordLlmCall(
          {
            missionId,
            purpose: 'marketplace.customization',
            phase: 'PLANNING',
            promptType: 'marketplace-customization',
            promptVersion: 'v1',
            contextForHash: { user },
            system: CUSTOMIZER_SYSTEM_PROMPT,
            user,
            refs: { missionId },
          },
          () => this.llm.complete({ system: CUSTOMIZER_SYSTEM_PROMPT, user, responseFormat: 'json_object' })
        );
        const parsed = this.parseJson<CustomizerResult>(completion.text);
        if (parsed) return parsed;
        if (process.env.MKT_DEBUG) console.error('CUSTOMIZER_JSON_PARSE_FAILED', completion.text.slice(0, 2000));
        lastError = new Error('CUSTOMIZER_MALFORMED_RESPONSE');
      } catch (e) {
        if (process.env.MKT_DEBUG) console.error('CUSTOMIZER_LLM_COMPLETE_FAILED', e);
        lastError = e;
      }
      if (attempt < CUSTOMIZER_MAX_ATTEMPTS) await this.delay(CUSTOMIZER_RETRY_BACKOFF_MS);
    }
    if (process.env.MKT_DEBUG) console.error('CUSTOMIZER_ALL_ATTEMPTS_FAILED', lastError);
    throw new Error('MARKETPLACE_CUSTOMIZER_AI_UNAVAILABLE');
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private parseJson<T>(text: string): T | null {
    try {
      const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '');
      return JSON.parse(cleaned) as T;
    } catch {
      return null;
    }
  }

  private async toPlanDto(planId: string, droppedForPolicy: { item: string; type: ChangeType }[] | undefined): Promise<CustomizationPlanDto> {
    const row = await this.prisma.marketplaceCustomizationPlan.findUnique({ where: { id: planId } });
    if (!row) throw new Error('MARKETPLACE_CUSTOMIZATION_PLAN_NOT_FOUND');
    const businessContext = row.businessContextJson as unknown as {
      description: string; missingInformation: string[]; assumptions: string[];
      needsClarification?: boolean; clarificationQuestion?: string | null;
    };

    // Só existe uma sessão de revisão depois que approvePlan() rodou o Council ao menos uma vez
    // (reviewAttemptCount > 0) — antes disso (plano recém-criado) não há nada ainda pra mostrar.
    const review = row.status !== 'REJECTED' && row.reviewAttemptCount > 0 ? await this.review.getSession(planId) : null;

    return {
      id: row.id, solutionId: row.solutionId, solutionVersionId: row.solutionVersionId, missionId: row.missionId,
      asIs: row.asIs,
      businessContext: businessContext.description,
      keep: row.keepJson as unknown as string[],
      remove: row.removeJson as unknown as CustomizerRemoveItem[],
      modify: row.modifyJson as unknown as CustomizerModifyItem[],
      add: row.addJson as unknown as CustomizerAddItem[],
      droppedForPolicy: droppedForPolicy ?? [],
      architecturalChangesDetected: row.architectureImpactsJson as unknown as string[],
      missingInformation: businessContext.missingInformation ?? [],
      assumptions: businessContext.assumptions ?? [],
      complexity: row.complexity as ComplexityClass,
      architectureImpact: row.architectureImpact as ArchitectureImpact,
      requiresArchitectureReview: row.requiresArchitectureReview,
      requiresUserDecision: row.requiresUserDecision,
      needsClarification: businessContext.needsClarification ?? false,
      clarificationQuestion: businessContext.clarificationQuestion ?? null,
      status: row.status as CustomizationPlanDto['status'],
      createdAt: row.createdAt.toISOString(),
      approvedAt: row.approvedAt?.toISOString() ?? null,
      review,
    };
  }
}
