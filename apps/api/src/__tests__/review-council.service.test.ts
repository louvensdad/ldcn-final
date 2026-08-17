import { randomUUID } from 'node:crypto';
import { PrismaService } from '../persistence/prisma.service';
import { ReviewFindingService } from '../review/review-finding.service';
import { ReviewCouncilService } from '../review/review-council.service';
import { LlmClient, LlmCompletionRequest, LlmCompletionResult } from '../assistant/deepseek-client';
import { LlmInvocationLedgerService } from '../ledger/llm-invocation-ledger.service';

const RUN_DB_TESTS = process.env.LDCN_TEST_DATABASE_URL || process.env.DATABASE_URL;

function turn(json: Record<string, unknown>): LlmCompletionResult {
  return { text: JSON.stringify(json), model: 'deepseek-chat', promptTokens: 80, completionTokens: 40 };
}

const NO_FINDINGS = turn({ findings: [] });

/** Same ordering guarantee as discovery.service.test.ts: Promise.allSettled(array.map(fn)) drains
 * the shared FIFO queue in array order because each fn's synchronous prefix (including the fake's
 * queue.shift()) runs to completion before the next map() iteration starts. */
class QueuedFakeLlmClient implements LlmClient {
  calls: LlmCompletionRequest[] = [];
  defaultResult: LlmCompletionResult | null = NO_FINDINGS;
  private queue: (LlmCompletionResult | 'FAIL' | 'MALFORMED' | 'HANG')[] = [];

  push(...items: (LlmCompletionResult | 'FAIL' | 'MALFORMED' | 'HANG')[]) {
    this.queue.push(...items);
  }

  async complete(input: LlmCompletionRequest): Promise<LlmCompletionResult> {
    this.calls.push(input);
    const next = this.queue.shift();
    if (!next) {
      if (this.defaultResult) return this.defaultResult;
      throw new Error('QueuedFakeLlmClient: no more queued responses');
    }
    if (next === 'FAIL') throw new Error('simulated LLM failure');
    if (next === 'MALFORMED') return { text: 'not json', model: 'deepseek-chat', promptTokens: 5, completionTokens: 5 };
    if (next === 'HANG') return new Promise<LlmCompletionResult>(() => {}); // never resolves — simulates a stuck provider call
    return next;
  }
}

