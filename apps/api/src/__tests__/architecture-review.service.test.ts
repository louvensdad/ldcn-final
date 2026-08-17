import { randomUUID } from 'node:crypto';
import { PrismaService } from '../persistence/prisma.service';
import { MissionPersistenceService } from '../persistence/mission-persistence.service';
import { ArchitectureReviewService } from '../architecture-review/architecture-review.service';
import { EventBusService } from '../events/event-bus.service';
import { LlmClient, LlmCompletionRequest, LlmCompletionResult } from '../assistant/deepseek-client';
import { LlmInvocationLedgerService } from '../ledger/llm-invocation-ledger.service';

const RUN_DB_TESTS = process.env.LDCN_TEST_DATABASE_URL || process.env.DATABASE_URL;

function turn(json: Record<string, unknown>): LlmCompletionResult {
  return { text: JSON.stringify(json), model: 'deepseek-chat', promptTokens: 80, completionTokens: 40 };
}

const EMPTY_RESULT = turn({ findings: [] });

class QueuedFakeLlmClient implements LlmClient {
  calls: LlmCompletionRequest[] = [];
  defaultResult: LlmCompletionResult | null = EMPTY_RESULT;
  private queue: (LlmCompletionResult | 'FAIL')[] = [];

  push(...items: (LlmCompletionResult | 'FAIL')[]) {
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
    return next;
  }
}

const RAW_IDEA = 'Quero um sistema web com backend e dashboard para gerenciar clientes e pedidos.';

