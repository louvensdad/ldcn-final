import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../persistence/prisma.service';
import { ReviewFindingService, ReviewFindingDto } from '../review/review-finding.service';
import { ReviewCouncilService, ReviewerExecutionDto, ReviewerKey } from '../review/review-council.service';
import { PromptMasterDecisionPolicy, DecisionPolicyOutcome } from '../review/decision-policy.service';
import { PromptMasterEditingService } from '../review/prompt-master-editing.service';

/** Fase 12 do brief "Completar o fluxo de compra/personalização": teto real de rodadas de
 * auto-repair/re-review por plano — sem isso, um PromptMaster derivado que oscila (um fix
 * introduz um achado novo, que introduz outro) poderia girar pra sempre. Mesmo espírito do
 * AUTO_REPAIR_MAX_FINDINGS do Discovery, mas no nível do CICLO inteiro, não de achados individuais. */
export const MAX_REVIEW_ATTEMPTS = 5;

export type MarketplaceReviewGateConditionCode = 'NO_UNRESOLVED_BLOCKERS' | 'NO_PENDING_USER_DECISIONS' | 'REVIEW_COUNCIL_COMPLETED';

export interface MarketplaceReviewGateConditionDto {
  code: MarketplaceReviewGateConditionCode;
  passed: boolean;
  failedReviewers?: string[];
}

export interface MarketplaceReviewGateDto {
  promptMasterId: string;
  passed: boolean;
  conditions: MarketplaceReviewGateConditionDto[];
}

export interface MarketplaceReviewFindingDto extends ReviewFindingDto {
  decisionOutcome: DecisionPolicyOutcome;
}

/** Fase 2 do brief — a "MarketplaceReviewSession" é deliberadamente uma VIEW computada sobre
 * MarketplaceCustomizationPlan + ReviewFinding + ReviewerExecution + PromptMasterDecision, nunca
 * uma tabela nova: o plano já É a sessão de revisão de uma personalização (mesmo padrão que
 * Discovery já usa — reviewStatus/gate também são sempre computados, nunca persistidos à parte).
 * Criar uma entidade paralela persistida aqui seria exatamente a "arquitetura paralela" que a
 * missão proíbe. */
export interface MarketplaceReviewSessionDto {
  planId: string;
  promptMasterId: string;
  status: 'REVIEWING' | 'WAITING_USER' | 'READY' | 'REVIEW_LOOP_EXHAUSTED';
  gate: MarketplaceReviewGateDto;
  findings: MarketplaceReviewFindingDto[];
  reviewerExecutions: ReviewerExecutionDto[];
  reviewStatus: 'PENDING' | 'REVIEW_COMPLETE' | 'REVIEW_COMPLETE_DEGRADED' | 'REVIEW_PARTIALLY_COMPLETED';
  autoResolvedCount: number;
  userDecisionsMadeCount: number;
  reviewAttemptCount: number;
  maxReviewAttempts: number;
}

/**
 * MISSÃO "Completar o fluxo de compra/personalização do Marketplace" — o orquestrador que faltava
 * (ver relatório: approvePlan() rodava o Review Council e, ao achar um BLOCKER legítimo, só
 * lançava DISCOVERY_PROMPTMASTER_HAS_BLOCKERS — o comprador ficava sem UX nenhuma de resolução).
 * Nenhuma lógica de propor/aplicar diff, Auto-Repair Loop ou classificação de achado é
 * reimplementada aqui — tudo vem de PromptMasterEditingService/ReviewCouncilService/
 * PromptMasterDecisionPolicy, o mesmo motor real que o Discovery usa (Fase 1 do audit).
 */