(RUN_DB_TESTS ? describe : describe.skip)('ReviewCouncilService (Postgres, fake LlmClient)', () => {
  let prisma: PrismaService;
  let fakeLlm: QueuedFakeLlmClient;
  let reviewFindings: ReviewFindingService;
  let council: ReviewCouncilService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
  });

  beforeEach(() => {
    fakeLlm = new QueuedFakeLlmClient();
    reviewFindings = new ReviewFindingService(prisma);
    council = new ReviewCouncilService(prisma, reviewFindings, fakeLlm, new LlmInvocationLedgerService(prisma));
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function cleanup(missionId: string) {
    await prisma.llmInvocationRecord.deleteMany({ where: { missionId } });
    await prisma.promptSnapshot.deleteMany({ where: { missionId } });
    await prisma.reviewFinding.deleteMany({ where: { missionId } });
    await prisma.reviewerExecution.deleteMany({ where: { missionId } });
    await prisma.requirement.deleteMany({ where: { missionId } });
    await prisma.promptMasterVersion.deleteMany({ where: { missionId } });
  }

  async function seedPromptMaster(missionId: string, opts: { vision?: string; features?: string[] } = {}): Promise<string> {
    const promptMasterId = randomUUID();
    await prisma.promptMasterVersion.create({
      data: {
        id: promptMasterId, missionId, version: 1,
        vision: opts.vision ?? 'Landing page comercial', objective: 'Converter visitantes', targetAudience: 'Público geral',
        fullMarkdown: '# doc', hash: 'x', status: 'DRAFT', provider: 'deepseek', model: 'deepseek-chat',
        promptTokens: 0, completionTokens: 0, latencyMs: 0,
      },
    });
    if (opts.features) {
      await prisma.requirement.createMany({
        data: opts.features.map((content) => ({
          id: randomUUID(), missionId, promptMasterId, section: 'features', content,
          origin: 'AI_SUGGESTED', status: 'CONFIRMED', createdBy: 'test',
        })),
      });
    }
    return promptMasterId;
  }

  it('routes only the 4 core reviewers for a plain mission with no special signals', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      const promptMasterId = await seedPromptMaster(missionId, { features: ['Exibir uma lista de produtos'] });
      const result = await council.runCouncil(missionId, promptMasterId);

      expect(result.completion).toBe('REVIEW_COMPLETE');
      expect(result.executions.map((e) => e.reviewerKey).sort()).toEqual(
        ['architectureFeasibility', 'consistency', 'qa', 'requirements'].sort()
      );
      expect(result.executions.every((e) => e.status === 'PASSED')).toBe(true);
      const invocations = await prisma.llmInvocationRecord.findMany({ where: { missionId } });
      expect(invocations).toHaveLength(result.executions.length);
      expect(invocations.every((row) => row.purpose.startsWith('review-council.'))).toBe(true);
    } finally {
      await cleanup(missionId);
    }
  });

  it('routes the security and privacy reviewers too when the content signals payments/login/CPF', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      const promptMasterId = await seedPromptMaster(missionId, {
        features: ['Login com senha', 'Cadastro de paciente com CPF para nota fiscal'],
      });
      const result = await council.runCouncil(missionId, promptMasterId);
      const keys = result.executions.map((e) => e.reviewerKey);
      expect(keys).toContain('security');
      expect(keys).toContain('privacy');
      expect(keys).not.toContain('abuseMisuse'); // no messaging/sharing signal in this content
    } finally {
      await cleanup(missionId);
    }
  });

  it('persists a real BLOCKER finding from a reviewer, correctly linked to the requirement it refers to', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      const promptMasterId = await seedPromptMaster(missionId, { features: ['Finalizar compra do curso'] });

      // Core reviewer order: requirements, consistency, architectureFeasibility, qa.
      fakeLlm.push(
        NO_FINDINGS, // requirements
        turn({
          findings: [
            {
              code: 'CHECKOUT_UNDEFINED',
              severity: 'BLOCKER',
              section: 'flows',
              targetContent: ['Finalizar compra do curso'],
              finding: 'O fluxo termina em compra, mas checkout está fora do escopo.',
              recommendedResolutions: ['Usar checkout externo', 'Adicionar pagamento ao escopo'],
              requiresUserDecision: true,
            },
          ],
        }), // consistency
        NO_FINDINGS, // architectureFeasibility
        NO_FINDINGS // qa
      );

      const result = await council.runCouncil(missionId, promptMasterId);
      expect(result.completion).toBe('REVIEW_COMPLETE');

      const findings = await reviewFindings.listForVersion(promptMasterId);
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('BLOCKER');
      expect(findings[0].code).toBe('CHECKOUT_UNDEFINED');
      expect(findings[0].requiresUserDecision).toBe(true);
      // targetContent was resolved server-side to the real requirement id, never trusted as-is.
      const requirement = await prisma.requirement.findFirst({ where: { missionId, content: 'Finalizar compra do curso' } });
      expect(findings[0].requirementIds).toEqual([requirement!.id]);
    } finally {
      await cleanup(missionId);
    }
  });

  it('never lets one reviewer failure take down the others — a persistent CRITICAL failure needs a manual retry', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      const promptMasterId = await seedPromptMaster(missionId, { features: ['Uma funcionalidade qualquer'] });

      // Promise.allSettled(reviewerKeys.map(fn)) dispatches EVERY reviewer's 1st attempt
      // synchronously, in order, before any retry happens (each fn only suspends at its own first
      // await) — so the queue must have exactly one item per reviewer for round 1 (never rely on
      // defaultResult there, or the assignment becomes arbitrary), and only afterwards the retry
      // item(s). Only ONE reviewer may be mid-retry per test, or the relative order between two
      // independently-scheduled backoff timers isn't guaranteed.
      fakeLlm.push(
        NO_FINDINGS, // requirements — attempt 1
        'FAIL', // consistency (CRITICAL) — attempt 1
        NO_FINDINGS, // architectureFeasibility — attempt 1
        NO_FINDINGS, // qa — attempt 1
        'FAIL' // consistency — attempt 2 (the only one pending retry)
      );

      const result = await council.runCouncil(missionId, promptMasterId);
      // Only a CRITICAL reviewer still down after retry makes the council genuinely incomplete.
      expect(result.completion).toBe('REVIEW_PARTIALLY_COMPLETED');

      const byKey = Object.fromEntries(result.executions.map((e) => [e.reviewerKey, e]));
      expect(byKey.requirements.status).toBe('PASSED');
      expect(byKey.requirements.attemptCount).toBe(1);
      expect(byKey.consistency.status).toBe('FAILED_BLOCKING');
      expect(byKey.consistency.criticality).toBe('CRITICAL');
      expect(byKey.consistency.attemptCount).toBe(2);
      expect(byKey.consistency.errorCode).toBeTruthy();
      expect(byKey.architectureFeasibility.status).toBe('PASSED');
      expect(byKey.qa.status).toBe('PASSED');

      // Telemetry never records chain-of-thought — only auditable fields.
      const executionRows = await prisma.reviewerExecution.findMany({ where: { missionId, promptMasterId } });
      expect(executionRows).toHaveLength(4);
      for (const row of executionRows) {
        expect(Object.keys(row).sort()).toEqual(
          ['id', 'missionId', 'promptMasterId', 'reviewerKey', 'status', 'provider', 'model', 'promptTemplateVersion', 'findingCount', 'promptTokens', 'completionTokens', 'latencyMs', 'errorCode', 'attemptCount', 'fallbackUsed', 'startedAt', 'finishedAt', 'createdAt'].sort()
        );
      }

      // Fase 29: retry only the failed reviewer, not the whole council.
      fakeLlm.push(NO_FINDINGS);
      const retried = await council.retryReviewer(missionId, promptMasterId, 'consistency');
      expect(retried.status).toBe('PASSED');
    } finally {
      await cleanup(missionId);
    }
  });

  it('MISSÃO "Auto-Governança por IA" (seção 10): a transient failure self-heals via automatic retry — never surfaces as REVIEWER_AI_UNAVAILABLE to the user', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      const promptMasterId = await seedPromptMaster(missionId, { features: ['Uma funcionalidade qualquer'] });

      fakeLlm.push(
        NO_FINDINGS, // requirements — attempt 1
        NO_FINDINGS, // consistency — attempt 1
        'MALFORMED', // architectureFeasibility — attempt 1 (transient bad response)
        NO_FINDINGS, // qa — attempt 1
        NO_FINDINGS // architectureFeasibility — attempt 2 (self-heals)
      );

      const result = await council.runCouncil(missionId, promptMasterId);
      expect(result.completion).toBe('REVIEW_COMPLETE');
      const byKey = Object.fromEntries(result.executions.map((e) => [e.reviewerKey, e]));
      expect(byKey.architectureFeasibility.status).toBe('PASSED');
      expect(byKey.architectureFeasibility.attemptCount).toBe(2);
      expect(byKey.architectureFeasibility.fallbackUsed).toBe(false);
    } finally {
      await cleanup(missionId);
    }
  });

  it('Fase 11: a reviewer whose LLM call hangs is marked FAILED with REVIEWER_TIMEOUT once the timeout elapses — it never blocks the others from completing', async () => {
    const missionId = `test-${randomUUID()}`;
    // Real, short timeout instead of jest fake timers — fake timers also intercept the setTimeout
    // calls Prisma's own driver relies on internally, which made the other (genuinely fine)
    // reviewers' real DB writes hang too. This override is test-only (see the field's own comment).
    (council as unknown as { reviewerTimeoutMs: number }).reviewerTimeoutMs = 100;
    (council as unknown as { retryBackoffMs: number }).retryBackoffMs = 20;
    try {
      const promptMasterId = await seedPromptMaster(missionId, { features: ['Uma funcionalidade qualquer'] });

      // Core reviewer order: requirements, consistency, architectureFeasibility, qa. Round 1 fires
      // synchronously for all 4 (one item each); the 2nd 'HANG' is consistency's retry, the only
      // reviewer pending a retry in this test (see comment on the test above for why that matters).
      fakeLlm.push(NO_FINDINGS, 'HANG', NO_FINDINGS, NO_FINDINGS, 'HANG');

      const result = await council.runCouncil(missionId, promptMasterId);

      expect(result.completion).toBe('REVIEW_PARTIALLY_COMPLETED');
      const byKey = Object.fromEntries(result.executions.map((e) => [e.reviewerKey, e]));
      expect(byKey.requirements.status).toBe('PASSED');
      expect(byKey.consistency.status).toBe('FAILED_BLOCKING');
      expect(byKey.consistency.criticality).toBe('CRITICAL');
      expect(byKey.consistency.errorCode).toBe('REVIEWER_TIMEOUT');
      expect(byKey.consistency.attemptCount).toBe(2);
      expect(byKey.architectureFeasibility.status).toBe('PASSED');
      expect(byKey.qa.status).toBe('PASSED');
    } finally {
      await cleanup(missionId);
    }
  });
});
