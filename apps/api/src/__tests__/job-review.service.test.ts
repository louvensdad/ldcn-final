import { randomUUID } from 'node:crypto';
import { JobReviewService } from '../generation-engine/job-review.service';
import { PlannedJob } from '../generation-engine/job-planner';
import { LlmClient, LlmCompletionRequest, LlmCompletionResult } from '../assistant/deepseek-client';
import { PrismaService } from '../persistence/prisma.service';
import { LlmInvocationLedgerService } from '../ledger/llm-invocation-ledger.service';

const RUN_DB_TESTS = process.env.LDCN_TEST_DATABASE_URL || process.env.DATABASE_URL;

function turn(json: Record<string, unknown>): LlmCompletionResult {
  return { text: JSON.stringify(json), model: 'deepseek-chat', promptTokens: 30, completionTokens: 40 };
}

class FakeLlmClient implements LlmClient {
  calls: LlmCompletionRequest[] = [];
  private queued: (LlmCompletionResult | 'FAIL')[] = [];

  push(item: LlmCompletionResult | 'FAIL') {
    this.queued.push(item);
  }

  async complete(input: LlmCompletionRequest): Promise<LlmCompletionResult> {
    this.calls.push(input);
    const next = this.queued.shift();
    if (!next) throw new Error('FakeLlmClient: no queued response');
    if (next === 'FAIL') throw new Error('simulated LLM failure');
    return next;
  }
}

const JOB: PlannedJob = {
  requirementId: 'req-1',
  requirementText: 'A comissão do vendedor deve ser 5% do valor da venda.',
  targetResource: 'Vendedore',
  targetFile: 'src/vendedores/vendedores.service.ts',
  agentKey: 'backend.nestjs.data-specialist',
};

(RUN_DB_TESTS ? describe : describe.skip)('JobReviewService (Postgres, fake LlmClient)', () => {
  let prisma: PrismaService;
  let ledger: LlmInvocationLedgerService;
  let llm: FakeLlmClient;
  let service: JobReviewService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    ledger = new LlmInvocationLedgerService(prisma);
  });

  beforeEach(() => {
    llm = new FakeLlmClient();
    service = new JobReviewService(llm, ledger);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  function missionId(): string {
    return `test-job-review-${randomUUID()}`;
  }

  async function cleanup(mid: string) {
    await prisma.llmInvocationRecord.deleteMany({ where: { missionId: mid } });
    await prisma.promptSnapshot.deleteMany({ where: { missionId: mid } });
  }

  it('aprova de verdade quando a lógica está correta', async () => {
    const mid = missionId();
    try {
      llm.push(turn({ approved: true, finding: null }));
      const result = await service.review(JOB, 'calculateCommission(v) { return v * 0.05; }', { missionId: mid });
      expect(result).toEqual({ approved: true, finding: null, ran: true, errorCode: null });
    } finally {
      await cleanup(mid);
    }
  });

  it('reprova de verdade com um achado real quando a lógica está errada', async () => {
    const mid = missionId();
    try {
      llm.push(turn({ approved: false, finding: 'Usa 0.5 (50%) em vez de 0.05 (5%) — a comissão calculada é 10x maior que o pedido.' }));
      const result = await service.review(JOB, 'calculateCommission(v) { return v * 0.5; }', { missionId: mid });
      expect(result.approved).toBe(false);
      expect(result.finding).toContain('10x maior');
    } finally {
      await cleanup(mid);
    }
  });

  it('resposta malformada nunca vira aprovação nem reprovação — fica null, honestamente "não rodou"', async () => {
    const mid = missionId();
    try {
      llm.push({ text: 'não é JSON', model: 'deepseek-chat', promptTokens: 5, completionTokens: 5 });
      const result = await service.review(JOB, 'x', { missionId: mid });
      expect(result.approved).toBeNull();
      expect(result.ran).toBe(false);
      expect(result.errorCode).toBe('REVIEWER_MALFORMED_RESPONSE');
    } finally {
      await cleanup(mid);
    }
  });

  it('falha real de LLM nunca vira aprovação silenciosa', async () => {
    const mid = missionId();
    try {
      llm.push('FAIL');
      const result = await service.review(JOB, 'x', { missionId: mid });
      expect(result.approved).toBeNull();
      expect(result.ran).toBe(false);
      expect(result.errorCode).toBe('REVIEWER_AI_UNAVAILABLE');
    } finally {
      await cleanup(mid);
    }
  });

  it('SLICE C1 (teste C): chamada real de job review persiste usage no LlmInvocationRecord', async () => {
    const mid = missionId();
    try {
      llm.push(turn({ approved: true, finding: null }));
      await service.review(JOB, 'calculateCommission(v) { return v * 0.05; }', { missionId: mid });

      const invocations = await prisma.llmInvocationRecord.findMany({ where: { missionId: mid, purpose: 'job.review' } });
      expect(invocations).toHaveLength(1);
      expect(invocations[0].status).toBe('SUCCEEDED');
      expect(invocations[0].provider).toBe('deepseek');
      expect(invocations[0].inputTokens).toBe(30);
      expect(invocations[0].outputTokens).toBe(40);
    } finally {
      await cleanup(mid);
    }
  });

  it('SLICE C1 (teste I): falha real do provider em job review persiste FAILED', async () => {
    const mid = missionId();
    try {
      llm.push('FAIL');
      await service.review(JOB, 'x', { missionId: mid });

      const invocations = await prisma.llmInvocationRecord.findMany({ where: { missionId: mid, purpose: 'job.review' } });
      expect(invocations).toHaveLength(1);
      expect(invocations[0].status).toBe('FAILED');
      expect(invocations[0].errorCode).toBe('REVIEWER_AI_UNAVAILABLE');
    } finally {
      await cleanup(mid);
    }
  });
});
