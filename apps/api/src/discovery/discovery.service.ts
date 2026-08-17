import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../persistence/prisma.service';
import { GeneratorService, StartMissionAccepted } from '../generator/generator.service';
import { LLM_CLIENT, LlmClient } from '../assistant/deepseek-client';
import { LlmInvocationLedgerService } from '../ledger/llm-invocation-ledger.service';
import { ReviewFindingService, ReviewFindingDto } from '../review/review-finding.service';
import { ReviewCouncilService, ReviewerExecutionDto, ReviewerKey } from '../review/review-council.service';
import { PromptMasterDecisionPolicy, DecisionPolicyOutcome } from '../review/decision-policy.service';
import { PromptMasterEditingService, CopilotChangeDto, CopilotProposalDto, CopilotChangeAction } from '../review/prompt-master-editing.service';
import { ArchitectureReviewService } from '../architecture-review/architecture-review.service';
import { DeliveryTargetKind } from 'ldcn-core';

export { CopilotChangeDto, CopilotProposalDto, CopilotChangeAction };

const MAX_CLARIFICATION_TURNS = 6;

// Defense in depth (Fase 6, mesmo espírito do MAX_CLARIFICATION_TURNS): o prompt já instrui o
// modelo a respeitar um pedido explícito do usuário para prosseguir, mas isso não pode depender
// só da IA obedecer — um usuário real que diz "pode prosseguir" duas vezes seguidas e ainda
// recebe a mesma pergunta reformulada é exatamente o tipo de interrogatório que a missão pede pra
// evitar. Detectado aqui, needsClarification é forçado para false independente da resposta do LLM.
const PROCEED_SIGNAL_PATTERNS = [
  /\bpode (prosseguir|seguir|continuar)\b/,
  /\b(prossiga|prossegue)\b/,
  /\bvai(?:\s+em)? frente\b/,
  /\bsiga em frente\b/,
  /\bcontinue assim\b/,
  /\b(pula|pule|pular) (essa|isso|essa parte)\b/,
  /\bdecide (você|voce)\b/,
  /\bfica a seu crit[ée]rio\b/,
  /\bdo jeito que (você |voce )?achar melhor\b/,
  /\bcomo (você |voce )?achar melhor\b/,
  /\bn[ãa]o sei,? (decide|prossiga|pode prosseguir)\b/,
];

function hasProceedSignal(text: string): boolean {
  const normalized = text.toLowerCase();
  return PROCEED_SIGNAL_PATTERNS.some((pattern) => pattern.test(normalized));
}

export interface DiscoveryAdvancedInput {
  technologyPreferences?: string[];
  forbiddenDeliveryTargets?: DeliveryTargetKind[];
  constraints?: string[];
}

