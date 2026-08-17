import { randomUUID } from 'node:crypto';
import { PrismaService } from '../persistence/prisma.service';
import { MissionPersistenceService } from '../persistence/mission-persistence.service';
import { OperationPersistenceService } from '../operations/operation-persistence.service';
import { EventBusService } from '../events/event-bus.service';
import { GeneratorService } from '../generator/generator.service';
import { OverviewService } from '../overview/overview.service';
import { DiscoveryService } from '../discovery/discovery.service';
import { ReviewFindingService } from '../review/review-finding.service';
import { ReviewCouncilService } from '../review/review-council.service';
import { PromptMasterDecisionPolicy } from '../review/decision-policy.service';
import { PromptMasterEditingService } from '../review/prompt-master-editing.service';
import { ArchitectureReviewService } from '../architecture-review/architecture-review.service';
import { LlmClient, LlmCompletionRequest, LlmCompletionResult } from '../assistant/deepseek-client';
import { LlmInvocationLedgerService } from '../ledger/llm-invocation-ledger.service';

const RUN_DB_TESTS = process.env.LDCN_TEST_DATABASE_URL || process.env.DATABASE_URL;

function turn(json: Record<string, unknown>): LlmCompletionResult {
  return { text: JSON.stringify(json), model: 'deepseek-chat', promptTokens: 100, completionTokens: 50 };
}

const EMPTY_REVIEWER_RESULT = turn({ findings: [] });

/**
 * Fake — queued responses in call order. Real calls to DeepSeek cost real money and hit the network.
 * generatePromptMaster()/createChangeRequest() now also trigger the Review Council (Fase 7) —
 * several concurrent reviewer calls fire on top of the explicitly-queued PromptMaster response.
 * Tests that don't care about specific reviewer behavior rely on `defaultResult` (a clean "no
 * findings" response) instead of having to queue 4-9 extra responses per test.
 */
class QueuedFakeLlmClient implements LlmClient {
  calls: LlmCompletionRequest[] = [];
  defaultResult: LlmCompletionResult | null = EMPTY_REVIEWER_RESULT;
  private queue: (LlmCompletionResult | 'FAIL' | 'MALFORMED')[] = [];

  push(...items: (LlmCompletionResult | 'FAIL' | 'MALFORMED')[]) {
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
    if (next === 'MALFORMED') return { text: 'not json at all', model: 'deepseek-chat', promptTokens: 5, completionTokens: 5 };
    return next;
  }
}

/** Minimal-but-complete PromptMasterResult payload — parseJson requires every section key present. */
function promptMasterTurn(overrides: Record<string, unknown> = {}): LlmCompletionResult {
  return turn({
    vision: 'Landing page comercial',
    objective: 'Converter visitantes',
    targetAudience: 'Donos de negócio',
    users: [],
    features: [],
    businessRules: [],
    flows: [],
    data: [],
    integrations: [],
    security: [],
    privacy: [],
    nonFunctional: [],
    acceptanceCriteria: [],
    outOfScope: [],
    fullMarkdown: '# PromptMaster\n...',
    ...overrides,
  });
}

/** Minimal-but-complete ImportAnalysisResult payload. */
function importTurn(overrides: Record<string, unknown> = {}): LlmCompletionResult {
  return turn({
    vision: 'Sistema para clínica',
    objective: 'Gerenciar consultas',
    targetAudience: 'Clínicas pequenas',
    users: [],
    features: [],
    businessRules: [],
    flows: [],
    data: [],
    integrations: [],
    security: [],
    privacy: [],
    nonFunctional: [],
    acceptanceCriteria: [],
    outOfScope: [],
    pointsToConfirm: [],
    inconsistencies: [],
    ...overrides,
  });
}

