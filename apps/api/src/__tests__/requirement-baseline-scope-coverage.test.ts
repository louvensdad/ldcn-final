import { randomUUID } from 'node:crypto';
import { PrismaService } from '../persistence/prisma.service';
import { LlmInvocationLedgerService } from '../ledger/llm-invocation-ledger.service';
import { EventBusService } from '../events/event-bus.service';
import { EventLogService } from '../events/event-log.service';
import { LlmClient, LlmCompletionRequest, LlmCompletionResult } from '../assistant/deepseek-client';
import { RequirementKeyService } from '../requirements/requirement-key.service';
import { RequirementExtractionService } from '../requirements/requirement-extraction.service';
import { RequirementBaselineService } from '../requirements/requirement-baseline.service';
import { ScopeCoverageService } from '../requirements/scope-coverage.service';
import { DiscoveryRequirementsResultV1 } from '../requirements/discovery-requirements-schema';

const RUN_DB_TESTS = process.env.LDCN_TEST_DATABASE_URL || process.env.DATABASE_URL;

class FakeLlmClient implements LlmClient {
  calls: LlmCompletionRequest[] = [];
  private queued: LlmCompletionResult[] = [];
  push(json: Record<string, unknown>): void {
    this.queued.push({ text: JSON.stringify(json), model: 'fake-model', promptTokens: 10, completionTokens: 10 });
  }
  async complete(input: LlmCompletionRequest): Promise<LlmCompletionResult> {
    this.calls.push(input);
    const next = this.queued.shift();
    if (!next) throw new Error('FakeLlmClient: no queued response');
    return next;
  }
}

function discoveryResult(overrides: Partial<DiscoveryRequirementsResultV1> = {}): DiscoveryRequirementsResultV1 {
  return {
    missionSummary: 'SaaS para pequenas oficinas gerenciarem clientes, ordens de serviço, estoque, usuários e relatórios.',
    requirements: [
      { statement: 'Cadastro de clientes', category: 'FUNCTIONAL', sourceBasis: 'USER_EXPLICIT' },
      { statement: 'Ordens de serviço', category: 'FUNCTIONAL', sourceBasis: 'USER_EXPLICIT' },
      { statement: 'Controle de estoque', category: 'FUNCTIONAL', sourceBasis: 'USER_EXPLICIT' },
      { statement: 'Autenticação', category: 'SECURITY', sourceBasis: 'DISCOVERY_DERIVED' },
      { statement: 'Perfis e permissões', category: 'SECURITY', sourceBasis: 'DISCOVERY_DERIVED' },
      { statement: 'Relatórios', category: 'FUNCTIONAL', sourceBasis: 'USER_EXPLICIT' },
      { statement: 'Auditoria de alterações', category: 'COMPLIANCE', sourceBasis: 'DISCOVERY_DERIVED' },
      { statement: 'Backup e recuperação', category: 'OPERATIONS', sourceBasis: 'DISCOVERY_DERIVED' },
    ],
    ambiguities: [{ description: 'Escopo mobile não definido' }],
    assumptions: ['Uso majoritariamente web/desktop'],
    ...overrides,
  };
}

