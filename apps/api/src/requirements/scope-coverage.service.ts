import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../persistence/prisma.service';
import { EventLogService } from '../events/event-log.service';
import { RequirementBaselineService, RequirementBaselineSnapshot } from './requirement-baseline.service';
import { canonicalHash } from './canonical-hash';

export type ScopeDecision = 'IN_SCOPE' | 'DEFERRED_USER_APPROVED' | 'NOT_APPLICABLE' | 'BLOCKED';
const VALID_DECISIONS: ScopeDecision[] = ['IN_SCOPE', 'DEFERRED_USER_APPROVED', 'NOT_APPLICABLE', 'BLOCKED'];

export interface SetScopeDecisionInput {
  missionId: string;
  requirementId: string;
  requirementBaselineId: string;
  decision: ScopeDecision;
  reason?: string;
  decisionSource: string;
  approvalRef?: string;
}

export interface ScopeCoverageItem {
  requirementId: string;
  requirementKey: string;
  category: string | null;
  statement: string;
  source: string | null;
  status: string;
  decision: ScopeDecision | 'UNDECIDED';
  reason: string | null;
  decisionSource: string | null;
  approvalRef: string | null;
}

export interface ScopeReadinessResult {
  ready: boolean;
  requirementBaselineHash: string;
  scopeCoverageHash: string | null;
  totalRequirements: number;
  inScopeCount: number;
  deferredCount: number;
  notApplicableCount: number;
  blockedCount: number;
  blockers: { code: string; requirementKey?: string }[];
}

/**
 * CORE-011 §15-25 — uma ScopeCoverageDecision por Requirement ativo da baseline. Estados
 * CANÔNICOS: IN_SCOPE | DEFERRED_USER_APPROVED | NOT_APPLICABLE | BLOCKED — nunca
 * OUT_OF_SCOPE_THIS_VERSION (§Z, isso é vocabulário de EVIDÊNCIA DE EXECUÇÃO em
 * requirement-coverage.ts, um estágio de pipeline totalmente diferente e posterior — nunca fonte
 * de decisão de escopo aqui). Requirement sem decisão nunca desaparece: fica UNDECIDED até
 * receber uma decisão real (§20).
 */