@Injectable()
export class MarketplaceReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reviewFindings: ReviewFindingService,
    private readonly reviewCouncil: ReviewCouncilService,
    private readonly decisionPolicy: PromptMasterDecisionPolicy,
    private readonly editing: PromptMasterEditingService
  ) {}

  /**
   * O ciclo real: Auto-Repair Loop (a IA tenta resolver tudo que for seguro primeiro) → avalia o
   * gate (só BLOCKED/USER_DECISION_REQUIRED — a mesma autoridade central da DecisionPolicy —
   * impedem prosseguir) → se limpo, trava o PromptMaster e aprova o plano; senão, devolve a sessão
   * com o que sobrou para o comprador decidir. Chamado tanto pela primeira aprovação quanto por
   * "resume" depois de uma decisão do comprador — idempotente e seguro de chamar de novo.
   */
  async runCycle(planId: string): Promise<MarketplaceReviewSessionDto> {
    const plan = await this.requirePlan(planId);
    if (plan.status === 'APPROVED') return this.buildSession(plan);

    const promptMaster = await this.prisma.promptMasterVersion.findFirst({ where: { missionId: plan.missionId, status: 'DRAFT' }, orderBy: { version: 'desc' } });
    if (!promptMaster) throw new Error('MARKETPLACE_CUSTOMIZATION_PLAN_NOT_FOUND');

    // O teto (Fase 12 — loop guard) só impede o sistema de tentar se corrigir sozinho pra sempre;
    // uma decisão real do comprador é sempre uma ação nova, nunca uma tentativa automática — o
    // gate é reavaliado (e o plano pode fechar) mesmo depois do teto, senão resolver manualmente o
    // último BLOCKER travaria o comprador para sempre num REVIEW_LOOP_EXHAUSTED que ele mesmo já
    // resolveu.
    const capped = plan.reviewAttemptCount >= MAX_REVIEW_ATTEMPTS;
    if (!capped) {
      await this.prisma.marketplaceCustomizationPlan.update({ where: { id: planId }, data: { reviewAttemptCount: { increment: 1 } } });
      // A IA sempre trabalha primeiro (seção 21 do brief: reduzir userDecisionsRequested) — só o
      // que sobrar depois disto é uma decisão real do comprador.
      await this.editing.autoRepair(plan.missionId, promptMaster.id);
    }

    const gate = await this.evaluateGate(promptMaster.id);
    if (!gate.passed) {
      const refreshed = await this.requirePlan(planId);
      return this.buildSession(refreshed, promptMaster.id, gate);
    }

    const now = new Date();
    await this.prisma.marketplaceCustomizationPlan.update({ where: { id: planId }, data: { status: 'APPROVED', approvedAt: now } });
    await this.prisma.promptMasterVersion.update({ where: { id: promptMaster.id }, data: { status: 'LOCKED', lockedAt: now } });

    const approved = await this.requirePlan(planId);
    return this.buildSession(approved, promptMaster.id, gate);
  }

  async getSession(planId: string): Promise<MarketplaceReviewSessionDto> {
    const plan = await this.requirePlan(planId);
    return this.buildSession(plan);
  }

  /**
   * Espelha DiscoveryService.resolveFinding — resolução direta (achado disclosed, sem alvo
   * mecânico de negócio). Fase 18 (Auto Continue): ao contrário do Discovery (onde um segundo
   * clique em "Aprovar" é sempre exigido), aqui a resolução já tenta avançar o ciclo sozinha —
   * "Personalização → Review → Resolver → Cotar" fica na mesma experiência, sem o comprador
   * precisar pedir explicitamente por uma nova rodada.
   */
  async resolveFinding(planId: string, findingId: string, resolutionNote?: string): Promise<MarketplaceReviewSessionDto> {
    const plan = await this.requirePlan(planId);
    const promptMaster = await this.requireDraftPromptMaster(plan);
    await this.requireOpenFinding(promptMaster.id, findingId);

    await this.reviewFindings.resolve(findingId, 'user', resolutionNote);
    return this.runCycle(planId);
  }

  /**
   * Espelha DiscoveryService.decideFinding (Fase 8 — Decision Center): a escolha do comprador vira
   * uma instrução real pro mesmo motor do Copilot. "Decision → Requirement update" é uma ação só.
   */
  async decideFinding(planId: string, findingId: string, chosenOption: string): Promise<MarketplaceReviewSessionDto> {
    if (!chosenOption?.trim()) throw new Error('INVALID_DISCOVERY_INPUT');
    const plan = await this.requirePlan(planId);
    const promptMaster = await this.requireDraftPromptMaster(plan);
    const finding = await this.requireOpenFinding(promptMaster.id, findingId);

    const instruction = `Resolução escolhida pelo comprador para o problema "${finding.finding}": ${chosenOption.trim()}`;
    const proposal = await this.editing.proposeChange(promptMaster.id, instruction);
    if (proposal.changes.length > 0) {
      await this.editing.applyChanges(plan.missionId, promptMaster.id, proposal.changes.map((c) => ({ ...c, accepted: true })), 'user');
    }

    await this.prisma.promptMasterDecision.create({
      data: { id: randomUUID(), missionId: plan.missionId, promptMasterId: promptMaster.id, findingId, chosenOption: chosenOption.trim(), decidedBy: 'user' },
    });
    await this.reviewFindings.resolve(findingId, 'user', chosenOption.trim());

    return this.runCycle(planId);
  }

  /**
   * Fase 7 — Copilot do Marketplace: em vez de escolher uma das recommendedResolutions, o
   * comprador descreve em linguagem natural o que quer para ESTE achado específico e a IA já
   * aplica (a mesma revisão do diff que o Decision Center faz é a própria escolha da opção — não
   * existe um segundo gate de aprovação aqui, igual ao Copilot do Discovery).
   */
  async delegateToAi(planId: string, findingId: string, instruction?: string): Promise<MarketplaceReviewSessionDto> {
    const plan = await this.requirePlan(planId);
    const promptMaster = await this.requireDraftPromptMaster(plan);
    const finding = await this.requireOpenFinding(promptMaster.id, findingId);

    const message = instruction?.trim()
      ? `Para o problema "${finding.finding}": ${instruction.trim()}`
      : `Resolva da forma mais segura o problema identificado pela revisão "${finding.reviewerKey}": ${finding.finding}${finding.recommendedResolutions[0] ? ` Sugestão: ${finding.recommendedResolutions[0]}` : ''}`;

    const proposal = await this.editing.proposeChange(promptMaster.id, message);
    if (proposal.changes.length === 0) throw new Error('MARKETPLACE_REVIEW_NO_MECHANICAL_TARGET');
    await this.editing.applyChanges(plan.missionId, promptMaster.id, proposal.changes.map((c) => ({ ...c, accepted: true })), 'user');
    await this.reviewFindings.resolve(findingId, 'user', instruction?.trim() || `Delegado à IA: ${proposal.summary}`);

    return this.runCycle(planId);
  }

  /** Fase 11 — rerun seletivo: só o reviewer indicado, nunca o Council inteiro. */
  async retryReviewer(planId: string, reviewerKey: ReviewerKey): Promise<MarketplaceReviewSessionDto> {
    const plan = await this.requirePlan(planId);
    const promptMaster = await this.requireDraftPromptMaster(plan);
    await this.reviewCouncil.retryReviewer(plan.missionId, promptMaster.id, reviewerKey);
    return this.buildSession(await this.requirePlan(planId), promptMaster.id);
  }

  private async evaluateGate(promptMasterId: string): Promise<MarketplaceReviewGateDto> {
    const [classified, executions] = await Promise.all([
      this.editing.classifyOpenFindings(promptMasterId),
      this.reviewCouncil.listExecutions(promptMasterId),
    ]);
    const hasBlocked = classified.some((c) => c.classification.outcome === 'BLOCKED');
    const hasUserDecisionRequired = classified.some((c) => c.classification.outcome === 'USER_DECISION_REQUIRED');
    const latestPerReviewer = this.reviewCouncil.latestExecutionPerReviewer(executions);
    const reviewStatus = this.reviewCouncil.computeReviewStatus(latestPerReviewer);
    const failedReviewers = latestPerReviewer.filter((e) => e.status === 'DEGRADED' || e.status === 'FAILED_BLOCKING').map((e) => e.reviewerKey);

    const conditions: MarketplaceReviewGateConditionDto[] = [
      { code: 'NO_UNRESOLVED_BLOCKERS', passed: !hasBlocked },
      { code: 'NO_PENDING_USER_DECISIONS', passed: !hasUserDecisionRequired },
      { code: 'REVIEW_COUNCIL_COMPLETED', passed: reviewStatus !== 'REVIEW_PARTIALLY_COMPLETED', ...(failedReviewers.length > 0 ? { failedReviewers } : {}) },
    ];
    return { promptMasterId, passed: conditions.every((c) => c.passed), conditions };
  }

  private async buildSession(
    plan: { id: string; missionId: string; status: string; reviewAttemptCount: number },
    promptMasterIdHint?: string,
    gateHint?: MarketplaceReviewGateDto
  ): Promise<MarketplaceReviewSessionDto> {
    const promptMaster = promptMasterIdHint
      ? { id: promptMasterIdHint }
      : await this.prisma.promptMasterVersion.findFirst({ where: { missionId: plan.missionId }, orderBy: { version: 'desc' } });
    if (!promptMaster) throw new Error('MARKETPLACE_CUSTOMIZATION_PLAN_NOT_FOUND');

    const [findingRows, executions] = await Promise.all([
      this.reviewFindings.listForVersion(promptMaster.id),
      this.reviewCouncil.listExecutions(promptMaster.id),
    ]);
    const findings: MarketplaceReviewFindingDto[] = findingRows.map((f) => ({
      ...f,
      decisionOutcome: this.decisionPolicy.classify({
        severity: f.severity, requiresUserDecision: f.requiresUserDecision, finding: f.finding,
        recommendedResolutions: f.recommendedResolutions, requirementIds: f.requirementIds,
      }).outcome,
    }));
    const reviewStatus = this.reviewCouncil.computeReviewStatus(executions);
    const gate = plan.status === 'APPROVED'
      ? { promptMasterId: promptMaster.id, passed: true, conditions: [] as MarketplaceReviewGateConditionDto[] }
      : gateHint ?? (await this.evaluateGate(promptMaster.id));

    const status: MarketplaceReviewSessionDto['status'] =
      plan.status === 'APPROVED' ? 'READY'
      : plan.reviewAttemptCount >= MAX_REVIEW_ATTEMPTS && !gate.passed ? 'REVIEW_LOOP_EXHAUSTED'
      : gate.passed ? 'READY'
      : 'WAITING_USER';

    return {
      planId: plan.id,
      promptMasterId: promptMaster.id,
      status,
      gate,
      findings,
      reviewerExecutions: executions,
      reviewStatus,
      autoResolvedCount: findings.filter((f) => f.resolvedBy === 'ai-auto-repair').length,
      userDecisionsMadeCount: findings.filter((f) => f.resolvedBy === 'user').length,
      reviewAttemptCount: plan.reviewAttemptCount,
      maxReviewAttempts: MAX_REVIEW_ATTEMPTS,
    };
  }

  private async requirePlan(planId: string) {
    const plan = await this.prisma.marketplaceCustomizationPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new Error('MARKETPLACE_CUSTOMIZATION_PLAN_NOT_FOUND');
    return plan;
  }

  private async requireDraftPromptMaster(plan: { missionId: string; status: string }) {
    if (plan.status === 'APPROVED') throw new Error('MARKETPLACE_CUSTOMIZATION_PLAN_ALREADY_APPROVED');
    const promptMaster = await this.prisma.promptMasterVersion.findFirst({ where: { missionId: plan.missionId, status: 'DRAFT' }, orderBy: { version: 'desc' } });
    if (!promptMaster) throw new Error('MARKETPLACE_CUSTOMIZATION_PLAN_NOT_FOUND');
    return promptMaster;
  }

  private async requireOpenFinding(promptMasterId: string, findingId: string): Promise<ReviewFindingDto> {
    const findings = await this.reviewFindings.listForVersion(promptMasterId);
    const finding = findings.find((f) => f.id === findingId);
    if (!finding || finding.status !== 'OPEN') throw new Error('DISCOVERY_NOT_FOUND');
    return finding;
  }
}