(RUN_DB_TESTS ? describe : describe.skip)('ArchitectureReviewService (Postgres, fake LlmClient)', () => {
  let prisma: PrismaService;
  let missionPersistence: MissionPersistenceService;
  let fakeLlm: QueuedFakeLlmClient;
  let review: ArchitectureReviewService;
  let eventBus: EventBusService;
  let ledger: LlmInvocationLedgerService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    missionPersistence = new MissionPersistenceService(prisma);
    ledger = new LlmInvocationLedgerService(prisma);
  });

  beforeEach(() => {
    fakeLlm = new QueuedFakeLlmClient();
    eventBus = new EventBusService();
    review = new ArchitectureReviewService(prisma, missionPersistence, eventBus, fakeLlm, ledger);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function seedMission(): Promise<string> {
    const missionId = `test-arch-review-${randomUUID()}`;
    const session = await missionPersistence.hydrate(missionId);
    session.commands.generate({ missionId, rawUserIdea: RAW_IDEA });
    await missionPersistence.flush(missionId, session);
    return missionId;
  }

  async function cleanup(missionId: string) {
    await prisma.llmInvocationRecord.deleteMany({ where: { missionId } });
    await prisma.promptSnapshot.deleteMany({ where: { missionId } });
    await prisma.architectureReviewFinding.deleteMany({ where: { missionId } });
    await prisma.architectureReviewerExecution.deleteMany({ where: { missionId } });
    await prisma.architectureReview.deleteMany({ where: { missionId } });
    await prisma.generationResult.deleteMany({ where: { missionId } });
    await prisma.generatorMissionState.deleteMany({ where: { missionId } });
  }

  it('MISSÃO "Tempo real (SSE)": emite architecture_review.started e .completed reais no mesmo instante em que o pipeline muda de fase — nunca sintético', async () => {
    const missionId = await seedMission();
    try {
      const received: { type: string; missionId?: string; payload: unknown }[] = [];
      const subscription = eventBus.stream().subscribe((event) => received.push({ type: event.type, missionId: event.missionId, payload: event.payload }));
      try {
        const result = await review.start(missionId);
        expect(received.map((e) => e.type)).toEqual(['architecture_review.started', 'architecture_review.completed']);
        expect(received.every((e) => e.missionId === missionId)).toBe(true);
        const completed = received.find((e) => e.type === 'architecture_review.completed')!;
        expect((completed.payload as { status: string }).status).toBe(result.status);
      } finally {
        subscription.unsubscribe();
      }
    } finally {
      await cleanup(missionId);
    }
  });

  it('approves a clean composition with no findings — real council + policy, both clean', async () => {
    const missionId = await seedMission();
    try {
      const result = await review.start(missionId);
      expect(result.status).toBe('APPROVED');
      expect(result.executions.length).toBeGreaterThanOrEqual(2); // ao menos solutionArchitect + stackArchitect
      expect(result.executions.every((e) => e.status === 'PASSED')).toBe(true);
    } finally {
      await cleanup(missionId);
    }
  });

  it('SLICE C1 (teste E): council com N reviewers reais produz N LlmInvocationRecord, um por reviewer, cada um ligado ao ArchitectureReviewerExecution correto', async () => {
    const missionId = await seedMission();
    try {
      const result = await review.start(missionId);
      expect(result.executions.length).toBe(3); // solutionArchitect + stackArchitect + securityArchitect (composição padrão sempre inclui "authentication middleware")

      const invocations = await prisma.llmInvocationRecord.findMany({ where: { missionId, purpose: 'architecture.review' } });
      expect(invocations).toHaveLength(3);
      expect(invocations.every((inv) => inv.status === 'SUCCEEDED')).toBe(true);
      expect(invocations.every((inv) => inv.provider === 'deepseek')).toBe(true);

      const rawExecutions = await prisma.architectureReviewerExecution.findMany({ where: { missionId } });
      expect(rawExecutions).toHaveLength(3);
      const rawExecutionIds = new Set(rawExecutions.map((e) => e.id));
      const linkedIds = new Set(invocations.map((inv) => inv.architectureReviewerExecutionId));
      expect(linkedIds).toEqual(rawExecutionIds);
    } finally {
      await cleanup(missionId);
    }
  });

  it('sempre inclui um achado determinístico STACK_NOT_GENERATABLE para stacks fora do motor de geração (sem gastar LLM nisso)', async () => {
    const missionId = await seedMission();
    try {
      const result = await review.start(missionId);
      // O cenário produz BACKEND (nestjs, suportado) + FRONTEND (nextjs, não suportado) — o
      // frontend deve gerar o achado determinístico, sem depender de nenhuma resposta do fakeLlm.
      const advisory = result.findings.find((f) => f.code === 'STACK_NOT_GENERATABLE');
      expect(advisory).toBeDefined();
      expect(advisory?.reviewerKey).toBe('policy');
      expect(advisory?.severity).toBe('ADVISORY');
    } finally {
      await cleanup(missionId);
    }
  });

  it('BLOCKER real do council com resolução disponível vira REWORK_REQUIRED, nunca aprova sozinho', async () => {
    const missionId = await seedMission();
    try {
      fakeLlm.push(
        turn({
          findings: [
            {
              code: 'MODULE_BOUNDARY_OVERLAP',
              severity: 'BLOCKER',
              finding: 'Dois módulos declaram a mesma responsabilidade de autenticação.',
              recommendedResolutions: ['Consolidar em um único módulo de autenticação'],
              requiresUserDecision: true,
            },
          ],
        })
      );
      const result = await review.start(missionId);
      expect(result.status).toBe('REWORK_REQUIRED');
      const blocker = result.findings.find((f) => f.code === 'MODULE_BOUNDARY_OVERLAP');
      expect(blocker?.status).toBe('OPEN');
    } finally {
      await cleanup(missionId);
    }
  });

  it('resolver o achado real reavalia o veredito para APPROVED — nunca preso em REWORK_REQUIRED depois de resolvido', async () => {
    const missionId = await seedMission();
    try {
      fakeLlm.push(
        turn({
          findings: [
            {
              code: 'MODULE_BOUNDARY_OVERLAP', severity: 'BLOCKER',
              finding: 'Sobreposição real detectada.', recommendedResolutions: ['Consolidar módulos'], requiresUserDecision: true,
            },
          ],
        })
      );
      const started = await review.start(missionId);
      const blocker = started.findings.find((f) => f.code === 'MODULE_BOUNDARY_OVERLAP')!;

      const decided = await review.decideFinding(missionId, blocker.id, 'Consolidar módulos');
      expect(decided.status).toBe('APPROVED');
      expect(decided.findings.find((f) => f.id === blocker.id)?.status).toBe('RESOLVED');
    } finally {
      await cleanup(missionId);
    }
  });

  it('BLOCKER sem nenhuma resolução oferecida nunca vira REWORK_REQUIRED — é BLOCKED de verdade (beco sem saída real)', async () => {
    const missionId = await seedMission();
    try {
      fakeLlm.push(
        turn({
          findings: [
            { code: 'UNRESOLVABLE_CONFLICT', severity: 'BLOCKER', finding: 'Conflito real sem caminho conhecido.', recommendedResolutions: [], requiresUserDecision: true },
          ],
        })
      );
      const result = await review.start(missionId);
      expect(result.status).toBe('BLOCKED');
    } finally {
      await cleanup(missionId);
    }
  });

  it('reviewer CRITICAL indisponível nunca aprova silenciosamente — REWORK_REQUIRED mesmo com achados vazios', async () => {
    const missionId = await seedMission();
    try {
      fakeLlm.defaultResult = null; // toda chamada falha
      const result = await review.start(missionId);
      expect(result.status).toBe('REWORK_REQUIRED');
      expect(result.executions.some((e) => e.criticality === 'CRITICAL' && e.status === 'FAILED_BLOCKING')).toBe(true);
    } finally {
      await cleanup(missionId);
    }
  });

  it('rodar start() de novo nunca acumula achados/execuções da rodada anterior', async () => {
    const missionId = await seedMission();
    try {
      fakeLlm.push(turn({ findings: [{ code: 'X', severity: 'WARNING', finding: 'y', recommendedResolutions: [], requiresUserDecision: false }] }));
      const first = await review.start(missionId);
      const firstCount = first.findings.length;
      expect(firstCount).toBeGreaterThan(0);

      const second = await review.start(missionId); // sem novo finding enfileirado — council limpo
      const stackFindings = second.findings.filter((f) => f.code === 'X');
      expect(stackFindings).toHaveLength(0);
    } finally {
      await cleanup(missionId);
    }
  });
});