(RUN_DB_TESTS ? describe : describe.skip)('CORE-011 Requirement Baseline + Scope Coverage (Postgres, fake LlmClient)', () => {
  let prisma: PrismaService;
  let ledger: LlmInvocationLedgerService;
  let eventBus: EventBusService;
  let eventLog: EventLogService;
  let llm: FakeLlmClient;
  let keys: RequirementKeyService;
  let extraction: RequirementExtractionService;
  let baselines: RequirementBaselineService;
  let scopeCoverage: ScopeCoverageService;
  const missionIdsToClean: string[] = [];

  beforeAll(() => {
    prisma = new PrismaService();
    eventBus = new EventBusService();
    eventLog = new EventLogService(prisma, eventBus);
    ledger = new LlmInvocationLedgerService(prisma, eventLog);
    llm = new FakeLlmClient();
    keys = new RequirementKeyService(prisma);
    extraction = new RequirementExtractionService(llm, prisma, ledger, eventLog, keys);
    baselines = new RequirementBaselineService(prisma, eventLog);
    scopeCoverage = new ScopeCoverageService(prisma, eventLog, baselines);
  });

  afterAll(async () => {
    for (const missionId of missionIdsToClean) await cleanupMission(missionId);
    await prisma.$disconnect();
  });

  async function cleanupMission(missionId: string): Promise<void> {
    await prisma.humanApprovalRequest.deleteMany({ where: { missionId } });
    await prisma.scopeCoverageDecision.deleteMany({ where: { missionId } });
    await prisma.requirementBaseline.deleteMany({ where: { missionId } });
    await prisma.requirementKeySequence.deleteMany({ where: { missionId } });
    await prisma.eventLog.deleteMany({ where: { missionId } });
    await prisma.llmInvocationRecord.deleteMany({ where: { missionId } });
    await prisma.promptSnapshot.deleteMany({ where: { missionId } });
    await prisma.requirement.deleteMany({ where: { missionId } });
  }

  function newMission(): string {
    const missionId = `test-core11-${randomUUID()}`;
    missionIdsToClean.push(missionId);
    return missionId;
  }

  async function eventsOf(missionId: string, type: string) {
    return prisma.eventLog.findMany({ where: { missionId, type } });
  }

  // A/B/C/E/F — structured extraction, canonical model reuse, requirementKey, source distinction, dedup
  it('A/B/C/E/F: persists a valid structured Discovery result into canonical Requirement rows with stable keys, distinct source, and normalized dedup', async () => {
    const missionId = newMission();
    const result = await extraction.persist(missionId, discoveryResult());
    expect(result.requirements).toHaveLength(8);
    expect(result.skippedDuplicateCount).toBe(0);
    expect(new Set(result.requirements.map((r) => r.requirementKey)).size).toBe(8);
    expect(result.requirements[0].requirementKey).toBe('REQ-001');

    const rows = await prisma.requirement.findMany({ where: { missionId } });
    expect(rows).toHaveLength(8);
    for (const row of rows) {
      expect(row.requirementKey).toMatch(/^REQ-\d{3}$/);
      expect(['FUNCTIONAL', 'SECURITY', 'COMPLIANCE', 'OPERATIONS']).toContain(row.category);
      expect(['USER_EXPLICIT', 'DISCOVERY_EXTRACTED']).toContain(row.source);
      // legacy fields (§2 — evoluído, não substituído) continuam presentes e coerentes
      expect(row.section).toBeTruthy();
      expect(row.origin).toBeTruthy();
      expect(row.status).toBe('SUGGESTED');
    }
    const explicit = rows.find((r) => r.content === 'Cadastro de clientes')!;
    const derived = rows.find((r) => r.content === 'Autenticação')!;
    expect(explicit.source).toBe('USER_EXPLICIT');
    expect(derived.source).toBe('DISCOVERY_EXTRACTED');

    // F — duplicata textual normalizada não duplica
    const second = await extraction.persist(missionId, discoveryResult({ requirements: [{ statement: '  CADASTRO DE CLIENTES.  ', category: 'FUNCTIONAL', sourceBasis: 'USER_EXPLICIT' }] }));
    expect(second.requirements).toHaveLength(0);
    expect(second.skippedDuplicateCount).toBe(1);
    expect(await prisma.requirement.count({ where: { missionId } })).toBe(8);
  });

  // D — requirementKey nunca reciclado
  it('D: requirementKey is never recycled even after a requirement is rejected', async () => {
    const missionId = newMission();
    await extraction.persist(missionId, discoveryResult({ requirements: [{ statement: 'Item 1', category: 'OTHER', sourceBasis: 'USER_EXPLICIT' }] }));
    const first = await prisma.requirement.findFirstOrThrow({ where: { missionId } });
    expect(first.requirementKey).toBe('REQ-001');
    await prisma.requirement.update({ where: { id: first.id }, data: { status: 'REJECTED' } });

    await extraction.persist(missionId, discoveryResult({ requirements: [{ statement: 'Item 2', category: 'OTHER', sourceBasis: 'USER_EXPLICIT' }] }));
    const second = await prisma.requirement.findFirstOrThrow({ where: { missionId, content: 'Item 2' } });
    expect(second.requirementKey).toBe('REQ-002');
  });

  // K/L/M/AB — 25+ requirements, no silent truncation
  it('K/L/M/AB: 25+ Requirements all persist, all appear in the baseline, and all are returned from coverage without limit', async () => {
    const missionId = newMission();
    const statements = Array.from({ length: 27 }, (_, i) => ({ statement: `Requisito único número ${i + 1}`, category: 'FUNCTIONAL' as const, sourceBasis: 'USER_EXPLICIT' as const }));
    const extracted = await extraction.persist(missionId, discoveryResult({ requirements: statements }));
    expect(extracted.requirements).toHaveLength(27);
    expect(await prisma.requirement.count({ where: { missionId } })).toBe(27);

    const baseline = await baselines.createBaseline(missionId);
    expect(baseline.requirementRefs).toHaveLength(27);
    await baselines.finalizeBaseline(missionId, baseline.id);

    for (const ref of baseline.requirementRefs) {
      await scopeCoverage.setDecision({ missionId, requirementId: ref.requirementId, requirementBaselineId: baseline.id, decision: 'IN_SCOPE', decisionSource: 'USER' });
    }
    const coverage = await scopeCoverage.getCoverage(missionId, baseline.id);
    expect(coverage).toHaveLength(27);
    expect(coverage.every((c) => c.decision === 'IN_SCOPE')).toBe(true);
  });

  // G/H/I/J/Y — baseline lifecycle
  it('G/H/I/J/Y: baseline is created, hash is deterministic, finalized baseline is immutable, and prior versions remain auditable', async () => {
    const missionId = newMission();
    await extraction.persist(missionId, discoveryResult({ requirements: discoveryResult().requirements.slice(0, 3) }));

    const v1 = await baselines.createBaseline(missionId);
    expect(v1.version).toBe(1);
    expect(v1.status).toBe('DRAFT');

    // H — sem mudança nenhuma no conjunto, um novo snapshot produz o MESMO hash
    const v1Again = await baselines.createBaseline(missionId);
    expect(v1Again.baselineHash).toBe(v1.baselineHash);
    expect(v1Again.version).toBe(2);

    const finalized = await baselines.finalizeBaseline(missionId, v1Again.id);
    expect(finalized.status).toBe('FINALIZED');
    const finalizedAgain = await baselines.finalizeBaseline(missionId, v1Again.id);
    expect(finalizedAgain.finalizedAt?.getTime()).toBe(finalized.finalizedAt?.getTime());

    // J — nova extração muda o conjunto ativo; nova baseline captura, v-anterior continua intacta
    await extraction.persist(missionId, discoveryResult({ requirements: [{ statement: 'Novo requisito pós-baseline', category: 'OTHER', sourceBasis: 'USER_EXPLICIT' }] }));
    const v3 = await baselines.createBaseline(missionId);
    expect(v3.requirementRefs.length).toBe(v1Again.requirementRefs.length + 1);

    // Y — versão anterior permanece auditável e inalterada
    const reread = await baselines.getBaseline(missionId, v1Again.id);
    expect(reread.status).toBe('FINALIZED');
    expect(reread.requirementRefs).toHaveLength(v1Again.requirementRefs.length);
  });

  it('REWORK A-K: FINALIZED v1 freezes statement/hash while the live Requirement evolves and v2 captures the new content', async () => {
    const missionId = newMission();
    await extraction.persist(missionId, discoveryResult({ requirements: [{ statement: 'Usuário pode fazer login', category: 'FUNCTIONAL', sourceBasis: 'USER_EXPLICIT' }] }));
    const live = await prisma.requirement.findFirstOrThrow({ where: { missionId } });

    const v1Draft = await baselines.createBaseline(missionId);
    const v1 = await baselines.finalizeBaseline(missionId, v1Draft.id);
    const frozenSnapshot = JSON.parse(JSON.stringify(v1.requirementsSnapshot));
    const frozenHash = v1.baselineHash;
    expect(v1.requirementsSnapshot[0]).toMatchObject({ requirementId: live.id, requirementKey: 'REQ-001', statement: 'Usuário pode fazer login' });

    await prisma.requirement.update({ where: { id: live.id }, data: {
      content: 'Usuário pode fazer login com MFA', status: 'CONFIRMED', source: 'USER_EDIT', version: { increment: 1 },
    }});

    const v1AfterMutation = await baselines.getBaseline(missionId, v1.id);
    const v1Coverage = await scopeCoverage.getCoverage(missionId, v1.id);
    expect(v1AfterMutation.requirementsSnapshot).toEqual(frozenSnapshot);
    expect(v1AfterMutation.requirementsSnapshot[0].statement).toBe('Usuário pode fazer login');
    expect(v1AfterMutation.baselineHash).toBe(frozenHash);
    expect(v1Coverage[0]).toMatchObject({ requirementId: live.id, requirementKey: 'REQ-001', statement: 'Usuário pode fazer login', status: 'SUGGESTED' });

    const v2 = await baselines.createBaseline(missionId);
    expect(v2.version).toBe(2);
    expect(v2.requirementsSnapshot[0]).toMatchObject({ requirementId: live.id, requirementKey: 'REQ-001', statement: 'Usuário pode fazer login com MFA', status: 'CONFIRMED' });
    expect(v2.baselineHash).not.toBe(v1.baselineHash);

    const v1AfterV2 = await baselines.getBaseline(missionId, v1.id);
    expect(v1AfterV2.requirementsSnapshot).toEqual(frozenSnapshot);
    expect(v1AfterV2.baselineHash).toBe(frozenHash);
  });

  // N/O/P/Q/R/S/T/Z — scope decision states + enforcement
  it('N/O/P/Q/R/S/T/Z: enforces canonical scope decision states and their evidence requirements', async () => {
    const missionId = newMission();
    await extraction.persist(missionId, discoveryResult({ requirements: discoveryResult().requirements.slice(0, 4) }));
    const baseline = await baselines.createBaseline(missionId);
    const [r1, r2, r3, r4] = baseline.requirementRefs;

    // N — sem decisão, UNDECIDED (não desaparece)
    const initial = await scopeCoverage.getCoverage(missionId, baseline.id);
    expect(initial.every((i) => i.decision === 'UNDECIDED')).toBe(true);

    // O
    await scopeCoverage.setDecision({ missionId, requirementId: r1.requirementId, requirementBaselineId: baseline.id, decision: 'IN_SCOPE', decisionSource: 'USER' });

    // Z — OUT_OF_SCOPE_THIS_VERSION nunca é uma decisão válida
    await expect(
      scopeCoverage.setDecision({ missionId, requirementId: r2.requirementId, requirementBaselineId: baseline.id, decision: 'OUT_OF_SCOPE_THIS_VERSION' as never, decisionSource: 'USER' })
    ).rejects.toThrow('SCOPE_INVALID_DECISION');

    // P — DEFERRED sem evidência real do usuário rejeita (source errado)
    await expect(
      scopeCoverage.setDecision({ missionId, requirementId: r2.requirementId, requirementBaselineId: baseline.id, decision: 'DEFERRED_USER_APPROVED', decisionSource: 'SYSTEM', approvalRef: 'x' })
    ).rejects.toThrow('SCOPE_DEFER_REQUIRES_USER_APPROVAL');
    // P — DEFERRED com decisionSource USER mas sem approvalRef também rejeita
    await expect(
      scopeCoverage.setDecision({ missionId, requirementId: r2.requirementId, requirementBaselineId: baseline.id, decision: 'DEFERRED_USER_APPROVED', decisionSource: 'USER' })
    ).rejects.toThrow('SCOPE_DEFER_REQUIRES_USER_APPROVAL');

    // Q — DEFERRED com evidência real passa
    const waiverId = `evt-${randomUUID()}`; await prisma.humanApprovalRequest.create({ data: { id: waiverId, missionId, trigger: 'REQUIREMENT_WAIVER', subjectType: 'Requirement', subjectId: r2.requirementId, subjectHash: baseline.baselineHash, status: 'APPROVED', requestedBy: 'test', decidedBy: 'test-user', decidedAt: new Date(), rationale: 'Deferred in test' } });
    await scopeCoverage.setDecision({ missionId, requirementId: r2.requirementId, requirementBaselineId: baseline.id, decision: 'DEFERRED_USER_APPROVED', decisionSource: 'USER', approvalRef: waiverId });

    // R — NOT_APPLICABLE sem reason rejeita
    await expect(
      scopeCoverage.setDecision({ missionId, requirementId: r3.requirementId, requirementBaselineId: baseline.id, decision: 'NOT_APPLICABLE', decisionSource: 'USER' })
    ).rejects.toThrow('SCOPE_NOT_APPLICABLE_REQUIRES_REASON');
    await scopeCoverage.setDecision({ missionId, requirementId: r3.requirementId, requirementBaselineId: baseline.id, decision: 'NOT_APPLICABLE', reason: 'Mobile fora do escopo confirmado pelo usuário', decisionSource: 'USER' });

    // S — BLOCKED sem reason rejeita
    await expect(
      scopeCoverage.setDecision({ missionId, requirementId: r4.requirementId, requirementBaselineId: baseline.id, decision: 'BLOCKED', decisionSource: 'SYSTEM' })
    ).rejects.toThrow('SCOPE_BLOCKED_REQUIRES_REASON');

    // T — enquanto r4 não tem decisão, finalizeCoverage (mesmo já FINALIZED baseline) falha
    await baselines.finalizeBaseline(missionId, baseline.id);
    await expect(scopeCoverage.finalizeCoverage(missionId, baseline.id)).rejects.toThrow('SCOPE_COVERAGE_INCOMPLETE');

    await scopeCoverage.setDecision({ missionId, requirementId: r4.requirementId, requirementBaselineId: baseline.id, decision: 'BLOCKED', reason: 'Depende de decisão externa pendente', decisionSource: 'SYSTEM' });

    // U — BLOCKED impede readiness
    const readinessBlocked = await scopeCoverage.assertReadyForSolutionPlanning(missionId, baseline.id);
    expect(readinessBlocked.ready).toBe(false);
    expect(readinessBlocked.blockedCount).toBe(1);
  });

  // V/W/AE — full coverage without blockers => ready, deterministic hash
  it('V/W/AE: complete coverage with no blockers is ready, and the coverage hash is deterministic across calls', async () => {
    const missionId = newMission();
    await extraction.persist(missionId, discoveryResult({ requirements: discoveryResult().requirements.slice(0, 2) }));
    const baseline = await baselines.createBaseline(missionId);
    await baselines.finalizeBaseline(missionId, baseline.id);
    for (const ref of baseline.requirementRefs) {
      await scopeCoverage.setDecision({ missionId, requirementId: ref.requirementId, requirementBaselineId: baseline.id, decision: 'IN_SCOPE', decisionSource: 'USER' });
    }
    const r1 = await scopeCoverage.assertReadyForSolutionPlanning(missionId, baseline.id);
    const r2 = await scopeCoverage.assertReadyForSolutionPlanning(missionId, baseline.id);
    expect(r1.ready).toBe(true);
    expect(r1.scopeCoverageHash).toBe(r2.scopeCoverageHash);
    expect(r1.inScopeCount).toBe(2);

    const readiness = await scopeCoverage.finalizeCoverage(missionId, baseline.id);
    expect(readiness.ready).toBe(true);
    expect((await eventsOf(missionId, 'mission.scope_ready')).length).toBe(1);
    expect((await eventsOf(missionId, 'mission.scope_blocked')).length).toBe(0);
  });

  // AF — blocker present => scope_blocked, never scope_ready
  it('AF: a BLOCKED requirement produces mission.scope_blocked and never mission.scope_ready', async () => {
    const missionId = newMission();
    await extraction.persist(missionId, discoveryResult({ requirements: discoveryResult().requirements.slice(0, 2) }));
    const baseline = await baselines.createBaseline(missionId);
    await baselines.finalizeBaseline(missionId, baseline.id);
    const [r1, r2] = baseline.requirementRefs;
    await scopeCoverage.setDecision({ missionId, requirementId: r1.requirementId, requirementBaselineId: baseline.id, decision: 'IN_SCOPE', decisionSource: 'USER' });
    await scopeCoverage.setDecision({ missionId, requirementId: r2.requirementId, requirementBaselineId: baseline.id, decision: 'BLOCKED', reason: 'Ambiguidade crítica não resolvida', decisionSource: 'SYSTEM' });

    const readiness = await scopeCoverage.finalizeCoverage(missionId, baseline.id);
    expect(readiness.ready).toBe(false);
    expect((await eventsOf(missionId, 'mission.scope_blocked')).length).toBe(1);
    expect((await eventsOf(missionId, 'mission.scope_ready')).length).toBe(0);
  });

  // X — decisions reference the exact baseline; a new baseline requires its own decisions
  it('X: a scope decision is scoped to one exact requirement baseline version', async () => {
    const missionId = newMission();
    await extraction.persist(missionId, discoveryResult({ requirements: discoveryResult().requirements.slice(0, 1) }));
    const v1 = await baselines.createBaseline(missionId);
    await scopeCoverage.setDecision({ missionId, requirementId: v1.requirementRefs[0].requirementId, requirementBaselineId: v1.id, decision: 'IN_SCOPE', decisionSource: 'USER' });

    const v2 = await baselines.createBaseline(missionId); // no content change, but a distinct baseline id
    const v2Coverage = await scopeCoverage.getCoverage(missionId, v2.id);
    expect(v2Coverage[0].decision).toBe('UNDECIDED'); // decision under v1 does not leak into v2

    const decisions = await prisma.scopeCoverageDecision.findMany({ where: { missionId, requirementId: v1.requirementRefs[0].requirementId } });
    expect(decisions).toHaveLength(1);
    expect(decisions[0].requirementBaselineId).toBe(v1.id);
  });

  // AC/AD/AG — events + safe payloads
  it('AC/AD/AG: emits real, versioned events with safe payloads (no statement text, no credentials, no CoT)', async () => {
    const missionId = newMission();
    await extraction.persist(missionId, discoveryResult({ requirements: [{ statement: 'Guardar credential do usuário com password em texto puro', category: 'SECURITY', sourceBasis: 'USER_EXPLICIT' }] }));
    const baseline = await baselines.createBaseline(missionId);
    await baselines.finalizeBaseline(missionId, baseline.id);
    await scopeCoverage.setDecision({
      missionId, requirementId: baseline.requirementRefs[0].requirementId, requirementBaselineId: baseline.id,
      decision: 'NOT_APPLICABLE', reason: 'Fora do escopo — contém password no texto, tratado como conteúdo do usuário', decisionSource: 'USER',
    });

    expect((await eventsOf(missionId, 'mission.discovery_completed')).length).toBe(1);
    expect((await eventsOf(missionId, 'mission.requirements_baseline_created')).length).toBeGreaterThanOrEqual(1);
    expect((await eventsOf(missionId, 'mission.requirements_baseline_finalized')).length).toBe(1);
    const decided = await eventsOf(missionId, 'requirement.scope_decided');
    expect(decided).toHaveLength(1);
    const payload = decided[0].payloadJson as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual(['baselineId', 'decision', 'missionId', 'requirementId', 'requirementKey'].sort());
    expect(JSON.stringify(payload).toLowerCase()).not.toContain('password');
  });

  // AH/AI — idempotency
  it('AH/AI: extraction/persistence and finalization are idempotent', async () => {
    const missionId = newMission();
    const payload = discoveryResult({ requirements: discoveryResult().requirements.slice(0, 3) });
    const first = await extraction.persist(missionId, payload);
    expect(first.requirements).toHaveLength(3);
    const replay = await extraction.persist(missionId, payload);
    expect(replay.requirements).toHaveLength(0);
    expect(replay.skippedDuplicateCount).toBe(3);
    expect(await prisma.requirement.count({ where: { missionId } })).toBe(3);

    const baseline = await baselines.createBaseline(missionId);
    await baselines.finalizeBaseline(missionId, baseline.id);
    await baselines.finalizeBaseline(missionId, baseline.id);
    expect((await eventsOf(missionId, 'mission.requirements_baseline_finalized')).length).toBe(1);

    for (const ref of baseline.requirementRefs) {
      await scopeCoverage.setDecision({ missionId, requirementId: ref.requirementId, requirementBaselineId: baseline.id, decision: 'IN_SCOPE', decisionSource: 'USER' });
    }
    await scopeCoverage.finalizeCoverage(missionId, baseline.id);
    await scopeCoverage.finalizeCoverage(missionId, baseline.id);
    expect((await eventsOf(missionId, 'mission.scope_coverage_completed')).length).toBe(1);
    expect((await eventsOf(missionId, 'mission.scope_ready')).length).toBe(1);
  });

  // §40 — acceptance fixture (CraftManager)
  it('acceptance fixture: CraftManager mission reaches scope READY with 7 IN_SCOPE and 1 real DEFERRED', async () => {
    const missionId = newMission();
    const extracted = await extraction.persist(missionId, discoveryResult());
    expect(extracted.requirements).toHaveLength(8);

    const baseline = await baselines.createBaseline(missionId);
    await baselines.finalizeBaseline(missionId, baseline.id);

    const rows = await prisma.requirement.findMany({ where: { missionId } });
    const backupRow = rows.find((r) => r.content === 'Backup e recuperação')!;
    for (const ref of baseline.requirementRefs) {
      if (ref.requirementId === backupRow.id) {
        const waiverId = `evt-${randomUUID()}`; await prisma.humanApprovalRequest.create({ data: { id: waiverId, missionId, trigger: 'REQUIREMENT_WAIVER', subjectType: 'Requirement', subjectId: ref.requirementId, subjectHash: baseline.baselineHash, status: 'APPROVED', requestedBy: 'test', decidedBy: 'test-user', decidedAt: new Date(), rationale: 'Deferred in acceptance test' } });
        await scopeCoverage.setDecision({ missionId, requirementId: ref.requirementId, requirementBaselineId: baseline.id, decision: 'DEFERRED_USER_APPROVED', decisionSource: 'USER', approvalRef: waiverId });
      } else {
        await scopeCoverage.setDecision({ missionId, requirementId: ref.requirementId, requirementBaselineId: baseline.id, decision: 'IN_SCOPE', decisionSource: 'USER' });
      }
    }
    const readiness = await scopeCoverage.finalizeCoverage(missionId, baseline.id);
    expect(readiness.ready).toBe(true);
    expect(readiness.inScopeCount).toBe(7);
    expect(readiness.deferredCount).toBe(1);
    expect(readiness.totalRequirements).toBe(8);
  });
});
