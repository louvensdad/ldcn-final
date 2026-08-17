import { randomUUID } from 'node:crypto';
import { SecurityReviewService } from '../generation-engine/security-review.service';
import { LlmClient, LlmCompletionRequest, LlmCompletionResult } from '../assistant/deepseek-client';
import { PrismaService } from '../persistence/prisma.service';
import { LlmInvocationLedgerService } from '../ledger/llm-invocation-ledger.service';

const RUN_DB_TESTS = process.env.LDCN_TEST_DATABASE_URL || process.env.DATABASE_URL;

function turn(json: Record<string, unknown>): LlmCompletionResult {
  return { text: JSON.stringify(json), model: 'deepseek-chat', promptTokens: 40, completionTokens: 60 };
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

(RUN_DB_TESTS ? describe : describe.skip)('SecurityReviewService (Postgres, fake LlmClient)', () => {
  let prisma: PrismaService;
  let ledger: LlmInvocationLedgerService;
  let llm: FakeLlmClient;
  let service: SecurityReviewService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    ledger = new LlmInvocationLedgerService(prisma);
  });

  beforeEach(() => {
    llm = new FakeLlmClient();
    service = new SecurityReviewService(llm, ledger);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  function missionId(): string {
    return `test-security-review-${randomUUID()}`;
  }

  async function cleanup(mid: string) {
    await prisma.llmInvocationRecord.deleteMany({ where: { missionId: mid } });
    await prisma.promptSnapshot.deleteMany({ where: { missionId: mid } });
  }

  it('nunca gasta uma chamada de LLM quando não há Job implementado — nada para revisar', async () => {
    const mid = missionId();
    const result = await service.reviewAgentAuthoredCode([], mid);
    expect(result).toEqual({ ran: false, findings: [], errorCode: null });
    expect(llm.calls).toHaveLength(0);
    const invocations = await prisma.llmInvocationRecord.findMany({ where: { missionId: mid } });
    expect(invocations).toHaveLength(0);
  });

  it('retorna achados reais quando o reviewer encontra algo', async () => {
    const mid = missionId();
    try {
      llm.push(turn({ findings: [{ code: 'UNVALIDATED_INPUT', severity: 'BLOCKER', file: 'src/vendedores/vendedores.service.ts', finding: 'valor negativo não é validado.' }] }));
      const result = await service.reviewAgentAuthoredCode([{ targetFile: 'src/vendedores/vendedores.service.ts', requirementText: 'Comissão 5%', content: 'class X {}' }], mid);
      expect(result.ran).toBe(true);
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0].severity).toBe('BLOCKER');
    } finally {
      await cleanup(mid);
    }
  });

  it('sem achado real retorna lista vazia — nunca inventa um achado para preencher', async () => {
    const mid = missionId();
    try {
      llm.push(turn({ findings: [] }));
      const result = await service.reviewAgentAuthoredCode([{ targetFile: 'src/x.service.ts', requirementText: 'regra', content: 'class X {}' }], mid);
      expect(result.ran).toBe(true);
      expect(result.findings).toHaveLength(0);
    } finally {
      await cleanup(mid);
    }
  });

  it('resposta malformada nunca vira PASSED silencioso', async () => {
    const mid = missionId();
    try {
      llm.push({ text: 'não é JSON', model: 'deepseek-chat', promptTokens: 5, completionTokens: 5 });
      const result = await service.reviewAgentAuthoredCode([{ targetFile: 'src/x.service.ts', requirementText: 'regra', content: 'class X {}' }], mid);
      expect(result.ran).toBe(false);
      expect(result.errorCode).toBe('SECURITY_REVIEWER_MALFORMED_RESPONSE');
    } finally {
      await cleanup(mid);
    }
  });

  it('falha real de LLM nunca é escondida como sucesso', async () => {
    const mid = missionId();
    try {
      llm.push('FAIL');
      const result = await service.reviewAgentAuthoredCode([{ targetFile: 'src/x.service.ts', requirementText: 'regra', content: 'class X {}' }], mid);
      expect(result.ran).toBe(false);
      expect(result.errorCode).toBe('SECURITY_REVIEWER_AI_UNAVAILABLE');
    } finally {
      await cleanup(mid);
    }
  });

  it('SLICE C1 (teste D): chamada real de security review persiste usage no LlmInvocationRecord', async () => {
    const mid = missionId();
    try {
      llm.push(turn({ findings: [] }));
      await service.reviewAgentAuthoredCode([{ targetFile: 'src/x.service.ts', requirementText: 'regra', content: 'class X {}' }], mid);

      const invocations = await prisma.llmInvocationRecord.findMany({ where: { missionId: mid, purpose: 'security.review' } });
      expect(invocations).toHaveLength(1);
      expect(invocations[0].status).toBe('SUCCEEDED');
      expect(invocations[0].provider).toBe('deepseek');
      expect(invocations[0].inputTokens).toBe(40);
      expect(invocations[0].outputTokens).toBe(60);
    } finally {
      await cleanup(mid);
    }
  });

  it('SLICE C1 (teste I): falha real do provider em security review persiste FAILED', async () => {
    const mid = missionId();
    try {
      llm.push('FAIL');
      await service.reviewAgentAuthoredCode([{ targetFile: 'src/x.service.ts', requirementText: 'regra', content: 'class X {}' }], mid);

      const invocations = await prisma.llmInvocationRecord.findMany({ where: { missionId: mid, purpose: 'security.review' } });
      expect(invocations).toHaveLength(1);
      expect(invocations[0].status).toBe('FAILED');
      expect(invocations[0].errorCode).toBe('SECURITY_REVIEWER_AI_UNAVAILABLE');
    } finally {
      await cleanup(mid);
    }
  });
});