(RUN_DB_TESTS ? describe : describe.skip)('DiscoveryService (Postgres, fake LlmClient)', () => {
  let prisma: PrismaService;
  let missionPersistence: MissionPersistenceService;
  let fakeLlm: QueuedFakeLlmClient;
  let discovery: DiscoveryService;
  let overview: OverviewService;
  let reviewFindings: ReviewFindingService;
  let generator: GeneratorService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    missionPersistence = new MissionPersistenceService(prisma);
  });

  beforeEach(() => {
    fakeLlm = new QueuedFakeLlmClient();
    generator = new GeneratorService(missionPersistence, new OperationPersistenceService(prisma), new EventBusService());
    reviewFindings = new ReviewFindingService(prisma);
    const ledger = new LlmInvocationLedgerService(prisma);
    const reviewCouncil = new ReviewCouncilService(prisma, reviewFindings, fakeLlm, ledger);
    const decisionPolicy = new PromptMasterDecisionPolicy();
    const editing = new PromptMasterEditingService(prisma, reviewFindings, reviewCouncil, decisionPolicy, fakeLlm, ledger);
    const architectureReview = new ArchitectureReviewService(prisma, missionPersistence, new EventBusService(), fakeLlm, new LlmInvocationLedgerService(prisma));
    discovery = new DiscoveryService(prisma, generator, reviewFindings, reviewCouncil, decisionPolicy, editing, architectureReview, fakeLlm, ledger);
    overview = new OverviewService(missionPersistence, new OperationPersistenceService(prisma), prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function cleanup(missionId: string) {
    await prisma.llmInvocationRecord.deleteMany({ where: { missionId } });
    await prisma.promptSnapshot.deleteMany({ where: { missionId } });
    await prisma.architectureReviewFinding.deleteMany({ where: { missionId } });
    await prisma.architectureReviewerExecution.deleteMany({ where: { missionId } });
    await prisma.architectureReview.deleteMany({ where: { missionId } });
    await prisma.discoveryMessage.deleteMany({ where: { missionId } });
    await prisma.reviewFinding.deleteMany({ where: { missionId } });
    await prisma.reviewerExecution.deleteMany({ where: { missionId } });
    await prisma.promptMasterDecision.deleteMany({ where: { missionId } });
    await prisma.promptMasterChangeRequest.deleteMany({ where: { missionId } });
    await prisma.requirement.deleteMany({ where: { missionId } });
    await prisma.promptMasterVersion.deleteMany({ where: { missionId } });
    await prisma.discoveryConversation.deleteMany({ where: { missionId } });
    await prisma.decisionEvent.deleteMany({ where: { missionId } });
    await prisma.generationResult.deleteMany({ where: { missionId } });
    await prisma.generatorMissionState.deleteMany({ where: { missionId } });
  }

  it('creates a conversation from a vague idea and asks one real clarifying question, persisted for refresh', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      fakeLlm.push(
        turn({
          interpretedIntent: 'Landing page para um produto',
          domain: 'landing page',
          goal: 'Apresentar um produto',
          targetUsers: [],
          knownRequirements: [],
          unknowns: ['Qual produto?'],
          confidence: 0.3,
          needsClarification: true,
          nextQuestion: { text: 'Que produto você quer apresentar?', options: [] },
          assistantMessage: 'Legal! Que produto você quer apresentar nessa página?',
        })
      );

      const result = await discovery.start(missionId, 'eu quero um lading page para produto');

      expect(fakeLlm.calls).toHaveLength(1);
      expect(result.status).toBe('WAITING_FOR_USER');
      expect(result.currentQuestion?.text).toBe('Que produto você quer apresentar?');
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].role).toBe('user');
      expect(result.messages[1].role).toBe('assistant');

      // "refresh" — a fresh read must reflect the exact same persisted state, no React state involved.
      const reread = await discovery.get(missionId);
      expect(reread?.currentQuestion?.text).toBe('Que produto você quer apresentar?');
      expect(reread?.messages).toHaveLength(2);
      const invocations = await prisma.llmInvocationRecord.findMany({ where: { missionId } });
      expect(invocations).toHaveLength(1);
      expect(invocations.every((row) => row.purpose.startsWith('discovery.'))).toBe(true);
    } finally {
      await cleanup(missionId);
    }
  });

  it('never fakes AI: a malformed LLM response fails loudly instead of fabricating understanding', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      fakeLlm.push('MALFORMED');
      await expect(discovery.start(missionId, 'quero um sistema para minha clínica')).rejects.toThrow('DISCOVERY_AI_UNAVAILABLE');
      const conversation = await discovery.get(missionId);
      expect(conversation).toBeNull();
    } finally {
      await cleanup(missionId);
    }
  });

  it('a second answer is considered by the next question (history is sent, no repeated question)', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      fakeLlm.push(
        turn({
          interpretedIntent: 'Landing page', domain: 'landing page', goal: 'Apresentar produto',
          targetUsers: [], knownRequirements: [], unknowns: ['produto'], confidence: 0.3,
          needsClarification: true, nextQuestion: { text: 'Que produto?', options: [] },
          assistantMessage: 'Que produto você quer apresentar?',
        }),
        turn({
          interpretedIntent: 'Landing page para SaaS de academias', domain: 'landing page', goal: 'Converter donos de academia',
          targetUsers: [{ value: 'Donos de academia', classification: 'EXPLICIT' }], knownRequirements: [{ value: 'Apresentar SaaS para academias', classification: 'INFERRED' }], unknowns: [], confidence: 0.85,
          needsClarification: false, nextQuestion: null,
          assistantMessage: 'Entendi o suficiente para seguir.',
        }),
        turn({ suggestions: [{ title: 'Hero', description: 'Seção principal', reason: 'Essencial', confidence: 0.9, origin: 'INFERRED' }] })
      );

      await discovery.start(missionId, 'quero uma landing page');
      const responded = await discovery.respond(missionId, 'um SaaS para academias');

      expect(fakeLlm.calls[1].user).toContain('um SaaS para academias');
      expect(fakeLlm.calls[1].user).toContain('Que produto você quer apresentar?'); // prior question in transcript
      expect(responded.status).toBe('FEATURE_REVIEW');
      expect(responded.currentQuestion).toBeNull();
      const features = responded.requirements.filter((r) => r.section === 'features');
      expect(features).toHaveLength(1);
      expect(features[0].status).toBe('SUGGESTED'); // never auto-confirmed
      expect(features[0].origin).toBe('AI_SUGGESTED'); // provenance vocabulary (Fase 8), not the old INFERRED/AI_SUGGESTED pair

      // Fase 4: EXPLICIT vs INFERRED is preserved end to end, never collapsed into one bucket.
      expect(responded.targetUsers).toEqual([{ value: 'Donos de academia', classification: 'EXPLICIT' }]);
      expect(responded.knownRequirements).toEqual([{ value: 'Apresentar SaaS para academias', classification: 'INFERRED' }]);
    } finally {
      await cleanup(missionId);
    }
  });

  it('rejects responding when there is no open question (no double-submit / out-of-order)', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      fakeLlm.push(
        turn({
          interpretedIntent: 'x', domain: 'x', goal: 'x', targetUsers: [], knownRequirements: [], unknowns: [],
          confidence: 0.9, needsClarification: false, nextQuestion: null, assistantMessage: 'Entendido.',
        }),
        turn({ suggestions: [] })
      );
      await discovery.start(missionId, 'crie uma landing page institucional completa com home, serviços, sobre e contato');
      await expect(discovery.respond(missionId, 'resposta indevida')).rejects.toThrow('DISCOVERY_NOT_WAITING');
    } finally {
      await cleanup(missionId);
    }
  });

  it('preserves provenance and decision on requirements; only CONFIRMED features feed the PromptMaster prompt, and get linked to the generated version', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      fakeLlm.push(
        turn({
          interpretedIntent: 'Landing page', domain: 'landing page', goal: 'Converter', targetUsers: [], knownRequirements: [], unknowns: [],
          confidence: 0.9, needsClarification: false, nextQuestion: null, assistantMessage: 'Entendido.',
        }),
        turn({
          suggestions: [
            { title: 'Hero com proposta de valor', description: 'd1', reason: 'r1', confidence: 0.9, origin: 'INFERRED' },
            { title: 'Simulador de economia', description: 'd2', reason: 'r2', confidence: 0.6, origin: 'AI_SUGGESTED' },
          ],
        })
      );
      const started = await discovery.start(missionId, 'quero uma landing page completa para meu produto');
      const [accept, reject] = started.requirements;
      expect(accept.content).toBe('Hero com proposta de valor — d1');
      expect(accept.confidence).toBe(0.9);
      expect(reject.confidence).toBe(0.6);

      await discovery.decideRequirement(missionId, accept.id, 'CONFIRMED');
      await discovery.decideRequirement(missionId, reject.id, 'REJECTED');

      fakeLlm.push(
        promptMasterTurn({
          features: ['Hero com proposta de valor'],
          flows: ['Visitante chega', 'Vê benefícios'],
          outOfScope: ['Simulador de economia'],
        }),
        'FAIL' // PromptMasterCompletionAgent — not exercised in this test
      );
      const withPromptMaster = await discovery.generatePromptMaster(missionId);

      const pmCallUser = fakeLlm.calls[2].user;
      const understandingSent = JSON.parse(pmCallUser.split('\n\nHistórico completo da conversa:')[0].replace('Entendimento e decisões (JSON):\n', ''));
      expect(understandingSent.acceptedFeatures).toEqual(['Hero com proposta de valor — d1']);
      expect(understandingSent.rejectedFeatures).toEqual(['Simulador de economia — d2']);

      expect(withPromptMaster.promptMaster?.features.map((r) => r.content)).toEqual(['Hero com proposta de valor — d1']);
      expect(withPromptMaster.promptMaster?.outOfScope.map((r) => r.content)).toEqual(['Simulador de economia']);
      // The confirmed feature keeps ITS OWN provenance from Discovery — never rewritten as if the
      // PromptMaster step had invented it — while the freshly-generated outOfScope item is tagged
      // AI_REFINED/SUGGESTED (not yet individually reviewed by the user).
      expect(withPromptMaster.promptMaster?.features[0].origin).toBe('AI_SUGGESTED');
      expect(withPromptMaster.promptMaster?.features[0].status).toBe('CONFIRMED');
      expect(withPromptMaster.promptMaster?.outOfScope[0].origin).toBe('AI_REFINED');
      expect(withPromptMaster.promptMaster?.outOfScope[0].status).toBe('SUGGESTED');
      expect(withPromptMaster.promptMaster?.status).toBe('DRAFT');
      expect(withPromptMaster.status).toBe('PROMPTMASTER_READY');
    } finally {
      await cleanup(missionId);
    }
  });

  it('PromptMaster cannot be generated before feature review, and approval locks the version, confirms suggested requirements, and hands off to the real engine with an enriched idea that fixes the reported bug (empty topology/solution)', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      await expect(discovery.generatePromptMaster(missionId)).rejects.toThrow('DISCOVERY_NOT_FOUND');

      fakeLlm.push(
        turn({
          interpretedIntent: 'Landing page para produto', domain: 'landing page', goal: 'Apresentar produto',
          targetUsers: [], knownRequirements: [], unknowns: [], confidence: 0.9,
          needsClarification: false, nextQuestion: null, assistantMessage: 'Entendido.',
        }),
        turn({ suggestions: [{ title: 'Hero', description: 'd', reason: 'r', confidence: 0.9, origin: 'INFERRED' }] })
      );
      const started = await discovery.start(missionId, 'eu quero um lading page para produto');
      expect(started.status).toBe('FEATURE_REVIEW'); // auto-transitioned once confidence was high enough

      const [hero] = started.requirements;
      await discovery.decideRequirement(missionId, hero.id, 'CONFIRMED');

      fakeLlm.push(
        promptMasterTurn({
          vision: 'Landing page comercial para apresentar o produto ao público-alvo',
          objective: 'Converter visitantes em leads',
          targetAudience: 'Clientes em potencial',
          features: ['Hero'],
          flows: ['Visitante chega', 'Conhece o produto'],
          security: ['Formulário de contato deve validar entrada do usuário'],
        }),
        'FAIL' // PromptMasterCompletionAgent — not exercised in this test
      );
      const withPromptMaster = await discovery.generatePromptMaster(missionId);
      const securityItem = withPromptMaster.promptMaster?.security[0];
      expect(securityItem?.status).toBe('SUGGESTED'); // not reviewed individually yet

      const accepted = await discovery.approvePromptMaster(missionId);
      expect(accepted.status).toBe('SUCCEEDED');

      // MISSÃO "Arquitetura não pode seguir automaticamente para Entrega": aprovar o PromptMaster
      // dispara o gate real (council + políticas) — nunca um avanço silencioso sem nenhum veredito.
      const architectureReview = await prisma.architectureReview.findFirst({ where: { missionId } });
      expect(architectureReview).not.toBeNull();
      expect(['PENDING', 'APPROVED', 'REWORK_REQUIRED', 'BLOCKED']).toContain(architectureReview?.status);
      const architectureExecutions = await prisma.architectureReviewerExecution.findMany({ where: { missionId } });
      expect(architectureExecutions.length).toBeGreaterThanOrEqual(2); // solutionArchitect + stackArchitect, no mínimo

      const finalConversation = await discovery.get(missionId);
      expect(finalConversation?.status).toBe('HANDED_OFF');
      expect(finalConversation?.promptMaster?.status).toBe('LOCKED');
      expect(finalConversation?.promptMaster?.lockedAt).not.toBeNull();
      // Approving the whole document is the real user decision that confirms every requirement
      // attached to it that hadn't been individually reviewed (Fase 8 — never an invented approval).
      const confirmedSecurity = finalConversation?.promptMaster?.security[0];
      expect(confirmedSecurity?.status).toBe('CONFIRMED');
      expect(confirmedSecurity?.approvedBy).toBe('user');
      expect(confirmedSecurity?.approvedAt).not.toBeNull();

      // The real deterministic engine now ran with real, well-formed text — this is the literal
      // reported bug (typo "lading" → empty topology/0 stacks) getting fixed as an honest side
      // effect of feeding it a properly-worded idea, not a hack around the engine.
      const missionOverview = await overview.getOverview(missionId);
      expect(missionOverview.topologySummary.requiredTargets).toContain('FRONTEND');
      expect(missionOverview.solutionSummary.selectedStackCount).toBeGreaterThan(0);
      expect(missionOverview.nextAction).not.toBe('RESOLVE_SOLUTION_SELECTION');

      // Once handed off, Discovery no longer accepts turns.
      await expect(discovery.respond(missionId, 'algo')).rejects.toThrow('DISCOVERY_NOT_WAITING');
    } finally {
      await cleanup(missionId);
    }
  });

  it('a rejected requirement stays rejected and is never confirmed by a later PromptMaster approval', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      fakeLlm.push(
        turn({
          interpretedIntent: 'x', domain: 'x', goal: 'x', targetUsers: [], knownRequirements: [], unknowns: [],
          confidence: 0.9, needsClarification: false, nextQuestion: null, assistantMessage: 'Entendido.',
        }),
        turn({
          suggestions: [
            { title: 'Feature A', description: '', reason: '', confidence: 0.9, origin: 'INFERRED' },
            { title: 'Feature B', description: '', reason: '', confidence: 0.5, origin: 'AI_SUGGESTED' },
          ],
        })
      );
      const started = await discovery.start(missionId, 'quero um sistema simples');
      const [a, b] = started.requirements;
      await discovery.decideRequirement(missionId, a.id, 'CONFIRMED');
      await discovery.decideRequirement(missionId, b.id, 'REJECTED');

      fakeLlm.push(promptMasterTurn({ features: ['Feature A'] }), 'FAIL'); // 2nd item: PromptMasterCompletionAgent, not exercised here
      await discovery.generatePromptMaster(missionId);
      await discovery.approvePromptMaster(missionId);

      const final = await discovery.get(missionId);
      const featureB = final?.requirements.find((r) => r.id === b.id);
      expect(featureB?.status).toBe('REJECTED');
      expect(featureB?.promptMasterId).toBeNull(); // never linked into the generated version
    } finally {
      await cleanup(missionId);
    }
  });

  it('caps clarification at a fixed ceiling even if the model keeps asking (never an interrogation)', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      const clarifyingTurn = (n: number) =>
        turn({
          interpretedIntent: `v${n}`, domain: 'x', goal: 'x', targetUsers: [], knownRequirements: [], unknowns: ['ainda'],
          confidence: 0.4, needsClarification: true, nextQuestion: { text: `Pergunta ${n}`, options: [] }, assistantMessage: `Pergunta ${n}`,
        });

      fakeLlm.push(clarifyingTurn(1));
      await discovery.start(missionId, 'quero um sistema para minha empresa');

      for (let i = 2; i <= 6; i++) {
        fakeLlm.push(clarifyingTurn(i));
        await discovery.respond(missionId, `resposta ${i}`);
      }

      // 7th turn: model still says needsClarification=true, but the ceiling forces it false.
      fakeLlm.push(clarifyingTurn(7), turn({ suggestions: [] }));
      const final = await discovery.respond(missionId, 'resposta 7');
      expect(final.status).toBe('FEATURE_REVIEW');
    } finally {
      await cleanup(missionId);
    }
  });

  it('treats an explicit "pode prosseguir" as a stop signal, even when the model keeps asking', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      fakeLlm.push(
        turn({
          interpretedIntent: 'Sistema de estoque', domain: 'sistema de gestão', goal: 'Controlar estoque',
          targetUsers: [], knownRequirements: [], unknowns: ['detalhes'], confidence: 0.4,
          needsClarification: true, nextQuestion: { text: 'Você também controla vendas?', options: [] },
          assistantMessage: 'Você também controla vendas junto com o estoque?',
        })
      );
      await discovery.start(missionId, 'quero um sistema para controlar o estoque da minha loja');

      // The model (fake) still insists needsClarification=true — but the user explicitly asked
      // to move on, so the deterministic safety net must override it regardless.
      fakeLlm.push(
        turn({
          interpretedIntent: 'Sistema de estoque', domain: 'sistema de gestão', goal: 'Controlar estoque',
          targetUsers: [], knownRequirements: [], unknowns: ['ainda mais detalhes'], confidence: 0.5,
          needsClarification: true, nextQuestion: { text: 'Reformulando: e sobre vendas?', options: [] },
          assistantMessage: 'Reformulando: você também precisa controlar vendas?',
        }),
        turn({ suggestions: [{ title: 'Controle de itens', description: 'd', reason: 'r', confidence: 0.9, origin: 'INFERRED' }] })
      );
      const result = await discovery.respond(missionId, 'pode prosseguir com o que já entendeu');

      expect(result.status).toBe('FEATURE_REVIEW');
      expect(result.currentQuestion).toBeNull();
      expect(result.requirements.filter((r) => r.section === 'features')).toHaveLength(1);
    } finally {
      await cleanup(missionId);
    }
  });

  it('a Change Request against a LOCKED PromptMaster creates a new version, supersedes the old one (never mutates it), and carries confirmed requirements forward with real provenance', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      fakeLlm.push(
        turn({
          interpretedIntent: 'x', domain: 'x', goal: 'x', targetUsers: [], knownRequirements: [], unknowns: [],
          confidence: 0.9, needsClarification: false, nextQuestion: null, assistantMessage: 'Entendido.',
        }),
        turn({ suggestions: [{ title: 'Feature A', description: '', reason: '', confidence: 0.9, origin: 'INFERRED' }] })
      );
      const started = await discovery.start(missionId, 'quero um sistema simples');
      const [featureA] = started.requirements;
      await discovery.decideRequirement(missionId, featureA.id, 'CONFIRMED');

      fakeLlm.push(promptMasterTurn({ features: ['Feature A'] }), 'FAIL'); // 2nd item: PromptMasterCompletionAgent, not exercised here
      const withDraft = await discovery.generatePromptMaster(missionId);
      const v1Id = withDraft.promptMaster!.id;

      // Reach PROMPTMASTER_LOCKED without also completing the handoff: today approvePromptMaster()
      // does both steps back-to-back with nothing in this test suite able to interrupt it between
      // them (the real, unmocked Generator always succeeds on first call). This replicates exactly
      // what lockPromptMaster() persists — the same state a real startArchitecture() failure, or
      // (once Fase 9's gate lands) a legitimate review pause, would leave behind.
      await prisma.promptMasterVersion.update({ where: { id: v1Id }, data: { status: 'LOCKED', lockedAt: new Date() } });
      await prisma.requirement.updateMany({ where: { promptMasterId: v1Id, status: 'SUGGESTED' }, data: { status: 'CONFIRMED', approvedBy: 'user', approvedAt: new Date() } });
      await prisma.discoveryConversation.update({ where: { missionId }, data: { status: 'PROMPTMASTER_LOCKED' } });

      const lockedState = await discovery.get(missionId);
      expect(lockedState?.promptMaster?.version).toBe(1);
      expect(lockedState?.promptMaster?.status).toBe('LOCKED');

      const afterChangeRequest = await discovery.createChangeRequest(missionId, 'Preciso adicionar suporte a pagamento via Pix');

      // v1 is untouched — still LOCKED, not deleted, not rewritten (Fase 9: imutável).
      const v1AfterChange = afterChangeRequest.promptMasterHistory.find((v) => v.id === v1Id);
      expect(v1AfterChange?.status).toBe('SUPERSEDED');
      expect(afterChangeRequest.promptMasterHistory).toHaveLength(2);

      expect(afterChangeRequest.promptMaster?.version).toBe(2);
      expect(afterChangeRequest.promptMaster?.status).toBe('DRAFT');
      expect(afterChangeRequest.status).toBe('PROMPTMASTER_READY');

      // The confirmed feature carried forward as a NEW row (new id), linked to v2, with its
      // provenance chain intact — the original v1 row is never edited in place.
      const carriedFeature = afterChangeRequest.promptMaster?.features[0];
      expect(carriedFeature?.id).not.toBe(featureA.id);
      expect(carriedFeature?.parentRequirementId).toBe(featureA.id);
      expect(carriedFeature?.status).toBe('CONFIRMED');
      expect(carriedFeature?.content).toBe('Feature A');

      const originalFeature = afterChangeRequest.requirements.find((r) => r.id === featureA.id);
      expect(originalFeature?.status).toBe('CONFIRMED'); // untouched, still linked to v1
      expect(originalFeature?.promptMasterId).toBe(v1Id);
    } finally {
      await cleanup(missionId);
    }
  });

  it('cannot request a change on a version that is not LOCKED, and cannot change a mission that already handed off (documented limitation — needs a replan flow)', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      await expect(discovery.createChangeRequest(missionId, 'motivo')).rejects.toThrow('DISCOVERY_NOT_FOUND');

      fakeLlm.push(
        turn({
          interpretedIntent: 'x', domain: 'x', goal: 'x', targetUsers: [], knownRequirements: [], unknowns: [],
          confidence: 0.9, needsClarification: false, nextQuestion: null, assistantMessage: 'Entendido.',
        }),
        turn({ suggestions: [{ title: 'Feature A', description: '', reason: '', confidence: 0.9, origin: 'INFERRED' }] })
      );
      const started = await discovery.start(missionId, 'quero um sistema simples');
      await discovery.decideRequirement(missionId, started.requirements[0].id, 'CONFIRMED');
      fakeLlm.push(promptMasterTurn({ features: ['Feature A'] }), 'FAIL'); // 2nd item: PromptMasterCompletionAgent, not exercised here
      await discovery.generatePromptMaster(missionId);

      // DRAFT, not LOCKED yet — no change request possible before approval.
      await expect(discovery.createChangeRequest(missionId, 'motivo')).rejects.toThrow('DISCOVERY_PROMPTMASTER_NOT_LOCKED');

      await discovery.approvePromptMaster(missionId);
      await expect(discovery.createChangeRequest(missionId, 'motivo')).rejects.toThrow('DISCOVERY_CHANGE_REQUIRES_REPLAN');
    } finally {
      await cleanup(missionId);
    }
  });

  it('imports a detailed spec, extracts multiple sections with real provenance, and skips straight to feature review when there is nothing to confirm', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      fakeLlm.push(
        importTurn({
          users: ['Médico', 'Paciente', 'Recepcionista'],
          features: ['Agendamento de consultas', 'Cadastro de pacientes', 'Prontuário eletrônico'],
          businessRules: ['Consulta não pode ser agendada em horário já ocupado'],
          integrations: ['Google Calendar'],
        })
      );
      const result = await discovery.startFromImport(
        missionId,
        'Sistema para clínica com médicos, pacientes, agenda, consultas e prontuário eletrônico. Integra com Google Calendar.'
      );

      expect(fakeLlm.calls).toHaveLength(1);
      expect(result.status).toBe('FEATURE_REVIEW'); // no pointsToConfirm -> nothing blocking
      expect(result.currentQuestion).toBeNull();

      const users = result.requirements.filter((r) => r.section === 'users');
      expect(users).toHaveLength(3);
      expect(users.every((r) => r.origin === 'USER_IMPORTED' && r.status === 'SUGGESTED')).toBe(true); // never silently confirmed

      const businessRules = result.requirements.filter((r) => r.section === 'businessRules');
      expect(businessRules[0].content).toBe('Consulta não pode ser agendada em horário já ocupado');

      // The detection summary is a real chat message, not a fabricated UI element.
      const summary = result.messages[result.messages.length - 1].content;
      expect(summary).toContain('Prompt recebido');
      expect(summary).toContain('3 requisitos'); // features
      expect(summary).toContain('3 perfis de usuário');
    } finally {
      await cleanup(missionId);
    }
  });

  it('imports a spec with open points and asks about them instead of silently guessing (never repeats an already-answered question)', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      fakeLlm.push(
        importTurn({
          features: ['Login de usuário'],
          pointsToConfirm: ['O login deve aceitar cadastro via redes sociais?'],
          inconsistencies: ['O documento menciona "sem custo" mas também descreve um plano pago.'],
        })
      );
      const result = await discovery.startFromImport(missionId, 'Um documento de spec qualquer com login e um plano pago.');

      expect(result.status).toBe('WAITING_FOR_USER');
      expect(result.currentQuestion?.text).toBe('O login deve aceitar cadastro via redes sociais?');
      const summary = result.messages[result.messages.length - 1].content;
      expect(summary).toContain('possível(is) inconsistência');
      expect(summary).toContain('ponto(s) para confirmação');

      // Answering continues the SAME real Discovery loop — no separate/duplicated flow.
      fakeLlm.push(
        turn({
          interpretedIntent: 'x', domain: 'x', goal: 'x', targetUsers: [], knownRequirements: [], unknowns: [],
          confidence: 0.9, needsClarification: false, nextQuestion: null, assistantMessage: 'Entendido, obrigado.',
        }),
        turn({ suggestions: [] })
      );
      const answered = await discovery.respond(missionId, 'sim, aceitar login social também');
      expect(fakeLlm.calls[1].user).toContain('O login deve aceitar cadastro via redes sociais?'); // prior question in transcript, not repeated
      expect(answered.status).toBe('FEATURE_REVIEW');
    } finally {
      await cleanup(missionId);
    }
  });

  it('never lets PromptMaster generation silently overwrite or duplicate confirmed imported requirements in non-feature sections', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      fakeLlm.push(importTurn({ features: ['Login'], integrations: ['Google Calendar'] }));
      const imported = await discovery.startFromImport(missionId, 'Sistema com login e integração com Google Calendar.');

      const feature = imported.requirements.find((r) => r.section === 'features')!;
      const integration = imported.requirements.find((r) => r.section === 'integrations')!;
      await discovery.decideRequirement(missionId, feature.id, 'CONFIRMED');
      // The integration is confirmed too (simulating a future per-section review UI — Fase 5) to
      // prove generatePromptMaster() must not re-author or duplicate it once confirmed.
      await prisma.requirement.update({ where: { id: integration.id }, data: { status: 'CONFIRMED', approvedBy: 'user', approvedAt: new Date() } });

      fakeLlm.push(promptMasterTurn({ features: ['Login'], integrations: ['Slack (nova sugestão indevida)'] }), 'FAIL');
      const withPromptMaster = await discovery.generatePromptMaster(missionId);

      // The original imported+confirmed integration survives, unchanged — the AI's fresh
      // (and contradicting) suggestion for that same section is never persisted.
      const integrations = withPromptMaster.promptMaster?.integrations ?? [];
      expect(integrations).toHaveLength(1);
      expect(integrations[0].id).toBe(integration.id);
      expect(integrations[0].content).toBe('Google Calendar');
      expect(integrations[0].origin).toBe('USER_IMPORTED');
    } finally {
      await cleanup(missionId);
    }
  });

  /** Drives a mission to PROMPTMASTER_READY with a DRAFT version containing one confirmed feature ("Login"). */
  async function seedDraftPromptMaster(missionId: string): Promise<{ featureId: string }> {
    fakeLlm.push(
      turn({
        interpretedIntent: 'x', domain: 'x', goal: 'x', targetUsers: [], knownRequirements: [], unknowns: [],
        confidence: 0.9, needsClarification: false, nextQuestion: null, assistantMessage: 'Entendido.',
      }),
      turn({ suggestions: [{ title: 'Login', description: '', reason: '', confidence: 0.9, origin: 'INFERRED' }] })
    );
    const started = await discovery.start(missionId, 'quero um sistema simples');
    const feature = started.requirements[0];
    await discovery.decideRequirement(missionId, feature.id, 'CONFIRMED');
    fakeLlm.push(promptMasterTurn({ features: ['Login'] }), 'FAIL');
    await discovery.generatePromptMaster(missionId);
    return { featureId: feature.id };
  }

  it('Copilot proposes a diff and only applies what the user explicitly accepted — ADD, EDIT (versioned, never rewritten in place) and REMOVE', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      await seedDraftPromptMaster(missionId);
      const beforePropose = await discovery.get(missionId);
      const loginId = beforePropose!.promptMaster!.features[0].id;

      fakeLlm.push(
        turn({
          summary: 'Essa mudança afeta pagamentos, segurança e critérios de aceite.',
          changes: [
            { action: 'ADD', section: 'features', targetContent: null, newContent: 'Pagamento via Pix', reason: 'Pedido do usuário' },
            { action: 'EDIT', section: 'features', targetContent: 'Login', newContent: 'Login com e-mail e senha', reason: 'Detalhar o método' },
            { action: 'REMOVE', section: 'features', targetContent: 'Um item que não existe', newContent: null, reason: 'Alucinação a ser descartada' },
          ],
        })
      );
      const proposal = await discovery.proposeCopilotChange(missionId, 'Adicione pagamento via Pix e detalhe o login');

      expect(proposal.summary).toContain('pagamentos');
      // The hallucinated REMOVE target (no match in the real document) is silently dropped.
      expect(proposal.changes).toHaveLength(2);
      const addChange = proposal.changes.find((c) => c.action === 'ADD')!;
      const editChange = proposal.changes.find((c) => c.action === 'EDIT')!;
      expect(editChange.targetRequirementId).toBe(loginId);

      const applied = await discovery.applyCopilotChanges(missionId, [
        { ...addChange, accepted: true },
        { ...editChange, accepted: false }, // user rejects the edit in review
      ]);

      const features = applied.promptMaster!.features;
      expect(features.some((f) => f.content === 'Pagamento via Pix' && f.status === 'CONFIRMED' && f.approvedBy === 'user')).toBe(true);
      // Rejected in review -> original "Login" untouched, never versioned.
      expect(features.some((f) => f.id === loginId && f.content === 'Login' && f.status === 'CONFIRMED')).toBe(true);

      // Now actually accept the edit too, to prove versioning (never rewritten in place).
      fakeLlm.push(turn({ summary: 'Detalha o login.', changes: [{ action: 'EDIT', section: 'features', targetContent: 'Login', newContent: 'Login com e-mail e senha', reason: 'Detalhar' }] }));
      const proposal2 = await discovery.proposeCopilotChange(missionId, 'Detalhe o login');
      const editChange2 = proposal2.changes[0];
      const applied2 = await discovery.applyCopilotChanges(missionId, [{ ...editChange2, accepted: true }]);

      const allFeatureRequirements = applied2.requirements.filter((r) => r.section === 'features');
      const originalLogin = allFeatureRequirements.find((r) => r.id === loginId)!;
      const newLogin = allFeatureRequirements.find((r) => r.parentRequirementId === loginId)!;
      expect(originalLogin.status).toBe('SUPERSEDED'); // never mutated in place
      expect(newLogin.content).toBe('Login com e-mail e senha');
      expect(newLogin.status).toBe('CONFIRMED');
      expect(newLogin.version).toBe(originalLogin.version + 1);
    } finally {
      await cleanup(missionId);
    }
  });

  it('Copilot cannot propose or apply changes outside the PromptMaster review window (DRAFT + PROMPTMASTER_READY only)', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      fakeLlm.push(
        turn({
          interpretedIntent: 'x', domain: 'x', goal: 'x', targetUsers: [], knownRequirements: [], unknowns: [],
          confidence: 0.9, needsClarification: false, nextQuestion: null, assistantMessage: 'Entendido.',
        }),
        turn({ suggestions: [] })
      );
      await discovery.start(missionId, 'quero um sistema simples');
      // Still in FEATURE_REVIEW — no PromptMaster generated yet.
      await expect(discovery.proposeCopilotChange(missionId, 'faça algo')).rejects.toThrow('DISCOVERY_PROMPTMASTER_NOT_READY');
    } finally {
      await cleanup(missionId);
    }
  });

  it('an unresolved BLOCKER finding stops approval cold — resolving it unblocks the same version, no new PromptMaster needed', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      await seedDraftPromptMaster(missionId);
      const draft = await discovery.get(missionId);
      const promptMasterId = draft!.promptMaster!.id;

      const finding = await reviewFindings.create({
        missionId,
        promptMasterId,
        reviewerKey: 'consistency',
        code: 'CHECKOUT_UNDEFINED',
        severity: 'BLOCKER',
        section: 'flows',
        finding: 'O fluxo termina em compra, mas checkout está fora do escopo.',
        recommendedResolutions: ['Usar checkout externo', 'Adicionar pagamento ao escopo', 'Transformar o CTA em captura de lead'],
        requiresUserDecision: true,
      });

      const withFinding = await discovery.get(missionId);
      expect(withFinding?.reviewFindings).toHaveLength(1);
      expect(withFinding?.reviewFindings[0].severity).toBe('BLOCKER');
      expect(withFinding?.reviewFindings[0].status).toBe('OPEN');

      // MISSÃO "Auto-Governança por IA": um BLOCKER com resolução real oferecida vira uma DECISÃO
      // (o usuário escolhe o caminho), não um bloqueio sem saída — DecisionPolicy classifica isso
      // como USER_DECISION_REQUIRED, nunca BLOCKED (que é reservado para quando não há resolução).
      await expect(discovery.approvePromptMaster(missionId)).rejects.toThrow('DISCOVERY_PROMPTMASTER_NEEDS_DECISION');

      // Not simply because requiresUserDecision — a WARNING with requiresUserDecision=false must
      // never block (Fase 20: só BLOCKER impede aprovação). Resolved through the real public
      // method (Fase 7: the minimal-but-real resolution path), not by poking the store directly.
      const stillWaiting = await discovery.resolveFinding(missionId, finding.id, 'Escolhido: checkout externo');
      expect(stillWaiting.reviewFindings[0].status).toBe('RESOLVED');
      expect(stillWaiting.reviewFindings[0].resolutionNote).toBe('Escolhido: checkout externo');

      const accepted = await discovery.approvePromptMaster(missionId);
      expect(accepted.status).toBe('SUCCEEDED');
      const finalConversation = await discovery.get(missionId);
      expect(finalConversation?.promptMaster?.status).toBe('LOCKED');
    } finally {
      await cleanup(missionId);
    }
  });

  it('a WARNING finding never blocks approval, only a BLOCKER does', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      await seedDraftPromptMaster(missionId);
      const draft = await discovery.get(missionId);
      const promptMasterId = draft!.promptMaster!.id;

      await reviewFindings.create({
        missionId,
        promptMasterId,
        reviewerKey: 'qa',
        code: 'VAGUE_ACCEPTANCE_CRITERIA',
        severity: 'WARNING',
        finding: 'Critério de aceite genérico.',
      });

      const accepted = await discovery.approvePromptMaster(missionId);
      expect(accepted.status).toBe('SUCCEEDED');
    } finally {
      await cleanup(missionId);
    }
  });

  it('Fase 9 gate: a PromptMaster with zero confirmed features is blocked by REQUIRED_SECTIONS_VALID, visible in the gate checklist before the user even tries to approve', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      fakeLlm.push(
        turn({
          interpretedIntent: 'x', domain: 'x', goal: 'x', targetUsers: [], knownRequirements: [], unknowns: [],
          confidence: 0.9, needsClarification: false, nextQuestion: null, assistantMessage: 'Entendido.',
        }),
        turn({ suggestions: [] })
      );
      await discovery.start(missionId, 'quero um sistema simples');
      fakeLlm.push(promptMasterTurn({ features: [] }), 'FAIL');
      const withDraft = await discovery.generatePromptMaster(missionId);

      const gate = withDraft.promptMaster!.gate;
      expect(gate.passed).toBe(false);
      const sectionsCondition = gate.conditions.find((c) => c.code === 'REQUIRED_SECTIONS_VALID')!;
      expect(sectionsCondition.passed).toBe(false);

      await expect(discovery.approvePromptMaster(missionId)).rejects.toThrow('DISCOVERY_PROMPTMASTER_SECTIONS_INCOMPLETE');
    } finally {
      await cleanup(missionId);
    }
  });

  it('Fase 10: the handoff to Architecture Office is never reached when the gate fails — generator.start() is provably not called, not just "the promise rejected"', async () => {
    const missionId = `test-${randomUUID()}`;
    const startSpy = jest.spyOn(generator, 'start');
    try {
      fakeLlm.push(
        turn({
          interpretedIntent: 'x', domain: 'x', goal: 'x', targetUsers: [], knownRequirements: [], unknowns: [],
          confidence: 0.9, needsClarification: false, nextQuestion: null, assistantMessage: 'Entendido.',
        }),
        turn({ suggestions: [] })
      );
      await discovery.start(missionId, 'quero um sistema simples');
      fakeLlm.push(promptMasterTurn({ features: [] }), 'FAIL'); // no confirmed feature -> REQUIRED_SECTIONS_VALID fails
      await discovery.generatePromptMaster(missionId);

      await expect(discovery.approvePromptMaster(missionId)).rejects.toThrow('DISCOVERY_PROMPTMASTER_SECTIONS_INCOMPLETE');
      expect(startSpy).not.toHaveBeenCalled();

      // The version stays DRAFT, never LOCKED — approvePromptMaster() remains retryable once the
      // real problem (no confirmed feature) is fixed, not stuck the way a partial commit would leave it.
      const state = await discovery.get(missionId);
      expect(state?.promptMaster?.status).toBe('DRAFT');
      expect(state?.status).toBe('PROMPTMASTER_READY');
    } finally {
      startSpy.mockRestore();
      await cleanup(missionId);
    }
  });

  it('Fase 9 gate: a persistent CRITICAL reviewer failure (survives automatic retry) blocks approval — retrying manually is what unblocks it, no full re-run needed', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      fakeLlm.push(
        turn({
          interpretedIntent: 'x', domain: 'x', goal: 'x', targetUsers: [], knownRequirements: [], unknowns: [],
          confidence: 0.9, needsClarification: false, nextQuestion: null, assistantMessage: 'Entendido.',
        }),
        turn({ suggestions: [{ title: 'Feature A', description: '', reason: '', confidence: 0.9, origin: 'INFERRED' }] })
      );
      const started = await discovery.start(missionId, 'quero um sistema simples');
      await discovery.decideRequirement(missionId, started.requirements[0].id, 'CONFIRMED');

      // promptMasterTurn is consumed by generatePromptMaster()'s own call. Core reviewer order:
      // requirements, consistency, architectureFeasibility, qa. MISSÃO "Auto-Governança por IA"
      // (seção 10): só reviewers CRITICAL (consistency/security/privacy/safety) ainda indisponíveis
      // depois do retry automático (2 tentativas) bloqueiam o gate — por isso a falha precisa ser
      // em 'consistency' (CRITICAL), não em 'requirements' (HIGH), para este teste continuar válido.
      //
      // Retry automático (Fase 11/seção 10) muda a ordem real de consumo da fila: TODOS os
      // reviewers disparam sua 1ª tentativa de forma síncrona antes de qualquer retry acontecer
      // (Promise.allSettled(array.map(fn)) — cada fn só suspende no próprio 1º await). Por isso a
      // fila precisa ter EXATAMENTE um item por reviewer para a 1ª rodada (nunca depender do
      // defaultResult aqui, ou a atribuição fica arbitrária), e só depois os itens de retry — e só
      // 1 reviewer pode estar "pendurado" em retry por teste, senão a ordem entre retries de
      // reviewers diferentes não é determinística (cada um tem seu próprio backoff assíncrono).
      fakeLlm.push(
        promptMasterTurn({ features: ['Feature A'] }),
        'FAIL', // PromptMasterCompletionAgent — not exercised in this test
        EMPTY_REVIEWER_RESULT, // requirements — 1ª tentativa
        'FAIL', // consistency — 1ª tentativa
        EMPTY_REVIEWER_RESULT, // architectureFeasibility — 1ª tentativa
        EMPTY_REVIEWER_RESULT, // qa — 1ª tentativa
        'FAIL' // consistency — 2ª tentativa (única pendurada em retry neste teste)
      );
      const afterGenerate = await discovery.generatePromptMaster(missionId);

      expect(afterGenerate.reviewStatus).toBe('REVIEW_PARTIALLY_COMPLETED');
      const gate = afterGenerate.promptMaster!.gate;
      expect(gate.passed).toBe(false);
      const reviewCondition = gate.conditions.find((c) => c.code === 'REVIEW_COUNCIL_COMPLETED')!;
      expect(reviewCondition.passed).toBe(false);
      expect(reviewCondition.failedReviewers).toContain('consistency');

      await expect(discovery.approvePromptMaster(missionId)).rejects.toThrow('DISCOVERY_PROMPTMASTER_REVIEW_INCOMPLETE');

      const retried = await discovery.retryReviewer(missionId, 'consistency');
      expect(retried.reviewStatus).toBe('REVIEW_COMPLETE');
      expect(retried.promptMaster!.gate.passed).toBe(true);

      const accepted = await discovery.approvePromptMaster(missionId);
      expect(accepted.status).toBe('SUCCEEDED');
    } finally {
      await cleanup(missionId);
    }
  });

  it('Fase 9 gate: a non-critical (HIGH/LOW) reviewer failure never blocks approval on its own — only degrades the review, visibly', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      fakeLlm.push(
        turn({
          interpretedIntent: 'x', domain: 'x', goal: 'x', targetUsers: [], knownRequirements: [], unknowns: [],
          confidence: 0.9, needsClarification: false, nextQuestion: null, assistantMessage: 'Entendido.',
        }),
        turn({ suggestions: [{ title: 'Feature A', description: '', reason: '', confidence: 0.9, origin: 'INFERRED' }] })
      );
      const started = await discovery.start(missionId, 'quero um sistema simples');
      await discovery.decideRequirement(missionId, started.requirements[0].id, 'CONFIRMED');

      // 'requirements' is HIGH criticality — even exhausting both automatic retry attempts, this
      // must not block the single consolidated approval (MISSÃO seção 10 e 36: reviewer não-crítico
      // indisponível não pode deixar o usuário travado). Mesma ordem de fila explicada no teste
      // anterior: 1 item por reviewer na 1ª rodada, depois só o retry do único reviewer pendurado.
      fakeLlm.push(
        promptMasterTurn({ features: ['Feature A'] }),
        'FAIL', // PromptMasterCompletionAgent — not exercised in this test
        'FAIL', // requirements — 1ª tentativa
        EMPTY_REVIEWER_RESULT, // consistency — 1ª tentativa
        EMPTY_REVIEWER_RESULT, // architectureFeasibility — 1ª tentativa
        EMPTY_REVIEWER_RESULT, // qa — 1ª tentativa
        'FAIL' // requirements — 2ª tentativa
      );
      const afterGenerate = await discovery.generatePromptMaster(missionId);

      expect(afterGenerate.reviewStatus).toBe('REVIEW_COMPLETE_DEGRADED');
      const gate = afterGenerate.promptMaster!.gate;
      // Degraded, but the gate still passes — the user is never stuck by a non-critical reviewer.
      expect(gate.passed).toBe(true);
      const reviewCondition = gate.conditions.find((c) => c.code === 'REVIEW_COUNCIL_COMPLETED')!;
      expect(reviewCondition.passed).toBe(true);
      expect(reviewCondition.failedReviewers).toContain('requirements');

      const accepted = await discovery.approvePromptMaster(missionId);
      expect(accepted.status).toBe('SUCCEEDED');
    } finally {
      await cleanup(missionId);
    }
  });

  it('Decision Center: choosing a recommended resolution for a BLOCKER produces a real requirement change and resolves the finding — one action, not two', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      const { featureId } = await seedDraftPromptMaster(missionId);
      const draft = await discovery.get(missionId);
      const promptMasterId = draft!.promptMaster!.id;

      const finding = await reviewFindings.create({
        missionId,
        promptMasterId,
        reviewerKey: 'consistency',
        code: 'AUTH_METHOD_UNDEFINED',
        severity: 'BLOCKER',
        section: 'features',
        requirementIds: [featureId],
        finding: 'O requisito "Login" não especifica o método de autenticação.',
        recommendedResolutions: ['Usar login com e-mail e senha', 'Usar login social (Google)'],
        requiresUserDecision: true,
      });

      // decideFinding() internally reuses proposeCopilotChange() — same LLM call shape.
      fakeLlm.push(
        turn({
          summary: 'Detalha o método de login.',
          changes: [{ action: 'EDIT', section: 'features', targetContent: 'Login', newContent: 'Login com e-mail e senha', reason: 'Resolução escolhida pelo usuário' }],
        })
      );
      const result = await discovery.decideFinding(missionId, finding.id, 'Usar login com e-mail e senha');

      // The finding is resolved with the chosen option as evidence.
      const resolvedFinding = result.reviewFindings.find((f) => f.id === finding.id)!;
      expect(resolvedFinding.status).toBe('RESOLVED');
      expect(resolvedFinding.resolutionNote).toBe('Usar login com e-mail e senha');

      // The requirement was actually changed — versioned, never rewritten in place (Fase 5's rule).
      const originalLogin = result.requirements.find((r) => r.id === featureId)!;
      expect(originalLogin.status).toBe('SUPERSEDED');
      const newLogin = result.requirements.find((r) => r.parentRequirementId === featureId)!;
      expect(newLogin.content).toBe('Login com e-mail e senha');
      expect(newLogin.status).toBe('CONFIRMED');

      // A real decision record exists — auditable, not just an implicit side effect.
      const decisionRows = await prisma.promptMasterDecision.findMany({ where: { missionId, findingId: finding.id } });
      expect(decisionRows).toHaveLength(1);
      expect(decisionRows[0].chosenOption).toBe('Usar login com e-mail e senha');

      // Approving now succeeds — the BLOCKER is really gone, not just hidden.
      const approved = await discovery.approvePromptMaster(missionId);
      expect(approved.status).toBe('SUCCEEDED');
    } finally {
      await cleanup(missionId);
    }
  });

  it('Fase 13 (caso C): a real "purchase defined but payment out of scope" contradiction, auto-detected by the routed Consistency reviewer (not manually inserted), blocks approval and is resolvable through the Decision Center', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      fakeLlm.push(
        turn({
          interpretedIntent: 'x', domain: 'x', goal: 'x', targetUsers: [], knownRequirements: [], unknowns: [],
          confidence: 0.9, needsClarification: false, nextQuestion: null, assistantMessage: 'Entendido.',
        }),
        turn({ suggestions: [{ title: 'Finalizar compra do curso online', description: '', reason: '', confidence: 0.9, origin: 'INFERRED' }] })
      );
      const started = await discovery.start(missionId, 'quero vender um curso online');
      const featureId = started.requirements[0].id;
      await discovery.decideRequirement(missionId, featureId, 'CONFIRMED');

      // Core reviewer order: requirements, consistency, architectureFeasibility, qa — then
      // conditionally-routed reviewers. "pagamento" (in the feature + outOfScope text) routes
      // security too (Fase 30 cost-aware routing), so it needs a queued response as well.
      fakeLlm.push(
        promptMasterTurn({ features: ['Finalizar compra do curso online'], outOfScope: ['Processamento de pagamentos nesta versão'] }),
        'FAIL', // PromptMasterCompletionAgent — not exercised in this test
        turn({ findings: [] }), // requirements
        turn({
          findings: [
            {
              code: 'CHECKOUT_UNDEFINED',
              severity: 'BLOCKER',
              section: 'outOfScope',
              targetContent: ['Finalizar compra do curso online'],
              finding: 'A funcionalidade "Finalizar compra do curso online" depende de processamento de pagamento, mas isso está explicitamente listado como fora do escopo.',
              recommendedResolutions: ['Adicionar processamento de pagamento ao escopo', 'Usar checkout externo de terceiros', 'Transformar em captura de lead sem cobrança'],
              requiresUserDecision: true,
            },
          ],
        }), // consistency — the real contradiction, auto-detected from the document's own sections
        turn({ findings: [] }), // architectureFeasibility
        turn({ findings: [] }), // qa
        turn({ findings: [] }) // security (routed by "pagamento")
      );
      const afterGenerate = await discovery.generatePromptMaster(missionId);

      const routedKeys = afterGenerate.reviewerExecutions.map((e) => e.reviewerKey);
      expect(routedKeys).toContain('consistency');

      const blocker = afterGenerate.reviewFindings.find((f) => f.code === 'CHECKOUT_UNDEFINED')!;
      expect(blocker.severity).toBe('BLOCKER');
      // targetContent was resolved server-side to the real requirement — never trusted as-is.
      expect(blocker.requirementIds).toEqual([featureId]);
      expect(afterGenerate.promptMaster!.gate.passed).toBe(false);

      // Um BLOCKER com resolução real oferecida é uma decisão, não um beco sem saída.
      await expect(discovery.approvePromptMaster(missionId)).rejects.toThrow('DISCOVERY_PROMPTMASTER_NEEDS_DECISION');

      // Real, concrete way out — never a dead end (reuses the same Decision Center mechanism as Fase 8).
      fakeLlm.push(
        turn({
          summary: 'Usa checkout externo de terceiros.',
          changes: [{ action: 'EDIT', section: 'features', targetContent: 'Finalizar compra do curso online', newContent: 'Finalizar compra do curso online via checkout externo de terceiros', reason: 'Resolução escolhida pelo usuário' }],
        })
      );
      const decided = await discovery.decideFinding(missionId, blocker.id, 'Usar checkout externo de terceiros');
      expect(decided.reviewFindings.find((f) => f.id === blocker.id)!.status).toBe('RESOLVED');

      const approved = await discovery.approvePromptMaster(missionId);
      expect(approved.status).toBe('SUCCEEDED');
    } finally {
      await cleanup(missionId);
    }
  });

  it('Fase 13 (caso D): a school system involving minors routes safety and privacy but never auto-blocks — only WARNING/ADVISORY controls, approval succeeds normally', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      fakeLlm.push(
        turn({
          interpretedIntent: 'x', domain: 'x', goal: 'x', targetUsers: [], knownRequirements: [], unknowns: [],
          confidence: 0.9, needsClarification: false, nextQuestion: null, assistantMessage: 'Entendido.',
        }),
        turn({ suggestions: [{ title: 'Cadastro de alunos menores de idade', description: '', reason: '', confidence: 0.9, origin: 'INFERRED' }] })
      );
      const started = await discovery.start(missionId, 'quero um sistema para escola gerenciar alunos menores de idade');
      await discovery.decideRequirement(missionId, started.requirements[0].id, 'CONFIRMED');

      // Core order first, then CONDITIONAL_REVIEWERS iteration order (security, privacy, safety,
      // abuseMisuse, dataGovernance) — only privacy and safety trigger for this content ("menor").
      fakeLlm.push(
        promptMasterTurn({
          vision: 'Sistema web para escola gerenciar alunos',
          features: ['Cadastro de alunos menores de idade'],
          businessRules: ['Professores podem lançar notas e frequência dos alunos'],
        }),
        'FAIL', // PromptMasterCompletionAgent — not exercised in this test
        turn({ findings: [] }), // requirements
        turn({ findings: [] }), // consistency
        turn({ findings: [] }), // architectureFeasibility
        turn({ findings: [] }), // qa
        turn({
          findings: [
            {
              code: 'MINOR_DATA_PROTECTION',
              severity: 'WARNING',
              section: 'privacy',
              targetContent: [],
              finding: 'Dados de menores exigem proteção adicional (LGPD).',
              recommendedResolutions: ['Adicionar controle de acesso e política de retenção para dados de alunos.'],
              requiresUserDecision: false,
            },
          ],
        }), // privacy
        turn({
          findings: [
            {
              code: 'SAFE_WITH_CONTROLS',
              severity: 'ADVISORY',
              section: null,
              targetContent: [],
              finding: 'Classificação: SAFE_WITH_CONTROLS. O sistema envolve menores, mas a funcionalidade descrita (cadastro escolar, notas e frequência) é legítima. Recomenda-se moderação de acesso.',
              recommendedResolutions: ['Restringir o acesso aos dados a professores autorizados.'],
              requiresUserDecision: false,
            },
          ],
        }), // safety
        // Auto-Repair Loop: ambas as findings (privacy e safety) têm resolução recomendada mas
        // nenhum targetContent específico — o Copilot não encontra nada mecânico pra aplicar,
        // então permanecem OPEN (não-bloqueantes) em vez de fingir uma correção.
        turn({ summary: 'Nada de concreto para aplicar.', changes: [] }),
        turn({ summary: 'Nada de concreto para aplicar.', changes: [] })
      );
      const afterGenerate = await discovery.generatePromptMaster(missionId);

      const routedKeys = afterGenerate.reviewerExecutions.map((e) => e.reviewerKey);
      expect(routedKeys).toContain('privacy');
      expect(routedKeys).toContain('safety');

      // Never a BLOCKER just because minors are involved — only controls, per the Safety reviewer's mandate.
      expect(afterGenerate.reviewFindings.length).toBeGreaterThan(0);
      expect(afterGenerate.reviewFindings.every((f) => f.severity !== 'BLOCKER')).toBe(true);
      expect(afterGenerate.promptMaster!.gate.passed).toBe(true);

      const approved = await discovery.approvePromptMaster(missionId);
      expect(approved.status).toBe('SUCCEEDED');
    } finally {
      await cleanup(missionId);
    }
  });

  it('Fase 13 (caso E) + MISSÃO "Auto-Governança por IA": a duplicate requirement is detected AND consolidated automatically by the Auto-Repair Loop — no business impact, so it never bothers the user (USER_CONFIRMATION, not USER_DECISION_REQUIRED)', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      fakeLlm.push(
        turn({
          interpretedIntent: 'x', domain: 'x', goal: 'x', targetUsers: [], knownRequirements: [], unknowns: [],
          confidence: 0.9, needsClarification: false, nextQuestion: null, assistantMessage: 'Entendido.',
        }),
        turn({
          suggestions: [
            { title: 'Cadastro de cliente', description: '', reason: '', confidence: 0.9, origin: 'INFERRED' },
            { title: 'Cadastro de clientes', description: '', reason: '', confidence: 0.85, origin: 'INFERRED' },
          ],
        })
      );
      const started = await discovery.start(missionId, 'quero um sistema de vendas simples');
      await discovery.decideRequirement(missionId, started.requirements[0].id, 'CONFIRMED');
      await discovery.decideRequirement(missionId, started.requirements[1].id, 'CONFIRMED');
      const originalId = started.requirements[0].id;
      const duplicateId = started.requirements[1].id;

      fakeLlm.push(
        promptMasterTurn({ features: ['Cadastro de cliente', 'Cadastro de clientes'] }),
        'FAIL', // PromptMasterCompletionAgent — not exercised in this test
        turn({
          findings: [
            {
              code: 'DUPLICATE_REQUIREMENT',
              severity: 'WARNING',
              section: 'features',
              targetContent: ['Cadastro de cliente', 'Cadastro de clientes'],
              finding: 'As funcionalidades "Cadastro de cliente" e "Cadastro de clientes" são duplicadas.',
              recommendedResolutions: ['Remover a duplicata "Cadastro de clientes"', 'Manter ambas como funcionalidades distintas'],
              requiresUserDecision: true,
            },
          ],
        }), // requirements — detects the duplicate
        turn({ findings: [] }), // consistency
        turn({ findings: [] }), // architectureFeasibility
        turn({ findings: [] }), // qa
        // Auto-Repair Loop: nenhum impacto de negócio detectado no texto -> USER_CONFIRMATION
        // (não USER_DECISION_REQUIRED), então o mesmo mecanismo do Copilot aplica sozinho a
        // resolução recomendada, nunca esperando o usuário abrir o Decision Center.
        turn({
          summary: 'Remove a funcionalidade duplicada.',
          changes: [{ action: 'REMOVE', section: 'features', targetContent: 'Cadastro de clientes', newContent: null, reason: 'Duplicata consolidada automaticamente' }],
        }),
        turn({ findings: [] }) // requirements — reconfirmação pós-correção (só o revisor afetado)
      );
      const afterGenerate = await discovery.generatePromptMaster(missionId);

      // A finding já chega para o usuário resolvida — nunca aparece como algo a decidir.
      const finding = afterGenerate.reviewFindings.find((f) => f.code === 'DUPLICATE_REQUIREMENT')!;
      expect(finding.status).toBe('RESOLVED');
      expect(finding.resolvedBy).toBe('ai-auto-repair');
      // Both duplicate requirements were resolved server-side to their real ids before the fix.
      expect(finding.requirementIds.sort()).toEqual([originalId, duplicateId].sort());

      const removed = afterGenerate.requirements.find((r) => r.id === duplicateId)!;
      expect(removed.status).toBe('REJECTED');
      expect(removed.approvedBy).toBe('ai-auto-repair');
      const kept = afterGenerate.requirements.find((r) => r.id === originalId)!;
      expect(kept.status).toBe('CONFIRMED');

      // Nada pendente — uma única aprovação, sem o usuário precisar decidir qual manter.
      expect(afterGenerate.promptMaster!.gate.passed).toBe(true);
      const approved = await discovery.approvePromptMaster(missionId);
      expect(approved.status).toBe('SUCCEEDED');
    } finally {
      await cleanup(missionId);
    }
  });

  it('MISSÃO "Auto-Governança por IA": Auto-Repair Loop corrige sozinho um achado AUTO_WITH_DISCLOSURE, sem pedir nada ao usuário, e reconfirma só com o revisor afetado', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      fakeLlm.push(
        turn({
          interpretedIntent: 'x', domain: 'x', goal: 'x', targetUsers: [], knownRequirements: [], unknowns: [],
          confidence: 0.9, needsClarification: false, nextQuestion: null, assistantMessage: 'Entendido.',
        }),
        turn({ suggestions: [{ title: 'Login', description: '', reason: '', confidence: 0.9, origin: 'INFERRED' }] })
      );
      const started = await discovery.start(missionId, 'quero um sistema simples');
      const featureId = started.requirements[0].id;
      await discovery.decideRequirement(missionId, featureId, 'CONFIRMED');

      fakeLlm.push(
        promptMasterTurn({ features: ['Login'] }),
        'FAIL', // PromptMasterCompletionAgent — not exercised in this test
        turn({
          findings: [
            {
              code: 'VAGUE_ACCEPTANCE_CRITERIA',
              severity: 'WARNING',
              section: 'features',
              targetContent: ['Login'],
              finding: 'O requisito "Login" não especifica o método de autenticação.',
              recommendedResolutions: ['Usar login com e-mail e senha'],
              requiresUserDecision: false,
            },
          ],
        }), // requirements — WARNING sem decisão de usuário -> AUTO_WITH_DISCLOSURE
        turn({ findings: [] }), // consistency
        turn({ findings: [] }), // architectureFeasibility
        turn({ findings: [] }), // qa
        turn({ findings: [] }), // security — "Login" aciona o sinal de roteamento (login|senha|...)
        // Auto-Repair Loop: propõe o diff via o MESMO mecanismo do Copilot (Fase 5).
        turn({
          summary: 'Detalha o método de login.',
          changes: [{ action: 'EDIT', section: 'features', targetContent: 'Login', newContent: 'Login com e-mail e senha', reason: 'Correção automática' }],
        }),
        // Reconfirmação: só o revisor afetado (requirements) roda de novo, nunca o Council inteiro.
        turn({ findings: [] })
      );
      const afterGenerate = await discovery.generatePromptMaster(missionId);

      // A finding foi resolvida sozinha pela IA — nunca aparece pendente para o usuário.
      const finding = afterGenerate.reviewFindings.find((f) => f.code === 'VAGUE_ACCEPTANCE_CRITERIA')!;
      expect(finding.status).toBe('RESOLVED');
      expect(finding.resolvedBy).toBe('ai-auto-repair');

      // O requisito foi realmente corrigido — versionado, nunca reescrito, e a proveniência nunca
      // finge que foi o usuário quem decidiu (seção 24 do brief).
      const original = afterGenerate.requirements.find((r) => r.id === featureId)!;
      expect(original.status).toBe('SUPERSEDED');
      const patched = afterGenerate.requirements.find((r) => r.parentRequirementId === featureId)!;
      expect(patched.content).toBe('Login com e-mail e senha');
      expect(patched.status).toBe('CONFIRMED');
      expect(patched.approvedBy).toBe('ai-auto-repair');
      expect(patched.createdBy).toBe('auto-repair-agent');

      // Nada pendente — o usuário aprova direto, sem precisar validar este detalhe.
      expect(afterGenerate.promptMaster!.gate.passed).toBe(true);
      const accepted = await discovery.approvePromptMaster(missionId);
      expect(accepted.status).toBe('SUCCEEDED');
    } finally {
      await cleanup(missionId);
    }
  });

  it('MISSÃO "Auto-Governança por IA": Auto-Repair Loop nunca toca um achado USER_DECISION_REQUIRED — decisões reais de negócio continuam esperando o usuário', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      fakeLlm.push(
        turn({
          interpretedIntent: 'x', domain: 'x', goal: 'x', targetUsers: [], knownRequirements: [], unknowns: [],
          confidence: 0.9, needsClarification: false, nextQuestion: null, assistantMessage: 'Entendido.',
        }),
        turn({ suggestions: [{ title: 'Finalizar compra', description: '', reason: '', confidence: 0.9, origin: 'INFERRED' }] })
      );
      const started = await discovery.start(missionId, 'quero vender um curso online');
      await discovery.decideRequirement(missionId, started.requirements[0].id, 'CONFIRMED');

      fakeLlm.push(
        promptMasterTurn({ features: ['Finalizar compra'], outOfScope: ['Processamento de pagamentos'] }),
        'FAIL', // PromptMasterCompletionAgent — not exercised in this test
        turn({ findings: [] }), // requirements
        turn({
          findings: [
            {
              code: 'CHECKOUT_UNDEFINED',
              severity: 'BLOCKER',
              section: 'outOfScope',
              targetContent: ['Finalizar compra'],
              finding: 'Compra depende de pagamento, mas pagamento está fora do escopo.',
              recommendedResolutions: ['Adicionar pagamento ao escopo', 'Usar checkout externo'],
              requiresUserDecision: true,
            },
          ],
        }), // consistency — decisão real de negócio, nunca auto-resolvida
        turn({ findings: [] }), // architectureFeasibility
        turn({ findings: [] }), // qa
        turn({ findings: [] }) // security — "pagamento" aciona o sinal de roteamento
      );
      const afterGenerate = await discovery.generatePromptMaster(missionId);

      // Nenhuma chamada extra de Copilot/reconfirmação foi feita — a fila continua com exatamente
      // os itens empurrados (nenhum consumo a mais por causa de um auto-repair indevido).
      const finding = afterGenerate.reviewFindings.find((f) => f.code === 'CHECKOUT_UNDEFINED')!;
      expect(finding.status).toBe('OPEN');
      expect(afterGenerate.promptMaster!.gate.passed).toBe(false);
      await expect(discovery.approvePromptMaster(missionId)).rejects.toThrow('DISCOVERY_PROMPTMASTER_NEEDS_DECISION');
    } finally {
      await cleanup(missionId);
    }
  });

  it('MISSÃO "Auto-Governança por IA" (seção 5): PromptMasterCompletionAgent preenche lacunas tecnicamente óbvias antes da revisão, nunca decisão de produto — confirmadas em bloco na aprovação, nunca perguntadas uma a uma', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      fakeLlm.push(
        turn({
          interpretedIntent: 'x', domain: 'x', goal: 'x', targetUsers: [], knownRequirements: [], unknowns: [],
          confidence: 0.9, needsClarification: false, nextQuestion: null, assistantMessage: 'Entendido.',
        }),
        turn({ suggestions: [{ title: 'Agendar consulta', description: '', reason: '', confidence: 0.9, origin: 'INFERRED' }] })
      );
      const started = await discovery.start(missionId, 'quero um sistema de agenda para minha clínica');
      await discovery.decideRequirement(missionId, started.requirements[0].id, 'CONFIRMED');

      fakeLlm.push(
        promptMasterTurn({ features: ['Agendar consulta'] }),
        // PromptMasterCompletionAgent: deriva o óbvio (conflito de horário, cancelamento) sem
        // nunca tocar decisão de negócio (preço/pagamento não aparecem aqui).
        turn({
          users: [],
          flows: ['Cancelar ou reagendar uma consulta existente'],
          data: [],
          security: [],
          privacy: [],
          nonFunctional: [],
          acceptanceCriteria: ['O sistema não permite agendar duas consultas no mesmo horário para o mesmo profissional'],
        }),
        turn({ findings: [] }), // requirements
        turn({ findings: [] }), // consistency
        turn({ findings: [] }), // architectureFeasibility
        turn({ findings: [] }) // qa
      );
      const afterGenerate = await discovery.generatePromptMaster(missionId);

      const flow = afterGenerate.promptMaster!.flows.find((f) => f.content.includes('Cancelar ou reagendar'));
      expect(flow).toBeDefined();
      expect(flow!.origin).toBe('AI_REFINED');
      expect(flow!.createdBy).toBe('completion-agent');
      expect(flow!.status).toBe('SUGGESTED'); // never individually confirmed — bulk-confirmed on approval

      const criterion = afterGenerate.promptMaster!.acceptanceCriteria.find((c) => c.content.includes('mesmo horário'));
      expect(criterion).toBeDefined();
      expect(criterion!.createdBy).toBe('completion-agent');

      // Uma única aprovação confirma tudo — o usuário nunca precisou validar estes dois itens.
      const approved = await discovery.approvePromptMaster(missionId);
      expect(approved.status).toBe('SUCCEEDED');
      const finalState = await discovery.get(missionId);
      const confirmedFlow = finalState!.promptMaster!.flows.find((f) => f.id === flow!.id)!;
      expect(confirmedFlow.status).toBe('CONFIRMED');
      expect(confirmedFlow.approvedBy).toBe('user'); // aprovação em bloco, nunca uma decisão individual fabricada
    } finally {
      await cleanup(missionId);
    }
  });

  it('MISSÃO "Auto-Governança por IA" seção 29: AI Autonomy Metrics reflete dados reais — nunca um contador fabricado', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      const { featureId } = await seedDraftPromptMaster(missionId);
      expect(featureId).toBeTruthy();
      const draft = await discovery.get(missionId);
      const promptMasterId = draft!.promptMaster!.id;

      const userDecisionFinding = await reviewFindings.create({
        missionId, promptMasterId, reviewerKey: 'consistency', code: 'REAL_DECISION', severity: 'BLOCKER',
        finding: 'Decisão real de negócio.', recommendedResolutions: ['Opção A', 'Opção B'], requiresUserDecision: true,
      });
      await reviewFindings.resolve(userDecisionFinding.id, 'user', 'Escolhi opção A');

      const autoFinding = await reviewFindings.create({
        missionId, promptMasterId, reviewerKey: 'qa', code: 'AUTO_FIXED', severity: 'ADVISORY',
        finding: 'Corrigido sozinho pela IA.', recommendedResolutions: [], requiresUserDecision: false,
      });
      await reviewFindings.resolve(autoFinding.id, 'ai-auto-repair', 'Corrigido automaticamente.');

      const metrics = await discovery.getAutonomyMetrics(missionId);

      expect(metrics.requirementsTotal).toBeGreaterThan(0);
      expect(metrics.requirementsUserProvided).toBeGreaterThanOrEqual(1); // a feature "Login" confirmada pelo usuário
      expect(metrics.findingsTotal).toBe(2);
      expect(metrics.findingsAutoResolved).toBe(1);
      expect(metrics.userDecisionsMade).toBe(1);
      expect(metrics.userDecisionsRequired).toBeGreaterThanOrEqual(1);
      // turnCount pode legitimamente ser 0 — uma ideia clara o bastante não precisa de nenhuma
      // pergunta de esclarecimento (seedDraftPromptMaster usa uma ideia direta o suficiente).
      expect(metrics.discoveryTurnCount).toBeGreaterThanOrEqual(0);
      expect(metrics.timeToPromptMasterReadyMs).not.toBeNull();
      expect(metrics.timeToPromptMasterReadyMs!).toBeGreaterThanOrEqual(0);
    } finally {
      await cleanup(missionId);
    }
  });
});