@Injectable()
export class ScopeCoverageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventLog: EventLogService,
    private readonly baselines: RequirementBaselineService
  ) {}

  /** §21 — supersede-then-insert dentro de uma transação: nunca duas decisões "atuais"
   * contraditórias para o mesmo (requirementId, baselineId). */
  async setDecision(input: SetScopeDecisionInput): Promise<void> {
    if (!VALID_DECISIONS.includes(input.decision)) throw new Error('SCOPE_INVALID_DECISION');

    const baseline = await this.baselines.getBaseline(input.missionId, input.requirementBaselineId);
    const ref = baseline.requirementsSnapshot.find((r) => r.requirementId === input.requirementId);
    if (!ref) throw new Error('REQUIREMENT_NOT_IN_BASELINE');

    if (input.decision === 'DEFERRED_USER_APPROVED') {
      if (input.decisionSource !== 'USER' || !input.approvalRef?.trim()) throw new Error('SCOPE_DEFER_REQUIRES_USER_APPROVAL');
      const approval = await this.prisma.humanApprovalRequest.findUnique({ where: { id: input.approvalRef } });
      if (!approval || approval.missionId !== input.missionId || approval.trigger !== 'REQUIREMENT_WAIVER' || approval.subjectId !== input.requirementId || approval.status !== 'APPROVED') throw new Error('APPROVAL_REFERENCE_INVALID');
    }
    if (input.decision === 'NOT_APPLICABLE' && !input.reason?.trim()) throw new Error('SCOPE_NOT_APPLICABLE_REQUIRES_REASON');
    if (input.decision === 'BLOCKED' && !input.reason?.trim()) throw new Error('SCOPE_BLOCKED_REQUIRES_REASON');

    const id = randomUUID();
    await this.prisma.$transaction(async (tx) => {
      await tx.scopeCoverageDecision.updateMany({
        where: { requirementId: input.requirementId, requirementBaselineId: input.requirementBaselineId, supersededAt: null },
        data: { supersededAt: new Date() },
      });
      await tx.scopeCoverageDecision.create({
        data: {
          id,
          missionId: input.missionId,
          requirementId: input.requirementId,
          requirementKey: ref.requirementKey,
          requirementBaselineId: input.requirementBaselineId,
          decision: input.decision,
          reason: input.reason ?? null,
          decisionSource: input.decisionSource,
          approvalRef: input.approvalRef ?? null,
        },
      });
    });

    await this.eventLog.append({
      missionId: input.missionId,
      correlationId: randomUUID(),
      actorType: input.decisionSource === 'USER' ? 'USER' : 'SYSTEM',
      type: 'requirement.scope_decided',
      payload: {
        missionId: input.missionId,
        baselineId: input.requirementBaselineId,
        requirementId: input.requirementId,
        requirementKey: ref.requirementKey,
        decision: input.decision,
      },
    });
  }

  async getCoverage(missionId: string, baselineId: string): Promise<ScopeCoverageItem[]> {
    const baseline = await this.baselines.getBaseline(missionId, baselineId);
    return this.currentItems(missionId, baselineId, baseline.requirementsSnapshot);
  }

  /** §23/§36/§39 — computa scopeCoverageHash e emite os eventos de conclusão/prontidão. Idempotente:
   * reexecutar com o mesmo conjunto de decisões produz o mesmo hash, e `idempotencyKey` no
   * EventLog garante que o mesmo fato nunca é publicado duas vezes. */
  async finalizeCoverage(missionId: string, baselineId: string): Promise<ScopeReadinessResult> {
    const baseline = await this.baselines.getBaseline(missionId, baselineId);
    if (baseline.status !== 'FINALIZED') throw new Error('SCOPE_COVERAGE_REQUIRES_FINALIZED_BASELINE');

    const items = await this.currentItems(missionId, baselineId, baseline.requirementsSnapshot);
    const undecided = items.filter((i) => i.decision === 'UNDECIDED');
    if (undecided.length > 0) throw new Error('SCOPE_COVERAGE_INCOMPLETE');

    const scopeCoverageHash = this.computeCoverageHash(items);

    await this.eventLog.append({
      missionId,
      correlationId: randomUUID(),
      actorType: 'SYSTEM',
      type: 'mission.scope_coverage_completed',
      payload: { missionId, baselineId, scopeCoverageHash, totalRequirements: items.length },
      idempotencyKey: `scope-coverage-completed:${baselineId}:${scopeCoverageHash}`,
    });

    const readiness = await this.assertReadyForSolutionPlanning(missionId, baselineId);

    if (readiness.ready) {
      await this.eventLog.append({
        missionId,
        correlationId: randomUUID(),
        actorType: 'SYSTEM',
        type: 'mission.scope_ready',
        payload: { missionId, baselineId, scopeCoverageHash, requirementBaselineHash: readiness.requirementBaselineHash },
        idempotencyKey: `scope-ready:${baselineId}:${scopeCoverageHash}`,
      });
    } else if (readiness.blockedCount > 0) {
      // §37 — nunca emitir scope_ready com Requirement BLOCKED.
      await this.eventLog.append({
        missionId,
        correlationId: randomUUID(),
        actorType: 'SYSTEM',
        type: 'mission.scope_blocked',
        payload: { missionId, baselineId, scopeCoverageHash, blockedCount: readiness.blockedCount },
        idempotencyKey: `scope-blocked:${baselineId}:${scopeCoverageHash}`,
      });
    }

    return readiness;
  }

  /** Query pura (§26 — só PROVA que pode avançar, nunca cria ApprovedSolution/escolhe stack). */
  async assertReadyForSolutionPlanning(missionId: string, baselineId: string): Promise<ScopeReadinessResult> {
    const baseline = await this.baselines.getBaseline(missionId, baselineId);
    const items = await this.currentItems(missionId, baselineId, baseline.requirementsSnapshot);

    const blockers: { code: string; requirementKey?: string }[] = [];
    if (baseline.status !== 'FINALIZED') blockers.push({ code: 'REQUIREMENT_BASELINE_NOT_FINALIZED' });

    const undecided = items.filter((i) => i.decision === 'UNDECIDED');
    for (const u of undecided) blockers.push({ code: 'SCOPE_COVERAGE_INCOMPLETE', requirementKey: u.requirementKey });

    const blockedItems = items.filter((i) => i.decision === 'BLOCKED');
    for (const b of blockedItems) blockers.push({ code: 'REQUIREMENT_BLOCKED', requirementKey: b.requirementKey });

    const deferredItems = items.filter((i) => i.decision === 'DEFERRED_USER_APPROVED');
    for (const d of deferredItems) {
      if (d.decisionSource !== 'USER' || !d.approvalRef) { blockers.push({ code: 'SCOPE_DEFER_REQUIRES_USER_APPROVAL', requirementKey: d.requirementKey }); continue; }
      const approval = await this.prisma.humanApprovalRequest.findUnique({ where: { id: d.approvalRef } });
      if (!approval || approval.missionId !== missionId || approval.trigger !== 'REQUIREMENT_WAIVER' || approval.subjectId !== d.requirementId || approval.status !== 'APPROVED') blockers.push({ code: 'APPROVAL_REFERENCE_INVALID', requirementKey: d.requirementKey });
    }

    const invalid = items.filter((i) => i.decision !== 'UNDECIDED' && !VALID_DECISIONS.includes(i.decision as ScopeDecision));
    for (const inv of invalid) blockers.push({ code: 'SCOPE_INVALID_DECISION', requirementKey: inv.requirementKey });

    const inScopeCount = items.filter((i) => i.decision === 'IN_SCOPE').length;
    const deferredCount = deferredItems.length;
    const notApplicableCount = items.filter((i) => i.decision === 'NOT_APPLICABLE').length;
    const blockedCount = blockedItems.length;

    return {
      ready: blockers.length === 0,
      requirementBaselineHash: baseline.baselineHash,
      scopeCoverageHash: undecided.length === 0 ? this.computeCoverageHash(items) : null,
      totalRequirements: items.length,
      inScopeCount,
      deferredCount,
      notApplicableCount,
      blockedCount,
      blockers,
    };
  }

  private async currentItems(missionId: string, baselineId: string, refs: RequirementBaselineSnapshot[]): Promise<ScopeCoverageItem[]> {
    const decisions = await this.prisma.scopeCoverageDecision.findMany({
      where: { missionId, requirementBaselineId: baselineId, supersededAt: null },
    });
    const byRequirementId = new Map(decisions.map((d) => [d.requirementId, d]));

    // §31 — TODOS os refs da baseline aparecem, sem limite arbitrário.
    return refs.map((ref) => {
      const d = byRequirementId.get(ref.requirementId);
      return d
        ? { requirementId: ref.requirementId, requirementKey: ref.requirementKey, category: ref.category, statement: ref.statement, source: ref.source, status: ref.status, decision: d.decision as ScopeDecision, reason: d.reason, decisionSource: d.decisionSource, approvalRef: d.approvalRef }
        : { requirementId: ref.requirementId, requirementKey: ref.requirementKey, category: ref.category, statement: ref.statement, source: ref.source, status: ref.status, decision: 'UNDECIDED' as const, reason: null, decisionSource: null, approvalRef: null };
    });
  }

  private computeCoverageHash(items: ScopeCoverageItem[]): string {
    const sorted = [...items]
      .filter((i) => i.decision !== 'UNDECIDED')
      .sort((a, b) => a.requirementKey.localeCompare(b.requirementKey))
      .map((i) => ({ requirementKey: i.requirementKey, decision: i.decision, reason: i.reason, approvalRef: i.approvalRef }));
    return canonicalHash(sorted);
  }
}
