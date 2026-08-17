import { randomUUID } from 'node:crypto';
import { AgentExecutionService } from '../generation-engine/agent-execution.service';
import { PlannedJob } from '../generation-engine/job-planner';
import { LlmClient, LlmCompletionRequest, LlmCompletionResult } from '../assistant/deepseek-client';
import { PrismaService } from '../persistence/prisma.service';
import { LlmInvocationLedgerService } from '../ledger/llm-invocation-ledger.service';
import { AgentCatalogService } from '../catalog/agent-catalog.service';
import { ContextLoaderService } from '../promptmaster/context-loader.service';
import { PromptMasterService } from '../promptmaster/prompt-master.service';

const RUN_DB_TESTS = process.env.LDCN_TEST_DATABASE_URL || process.env.DATABASE_URL;

function turn(json: Record<string, unknown>): LlmCompletionResult {
  return { text: JSON.stringify(json), model: 'deepseek-chat', promptTokens: 60, completionTokens: 120 };
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

const ORIGINAL_SERVICE = `import { Injectable } from '@nestjs/common';

export interface Vendedore {
  id: string;
  name: string;
  createdAt: string;
}

@Injectable()
export class VendedoreService {
  private readonly items = new Map<string, Vendedore>();

  list(): Vendedore[] {
    return [...this.items.values()];
  }

  get(id: string): Vendedore | undefined {
    return this.items.get(id);
  }

  create(name: string): Vendedore {
    const id = \`vendedores-\${this.items.size + 1}\`;
    const item: Vendedore = { id, name, createdAt: new Date().toISOString() };
    this.items.set(id, item);
    return item;
  }
}
`;

const JOB: PlannedJob = {
  requirementId: 'req-1',
  requirementText: 'A comissão do vendedor deve ser 5% do valor da venda.',
  targetResource: 'Vendedore',
  targetFile: 'src/vendedores/vendedores.service.ts',
  agentKey: 'backend.nestjs.data-specialist',
};

(RUN_DB_TESTS ? describe : describe.skip)('AgentExecutionService (Postgres, fake LlmClient)', () => {
  let prisma: PrismaService;
  let ledger: LlmInvocationLedgerService;
  let llm: FakeLlmClient;
  let service: AgentExecutionService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    ledger = new LlmInvocationLedgerService(prisma);
  });

  beforeEach(() => {
    llm = new FakeLlmClient();
    const catalog = new AgentCatalogService(prisma);
    const contextLoader = new ContextLoaderService(prisma);
    const promptMaster = new PromptMasterService(catalog, contextLoader, ledger, prisma);
    service = new AgentExecutionService(llm, prisma, ledger, catalog, promptMaster);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  function missionId(): string {
    return `test-agent-exec-${randomUUID()}`;
  }

  async function cleanup(mid: string) {
    await prisma.llmInvocationRecord.deleteMany({ where: { missionId: mid } });
    await prisma.promptSnapshot.deleteMany({ where: { missionId: mid } });
    await prisma.agentExecution.deleteMany({ where: { missionId: mid } });
  }

  it('aplica um ChangeSet real quando o LLM preserva toda a superfície pública existente', async () => {
    const mid = missionId();
    const agentExecutionId = randomUUID();
    try {
      const updated = ORIGINAL_SERVICE.replace(
        '  create(name: string): Vendedore {',
        '  calculateCommission(saleValue: number): number {\n    return saleValue * 0.05;\n  }\n\n  create(name: string): Vendedore {'
      );
      llm.push(turn({ analysis: 'Entendi a regra.', plan: 'Adicionar calculateCommission.', implementationSummary: 'Método de comissão adicionado.', updatedFileContent: updated }));

      const result = await service.implement(JOB, ORIGINAL_SERVICE, mid, agentExecutionId);
      expect(result.status).toBe('IMPLEMENTED');
      expect(result.updatedFileContent).toContain('calculateCommission');
      expect(result.errorCode).toBeNull();
    } finally {
      await cleanup(mid);
    }
  });

  it('rejeita um ChangeSet que remove um método existente que o controller depende (violação de escopo real)', async () => {
    const mid = missionId();
    const agentExecutionId = randomUUID();
    try {
      const broken = ORIGINAL_SERVICE.replace('  get(id: string): Vendedore | undefined {\n    return this.items.get(id);\n  }\n\n', '');
      llm.push(turn({ analysis: 'x', plan: 'y', implementationSummary: 'z', updatedFileContent: broken }));

      const result = await service.implement(JOB, ORIGINAL_SERVICE, mid, agentExecutionId);
      expect(result.status).toBe('FAILED');
      expect(result.errorCode).toBe('AGENT_SCOPE_VIOLATION');
    } finally {
      await cleanup(mid);
    }
  });

  it('rejeita resposta malformada (JSON inválido) sem aplicar nada', async () => {
    const mid = missionId();
    const agentExecutionId = randomUUID();
    try {
      llm.push({ text: 'isto não é JSON', model: 'deepseek-chat', promptTokens: 5, completionTokens: 5 });
      const result = await service.implement(JOB, ORIGINAL_SERVICE, mid, agentExecutionId);
      expect(result.status).toBe('FAILED');
      expect(result.errorCode).toBe('AGENT_MALFORMED_RESPONSE');
    } finally {
      await cleanup(mid);
    }
  });

  it('rejeita saída suspeitosamente curta (agente devolveu lixo/truncado)', async () => {
    const mid = missionId();
    const agentExecutionId = randomUUID();
    try {
      llm.push(turn({ analysis: 'x', plan: 'y', implementationSummary: 'z', updatedFileContent: '// nada aqui' }));
      const result = await service.implement(JOB, ORIGINAL_SERVICE, mid, agentExecutionId);
      expect(result.status).toBe('FAILED');
      expect(result.errorCode).toBe('AGENT_SUSPICIOUSLY_SHORT_OUTPUT');
    } finally {
      await cleanup(mid);
    }
  });

  it('falha real de LLM nunca é escondida como sucesso', async () => {
    const mid = missionId();
    const agentExecutionId = randomUUID();
    try {
      llm.push('FAIL');
      const result = await service.implement(JOB, ORIGINAL_SERVICE, mid, agentExecutionId);
      expect(result.status).toBe('FAILED');
      expect(result.errorCode).toBe('AGENT_LLM_UNAVAILABLE');
      expect(result.updatedFileContent).toBeNull();
    } finally {
      await cleanup(mid);
    }
  });

  it('SLICE C1 (teste A): uma chamada real de LLM produz exatamente 1 LlmInvocationRecord com usage persistida', async () => {
    const mid = missionId();
    const agentExecutionId = randomUUID();
    try {
      const updated = ORIGINAL_SERVICE.replace(
        '  create(name: string): Vendedore {',
        '  calculateCommission(saleValue: number): number {\n    return saleValue * 0.05;\n  }\n\n  create(name: string): Vendedore {'
      );
      llm.push(turn({ analysis: 'x', plan: 'y', implementationSummary: 'z', updatedFileContent: updated }));
      await service.implement(JOB, ORIGINAL_SERVICE, mid, agentExecutionId);

      const invocations = await prisma.llmInvocationRecord.findMany({ where: { missionId: mid, agentExecutionId } });
      expect(invocations).toHaveLength(1);
      expect(invocations[0].status).toBe('SUCCEEDED');
      expect(invocations[0].purpose).toBe('job.implement');
      expect(invocations[0].provider).toBe('deepseek');
      expect(invocations[0].inputTokens).toBe(60);
      expect(invocations[0].outputTokens).toBe(120);
      expect(invocations[0].totalTokens).toBe(180);
    } finally {
      await cleanup(mid);
    }
  });

  it('SLICE C1 (teste I): falha real do provider persiste o LlmInvocationRecord como FAILED, nunca omitido', async () => {
    const mid = missionId();
    const agentExecutionId = randomUUID();
    try {
      llm.push('FAIL');
      await service.implement(JOB, ORIGINAL_SERVICE, mid, agentExecutionId);

      const invocations = await prisma.llmInvocationRecord.findMany({ where: { missionId: mid, agentExecutionId } });
      expect(invocations).toHaveLength(1);
      expect(invocations[0].status).toBe('FAILED');
      expect(invocations[0].errorCode).toBe('AGENT_LLM_UNAVAILABLE');
    } finally {
      await cleanup(mid);
    }
  });

  it('SLICE C1 (teste J): elapsedMs da AgentExecution reflete de verdade startedAt/completedAt', async () => {
    const mid = missionId();
    try {
      const updated = ORIGINAL_SERVICE.replace(
        '  create(name: string): Vendedore {',
        '  calculateCommission(saleValue: number): number {\n    return saleValue * 0.05;\n  }\n\n  create(name: string): Vendedore {'
      );
      llm.push(turn({ analysis: 'x', plan: 'y', implementationSummary: 'z', updatedFileContent: updated }));
      await service.implementWithRepair(JOB, ORIGINAL_SERVICE, { missionId: mid });

      const executions = await prisma.agentExecution.findMany({ where: { missionId: mid } });
      expect(executions).toHaveLength(1);
      const exec = executions[0];
      expect(exec.startedAt).not.toBeNull();
      expect(exec.completedAt).not.toBeNull();
      const realDiff = exec.completedAt!.getTime() - exec.startedAt!.getTime();
      expect(exec.elapsedMs).toBe(realDiff);
    } finally {
      await cleanup(mid);
    }
  });

  describe('implementWithRepair', () => {
    it('tentativa original bem-sucedida nunca gasta uma segunda chamada de reparo', async () => {
      const mid = missionId();
      try {
        const updated = ORIGINAL_SERVICE.replace(
          '  create(name: string): Vendedore {',
          '  calculateCommission(saleValue: number): number {\n    return saleValue * 0.05;\n  }\n\n  create(name: string): Vendedore {'
        );
        llm.push(turn({ analysis: 'x', plan: 'y', implementationSummary: 'z', updatedFileContent: updated }));
        const result = await service.implementWithRepair(JOB, ORIGINAL_SERVICE, { missionId: mid });
        expect(result.status).toBe('IMPLEMENTED');
        expect(result.attemptCount).toBe(1);
        expect(result.firstAttemptErrorCode).toBeNull();
        expect(llm.calls).toHaveLength(1);
      } finally {
        await cleanup(mid);
      }
    });

    it('1ª tentativa falha (violação de escopo), reparo real na 2ª corrige e o Job vira IMPLEMENTED', async () => {
      const mid = missionId();
      try {
        const broken = ORIGINAL_SERVICE.replace('  get(id: string): Vendedore | undefined {\n    return this.items.get(id);\n  }\n\n', '');
        const fixed = ORIGINAL_SERVICE.replace(
          '  create(name: string): Vendedore {',
          '  calculateCommission(saleValue: number): number {\n    return saleValue * 0.05;\n  }\n\n  create(name: string): Vendedore {'
        );
        llm.push(turn({ analysis: 'x', plan: 'y', implementationSummary: 'z', updatedFileContent: broken }));
        llm.push(turn({ analysis: 'x2', plan: 'y2', implementationSummary: 'z2', updatedFileContent: fixed }));

        const result = await service.implementWithRepair(JOB, ORIGINAL_SERVICE, { missionId: mid });
        expect(result.status).toBe('IMPLEMENTED');
        expect(result.attemptCount).toBe(2);
        // Nunca esconde que precisou de reparo, mesmo tendo dado certo depois.
        expect(result.firstAttemptErrorCode).toBe('AGENT_SCOPE_VIOLATION');
        expect(llm.calls).toHaveLength(2);
        // O prompt de reparo real inclui o motivo exato da falha anterior — nunca um retry cego.
        expect(llm.calls[1].system).toContain('TENTATIVA DE REPARO');
        expect(llm.calls[1].system).toContain('quebra o controller');
      } finally {
        await cleanup(mid);
      }
    });

    it('duas tentativas reais falhando param no limite — nunca tenta uma 3ª vez', async () => {
      const mid = missionId();
      try {
        llm.push(turn({ analysis: 'x', plan: 'y', implementationSummary: 'z', updatedFileContent: '// curto' }));
        llm.push(turn({ analysis: 'x2', plan: 'y2', implementationSummary: 'z2', updatedFileContent: '// ainda curto' }));

        const result = await service.implementWithRepair(JOB, ORIGINAL_SERVICE, { missionId: mid });
        expect(result.status).toBe('FAILED');
        expect(result.attemptCount).toBe(2);
        expect(result.firstAttemptErrorCode).toBe('AGENT_SUSPICIOUSLY_SHORT_OUTPUT');
        expect(llm.calls).toHaveLength(2); // nunca uma 3ª chamada
      } finally {
        await cleanup(mid);
      }
    });

    it('SLICE C1 (teste B): repair de 2 tentativas produz 2 AgentExecution + 2 LlmInvocationRecord — tokens da 1ª tentativa nunca se perdem', async () => {
      const mid = missionId();
      try {
        const broken = ORIGINAL_SERVICE.replace('  get(id: string): Vendedore | undefined {\n    return this.items.get(id);\n  }\n\n', '');
        const fixed = ORIGINAL_SERVICE.replace(
          '  create(name: string): Vendedore {',
          '  calculateCommission(saleValue: number): number {\n    return saleValue * 0.05;\n  }\n\n  create(name: string): Vendedore {'
        );
        llm.push({ text: JSON.stringify({ analysis: 'x', plan: 'y', implementationSummary: 'z', updatedFileContent: broken }), model: 'deepseek-chat', promptTokens: 100, completionTokens: 50 });
        llm.push({ text: JSON.stringify({ analysis: 'x2', plan: 'y2', implementationSummary: 'z2', updatedFileContent: fixed }), model: 'deepseek-chat', promptTokens: 111, completionTokens: 222 });

        const result = await service.implementWithRepair(JOB, ORIGINAL_SERVICE, { missionId: mid, generationRunId: 'run-1' });
        expect(result.status).toBe('IMPLEMENTED');
        expect(result.attemptCount).toBe(2);

        const executions = await prisma.agentExecution.findMany({ where: { missionId: mid }, orderBy: { attempt: 'asc' } });
        expect(executions).toHaveLength(2);
        expect(executions[0].reason).toBe('INITIAL');
        expect(executions[0].status).toBe('FAILED');
        expect(executions[1].reason).toBe('STRUCTURAL_REPAIR');
        expect(executions[1].status).toBe('SUCCEEDED');

        const invocations = await prisma.llmInvocationRecord.findMany({ where: { missionId: mid }, orderBy: { startedAt: 'asc' } });
        expect(invocations).toHaveLength(2);

        const firstInvocation = invocations.find((inv) => inv.agentExecutionId === executions[0].id);
        const secondInvocation = invocations.find((inv) => inv.agentExecutionId === executions[1].id);
        expect(firstInvocation).toBeDefined();
        expect(secondInvocation).toBeDefined();
        // O 1º attempt falhou na validação estrutural (depois do LLM responder), então a chamada em
        // si foi um sucesso de provider — os tokens reais da 1ª tentativa continuam na linha 1,
        // nunca sobrescritos pela 2ª tentativa.
        expect(firstInvocation!.inputTokens).toBe(100);
        expect(firstInvocation!.outputTokens).toBe(50);
        expect(secondInvocation!.inputTokens).toBe(111);
        expect(secondInvocation!.outputTokens).toBe(222);
      } finally {
        await cleanup(mid);
      }
    });
  });
});