export interface DiscoveryMessageDto {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export type RequirementOrigin = 'USER' | 'USER_IMPORTED' | 'AI_SUGGESTED' | 'AI_REFINED' | 'ARCHITECTURE_DERIVED';
export type RequirementStatus = 'DRAFT' | 'SUGGESTED' | 'CONFIRMED' | 'REJECTED' | 'SUPERSEDED';

/** Fase 8 da governança do PromptMaster: identidade própria por requirement, nunca "APPROVED" sem uma aprovação real correspondente. */
export interface RequirementDto {
  id: string;
  section: string;
  content: string;
  origin: RequirementOrigin;
  confidence: number | null;
  status: RequirementStatus;
  createdBy: string;
  createdAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
  version: number;
  parentRequirementId: string | null;
  evidence: string | null;
  reasoningSummary: string | null;
  promptMasterId: string | null;
}

/** Fase 9: cada condição do gate mapeia para um domain-error code distinto — o usuário sempre vê
 * exatamente qual condição falhou primeiro, nunca um "não foi possível aprovar" genérico. */
const GATE_CONDITION_ERROR_CODES: Record<ValidationGateConditionCode, string> = {
  NO_UNRESOLVED_BLOCKERS: 'DISCOVERY_PROMPTMASTER_HAS_BLOCKERS',
  NO_PENDING_USER_DECISIONS: 'DISCOVERY_PROMPTMASTER_NEEDS_DECISION',
  REQUIRED_SECTIONS_VALID: 'DISCOVERY_PROMPTMASTER_SECTIONS_INCOMPLETE',
  REVIEW_COUNCIL_COMPLETED: 'DISCOVERY_PROMPTMASTER_REVIEW_INCOMPLETE',
};

const REQUIREMENT_SECTIONS = [
  'users', 'features', 'businessRules', 'flows', 'data', 'integrations',
  'security', 'privacy', 'nonFunctional', 'acceptanceCriteria', 'outOfScope',
] as const;
export type RequirementSection = (typeof REQUIREMENT_SECTIONS)[number];

export interface PromptMasterDto {
  id: string;
  version: number;
  vision: string;
  objective: string;
  targetAudience: string;
  users: RequirementDto[];
  features: RequirementDto[];
  businessRules: RequirementDto[];
  flows: RequirementDto[];
  data: RequirementDto[];
  integrations: RequirementDto[];
  security: RequirementDto[];
  privacy: RequirementDto[];
  nonFunctional: RequirementDto[];
  acceptanceCriteria: RequirementDto[];
  outOfScope: RequirementDto[];
  fullMarkdown: string;
  status: 'DRAFT' | 'PENDING_REVIEW' | 'LOCKED' | 'SUPERSEDED';
  createdAt: string;
  lockedAt: string | null;
  /** Fase 9: o gate nomeado e visível — a mesma checklist que lockPromptMaster() aplica por baixo,
   * exposta ANTES do clique em "Aprovar" (Fase 22 do brief: nunca um erro técnico cru). */
  gate: ValidationGateDto;
}

/** Fase 9 do brief — PROMPTMASTER_VALIDATION_GATE: as 4 condições formais que precisam estar
 * TODAS verdadeiras antes de LOCKED. Cada code é traduzido no frontend (nunca texto livre aqui —
 * só o conteúdo gerado por IA é texto livre neste sistema). */
export type ValidationGateConditionCode =
  | 'NO_UNRESOLVED_BLOCKERS'
  | 'NO_PENDING_USER_DECISIONS'
  | 'REQUIRED_SECTIONS_VALID'
  | 'REVIEW_COUNCIL_COMPLETED';

export interface ValidationGateConditionDto {
  code: ValidationGateConditionCode;
  passed: boolean;
  /** Só preenchido para REVIEW_COUNCIL_COMPLETED quando reprovado — quais reviewers não concluíram. */
  failedReviewers?: string[];
}

export interface ValidationGateDto {
  promptMasterId: string;
  passed: boolean;
  conditions: ValidationGateConditionDto[];
}

/** MISSÃO "Auto-Governança por IA" seção 3 — a única classificação de decisão do sistema inteiro,
 * calculada pela PromptMasterDecisionPolicy (nunca reimplementada em outro lugar). */
export interface ReviewFindingWithPolicyDto extends ReviewFindingDto {
  decisionOutcome: DecisionPolicyOutcome;
}

/** MISSÃO "Auto-Governança por IA" seção 29 — AI Autonomy Metrics: tudo calculado a partir de
 * dados já persistidos e reais (nunca um contador fabricado à parte). Mede se a experiência está
 * ficando de verdade menos manual, não só "parece" menos manual. */
export interface AutonomyMetricsDto {
  requirementsTotal: number;
  requirementsUserProvided: number;
  requirementsAutoCompleted: number;
  findingsTotal: number;
  findingsAutoResolved: number;
  userDecisionsRequired: number;
  userDecisionsMade: number;
  reviewRetries: number;
  reviewFallbacksUsed: number;
  reviewFailuresBlocking: number;
  discoveryTurnCount: number;
  timeToPromptMasterReadyMs: number | null;
}

export interface DiscoveryConversationDto {
  missionId: string;
  status: string;
  rawUserIdea: string;
  interpretedIntent: string | null;
  domain: string | null;
  goal: string | null;
  /** Fase 4: só EXPLICIT é uma decisão confirmada do usuário — INFERRED é sempre hipótese, exibida como tal. */
  targetUsers: ClassifiedItemDto[];
  knownRequirements: ClassifiedItemDto[];
  unknowns: string[];
  confidence: number;
  currentQuestion: { text: string; options: string[] } | null;
  turnCount: number;
  messages: DiscoveryMessageDto[];
  /** Todos os requirements da missão (todas as seções) — o consumidor filtra por section quando precisar de um subconjunto (ex: só "features" durante FEATURE_REVIEW). */
  requirements: RequirementDto[];
  promptMaster: PromptMasterDto | null;
  /** Fase 3: histórico de versões (mais recente primeiro) — nunca some quando uma nova versão é criada. */
  promptMasterHistory: PromptMasterHistoryEntryDto[];
  /** Fase 6: achados do Review Council para a versão atual do PromptMaster — nunca texto livre.
   * MISSÃO "Auto-Governança por IA": cada achado carrega o `decisionOutcome` da DecisionPolicy
   * (autoridade central) — o frontend NUNCA reimplementa essa classificação, só a exibe. */
  reviewFindings: ReviewFindingWithPolicyDto[];
  /** Fase 28: telemetria real por reviewer — nunca chain-of-thought, só o que é auditável. */
  reviewerExecutions: ReviewerExecutionDto[];
  /** Fase 29: PENDING (nunca rodou) | REVIEW_COMPLETE | REVIEW_PARTIALLY_COMPLETED (algum reviewer falhou, retentável). */
  reviewStatus: 'PENDING' | 'REVIEW_COMPLETE' | 'REVIEW_COMPLETE_DEGRADED' | 'REVIEW_PARTIALLY_COMPLETED';
}

export interface PromptMasterHistoryEntryDto {
  id: string;
  version: number;
  status: 'DRAFT' | 'PENDING_REVIEW' | 'LOCKED' | 'SUPERSEDED';
  createdBy: string;
  createdAt: string;
  lockedAt: string | null;
}

/** Fase 4: só EXPLICIT pode virar decisão confirmada do usuário — INFERRED é sempre uma hipótese, nunca fato. */
export interface ClassifiedItemDto {
  value: string;
  classification: 'EXPLICIT' | 'INFERRED';
}

interface DiscoveryTurnResult {
  interpretedIntent: string;
  domain: string;
  goal: string;
  targetUsers: ClassifiedItemDto[];
  knownRequirements: ClassifiedItemDto[];
  unknowns: string[];
  confidence: number;
  needsClarification: boolean;
  nextQuestion: { text: string; options?: string[] } | null;
  assistantMessage: string;
}

interface SuggestionsResult {
  suggestions: { title: string; description: string; reason: string; confidence: number; origin: 'AI_SUGGESTED' | 'INFERRED' }[];
}

interface PromptMasterResult {
  vision: string;
  objective: string;
  targetAudience: string;
  users: string[];
  features: string[];
  businessRules: string[];
  flows: string[];
  data: string[];
  integrations: string[];
  security: string[];
  privacy: string[];
  nonFunctional: string[];
  acceptanceCriteria: string[];
  outOfScope: string[];
  fullMarkdown: string;
}

interface CompletionResult {
  users: string[];
  flows: string[];
  data: string[];
  security: string[];
  privacy: string[];
  nonFunctional: string[];
  acceptanceCriteria: string[];
}

interface ImportAnalysisResult {
  vision: string;
  objective: string;
  targetAudience: string;
  users: string[];
  features: string[];
  businessRules: string[];
  flows: string[];
  data: string[];
  integrations: string[];
  security: string[];
  privacy: string[];
  nonFunctional: string[];
  acceptanceCriteria: string[];
  outOfScope: string[];
  pointsToConfirm: string[];
  inconsistencies: string[];
}

const DISCOVERY_SYSTEM_PROMPT = `Você é o "Discovery AI" do LDCN OS, uma plataforma que transforma ideias de software em sistemas reais. Sua função aqui é conversar com uma pessoa NÃO-TÉCNICA para entender o que ela quer construir — nunca para decidir tecnologia.

Regras obrigatórias:
- Responda sempre em português do Brasil, tom direto e acolhedor, sem jargão técnico.
- NUNCA pergunte sobre banco de dados, API, arquitetura, REST/GraphQL, hospedagem, autenticação técnica ou qualquer detalhe de implementação. Isso é decidido depois, automaticamente, por outra camada do sistema.
- Extraia o máximo possível da mensagem do usuário antes de perguntar qualquer coisa.
- Faça UMA pergunta principal por vez, nunca uma lista de perguntas.
- Ofereça de 2 a 4 opções curtas quando fizer sentido (nextQuestion.options), mas não é obrigatório.
- Pare de perguntar assim que tiver confiança suficiente para prosseguir. Ideias simples e completas podem precisar de poucas ou nenhuma pergunta adicional.
- Se o usuário pedir explicitamente para prosseguir, pular a pergunta, dizer que não sabe, ou deixar a decisão a seu critério (ex: "pode prosseguir", "não sei, decide você", "do jeito que achar melhor", "pula essa"), respeite isso: marque needsClarification=false, preencha os campos que faltam com hipóteses razoáveis baseadas no que já foi dito (registre isso implicitamente no entendimento, sem inventar fatos concretos que o usuário não confirmou) e siga em frente. Nunca insista numa pergunta que o usuário já sinalizou não querer responder.
- Nunca repita uma pergunta que já foi feita na conversa.
- No campo "domain" e em "interpretedIntent", use termos claros e comuns para o tipo de produto quando aplicável (ex: "landing page", "aplicativo mobile", "dashboard administrativo", "sistema de gestão", "e-commerce"), porque esses termos são usados depois por uma camada técnica automática para identificar o tipo de entrega.
- Em "targetUsers" e "knownRequirements", classifique cada item como "EXPLICIT" (o usuário disse isso literalmente) ou "INFERRED" (você deduziu/presumiu a partir do contexto). Nunca marque uma suposição sua como EXPLICIT — só o que o usuário realmente afirmou.

Responda SOMENTE com um objeto JSON válido, sem markdown, sem texto fora do JSON, exatamente neste formato:
{"interpretedIntent": string, "domain": string, "goal": string, "targetUsers": [{"value": string, "classification": "EXPLICIT" | "INFERRED"}], "knownRequirements": [{"value": string, "classification": "EXPLICIT" | "INFERRED"}], "unknowns": string[], "confidence": number (0 a 1), "needsClarification": boolean, "nextQuestion": {"text": string, "options": string[]} | null, "assistantMessage": string}

"assistantMessage" é o texto exibido ao usuário no chat: se needsClarification=true, é a pergunta em tom de conversa; se needsClarification=false, é uma frase curta dizendo que você já entendeu o suficiente para seguir.`;

const SUGGESTIONS_SYSTEM_PROMPT = `Você gera sugestões de funcionalidades específicas para o produto descrito — nunca genéricas ou copiadas de outro domínio. Baseie-se no entendimento estruturado e na conversa fornecidos, em português do Brasil.

Responda SOMENTE com um objeto JSON válido neste formato:
{"suggestions": [{"title": string, "description": string, "reason": string, "confidence": number (0 a 1), "origin": "AI_SUGGESTED" | "INFERRED"}]}

Gere entre 4 e 9 sugestões relevantes. Use "origin":"INFERRED" quando a funcionalidade é praticamente obrigatória para esse tipo de produto, e "AI_SUGGESTED" quando é uma sugestão de valor agregado, não estritamente necessária. "reason" explica em uma frase por que está sugerindo.`;

const PROMPTMASTER_SYSTEM_PROMPT = `Você consolida uma conversa de descoberta de produto em um PromptMaster: o contrato funcional estruturado que vai guiar a construção automática do sistema e a revisão por especialistas independentes antes da arquitetura. Baseie-se SOMENTE no que foi conversado e nas funcionalidades aceitas — nunca invente escopo novo, decisões de negócio (preço, meios de pagamento, stack técnica, provedor de nuvem) ou informação que o usuário nunca confirmou.

Responda SOMENTE com um objeto JSON válido, sem markdown, sem texto fora do JSON, exatamente neste formato:
{"vision": string, "objective": string, "targetAudience": string, "users": string[], "features": string[], "businessRules": string[], "flows": string[], "data": string[], "integrations": string[], "security": string[], "privacy": string[], "nonFunctional": string[], "acceptanceCriteria": string[], "outOfScope": string[], "fullMarkdown": string}

- "vision": 1-2 frases descrevendo o que está sendo construído, usando termos claros e comuns (ex: "landing page", "aplicativo mobile", "dashboard administrativo", "sistema de gestão").
- "objective": objetivo de negócio principal.
- "users": perfis/papéis de usuário distintos (ex: "Administrador", "Cliente final"). Lista vazia se não houver diferenciação clara.
- "features": as funcionalidades confirmadas, uma frase objetiva cada.
- "businessRules": regras de negócio explícitas na conversa (limites, condições, exceções). Nunca invente uma regra que o usuário não mencionou.
- "flows": passos ordenados do fluxo principal do usuário, do início ao fim.
- "data": tipos de dado que o sistema vai armazenar/manipular — só o que foi mencionado ou é claramente necessário para as funcionalidades confirmadas.
- "integrations": integrações externas mencionadas ou claramente necessárias (ex: "pagamento", "WhatsApp"). Se nenhuma foi confirmada, deixe vazio — não presuma qual provedor usar.
- "security": necessidades de segurança em nível de requisito (ex: "controle de acesso por perfil"), nunca uma implementação técnica específica.
- "privacy": necessidades de privacidade quando dados pessoais/sensíveis estiverem envolvidos (CPF, saúde, dados de menores, financeiro). Lista vazia se não houver dado sensível identificável na conversa.
- "nonFunctional": requisitos não funcionais só quando houver sinal real na conversa (performance, disponibilidade, acessibilidade) — nunca invente números.
- "acceptanceCriteria": critérios de aceite verificáveis para as funcionalidades principais (evite frases vagas como "deve ser rápido").
- "outOfScope": o que foi explicitamente rejeitado ou está fora desta versão.
- "fullMarkdown": o documento técnico completo em Markdown, com todas as seções acima.

Se uma seção não tiver conteúdo real baseado na conversa, retorne uma lista vazia — nunca invente itens só para preencher.`;

/**
 * MISSÃO "Auto-Governança por IA" (seção 5) — PromptMasterCompletionAgent: roda DEPOIS do
 * PromptMaster inicial (deliberadamente conservador — nunca inventa escopo) e ANTES do Review
 * Council, preenchendo lacunas tecnicamente DERIVÁVEIS das funcionalidades já confirmadas (ex:
 * "agenda online" implica conflito de horário, cancelamento, estados vazios). Nunca decisão de
 * produto/negócio — por isso o próprio prompt e o código (seções permitidas) excluem
 * businessRules, integrations e outOfScope, que são exatamente onde decisões de negócio moram.
 */
const PROMPTMASTER_COMPLETION_SYSTEM_PROMPT = `Você é o PromptMasterCompletionAgent do LDCN OS. Recebe um PromptMaster já estruturado e confirmado pelo usuário e identifica APENAS detalhes técnicos/funcionais que são consequência ÓBVIA e SEGURA das funcionalidades já confirmadas — coisas que qualquer profissional de produto competente incluiria sem precisar perguntar, nunca uma decisão de negócio.

Exemplos do que INCLUIR quando aplicável: tratamento de conflito de horário para agendamento, fluxo de cancelamento/edição quando existe criação, estados vazios/carregamento/erro para listas e formulários, validação básica de campos, paginação quando uma lista pode crescer, critérios de aceite objetivos para as funcionalidades principais, requisitos de dado óbvios (ex: se existe "consulta" deve haver data/hora/status).

NUNCA inclua: preço, forma de pagamento, política comercial, qual provedor de integração usar, prazo, dado sensível não mencionado, nova funcionalidade que muda o produto. Na dúvida entre incluir e não incluir, NÃO incluir — o usuário nunca vê isso individualmente, então só o que é seguro e óbvio pode entrar aqui.

Responda SOMENTE com um objeto JSON válido, sem markdown, sem texto fora do JSON, exatamente neste formato:
{"users": string[], "flows": string[], "data": string[], "security": string[], "privacy": string[], "nonFunctional": string[], "acceptanceCriteria": string[]}

Cada item deve ser algo que AINDA NÃO está no PromptMaster fornecido (não repita o que já existe). Se não houver nada seguro para adicionar em uma seção, retorne lista vazia — nunca invente item só para preencher.`;

// Fase 4 §3.3: "Já tenho uma especificação / PromptMaster" — extrai o que já está escrito, nunca
// reescreve nem inventa. pointsToConfirm/inconsistencies não viram Requirement — são superfície
// para o usuário decidir, mostrados como mensagem, não como fato silenciosamente aceito.
const IMPORT_ANALYZER_SYSTEM_PROMPT = `Você analisa uma especificação de produto que o usuário já escreveu (um documento, PRD, ou "PromptMaster" próprio) e extrai dela um entendimento estruturado — sem reescrever, resumir criativamente ou substituir o conteúdo original. Se o documento não menciona algo, a seção correspondente fica vazia; nunca invente conteúdo que não está no texto.

Responda SOMENTE com um objeto JSON válido, sem markdown, sem texto fora do JSON, exatamente neste formato:
{"vision": string, "objective": string, "targetAudience": string, "users": string[], "features": string[], "businessRules": string[], "flows": string[], "data": string[], "integrations": string[], "security": string[], "privacy": string[], "nonFunctional": string[], "acceptanceCriteria": string[], "outOfScope": string[], "pointsToConfirm": string[], "inconsistencies": string[]}

- Os campos de seção seguem o mesmo sentido do PromptMaster estruturado do LDCN (extraia, não invente).
- "pointsToConfirm": trechos ambíguos, incompletos, ou decisões que o documento deixa em aberto e que precisam de confirmação do usuário antes de prosseguir.
- "inconsistencies": contradições reais dentro do próprio documento (ex: uma seção diz que pagamento está fora do escopo, mas o fluxo descrito depende de uma compra). Liste vazio se não encontrar nenhuma.`;

@Injectable()
export class DiscoveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly generator: GeneratorService,
    private readonly reviewFindings: ReviewFindingService,
    private readonly reviewCouncil: ReviewCouncilService,
    private readonly decisionPolicy: PromptMasterDecisionPolicy,
    private readonly editing: PromptMasterEditingService,
    private readonly architectureReview: ArchitectureReviewService,
    @Inject(LLM_CLIENT) private readonly llm: LlmClient,
    private readonly ledger: LlmInvocationLedgerService
  ) {}

  async start(missionId: string, rawUserIdea: string, advancedInput?: DiscoveryAdvancedInput): Promise<DiscoveryConversationDto> {
    if (!missionId?.trim()) throw new Error('INVALID_DISCOVERY_INPUT');
    if (!rawUserIdea?.trim()) throw new Error('INVALID_DISCOVERY_INPUT');

    const existing = await this.prisma.discoveryConversation.findUnique({ where: { missionId } });
    if (existing) return this.toDto(missionId);

    const hasAdvancedInput = advancedInput && (advancedInput.technologyPreferences?.length || advancedInput.forbiddenDeliveryTargets?.length || advancedInput.constraints?.length);
    await this.prisma.discoveryConversation.create({
      data: {
        missionId,
        status: 'WAITING_FOR_USER',
        rawUserIdea: rawUserIdea.trim(),
        confidence: 0,
        turnCount: 0,
        advancedInput: hasAdvancedInput ? (advancedInput as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });
    await this.appendMessage(missionId, 'user', rawUserIdea.trim());

    try {
      await this.runDiscoveryTurn(missionId);
    } catch (error) {
      // The first turn is the only one that can leave a conversation permanently stuck: start()
      // is a no-op once a row exists, so a failed first call with no retry path would strand the
      // user forever. Roll back so a retry of start() creates a clean attempt instead.
      await this.prisma.discoveryMessage.deleteMany({ where: { missionId } });
      await this.prisma.discoveryConversation.delete({ where: { missionId } });
      throw error;
    }
    return this.toDto(missionId);
  }

  /**
   * Fase 4 §3.3: o usuário já tem uma especificação própria (PRD, PromptMaster de outra
   * ferramenta, um documento qualquer). Extrai o que já está escrito — nunca reescreve nem
   * substitui silenciosamente (Fase 3 do brief): tudo entra como SUGGESTED, e "pontos para
   * confirmar" viram uma pergunta real de Discovery em vez de serem silenciosamente ignorados.
   */
  async startFromImport(missionId: string, specText: string): Promise<DiscoveryConversationDto> {
    if (!missionId?.trim()) throw new Error('INVALID_DISCOVERY_INPUT');
    if (!specText?.trim()) throw new Error('INVALID_DISCOVERY_INPUT');

    const existing = await this.prisma.discoveryConversation.findUnique({ where: { missionId } });
    if (existing) return this.toDto(missionId);

    const label = specText.trim().split('\n')[0].slice(0, 160);
    await this.prisma.discoveryConversation.create({
      data: { missionId, status: 'WAITING_FOR_USER', rawUserIdea: label, confidence: 0, turnCount: 0 },
    });
    await this.appendMessage(missionId, 'user', specText.trim());

    try {
      await this.runImportAnalysis(missionId, specText.trim());
    } catch (error) {
      await this.prisma.requirement.deleteMany({ where: { missionId } });
      await this.prisma.discoveryMessage.deleteMany({ where: { missionId } });
      await this.prisma.discoveryConversation.delete({ where: { missionId } });
      throw error;
    }
    return this.toDto(missionId);
  }

  async respond(missionId: string, answer: string): Promise<DiscoveryConversationDto> {
    if (!answer?.trim()) throw new Error('INVALID_DISCOVERY_INPUT');
    const conversation = await this.requireConversation(missionId);
    if (conversation.status !== 'WAITING_FOR_USER') throw new Error('DISCOVERY_NOT_WAITING');

    await this.appendMessage(missionId, 'user', answer.trim());
    await this.prisma.discoveryConversation.update({ where: { missionId }, data: { turnCount: { increment: 1 } } });

    await this.runDiscoveryTurn(missionId);
    return this.toDto(missionId);
  }

  async decideRequirement(missionId: string, requirementId: string, decision: 'CONFIRMED' | 'REJECTED'): Promise<DiscoveryConversationDto> {
    const conversation = await this.requireConversation(missionId);
    if (conversation.status !== 'FEATURE_REVIEW') throw new Error('DISCOVERY_NOT_IN_FEATURE_REVIEW');
    const requirement = await this.prisma.requirement.findUnique({ where: { id: requirementId } });
    if (!requirement || requirement.missionId !== missionId) throw new Error('REQUIREMENT_NOT_FOUND');

    await this.prisma.requirement.update({
      where: { id: requirementId },
      data: { status: decision, approvedBy: 'user', approvedAt: new Date() },
    });
    return this.toDto(missionId);
  }

  async generatePromptMaster(missionId: string): Promise<DiscoveryConversationDto> {
    const conversation = await this.requireConversation(missionId);
    if (conversation.status !== 'FEATURE_REVIEW') throw new Error('DISCOVERY_NOT_IN_FEATURE_REVIEW');

    const messages = await this.prisma.discoveryMessage.findMany({ where: { missionId }, orderBy: { createdAt: 'asc' } });
    const featureRequirements = await this.prisma.requirement.findMany({ where: { missionId, section: 'features' } });
    const accepted = featureRequirements.filter((r) => r.status === 'CONFIRMED');
    const rejected = featureRequirements.filter((r) => r.status === 'REJECTED');

    // Requirements in OTHER sections too — e.g. from an imported spec (Fase 4 §3.3). CONFIRMED
    // ones get linked, never duplicated. SUGGESTED/DRAFT ones haven't been reviewed yet (no
    // per-section review UI exists before Fase 5's editor) but their mere existence still blocks
    // fresh AI generation for that section — otherwise an unreviewed import would silently get a
    // duplicate, contradicting AI-authored sibling instead of waiting for real review.
    const otherExisting = await this.prisma.requirement.findMany({
      where: { missionId, section: { not: 'features' }, status: { in: ['CONFIRMED', 'SUGGESTED', 'DRAFT'] } },
    });
    const otherConfirmed = otherExisting.filter((r) => r.status === 'CONFIRMED');
    const otherConfirmedBySection = new Map<string, typeof otherExisting>();
    for (const r of otherExisting) {
      const list = otherConfirmedBySection.get(r.section) ?? [];
      list.push(r);
      otherConfirmedBySection.set(r.section, list);
    }

    const understanding = {
      rawUserIdea: conversation.rawUserIdea,
      interpretedIntent: conversation.interpretedIntent,
      domain: conversation.domain,
      goal: conversation.goal,
      acceptedFeatures: accepted.map((r) => r.content),
      rejectedFeatures: rejected.map((r) => r.content),
      alreadyConfirmedInOtherSections: Object.fromEntries(
        [...otherConfirmedBySection.entries()].map(([section, items]) => [section, items.map((r) => r.content)])
      ),
    };
    const transcript = this.formatTranscript(messages);
    const user = `Entendimento e decisões (JSON):\n${JSON.stringify(understanding, null, 2)}\n\nHistórico completo da conversa:\n${transcript}`;

    const startedAt = Date.now();
    let completion;
    try {
      completion = await this.ledger.recordLlmCall(
        { missionId, purpose: 'discovery.prompt-master', phase: 'PLANNING', promptType: 'prompt-master', promptVersion: 'v1', contextForHash: { understanding, transcript }, system: PROMPTMASTER_SYSTEM_PROMPT, user, refs: { missionId } },
        () => this.llm.complete({ system: PROMPTMASTER_SYSTEM_PROMPT, user, responseFormat: 'json_object' })
      );
    } catch {
      throw new Error('DISCOVERY_AI_UNAVAILABLE');
    }
    const latencyMs = Date.now() - startedAt;
    const parsed = this.parseJson<PromptMasterResult>(completion.text, [
      'vision', 'objective', 'targetAudience', 'users', 'features', 'businessRules', 'flows', 'data',
      'integrations', 'security', 'privacy', 'nonFunctional', 'acceptanceCriteria', 'outOfScope', 'fullMarkdown',
    ]);
    if (!parsed) throw new Error('DISCOVERY_AI_UNAVAILABLE');

    const priorMax = await this.prisma.promptMasterVersion.aggregate({ where: { missionId }, _max: { version: true } });
    const version = (priorMax._max.version ?? 0) + 1;
    const hash = createHash('sha256').update(JSON.stringify(parsed)).digest('hex');
    const promptMasterId = randomUUID();

    await this.prisma.promptMasterVersion.create({
      data: {
        id: promptMasterId,
        missionId,
        version,
        vision: parsed.vision,
        objective: parsed.objective,
        targetAudience: parsed.targetAudience,
        fullMarkdown: parsed.fullMarkdown,
        hash,
        status: 'DRAFT',
        createdBy: 'discovery-ai',
        provider: 'deepseek',
        model: completion.model,
        promptTokens: completion.promptTokens,
        completionTokens: completion.completionTokens,
        latencyMs,
      },
    });

    // Confirmed requirements (features from Discovery, or anything else already confirmed — e.g.
    // an imported spec) already have their own provenance — link them to this version instead of
    // duplicating as fresh rows. Never rewritten, never re-authored.
    const alreadyConfirmedIds = [...accepted, ...otherConfirmed].map((r) => r.id);
    if (alreadyConfirmedIds.length > 0) {
      await this.prisma.requirement.updateMany({
        where: { id: { in: alreadyConfirmedIds } },
        data: { promptMasterId },
      });
    }

    // The other sections are genuinely new content produced at PromptMaster-generation time —
    // SUGGESTED, not CONFIRMED: the user hasn't reviewed each one individually yet (only the
    // features went through explicit accept/reject). Approving the whole document is what
    // confirms them (see approvePromptMaster()) — never fabricate an approval before that.
    // Skipped entirely for a section that already has confirmed content (e.g. imported) — the AI
    // never gets to silently duplicate or contradict something already reviewed.
    const allSections: { section: RequirementSection; items: string[] }[] = [
      { section: 'users', items: parsed.users },
      { section: 'businessRules', items: parsed.businessRules },
      { section: 'flows', items: parsed.flows },
      { section: 'data', items: parsed.data },
      { section: 'integrations', items: parsed.integrations },
      { section: 'security', items: parsed.security },
      { section: 'privacy', items: parsed.privacy },
      { section: 'nonFunctional', items: parsed.nonFunctional },
      { section: 'acceptanceCriteria', items: parsed.acceptanceCriteria },
      { section: 'outOfScope', items: parsed.outOfScope },
    ];
    const freshSections = allSections.filter(({ section }) => !otherConfirmedBySection.has(section));
    const rows = freshSections.flatMap(({ section, items }) =>
      (items ?? []).filter((item) => item?.trim()).map((content) => ({
        id: randomUUID(),
        missionId,
        promptMasterId,
        section,
        content,
        origin: 'AI_REFINED' as const,
        status: 'SUGGESTED' as const,
        createdBy: 'promptmaster-ai',
      }))
    );
    if (rows.length > 0) await this.prisma.requirement.createMany({ data: rows });

    // MISSÃO "Auto-Governança por IA" (seção 5): completa lacunas tecnicamente óbvias ANTES da
    // revisão — reduz achados que o Review Council encontraria e o Auto-Repair Loop teria que
    // corrigir depois, sem nunca decidir nada de produto/negócio sozinho.
    await this.completePromptMaster(missionId, promptMasterId, parsed);

    // Fase 24: a próxima etapa acontece automaticamente — o usuário não precisa pedir a revisão.
    await this.reviewCouncil.runCouncil(missionId, promptMasterId);

    await this.prisma.discoveryConversation.update({ where: { missionId }, data: { status: 'PROMPTMASTER_READY' } });

    // MISSÃO "Auto-Governança por IA": a IA corrige sozinha tudo que a DecisionPolicy classificou
    // como resolvível sem decisão humana — o usuário só vê o que sobrou de verdade.
    await this.editing.autoRepair(missionId, promptMasterId);

    return this.toDto(missionId);
  }

  /**
   * MISSÃO "Auto-Governança por IA" (seção 5) — PromptMasterCompletionAgent: preenche lacunas
   * tecnicamente derivadas das funcionalidades confirmadas, nunca decisão de produto/negócio (por
   * isso nunca toca businessRules/integrations/outOfScope — são exatamente onde essas decisões
   * moram). Os itens entram como SUGGESTED, exatamente como qualquer outra seção não-feature do
   * PromptMaster — confirmados em bloco na aprovação única (Fase 8/9), nunca perguntados um a um.
   * Uma falha aqui nunca impede a geração do PromptMaster (é um enriquecimento, não um requisito).
   */
  private async completePromptMaster(missionId: string, promptMasterId: string, parsed: PromptMasterResult): Promise<void> {
    const currentBySection: Record<string, string[]> = {
      users: parsed.users, flows: parsed.flows, data: parsed.data, security: parsed.security,
      privacy: parsed.privacy, nonFunctional: parsed.nonFunctional, acceptanceCriteria: parsed.acceptanceCriteria,
    };
    const context = { vision: parsed.vision, objective: parsed.objective, features: parsed.features, ...currentBySection };

    let completion;
    try {
      const completionUser = `PromptMaster atual (JSON):\n${JSON.stringify(context, null, 2)}`;
      completion = await this.ledger.recordLlmCall(
        { missionId, purpose: 'discovery.prompt-master-completion', phase: 'PLANNING', promptType: 'prompt-master-completion', promptVersion: 'v1', contextForHash: context, system: PROMPTMASTER_COMPLETION_SYSTEM_PROMPT, user: completionUser, refs: { missionId, promptMasterId } },
        () => this.llm.complete({ system: PROMPTMASTER_COMPLETION_SYSTEM_PROMPT, user: completionUser, responseFormat: 'json_object' })
      );
    } catch {
      return; // IA de completude indisponível nunca trava a geração — é um enriquecimento, não um requisito.
    }
    const completed = this.parseJson<CompletionResult>(completion.text, ['users', 'flows', 'data', 'security', 'privacy', 'nonFunctional', 'acceptanceCriteria']);
    if (!completed) return;

    const sections: (keyof CompletionResult)[] = ['users', 'flows', 'data', 'security', 'privacy', 'nonFunctional', 'acceptanceCriteria'];
    const rows = sections.flatMap((section) => {
      const existing = new Set((currentBySection[section] ?? []).map((c) => c.trim().toLowerCase()));
      const additions = (completed[section] ?? []).filter((item) => item?.trim() && !existing.has(item.trim().toLowerCase()));
      return additions.map((content) => ({
        id: randomUUID(),
        missionId,
        promptMasterId,
        section,
        content: content.trim(),
        origin: 'AI_REFINED' as const,
        status: 'SUGGESTED' as const,
        createdBy: 'completion-agent',
      }));
    });
    if (rows.length > 0) await this.prisma.requirement.createMany({ data: rows });
  }

  /**
   * Two real internal steps (Fase 24: "aprovação → LOCKED → Architecture Office iniciado
   * automaticamente" — sequential, not one opaque action). Split matters for recovery: if
   * startArchitecture() fails after the lock already committed, conversation.status sits at
   * PROMPTMASTER_LOCKED (not PROMPTMASTER_READY), so a retry of approvePromptMaster() skips
   * re-locking (the version is no longer DRAFT) and only retries the handoff — a version that
   * already went LOCKED is exactly the state createChangeRequest() knows how to act on too.
   */
  async approvePromptMaster(missionId: string): Promise<StartMissionAccepted> {
    const conversation = await this.requireConversation(missionId);
    if (conversation.status === 'PROMPTMASTER_READY') {
      await this.lockPromptMaster(missionId);
    } else if (conversation.status !== 'PROMPTMASTER_LOCKED') {
      throw new Error('DISCOVERY_PROMPTMASTER_NOT_READY');
    }
    return this.startArchitecture(missionId);
  }

  /**
   * MISSÃO "Auto-Governança por IA" seção 29 — AI Autonomy Metrics: tudo calculado de dados reais
   * já persistidos, nunca um contador paralelo que pode divergir do estado de verdade.
   */
  async getAutonomyMetrics(missionId: string): Promise<AutonomyMetricsDto> {
    const conversation = await this.requireConversation(missionId);
    const [requirementRows, latest, firstVersion] = await Promise.all([
      this.prisma.requirement.findMany({ where: { missionId } }),
      this.prisma.promptMasterVersion.findFirst({ where: { missionId }, orderBy: { version: 'desc' } }),
      this.prisma.promptMasterVersion.findFirst({ where: { missionId }, orderBy: { version: 'asc' } }),
    ]);

    const activeRequirements = requirementRows.filter((r) => r.status === 'CONFIRMED' || r.status === 'SUGGESTED');
    const requirementsAutoCompleted = activeRequirements.filter((r) => r.origin === 'AI_REFINED').length;

    const findings = latest ? await this.reviewFindings.listForVersion(latest.id) : [];
    const executions = latest ? await this.reviewCouncil.listExecutions(latest.id) : [];
    const latestExecutions = this.reviewCouncil.latestExecutionPerReviewer(executions);

    const classifiedAll = findings.map((f) => this.decisionPolicy.classify({
      severity: f.severity, requiresUserDecision: f.requiresUserDecision, finding: f.finding,
      recommendedResolutions: f.recommendedResolutions, requirementIds: f.requirementIds,
    }));

    return {
      requirementsTotal: activeRequirements.length,
      requirementsUserProvided: activeRequirements.length - requirementsAutoCompleted,
      requirementsAutoCompleted,
      findingsTotal: findings.length,
      findingsAutoResolved: findings.filter((f) => f.resolvedBy === 'ai-auto-repair').length,
      userDecisionsRequired: classifiedAll.filter((c) => c.outcome === 'USER_DECISION_REQUIRED' || c.outcome === 'BLOCKED').length,
      userDecisionsMade: findings.filter((f) => f.resolvedBy === 'user').length,
      reviewRetries: executions.reduce((sum, e) => sum + Math.max(0, e.attemptCount - 1), 0),
      reviewFallbacksUsed: executions.filter((e) => e.fallbackUsed).length,
      reviewFailuresBlocking: latestExecutions.filter((e) => e.status === 'FAILED_BLOCKING').length,
      discoveryTurnCount: conversation.turnCount,
      timeToPromptMasterReadyMs: firstVersion ? firstVersion.createdAt.getTime() - conversation.createdAt.getTime() : null,
    };
  }

  /**
   * Fase 9 do brief: PROMPTMASTER_VALIDATION_GATE — as 4 condições formais, avaliadas juntas e
   * expostas como uma checklist real (via toDto()) para o usuário ver ANTES de tentar aprovar,
   * não só descobrir depois de um erro. lockPromptMaster() usa exatamente este mesmo resultado —
   * uma única fonte de verdade, nunca duas implementações do "pode aprovar?" que podem divergir.
   */
  async evaluateValidationGate(missionId: string): Promise<ValidationGateDto> {
    const latest = await this.prisma.promptMasterVersion.findFirst({ where: { missionId }, orderBy: { version: 'desc' } });
    if (!latest) throw new Error('DISCOVERY_PROMPTMASTER_NOT_READY');

    const [classified, confirmedFeatureCount, executions] = await Promise.all([
      this.editing.classifyOpenFindings(latest.id),
      this.prisma.requirement.count({
        where: { promptMasterId: latest.id, section: 'features', status: { in: ['CONFIRMED', 'SUGGESTED'] } },
      }),
      this.reviewCouncil.listExecutions(latest.id),
    ]);

    // MISSÃO "Auto-Governança por IA": nunca a bandeira crua requiresUserDecision=true da IA
    // decide sozinha se algo bloqueia — a DecisionPolicy (autoridade central, seção 7 do brief)
    // decide. Um BLOCKER sem resolução (BLOCKED) e um BLOCKER/decisão real de produto
    // (USER_DECISION_REQUIRED) são as ÚNICAS duas classificações que impedem a aprovação; tudo o
    // resto (AUTO/AUTO_WITH_DISCLOSURE/USER_CONFIRMATION) a IA já resolveu sozinha.
    const hasBlocked = classified.some((c) => c.classification.outcome === 'BLOCKED');
    const hasUserDecisionRequired = classified.some((c) => c.classification.outcome === 'USER_DECISION_REQUIRED');

    const sectionsValid = Boolean(latest.vision?.trim()) && Boolean(latest.objective?.trim()) && confirmedFeatureCount > 0;
    // listExecutions() is a full audit trail (Fase 28: every attempt, never overwritten) — a
    // retried reviewer leaves its old row in place alongside the new one, so "is the council
    // done" must look only at each reviewer's MOST RECENT attempt, never the full history.
    const latestPerReviewer = this.reviewCouncil.latestExecutionPerReviewer(executions);
    const reviewStatus = this.reviewCouncil.computeReviewStatus(latestPerReviewer);
    // Seção 10 do brief: só reviewers CRITICAL ainda travados (mesmo após retry/fallback) contam
    // como "revisão incompleta" para o gate — HIGH/LOW degradados são disclosed, nunca bloqueiam.
    const failedReviewers = latestPerReviewer
      .filter((e) => e.status === 'DEGRADED' || e.status === 'FAILED_BLOCKING')
      .map((e) => e.reviewerKey);

    const conditions: ValidationGateConditionDto[] = [
      { code: 'NO_UNRESOLVED_BLOCKERS', passed: !hasBlocked },
      { code: 'NO_PENDING_USER_DECISIONS', passed: !hasUserDecisionRequired },
      { code: 'REQUIRED_SECTIONS_VALID', passed: sectionsValid },
      {
        code: 'REVIEW_COUNCIL_COMPLETED',
        passed: reviewStatus !== 'REVIEW_PARTIALLY_COMPLETED',
        ...(failedReviewers.length > 0 ? { failedReviewers } : {}),
      },
    ];

    return { promptMasterId: latest.id, passed: conditions.every((c) => c.passed), conditions };
  }

  private async lockPromptMaster(missionId: string): Promise<void> {
    const latest = await this.prisma.promptMasterVersion.findFirst({ where: { missionId }, orderBy: { version: 'desc' } });
    if (!latest || latest.status !== 'DRAFT') throw new Error('DISCOVERY_PROMPTMASTER_NOT_READY');

    // Fase 9: o gate formal — a mesma checklist exposta no frontend decide aqui, sem uma segunda
    // implementação. A ordem das condições define qual erro específico o usuário vê primeiro.
    const gate = await this.evaluateValidationGate(missionId);
    const failed = gate.conditions.find((c) => !c.passed);
    if (failed) throw new Error(GATE_CONDITION_ERROR_CODES[failed.code]);

    const lockedAt = new Date();
    await this.prisma.promptMasterVersion.update({ where: { id: latest.id }, data: { status: 'LOCKED', lockedAt } });

    // Approving the whole document is the real, timestamped user decision that covers every
    // requirement attached to it that the user hadn't individually reviewed yet (Fase 8: never an
    // invented approval). Rejected/superseded items are never flipped by this.
    await this.prisma.requirement.updateMany({
      where: { promptMasterId: latest.id, status: 'SUGGESTED' },
      data: { status: 'CONFIRMED', approvedBy: 'user', approvedAt: lockedAt },
    });

    await this.prisma.discoveryConversation.update({ where: { missionId }, data: { status: 'PROMPTMASTER_LOCKED' } });
  }

  private async startArchitecture(missionId: string): Promise<StartMissionAccepted> {
    const conversation = await this.requireConversation(missionId);
    const latest = await this.prisma.promptMasterVersion.findFirst({ where: { missionId }, orderBy: { version: 'desc' } });
    if (!latest || latest.status !== 'LOCKED') throw new Error('DISCOVERY_PROMPTMASTER_NOT_READY');

    const confirmedFeatures = await this.prisma.requirement.findMany({
      where: { promptMasterId: latest.id, section: 'features', status: 'CONFIRMED' },
    });
    const enrichedIdea = [latest.vision, latest.objective, confirmedFeatures.length ? `Funcionalidades: ${confirmedFeatures.map((r) => r.content).join(', ')}.` : '']
      .filter(Boolean)
      .join(' ');
    const advanced = (conversation.advancedInput as unknown as DiscoveryAdvancedInput | null) ?? {};

    const result = await this.generator.start(missionId, {
      rawUserIdea: enrichedIdea,
      technologyPreferences: advanced.technologyPreferences,
      forbiddenDeliveryTargets: advanced.forbiddenDeliveryTargets,
      constraints: advanced.constraints,
    });

    await this.prisma.discoveryConversation.update({
      where: { missionId },
      data: { status: 'HANDED_OFF', handedOffAt: new Date() },
    });

    // MISSÃO "Arquitetura não pode seguir automaticamente para Entrega": dispara o gate real
    // (council LLM + políticas) assim que a composição existe, no mesmo espírito síncrono do
    // Review Council do PromptMaster (já um precedente real neste código). Uma falha aqui nunca
    // derruba a aprovação do PromptMaster em si — o usuário/UI ainda pode disparar
    // POST .../architecture-review/start manualmente depois.
    try {
      await this.architectureReview.start(missionId);
    } catch {
      /* arquitetura fica sem review iniciado; endpoint manual cobre o retry */
    }

    return result;
  }

  /**
   * Fase 3 (versionamento): o único jeito válido de mudar algo depois de LOCKED. A versão travada
   * nunca é mutada — ela vira SUPERSEDED (permanece intacta, histórico real de proveniência) e uma
   * nova versão DRAFT nasce a partir dela, com os requirements confirmados levados adiante (nova
   * linha, `parentRequirementId` apontando pro original, nunca reescrevendo o antigo).
   */
  async createChangeRequest(missionId: string, reason: string): Promise<DiscoveryConversationDto> {
    if (!reason?.trim()) throw new Error('INVALID_DISCOVERY_INPUT');
    const conversation = await this.requireConversation(missionId);
    if (conversation.status === 'HANDED_OFF') throw new Error('DISCOVERY_CHANGE_REQUIRES_REPLAN');
    if (conversation.status !== 'PROMPTMASTER_LOCKED') throw new Error('DISCOVERY_PROMPTMASTER_NOT_LOCKED');

    const latest = await this.prisma.promptMasterVersion.findFirst({ where: { missionId }, orderBy: { version: 'desc' } });
    if (!latest || latest.status !== 'LOCKED') throw new Error('DISCOVERY_PROMPTMASTER_NOT_LOCKED');

    const newVersionId = randomUUID();
    const newVersion = latest.version + 1;

    await this.prisma.promptMasterVersion.create({
      data: {
        id: newVersionId,
        missionId,
        version: newVersion,
        vision: latest.vision,
        objective: latest.objective,
        targetAudience: latest.targetAudience,
        fullMarkdown: latest.fullMarkdown,
        hash: latest.hash,
        status: 'DRAFT',
        createdBy: 'change-request',
        provider: latest.provider,
        model: latest.model,
        promptTokens: 0,
        completionTokens: 0,
        latencyMs: 0,
      },
    });

    const carried = await this.prisma.requirement.findMany({ where: { promptMasterId: latest.id, status: 'CONFIRMED' } });
    if (carried.length > 0) {
      await this.prisma.requirement.createMany({
        data: carried.map((r) => ({
          id: randomUUID(),
          missionId,
          promptMasterId: newVersionId,
          section: r.section,
          content: r.content,
          origin: r.origin,
          confidence: r.confidence,
          status: 'CONFIRMED' as const,
          createdBy: r.createdBy,
          approvedBy: r.approvedBy,
          approvedAt: r.approvedAt,
          version: r.version + 1,
          parentRequirementId: r.id,
          evidence: r.evidence,
          reasoningSummary: r.reasoningSummary,
        })),
      });
    }

    await this.prisma.promptMasterVersion.update({ where: { id: latest.id }, data: { status: 'SUPERSEDED' } });
    await this.prisma.promptMasterChangeRequest.create({
      data: { id: randomUUID(), missionId, fromPromptMasterId: latest.id, toPromptMasterId: newVersionId, reason: reason.trim(), requestedBy: 'user' },
    });

    // Fase 9 do brief: "Change Request → nova versão → Impact Analysis → Review → nova aprovação" —
    // a versão nova sempre passa pelo Council de novo, nunca herda a aprovação da anterior.
    await this.reviewCouncil.runCouncil(missionId, newVersionId);

    await this.prisma.discoveryConversation.update({ where: { missionId }, data: { status: 'PROMPTMASTER_READY' } });

    await this.editing.autoRepair(missionId, newVersionId);

    return this.toDto(missionId);
  }

  /** Fase 29: reexecutar só o reviewer que falhou, não o Council inteiro nem o PromptMaster. */
  async retryReviewer(missionId: string, reviewerKey: ReviewerKey): Promise<DiscoveryConversationDto> {
    const conversation = await this.requireConversation(missionId);
    if (conversation.status !== 'PROMPTMASTER_READY') throw new Error('DISCOVERY_PROMPTMASTER_NOT_READY');
    const latest = await this.prisma.promptMasterVersion.findFirst({ where: { missionId }, orderBy: { version: 'desc' } });
    if (!latest || latest.status !== 'DRAFT') throw new Error('DISCOVERY_PROMPTMASTER_NOT_READY');

    await this.reviewCouncil.retryReviewer(missionId, latest.id, reviewerKey);
    return this.toDto(missionId);
  }

  /**
   * Minimal, real resolution path so um BLOCKER genuinely encontrado nunca deixa o usuário sem
   * saída (Fase 8 constrói a experiência guiada em cima disto — escolher entre
   * recommendedResolutions, atualizar requirements automaticamente; aqui é só o mecanismo).
   */
  async resolveFinding(missionId: string, findingId: string, resolutionNote?: string): Promise<DiscoveryConversationDto> {
    const conversation = await this.requireConversation(missionId);
    if (conversation.status !== 'PROMPTMASTER_READY') throw new Error('DISCOVERY_PROMPTMASTER_NOT_READY');
    const latest = await this.prisma.promptMasterVersion.findFirst({ where: { missionId }, orderBy: { version: 'desc' } });
    if (!latest) throw new Error('DISCOVERY_PROMPTMASTER_NOT_READY');

    const finding = await this.prisma.reviewFinding.findUnique({ where: { id: findingId } });
    if (!finding || finding.missionId !== missionId || finding.promptMasterId !== latest.id) throw new Error('DISCOVERY_NOT_FOUND');

    await this.reviewFindings.resolve(findingId, 'user', resolutionNote);
    return this.toDto(missionId);
  }

  /**
   * Fase 8 — Decision Center: o caminho guiado de verdade. O usuário escolhe uma das
   * recommendedResolutions (ou escreve a própria), isso vira uma instrução real pro mesmo
   * mecanismo do Copilot (Fase 5) — "Decision → Requirement update" é uma ação só, nunca um
   * blocker vira um beco sem saída técnico. Nunca reexecuta o Council inteiro por uma decisão.
   */
  async decideFinding(missionId: string, findingId: string, chosenOption: string): Promise<DiscoveryConversationDto> {
    if (!chosenOption?.trim()) throw new Error('INVALID_DISCOVERY_INPUT');
    const conversation = await this.requireConversation(missionId);
    if (conversation.status !== 'PROMPTMASTER_READY') throw new Error('DISCOVERY_PROMPTMASTER_NOT_READY');
    const latest = await this.prisma.promptMasterVersion.findFirst({ where: { missionId }, orderBy: { version: 'desc' } });
    if (!latest || latest.status !== 'DRAFT') throw new Error('DISCOVERY_PROMPTMASTER_NOT_READY');

    const finding = await this.prisma.reviewFinding.findUnique({ where: { id: findingId } });
    if (!finding || finding.missionId !== missionId || finding.promptMasterId !== latest.id || finding.status !== 'OPEN') {
      throw new Error('DISCOVERY_NOT_FOUND');
    }

    const instruction = `Resolução escolhida pelo usuário para o problema "${finding.finding}": ${chosenOption.trim()}`;
    const proposal = await this.proposeCopilotChange(missionId, instruction);
    if (proposal.changes.length > 0) {
      await this.applyCopilotChanges(missionId, proposal.changes.map((c) => ({ ...c, accepted: true })));
    }

    await this.prisma.promptMasterDecision.create({
      data: { id: randomUUID(), missionId, promptMasterId: latest.id, findingId, chosenOption: chosenOption.trim(), decidedBy: 'user' },
    });
    await this.reviewFindings.resolve(findingId, 'user', chosenOption.trim());

    return this.toDto(missionId);
  }

  /**
   * Fase 5 — primeira metade do fluxo Copilot: propõe, nunca aplica. Casca fina de validação de
   * estado (Fase 1 do audit "Completar o fluxo de compra/personalização": só Discovery sabe o que
   * PROMPTMASTER_READY significa) por cima do motor real, que vive em PromptMasterEditingService —
   * o mesmo motor que MarketplaceReviewService usa para o PromptMaster derivado de uma compra.
   */
  async proposeCopilotChange(missionId: string, message: string): Promise<CopilotProposalDto> {
    const conversation = await this.requireConversation(missionId);
    if (conversation.status !== 'PROMPTMASTER_READY') throw new Error('DISCOVERY_PROMPTMASTER_NOT_READY');

    const latest = await this.prisma.promptMasterVersion.findFirst({ where: { missionId }, orderBy: { version: 'desc' } });
    if (!latest || latest.status !== 'DRAFT') throw new Error('DISCOVERY_PROMPTMASTER_NOT_READY');

    return this.editing.proposeChange(latest.id, message);
  }

  /**
   * Segunda metade: só o que o usuário aceitou entra no documento. Mesma casca fina — a aplicação
   * real do diff vive em PromptMasterEditingService.
   */
  async applyCopilotChanges(
    missionId: string,
    decisions: (CopilotChangeDto & { accepted: boolean })[],
    actor: 'user' | 'ai-auto-repair' = 'user'
  ): Promise<DiscoveryConversationDto> {
    const conversation = await this.requireConversation(missionId);
    if (conversation.status !== 'PROMPTMASTER_READY') throw new Error('DISCOVERY_PROMPTMASTER_NOT_READY');

    const latest = await this.prisma.promptMasterVersion.findFirst({ where: { missionId }, orderBy: { version: 'desc' } });
    if (!latest || latest.status !== 'DRAFT') throw new Error('DISCOVERY_PROMPTMASTER_NOT_READY');

    await this.editing.applyChanges(missionId, latest.id, decisions, actor);
    return this.toDto(missionId);
  }

  async get(missionId: string): Promise<DiscoveryConversationDto | null> {
    const conversation = await this.prisma.discoveryConversation.findUnique({ where: { missionId } });
    if (!conversation) return null;
    return this.toDto(missionId);
  }

  // --- internals ---

  private async requireConversation(missionId: string) {
    const conversation = await this.prisma.discoveryConversation.findUnique({ where: { missionId } });
    if (!conversation) throw new Error('DISCOVERY_NOT_FOUND');
    return conversation;
  }

  private async appendMessage(missionId: string, role: 'user' | 'assistant', content: string, usage?: { provider: string; model: string; promptTokens: number; completionTokens: number; latencyMs: number }) {
    await this.prisma.discoveryMessage.create({
      data: {
        id: randomUUID(),
        missionId,
        role,
        content,
        provider: usage?.provider,
        model: usage?.model,
        promptTokens: usage?.promptTokens,
        completionTokens: usage?.completionTokens,
        latencyMs: usage?.latencyMs,
      },
    });
  }

  private async runDiscoveryTurn(missionId: string): Promise<void> {
    const conversation = await this.requireConversation(missionId);
    const messages = await this.prisma.discoveryMessage.findMany({ where: { missionId }, orderBy: { createdAt: 'asc' } });

    const understanding = {
      interpretedIntent: conversation.interpretedIntent,
      domain: conversation.domain,
      goal: conversation.goal,
      targetUsers: conversation.targetUsers,
      knownRequirements: conversation.knownRequirements,
      unknowns: conversation.unknowns,
      confidence: conversation.confidence,
    };
    const transcript = this.formatTranscript(messages);
    const user = `Ideia original do usuário: "${conversation.rawUserIdea}"\n\nEntendimento acumulado até agora (JSON):\n${JSON.stringify(understanding, null, 2)}\n\nHistórico da conversa:\n${transcript}\n\nResponda considerando a mensagem mais recente do usuário. Não repita perguntas já feitas.`;

    const startedAt = Date.now();
    let completion;
    try {
      completion = await this.ledger.recordLlmCall(
        { missionId, purpose: 'discovery.turn', phase: 'CONTEXT_ANALYSIS', promptType: 'discovery-turn', promptVersion: 'v1', contextForHash: { understanding, transcript }, system: DISCOVERY_SYSTEM_PROMPT, user, refs: { missionId } },
        () => this.llm.complete({ system: DISCOVERY_SYSTEM_PROMPT, user, responseFormat: 'json_object' })
      );
    } catch {
      throw new Error('DISCOVERY_AI_UNAVAILABLE');
    }
    const latencyMs = Date.now() - startedAt;
    const parsed = this.parseJson<DiscoveryTurnResult>(completion.text, [
      'interpretedIntent', 'domain', 'goal', 'targetUsers', 'knownRequirements', 'unknowns', 'confidence', 'needsClarification', 'assistantMessage',
    ]);
    if (!parsed) throw new Error('DISCOVERY_AI_UNAVAILABLE');

    // Safety net (Fase 6): never let Discovery turn into an endless interrogation, regardless of
    // what the model returns — enforced here, not left to the prompt alone. Two triggers: the
    // turn ceiling, and an explicit "just proceed" signal from the user's own last message (the
    // prompt asks the model to respect this too, but a real user typing "pode prosseguir" twice
    // and getting the same question reworded is exactly the interrogation this guards against).
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
    const userAskedToProceed = lastUserMessage ? hasProceedSignal(lastUserMessage.content) : false;
    const forcedDone = conversation.turnCount >= MAX_CLARIFICATION_TURNS || userAskedToProceed;
    const needsClarification = forcedDone ? false : parsed.needsClarification;

    const usage = { provider: 'deepseek', model: completion.model, promptTokens: completion.promptTokens, completionTokens: completion.completionTokens, latencyMs };
    await this.appendMessage(missionId, 'assistant', parsed.assistantMessage, usage);

    await this.prisma.discoveryConversation.update({
      where: { missionId },
      data: {
        interpretedIntent: parsed.interpretedIntent,
        domain: parsed.domain,
        goal: parsed.goal,
        targetUsers: parsed.targetUsers as unknown as Prisma.InputJsonValue,
        knownRequirements: parsed.knownRequirements as unknown as Prisma.InputJsonValue,
        unknowns: parsed.unknowns,
        confidence: parsed.confidence,
        currentQuestion: needsClarification && parsed.nextQuestion ? parsed.nextQuestion : Prisma.JsonNull,
        status: needsClarification ? 'WAITING_FOR_USER' : 'FEATURE_REVIEW',
      },
    });

    if (!needsClarification) {
      await this.generateFeatureSuggestions(missionId);
    }
  }

  private async generateFeatureSuggestions(missionId: string): Promise<void> {
    const conversation = await this.requireConversation(missionId);
    const messages = await this.prisma.discoveryMessage.findMany({ where: { missionId }, orderBy: { createdAt: 'asc' } });
    const understanding = {
      rawUserIdea: conversation.rawUserIdea,
      interpretedIntent: conversation.interpretedIntent,
      domain: conversation.domain,
      goal: conversation.goal,
      targetUsers: conversation.targetUsers,
      knownRequirements: conversation.knownRequirements,
    };
    const user = `Entendimento (JSON):\n${JSON.stringify(understanding, null, 2)}\n\nHistórico da conversa:\n${this.formatTranscript(messages)}`;

    const startedAt = Date.now();
    let completion;
    try {
      completion = await this.ledger.recordLlmCall(
        { missionId, purpose: 'discovery.suggestions', phase: 'PLANNING', promptType: 'discovery-suggestions', promptVersion: 'v1', contextForHash: understanding, system: SUGGESTIONS_SYSTEM_PROMPT, user, refs: { missionId } },
        () => this.llm.complete({ system: SUGGESTIONS_SYSTEM_PROMPT, user, responseFormat: 'json_object' })
      );
    } catch {
      throw new Error('DISCOVERY_AI_UNAVAILABLE');
    }
    const latencyMs = Date.now() - startedAt;
    const parsed = this.parseJson<SuggestionsResult>(completion.text, ['suggestions']);
    if (!parsed || !Array.isArray(parsed.suggestions)) throw new Error('DISCOVERY_AI_UNAVAILABLE');

    const usage = { provider: 'deepseek', model: completion.model, promptTokens: completion.promptTokens, completionTokens: completion.completionTokens, latencyMs };
    await this.appendMessage(
      missionId,
      'assistant',
      `Identifiquei ${parsed.suggestions.length} funcionalidades que podem ajudar. Dá uma olhada e me diga quais fazem sentido.`,
      usage
    );

    if (parsed.suggestions.length > 0) {
      // PostgreSQL may assign the same millisecond to every createMany row. toDto() orders by
      // createdAt, so freeze the provider's suggestion order explicitly instead of relying on
      // unspecified tie ordering from the database.
      const suggestionsCreatedAt = Date.now();
      await this.prisma.requirement.createMany({
        data: parsed.suggestions.map((s, index) => ({
          id: randomUUID(),
          missionId,
          promptMasterId: null,
          section: 'features',
          content: s.title + (s.description ? ` — ${s.description}` : ''),
          origin: 'AI_SUGGESTED' as const,
          confidence: typeof s.confidence === 'number' ? s.confidence : null,
          status: 'SUGGESTED' as const,
          createdBy: 'discovery-ai',
          createdAt: new Date(suggestionsCreatedAt + index),
          reasoningSummary: s.reason ?? null,
        })),
      });
    }
  }

  private async runImportAnalysis(missionId: string, specText: string): Promise<void> {
    const startedAt = Date.now();
    let completion;
    try {
      completion = await this.ledger.recordLlmCall(
        { missionId, purpose: 'discovery.import-analysis', phase: 'CONTEXT_ANALYSIS', promptType: 'discovery-import', promptVersion: 'v1', contextForHash: { specHash: createHash('sha256').update(specText).digest('hex') }, system: IMPORT_ANALYZER_SYSTEM_PROMPT, user: specText, refs: { missionId } },
        () => this.llm.complete({ system: IMPORT_ANALYZER_SYSTEM_PROMPT, user: specText, responseFormat: 'json_object' })
      );
    } catch {
      throw new Error('DISCOVERY_AI_UNAVAILABLE');
    }
    const latencyMs = Date.now() - startedAt;
    const parsed = this.parseJson<ImportAnalysisResult>(completion.text, [
      'vision', 'objective', 'targetAudience', 'users', 'features', 'businessRules', 'flows', 'data',
      'integrations', 'security', 'privacy', 'nonFunctional', 'acceptanceCriteria', 'outOfScope', 'pointsToConfirm', 'inconsistencies',
    ]);
    if (!parsed) throw new Error('DISCOVERY_AI_UNAVAILABLE');

    const sections: { section: RequirementSection; items: string[] }[] = [
      { section: 'users', items: parsed.users },
      { section: 'features', items: parsed.features },
      { section: 'businessRules', items: parsed.businessRules },
      { section: 'flows', items: parsed.flows },
      { section: 'data', items: parsed.data },
      { section: 'integrations', items: parsed.integrations },
      { section: 'security', items: parsed.security },
      { section: 'privacy', items: parsed.privacy },
      { section: 'nonFunctional', items: parsed.nonFunctional },
      { section: 'acceptanceCriteria', items: parsed.acceptanceCriteria },
      { section: 'outOfScope', items: parsed.outOfScope },
    ];
    const counts = sections.map(({ section, items }) => [section, (items ?? []).filter((i) => i?.trim()).length] as const).filter(([, count]) => count > 0);

    const rows = sections.flatMap(({ section, items }) =>
      (items ?? []).filter((item) => item?.trim()).map((content) => ({
        id: randomUUID(),
        missionId,
        promptMasterId: null,
        section,
        content,
        origin: 'USER_IMPORTED' as const,
        status: 'SUGGESTED' as const,
        createdBy: 'import-analyzer',
      }))
    );
    if (rows.length > 0) await this.prisma.requirement.createMany({ data: rows });

    const pointsToConfirm = (parsed.pointsToConfirm ?? []).filter((p) => p?.trim());
    const inconsistencies = (parsed.inconsistencies ?? []).filter((i) => i?.trim());

    const summaryLines = [
      'Prompt recebido ✓',
      '',
      'Detectamos:',
      ...counts.map(([section, count]) => `${count} ${this.sectionLabel(section, count)}`),
      ...(inconsistencies.length > 0 ? ['', `${inconsistencies.length} possível(is) inconsistência(s):`, ...inconsistencies.map((i) => `- ${i}`)] : []),
      ...(pointsToConfirm.length > 0 ? ['', `${pointsToConfirm.length} ponto(s) para confirmação:`, ...pointsToConfirm.map((p) => `- ${p}`)] : []),
    ];

    const usage = { provider: 'deepseek', model: completion.model, promptTokens: completion.promptTokens, completionTokens: completion.completionTokens, latencyMs };
    await this.appendMessage(missionId, 'assistant', summaryLines.join('\n'), usage);

    const needsClarification = pointsToConfirm.length > 0;
    await this.prisma.discoveryConversation.update({
      where: { missionId },
      data: {
        interpretedIntent: parsed.vision,
        goal: parsed.objective,
        confidence: needsClarification ? 0.5 : 0.9,
        currentQuestion: needsClarification ? { text: pointsToConfirm[0], options: [] } : Prisma.JsonNull,
        status: needsClarification ? 'WAITING_FOR_USER' : 'FEATURE_REVIEW',
      },
    });
  }

  private sectionLabel(section: RequirementSection, count: number): string {
    const plural = count !== 1;
    const labels: Record<RequirementSection, [string, string]> = {
      users: ['perfil de usuário', 'perfis de usuário'],
      features: ['requisito', 'requisitos'],
      businessRules: ['regra de negócio', 'regras de negócio'],
      flows: ['passo de fluxo', 'passos de fluxo'],
      data: ['tipo de dado', 'tipos de dado'],
      integrations: ['integração', 'integrações'],
      security: ['requisito de segurança', 'requisitos de segurança'],
      privacy: ['requisito de privacidade', 'requisitos de privacidade'],
      nonFunctional: ['requisito não funcional', 'requisitos não funcionais'],
      acceptanceCriteria: ['critério de aceite', 'critérios de aceite'],
      outOfScope: ['item fora de escopo', 'itens fora de escopo'],
    };
    return labels[section][plural ? 1 : 0];
  }

  private formatTranscript(messages: { role: string; content: string }[]): string {
    return messages.map((m) => `${m.role === 'user' ? 'Usuário' : 'LDCN'}: ${m.content}`).join('\n');
  }

  private parseJson<T>(text: string, requiredKeys: string[]): T | null {
    try {
      const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '');
      const parsed = JSON.parse(cleaned) as Record<string, unknown>;
      for (const key of requiredKeys) {
        if (!(key in parsed)) return null;
      }
      return parsed as T;
    } catch {
      return null;
    }
  }

  private toRequirementDto(r: {
    id: string; section: string; content: string; origin: string; confidence: number | null; status: string; createdBy: string; createdAt: Date;
    approvedBy: string | null; approvedAt: Date | null; version: number; parentRequirementId: string | null;
    evidence: string | null; reasoningSummary: string | null; promptMasterId: string | null;
  }): RequirementDto {
    return {
      id: r.id,
      section: r.section,
      content: r.content,
      origin: r.origin as RequirementOrigin,
      confidence: r.confidence,
      status: r.status as RequirementStatus,
      createdBy: r.createdBy,
      createdAt: r.createdAt.toISOString(),
      approvedBy: r.approvedBy,
      approvedAt: r.approvedAt?.toISOString() ?? null,
      version: r.version,
      parentRequirementId: r.parentRequirementId,
      evidence: r.evidence,
      reasoningSummary: r.reasoningSummary,
      promptMasterId: r.promptMasterId,
    };
  }

  private async toDto(missionId: string): Promise<DiscoveryConversationDto> {
    const conversation = await this.requireConversation(missionId);
    const [messages, requirementRows, promptMaster, allVersions] = await Promise.all([
      this.prisma.discoveryMessage.findMany({ where: { missionId }, orderBy: { createdAt: 'asc' } }),
      this.prisma.requirement.findMany({ where: { missionId }, orderBy: { createdAt: 'asc' } }),
      this.prisma.promptMasterVersion.findFirst({ where: { missionId }, orderBy: { version: 'desc' } }),
      this.prisma.promptMasterVersion.findMany({ where: { missionId }, orderBy: { version: 'desc' } }),
    ]);
    const requirements = requirementRows.map((r) => this.toRequirementDto(r));
    const reviewFindingRowsRaw = promptMaster ? await this.reviewFindings.listForVersion(promptMaster.id) : [];
    const reviewFindingRows: ReviewFindingWithPolicyDto[] = reviewFindingRowsRaw.map((f) => ({
      ...f,
      decisionOutcome: this.decisionPolicy.classify({
        severity: f.severity,
        requiresUserDecision: f.requiresUserDecision,
        finding: f.finding,
        recommendedResolutions: f.recommendedResolutions,
        requirementIds: f.requirementIds,
      }).outcome,
    }));
    const reviewerExecutionRows = promptMaster ? await this.reviewCouncil.listExecutions(promptMaster.id) : [];
    const reviewStatus = this.reviewCouncil.computeReviewStatus(reviewerExecutionRows);
    const gate = promptMaster ? await this.evaluateValidationGate(missionId) : null;

    let promptMasterDto: PromptMasterDto | null = null;
    if (promptMaster && gate) {
      const forVersion = requirements.filter((r) => r.promptMasterId === promptMaster.id);
      const bySection = (section: RequirementSection) => forVersion.filter((r) => r.section === section);
      promptMasterDto = {
        id: promptMaster.id,
        version: promptMaster.version,
        vision: promptMaster.vision,
        objective: promptMaster.objective,
        targetAudience: promptMaster.targetAudience,
        users: bySection('users'),
        features: bySection('features'),
        businessRules: bySection('businessRules'),
        flows: bySection('flows'),
        data: bySection('data'),
        integrations: bySection('integrations'),
        security: bySection('security'),
        privacy: bySection('privacy'),
        nonFunctional: bySection('nonFunctional'),
        acceptanceCriteria: bySection('acceptanceCriteria'),
        outOfScope: bySection('outOfScope'),
        fullMarkdown: promptMaster.fullMarkdown,
        status: promptMaster.status as PromptMasterDto['status'],
        createdAt: promptMaster.createdAt.toISOString(),
        lockedAt: promptMaster.lockedAt?.toISOString() ?? null,
        gate,
      };
    }

    return {
      missionId,
      status: conversation.status,
      rawUserIdea: conversation.rawUserIdea,
      interpretedIntent: conversation.interpretedIntent,
      domain: conversation.domain,
      goal: conversation.goal,
      targetUsers: (conversation.targetUsers as unknown as ClassifiedItemDto[] | null) ?? [],
      knownRequirements: (conversation.knownRequirements as unknown as ClassifiedItemDto[] | null) ?? [],
      unknowns: (conversation.unknowns as unknown as string[] | null) ?? [],
      confidence: conversation.confidence,
      currentQuestion: (conversation.currentQuestion as { text: string; options: string[] } | null) ?? null,
      turnCount: conversation.turnCount,
      messages: messages.map((m) => ({ id: m.id, role: m.role as 'user' | 'assistant', content: m.content, createdAt: m.createdAt.toISOString() })),
      requirements,
      promptMaster: promptMasterDto,
      promptMasterHistory: allVersions.map((v) => ({
        id: v.id,
        version: v.version,
        status: v.status as PromptMasterHistoryEntryDto['status'],
        createdBy: v.createdBy,
        createdAt: v.createdAt.toISOString(),
        lockedAt: v.lockedAt?.toISOString() ?? null,
      })),
      reviewFindings: reviewFindingRows,
      reviewerExecutions: reviewerExecutionRows,
      reviewStatus,
    };
  }
}
