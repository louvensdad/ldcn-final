import { randomUUID } from 'node:crypto';
import { PrismaService } from '../persistence/prisma.service';
import { LlmInvocationLedgerService } from '../ledger/llm-invocation-ledger.service';

const RUN_DB_TESTS = process.env.LDCN_TEST_DATABASE_URL || process.env.DATABASE_URL;

(RUN_DB_TESTS ? describe : describe.skip)('LlmInvocationLedgerService (Postgres)', () => {
  let prisma: PrismaService;
  let ledger: LlmInvocationLedgerService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    ledger = new LlmInvocationLedgerService(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  function missionId(): string {
    return `test-ledger-${randomUUID()}`;
  }

  async function cleanup(mid: string) {
    await prisma.llmInvocationRecord.deleteMany({ where: { missionId: mid } });
    await prisma.promptSnapshot.deleteMany({ where: { missionId: mid } });
  }

  it('SLICE C1 (teste H): nenhum segredo (API key/token/credential) aparece em PromptSnapshot ou LlmInvocationRecord — só hashes', async () => {
    const mid = missionId();
    const SECRET = 'sk-live-super-secret-deepseek-api-key-abc123';
    try {
      const promptSnapshotId = await ledger.snapshotPrompt({
        missionId: mid,
        promptType: 'job.implement',
        promptVersion: 'v1',
        contextForHash: { apiKey: SECRET, note: 'contexto qualquer' },
        system: `Authorization: Bearer ${SECRET}\nVocê é um agente.`,
        user: `Use a chave ${SECRET} internamente.`,
      });
      const invocationId = await ledger.startInvocation({ missionId: mid, purpose: 'job.implement', promptSnapshotId });
      await ledger.completeInvocation(invocationId, { provider: 'deepseek', model: 'deepseek-chat', inputTokens: 10, outputTokens: 20 });

      const snapshot = await prisma.promptSnapshot.findUniqueOrThrow({ where: { id: promptSnapshotId } });
      const invocation = await prisma.llmInvocationRecord.findUniqueOrThrow({ where: { id: invocationId } });

      const snapshotSerialized = JSON.stringify(snapshot);
      const invocationSerialized = JSON.stringify(invocation);
      expect(snapshotSerialized).not.toContain(SECRET);
      expect(invocationSerialized).not.toContain(SECRET);
      // Só hashes hex de 64 chars (sha256) — nunca o texto original.
      expect(snapshot.renderedPromptHash).toMatch(/^[0-9a-f]{64}$/);
      expect(snapshot.contextHash).toMatch(/^[0-9a-f]{64}$/);
    } finally {
      await cleanup(mid);
    }
  });

  it('cada startInvocation() gera um id próprio — nunca reaproveita/duplica o id de outra chamada real', async () => {
    const mid = missionId();
    try {
      const id1 = await ledger.startInvocation({ missionId: mid, purpose: 'job.implement' });
      const id2 = await ledger.startInvocation({ missionId: mid, purpose: 'job.implement' });
      expect(id1).not.toBe(id2);
      const rows = await prisma.llmInvocationRecord.findMany({ where: { missionId: mid } });
      expect(rows).toHaveLength(2);
    } finally {
      await cleanup(mid);
    }
  });

  it('completeInvocation() calcula latencyMs real a partir de startedAt/completedAt, nunca fabricado', async () => {
    const mid = missionId();
    try {
      const invocationId = await ledger.startInvocation({ missionId: mid, purpose: 'job.implement' });
      await new Promise((resolve) => setTimeout(resolve, 20));
      await ledger.completeInvocation(invocationId, { provider: 'deepseek', model: 'deepseek-chat', inputTokens: 1, outputTokens: 1 });

      const row = await prisma.llmInvocationRecord.findUniqueOrThrow({ where: { id: invocationId } });
      const realDiff = row.completedAt!.getTime() - row.startedAt.getTime();
      expect(row.latencyMs).toBe(realDiff);
      expect(row.latencyMs).toBeGreaterThanOrEqual(15);
    } finally {
      await cleanup(mid);
    }
  });
});
