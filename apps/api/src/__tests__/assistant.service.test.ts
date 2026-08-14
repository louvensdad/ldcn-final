import { randomUUID } from 'node:crypto';
import { PrismaService } from '../persistence/prisma.service';
import { MissionPersistenceService } from '../persistence/mission-persistence.service';
import { OperationPersistenceService } from '../operations/operation-persistence.service';
import { EventBusService } from '../events/event-bus.service';
import { GeneratorService } from '../generator/generator.service';
import { RoutingPersistenceService } from '../routing/routing-persistence.service';
import { AssistantService } from '../assistant/assistant.service';
import { LlmClient, LlmCompletionRequest, LlmCompletionResult } from '../assistant/deepseek-client';

const RUN_DB_TESTS = process.env.LDCN_TEST_DATABASE_URL || process.env.DATABASE_URL;

/** Fake — real calls to DeepSeek cost real money and hit the network, kept out of the automated suite. */
class FakeLlmClient implements LlmClient {
  calls: LlmCompletionRequest[] = [];
  result: LlmCompletionResult | null = { text: 'Explicação em linguagem simples.', model: 'deepseek-chat', promptTokens: 120, completionTokens: 40 };

  async complete(input: LlmCompletionRequest): Promise<LlmCompletionResult> {
    this.calls.push(input);
    if (!this.result) throw new Error('simulated LLM failure');
    return this.result;
  }
}

(RUN_DB_TESTS ? describe : describe.skip)('AssistantService (Postgres, fake LlmClient)', () => {
  let prisma: PrismaService;
  let missionPersistence: MissionPersistenceService;
  let routing: RoutingPersistenceService;
  let fakeLlm: FakeLlmClient;
  let assistant: AssistantService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    missionPersistence = new MissionPersistenceService(prisma);
    routing = new RoutingPersistenceService(prisma, missionPersistence);
  });

  beforeEach(() => {
    fakeLlm = new FakeLlmClient();
    const generator = new GeneratorService(missionPersistence, new OperationPersistenceService(prisma), new EventBusService());
    assistant = new AssistantService(fakeLlm, prisma, missionPersistence, generator);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function cleanup(missionId: string) {
    await prisma.decisionEvent.deleteMany({ where: { missionId } });
    await prisma.generationResult.deleteMany({ where: { missionId } });
    await prisma.generatorMissionState.deleteMany({ where: { missionId } });
    await prisma.jobClassificationRecord.deleteMany({ where: { missionId } });
    await prisma.workRoutingDecisionRecord.deleteMany({ where: { missionId } });
  }

  async function seedMissionWithArchitecture(missionId: string) {
    const session = await missionPersistence.hydrate(missionId);
    const result = session.commands.generate({ missionId, rawUserIdea: 'quero uma landing page' });
    await missionPersistence.flush(missionId, session);
    return result;
  }

  it('404s for an architecture decision that does not exist on the mission', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      await seedMissionWithArchitecture(missionId);
      await expect(assistant.explainArchitectureDecision(missionId, 'not-a-real-decision-id')).rejects.toThrow('ARCHITECTURE_DECISION_NOT_FOUND');
      expect(fakeLlm.calls).toHaveLength(0);
    } finally {
      await cleanup(missionId);
    }
  });

  it('explains a real architecture decision and records AI_EXPLANATION_GENERATED with real usage', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      const result = await seedMissionWithArchitecture(missionId);
      const decision = result.architectureComposition.proposals[0].decisions[0];

      const explanation = await assistant.explainArchitectureDecision(missionId, decision.id);

      expect(explanation.explanation).toBe('Explicação em linguagem simples.');
      expect(explanation.usage).toEqual({ provider: 'deepseek', model: 'deepseek-chat', promptTokens: 120, completionTokens: 40, totalTokens: 160, latencyMs: expect.any(Number) });
      expect(fakeLlm.calls).toHaveLength(1);
      expect(fakeLlm.calls[0].user).toContain(decision.selectedOption);

      const events = await prisma.decisionEvent.findMany({ where: { missionId, eventType: 'AI_EXPLANATION_GENERATED' } });
      expect(events).toHaveLength(1);
      const payload = events[0].payload as Record<string, unknown>;
      expect(payload.aggregateId).toBe(decision.id);
      expect(payload.aggregateType).toBe('ArchitectureDecision');
      expect(payload.provider).toBe('deepseek');
      expect(payload.totalUnits).toBe(160);
    } finally {
      await cleanup(missionId);
    }
  });

  it('maps an LLM failure to AI_EXPLANATION_UNAVAILABLE and records no event', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      const result = await seedMissionWithArchitecture(missionId);
      const decision = result.architectureComposition.proposals[0].decisions[0];
      fakeLlm.result = null;

      await expect(assistant.explainArchitectureDecision(missionId, decision.id)).rejects.toThrow('AI_EXPLANATION_UNAVAILABLE');

      const events = await prisma.decisionEvent.count({ where: { missionId, eventType: 'AI_EXPLANATION_GENERATED' } });
      expect(events).toBe(0);
    } finally {
      await cleanup(missionId);
    }
  });

  it('404s for a team decision that does not exist on the mission', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      await seedMissionWithArchitecture(missionId);
      await expect(assistant.explainTeamDecision(missionId, 'not-a-real-decision-id')).rejects.toThrow('TEAM_DECISION_NOT_FOUND');
    } finally {
      await cleanup(missionId);
    }
  });

  it('explains a real team composition decision and records the event', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      const result = await seedMissionWithArchitecture(missionId);
      const decision = result.agentTeam.decisions[0];

      const explanation = await assistant.explainTeamDecision(missionId, decision.id);

      expect(explanation.explanation).toBe('Explicação em linguagem simples.');
      expect(fakeLlm.calls[0].user).toContain(decision.selectedOption);

      const events = await prisma.decisionEvent.findMany({ where: { missionId, eventType: 'AI_EXPLANATION_GENERATED' } });
      expect(events).toHaveLength(1);
      const payload = events[0].payload as Record<string, unknown>;
      expect(payload.aggregateType).toBe('TeamCompositionDecision');
      expect(payload.aggregateId).toBe(decision.id);
    } finally {
      await cleanup(missionId);
    }
  });

  it('404s for a routing decision that does not exist on the mission', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      await seedMissionWithArchitecture(missionId);
      await expect(assistant.explainRoutingDecision(missionId, 'task-never-routed')).rejects.toThrow('ROUTING_DECISION_NOT_FOUND');
    } finally {
      await cleanup(missionId);
    }
  });

  it('explains a real routing decision and records the event', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      await seedMissionWithArchitecture(missionId);
      await routing.classify(missionId, 'task-1', { description: 'Implementar hero section com SEO' });
      const routed = await routing.route(missionId, 'task-1');

      const explanation = await assistant.explainRoutingDecision(missionId, 'task-1');

      expect(explanation.explanation).toBe('Explicação em linguagem simples.');
      expect(fakeLlm.calls[0].user).toContain('task-1');

      const events = await prisma.decisionEvent.findMany({ where: { missionId, eventType: 'AI_EXPLANATION_GENERATED' } });
      expect(events).toHaveLength(1);
      const payload = events[0].payload as Record<string, unknown>;
      expect(payload.aggregateType).toBe('WorkRoutingDecision');
      expect(payload.aggregateId).toBe(routed.id);
    } finally {
      await cleanup(missionId);
    }
  });
});
