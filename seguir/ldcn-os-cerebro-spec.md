# LDCN OS — O Cérebro (Cognitive Core)
## Especificação do Sistema de Empresa Virtual de Agentes + Plano de Implementação

**Versão:** 1.0 · **Data:** Agosto 2026 · **Status:** Draft para aprovação
**Escopo:** Motor cognitivo que transforma um projeto em uma empresa virtual de agentes de IA, executa o trabalho com LLMs, valida por gates e entrega com evidência auditável, com visibilidade em tempo real para o usuário.

---

## 1. Visão

Cada projeto cria uma **empresa virtual temporária** composta por agentes de IA especializados, organizados em departamentos, times e unidades de stack. O sistema:

1. Entende o projeto (Discovery cognitivo)
2. Decide arquitetura e stacks (Architecture Council)
3. Monta a empresa virtual mínima necessária (Team Composer)
4. Quebra o trabalho em Jobs com escopo fechado (Job Planner)
5. Roteia cada Job para a equipe mínima correta (Intelligent Work Router)
6. Executa cognitivamente via LLM (Agent Runtime + PromptMaster)
7. Valida por gates determinísticos (Build, Test, Security, Review)
8. Integra, entrega e aprende (Handoff, Delivery, Institutional Memory)

**Frase canônica:** A empresa completa existe no catálogo. Cada projeto cria sua própria empresa virtual. A ApprovedSolution define quais departamentos participam. O TeamComposer instancia os agentes necessários. O IntelligentWorkRouter convoca a equipe mínima para cada Job. Agente pensa com LLM. Ferramenta executa deterministicamente. Reviews verificam. Gates provam. O usuário observa tudo em tempo real.

---

## 2. Princípios arquiteturais

| # | Princípio | Consequência prática |
|---|-----------|---------------------|
| P1 | Agente ≠ ferramenta | Agente é cognitivo (usa LLM). Maven, npm, SAST, Git, Docker são ferramentas determinísticas invocadas por agentes. |
| P2 | Catálogo permanente, empresa temporária | AgentDefinitions vivem no catálogo. AgentInstances vivem na Mission e morrem com ela. |
| P3 | Domínio > linguagem | Unidades por tipo de engenharia (Angular Unit ≠ NestJS Unit), não por linguagem. |
| P4 | Contexto mínimo suficiente | Cada agente recebe só o necessário para o seu Job. Nunca a Mission inteira. |
| P5 | Escopo fechado | Todo Job tem JobScope. Alteração fora do escopo = SCOPE_VIOLATION, rejeitada. |
| P6 | Separação executor/revisor | Reviewer nunca é o executor da mesma execução. |
| P7 | Prova, não confiança | LLM nunca promove artifact. Só gates promovem, com evidência. |
| P8 | Observabilidade total | Todo estado de agente, job e gate é visível ao usuário em tempo real. |
| P9 | Custo governado | Toda Mission tem budget cap de LLM. Estouro pausa, nunca falha silenciosamente. |
| P10 | Humano no loop onde importa | Decisões de alto impacto geram AWAITING_HUMAN_APPROVAL. |
| P11 | Memória institucional | Padrões validados sobrevivem à empresa temporária e alimentam as próximas. |
| P12 | Tudo versionado | AgentDefinition, prompts, políticas e contratos são versionados e referenciados por versão exata. |

---

## 3. Organograma permanente (catálogo)

```
LDCN VIRTUAL COMPANY (catálogo permanente)
│
├── Product Department
│     AI CTO · AI Product Manager · AI Product Owner · AI Business Analyst
│
├── Architecture Department
│     Solution Architect · Integration Architect · Architecture Council Arbiter
│
├── Web Department
│     ├── Angular Unit        (Architect, Lead, Sr Dev, Dev, UX Specialist,
│     │                        Performance Specialist, Test Engineer, Reviewer)
│     ├── React Unit          (Architect, Lead, Dev, Test Engineer, Reviewer)
│     ├── Next.js Unit        (Architect, Dev, SEO Specialist, Perf Specialist, Reviewer)
│     ├── Astro Unit          (Architect, Dev, UX/SEO Agent, Reviewer)
│     ├── NestJS Unit         (Architect, Lead, Dev, Data Specialist,
│     │                        Security Specialist, Test Engineer, Reviewer)
│     └── Integration Web Unit
│
├── Java Enterprise Department
│     Solution Architect · Spring Boot Architect · Lead · Sr Dev · Dev ·
│     Spring Specialist · Data Specialist · Security Specialist ·
│     Integration Specialist · Performance Specialist · Runtime Specialist ·
│     Test Engineer · Reviewer
│
├── .NET Department
│     .NET Architect · ASP.NET Core Lead · Dev · Data Specialist ·
│     Security Specialist · Azure Specialist · Test Engineer · Reviewer
│     └── Unity Engineering Unit (games, separada)
│
├── AI & Data Department
│     ├── Python AI Unit · Machine Learning Unit · Data Science Unit
│     ├── Data Engineering Unit · MLOps Unit
│     AI Architect · ML Architect · Data Scientist · ML Engineer ·
│     Data Engineer · Python Backend · MLOps Agent · AI Security ·
│     AI Test · AI Reviewer
│
├── Go Cloud Department
│     Go Architect · Backend Lead · Dev · gRPC Specialist · Cloud Specialist ·
│     SRE Agent · Performance Specialist · Test Engineer · Reviewer
│
├── Rust Systems Department
│     Rust Architect · Systems Engineer · Dev · Concurrency Specialist ·
│     Security Specialist · Performance Specialist · Test Engineer · Reviewer
│
├── Mobile Department
│     ├── Android Kotlin Unit · Apple Swift Unit · Flutter Unit
│     (cada uma: Architect, Lead, Dev, Platform/Security Specialist,
│      Test Engineer, Reviewer)
│
├── Data Department
│     Data Architect · Database Architect · PostgreSQL Specialist ·
│     SQL Specialist · Data Engineer · DBA Agent · Data Quality Agent ·
│     Performance Agent · Data Security Agent · Data Reviewer
│
├── Security Department
│     Security Architect · Security Reviewer · AppSec Specialist
│
├── Compliance Department  ★ NOVO
│     Privacy Officer Agent (LGPD) · Data Retention Agent · Compliance Reviewer
│
├── QA Department
│     QA Architect · Test Engineer · Test Adequacy Analyst
│
├── DevOps Department
│     DevOps Agent · Release Agent · Infra Agent (K8s/Terraform)
│
├── Observability/SRE Department  ★ NOVO (separado de DevOps)
│     SRE Agent · Observability Agent · SLA Monitor Agent
│
├── FinOps Department  ★ NOVO
│     Cost Governance Agent · Budget Enforcement Agent
│
├── UX/UI Department
│     UX/UI Agent · Design System Agent  ★ NOVO
│
├── Integration Department
│     Integration Engineer · Contract Validator · Integration Reviewer
│
├── Documentation Department
│     Technical Writer · Documentation Reviewer
│
└── Knowledge Department  ★ NOVO
      Institutional Memory Curator · Pattern Promoter Agent
```

---

## 4. Modelo de domínio (esquema completo)

### 4.1 Diagrama de entidades (visão geral)

```
Catalog (permanente)                    Mission (por projeto)
─────────────────────                   ──────────────────────
Department 1─* UnitDefinition           Mission 1─1 VirtualCompany
UnitDefinition 1─* AgentDefinition      VirtualCompany 1─* TeamInstance
AgentDefinition 1─* AgentDefVersion     TeamInstance 1─* AgentInstance
CapabilityTag *─* AgentDefVersion       AgentInstance *─1 AgentDefVersion
PolicyPack 1─* Policy                   Mission 1─1 ApprovedSolution
KnowledgePattern (Institutional         Mission 1─* Requirement
  Memory, global)                       Mission 1─* Job
                                        Job 1─1 JobScope
                                        Job 1─* AgentExecution
                                        AgentExecution 1─* LlmInvocationRecord
                                        AgentExecution 1─* ToolInvocationRecord
                                        AgentExecution 0..1─1 ChangeSet
                                        ChangeSet 1─* ArtifactChange
                                        Job 1─* GateResult
                                        Job 1─* ReviewRecord
                                        Mission 1─* HandoffRecord
                                        Mission 1─1 CostLedger
                                        Mission 1─* HumanApprovalRequest
                                        Mission 1─* EventLog (append-only)
```

### 4.2 Entidades do catálogo

```yaml
Department:
  id: string            # ex: "dept.web"
  name: string
  description: string
  units: UnitDefinition[]

UnitDefinition:
  id: string            # ex: "unit.web.nestjs"
  departmentId: string
  engineeringType: string   # "nestjs-backend" ≠ "angular-frontend"
  stacks: StackRef[]        # frameworks disponíveis (não obrigatórios)

AgentDefinition:
  id: string            # ex: "backend.java.security-specialist"
  unitId: string
  currentVersion: semver
  versions: AgentDefVersion[]

AgentDefVersion:        # imutável após publicação
  version: semver       # "java-developer@v3"
  identity: { name, role, seniority }
  mission: string       # mandato do agente
  capabilities: CapabilityTag[]   # ["Java","Spring Security","OAuth2","OIDC","JWT","OWASP"]
  knowledge: KnowledgeRef[]       # docs, padrões, KnowledgePatterns
  promptTemplate: PromptTemplateRef  # versionado
  llmPolicy: { provider, model, maxTokens, temperature, fallbackChain }
  tools: ToolRef[]      # ["repository-inspector","build-runtime","test-runtime","security-scanner"]
  territory: TerritoryRule[]      # onde pode atuar por padrão
  memoryPolicy: { scope: JOB|MISSION, retention }
  outputContract: SchemaRef       # ex: "SecurityImplementationProposalV1"
  reviewPolicy: { requiresReview: bool, reviewerRole }
  boundaries: string[]  # proibições explícitas
  cognitiveMode: COGNITIVE | ORCHESTRATION   # ORCHESTRATION não exige LLM

CapabilityTag:
  id: string            # "oauth2", "grpc", "jetpack-compose"
  domain: string

KnowledgePattern:       # Institutional Memory
  id: string
  title: string         # "Rate limiting em NestJS com Redis"
  stack: StackRef[]
  problem: string
  solution: string      # descrição + referência a artifacts exemplares
  sourceMissionId: string
  validatedBy: ReviewRecordRef
  usageCount: int
  status: CANDIDATE | PROMOTED | DEPRECATED
```

### 4.3 Entidades da Mission

```yaml
Mission:
  id: string
  title: string
  status: DISCOVERY | PLANNING | TEAM_ASSEMBLY | EXECUTING | INTEGRATING |
          DELIVERING | COMPLETED | PAUSED_BUDGET | PAUSED_HUMAN | FAILED
  approvedSolution: ApprovedSolution
  budget: { maxCostBRL, maxTokens, alertThresholds[] }
  createdAt / completedAt

ApprovedSolution:
  architectureDecision: { style, rationale, approvedBy }   # decidida cognitivamente
  allowedDepartments: DepartmentRef[]
  allowedStacks: StackRef[]        # nenhum Team usa stack fora daqui
  contracts: ContractRef[]         # OpenAPI, eventos, schemas
  nonFunctional: NFR[]             # LGPD, performance, SLA...

Requirement:
  id: string                       # REQ-001
  text, source, priority
  scope: IN_SCOPE | OUT_OF_SCOPE | DEFERRED
  status: PENDING | IMPLEMENTED | VERIFIED | WAIVED   # WAIVED exige HumanApproval
  linkedJobs: JobRef[]

VirtualCompany:
  missionId: string
  teams: TeamInstance[]
  composedBy: "TeamComposer"
  compositionRationale: string     # por que esses times/agentes

TeamInstance:
  id, unitDefinitionId
  agents: AgentInstance[]

AgentInstance:
  id: string                       # instância viva na Mission
  agentDefVersion: "java-developer@v3"   # versão EXATA congelada
  state: IDLE | SUMMONED | CONTEXT_LOADING | ANALYZING | PLANNING |
         WAITING_DEPENDENCY | IMPLEMENTING | TOOL_RUNNING | BUILDING |
         TESTING | SELF_CHECKING | WAITING_REVIEW | REWORKING |
         COMPLETED | FAILED | BLOCKED | BLOCKED_NEEDS_HUMAN
  currentJobId: string?
  metrics: { llmCalls, tokensIn, tokensOut, elapsedMs }

Job:
  id: string                       # JOB-043
  title: string                    # "Stock Alert Engine"
  missionId, module
  requirements: RequirementRef[]
  complexity: LOW | MEDIUM | HIGH
  risk: LOW | MEDIUM | HIGH
  requiredCapabilities: CapabilityTag[]
  dependencies: JobRef[]
  scope: JobScope
  team: AgentInstanceRef[]         # decidido pelo IntelligentWorkRouter
  status: PLANNED | READY | RUNNING | WAITING_REVIEW | REWORK |
          BLOCKED | ARCHITECTURE_CONFLICT | DONE | FAILED
  reworkCount: int                 # teto: N (default 3) → BLOCKED_NEEDS_HUMAN

JobScope:
  allowedPaths: glob[]
  allowedModules: string[]
  allowedSymbols: string[]
  forbiddenAreas: glob[]
  requiredContracts: ContractRef[]
  acceptanceCriteria: Criterion[]

AgentExecution:
  id, jobId, agentInstanceId
  mode: COGNITIVE | ORCHESTRATION
  # INVARIANTE: mode=COGNITIVE ⇒ llmInvocations.length >= 1
  llmInvocations: LlmInvocationRecord[]
  toolInvocations: ToolInvocationRecord[]
  changeSet: ChangeSet?
  confidenceScore: float           # < limiar ⇒ review antecipada obrigatória
  timeline: TimelineEvent[]        # summoned, context ready, analysis, plan...
  result: SUCCESS | FAILED | SCOPE_VIOLATION | DUPLICATE_ARTIFACT_CONFLICT

LlmInvocationRecord:
  id, provider, model, promptRef (CompiledPrompt hash)
  tokensIn, tokensOut, latencyMs, costBRL
  purpose: ANALYSIS | PLANNING | IMPLEMENTATION | SELF_CHECK | REPAIR | REVIEW

ToolInvocationRecord:
  tool: string                     # "maven-build", "sast-scan"
  input/outputRef, exitStatus, durationMs

ChangeSet:
  changes: ArtifactChange[]
  # cada change: CREATE | MODIFY | REUSE | NO_CHANGE
  validations:
    scopeValidator: PASS | SCOPE_VIOLATION
    duplicateValidator: PASS | DUPLICATE_ARTIFACT_CONFLICT

GateResult:
  gate: BUILD | TEST | TEST_ADEQUACY | SECURITY | REVIEW | DELIVERY
  status: PASS | FAIL | WAIVED
  evidence: EvidenceRef[]          # logs, coverage, SAST report
  waivedBy: HumanApprovalRef?      # SECURITY HIGH só com decisão explícita

ReviewRecord:
  reviewerAgentInstanceId          # ≠ executor (validado)
  verdict: APPROVED | REJECTED
  findings: Finding[]              # ex: "status inicial ausente"

HandoffRecord:
  fromTeam, toTeam, artifact/contractRef
  validation: Integration Unit result
  status: PENDING | VALIDATED | REJECTED

CostLedger:
  missionId
  totals: { llmCalls, tokensIn, tokensOut, costBRL }
  perAgent[], perJob[]
  budgetStatus: OK | WARNING | EXCEEDED   # EXCEEDED ⇒ Mission PAUSED_BUDGET

HumanApprovalRequest:
  trigger: ARCHITECTURE_APPROVAL | REQUIREMENT_WAIVER | SECURITY_HIGH_WAIVER |
           BUDGET_INCREASE | REWORK_LIMIT | ARCHITECTURE_CONFLICT
  status: PENDING | APPROVED | REJECTED
  decidedBy, decidedAt, rationale

AgentMessage:                      # comunicação lateral auditável
  fromAgent, toAgent, jobId
  content, createdAt               # sem chain-of-thought exposto

EventLog:                          # append-only, alimenta a UI em tempo real
  missionId, ts, actor, type, payload
```

### 4.4 Máquina de estados do agente

```
IDLE → SUMMONED → CONTEXT_LOADING → ANALYZING → PLANNING
     → (WAITING_DEPENDENCY ⇄) → IMPLEMENTING ⇄ TOOL_RUNNING
     → BUILDING → TESTING → SELF_CHECKING → WAITING_REVIEW
         ├─ APPROVED → COMPLETED
         └─ REJECTED → REWORKING → (volta a IMPLEMENTING)
                          └─ reworkCount > N → BLOCKED_NEEDS_HUMAN
Qualquer estado → FAILED | BLOCKED
```

### 4.5 Pipeline de gates (nenhum é suficiente sozinho)

```
ChangeSet → ScopeValidator → DuplicateValidator → Workspace
   → BUILD gate → TEST gate → TEST_ADEQUACY gate (cobertura suficiente?)
   → SECURITY gate (HIGH nunca ignorado sem HumanApproval)
   → REVIEW gate (reviewer ≠ executor)
   → promoção do artifact (NUNCA feita pelo LLM diretamente)
```

---

## 5. Serviços do Cérebro (componentes de runtime)

| Serviço | Responsabilidade | Entrada → Saída |
|---|---|---|
| **DiscoveryEngine** | Entrevista cognitiva, extrai requisitos | Ideia → Requirements + Scope |
| **PromptMaster** | Compila o "cérebro temporário" do agente | AgentDefVersion + Job + Mission + Architecture + Artifacts + Policies → CompiledPrompt (hash versionado) |
| **LlmGateway** | Abstração multi-provider, fallback, rate limit, custo | CompiledPrompt → LlmInvocationRecord |
| **ArchitectureCouncil** | Decisão cognitiva de arquitetura + arbitragem | Requirements → ApprovedSolution; conflito → Arbiter decide ou escala |
| **TeamComposer** | Monta a empresa virtual mínima | ApprovedSolution → VirtualCompany (com rationale) |
| **ImplementationPlanner** | Módulos, estimativas, dependências | ApprovedSolution → ImplementationPlan |
| **JobPlanner** | Quebra em Jobs com JobScope | Plan → Job[] |
| **JobAnalyzer + IntelligentWorkRouter** | Capabilities/risco/complexidade → equipe mínima | Job → JobTeam |
| **AgentRuntime** | Executa a máquina de estados do agente | Job + AgentInstance → AgentExecution |
| **ScopeValidator / DuplicateValidator** | Guardas determinísticos do ChangeSet | ChangeSet → PASS/violação |
| **RepositoryInspector** | Artifact Registry, Symbol Manifest, busca semântica | query → CREATE/MODIFY/REUSE/NO_CHANGE |
| **GateEngine** | Build/Test/Adequacy/Security/Review/Delivery | ChangeSet → GateResult[] |
| **ReviewOrchestrator** | Seleciona reviewer ≠ executor, gerencia rework | Execution → ReviewRecord |
| **HandoffCoordinator** | Contratos entre times, Integration Unit | artifact → HandoffRecord |
| **CostGovernor** | Ledger, budget cap, pausa por estouro | eventos LLM → CostLedger |
| **HumanApprovalService** | Fila de decisões humanas | trigger → HumanApprovalRequest |
| **MemoryCurator** | Promove padrões à Institutional Memory | Mission concluída → KnowledgePattern[] |
| **EventBus + LiveProjector** | Projeção em tempo real para a UI (WebSocket/SSE) | EventLog → telas Central de Comando |

---

## 6. Fluxo canônico ponta a ponta

```
USER IDEA
  ↓
AI DISCOVERY → AI REQUIREMENTS → SCOPE
  ↓
PROMPTMASTER (contexto de planejamento)
  ↓
SOLUTION PLANNING → STACK SELECTION
  ↓
ARCHITECTURE COUNCIL → [conflito? → ARBITER → resolve ou AWAITING_HUMAN_APPROVAL]
  ↓
ARCHITECTURE VALIDATION → ★ HUMAN CHECKPOINT (aprovação de arquitetura)
  ↓
IMPLEMENTATION PLAN → TEAM REQUIREMENT ANALYSIS
  ↓
TEAM COMPOSER → VIRTUAL COMPANY CREATED   ("Montando sua empresa virtual...")
  ↓
JOB PLANNER → N Jobs com JobScope
  ↓ (para cada Job, respeitando dependências)
JOB ANALYZER → capabilities/complexidade/risco → INTELLIGENT WORK ROUTER → JobTeam
  ↓
AGENT SUMMONED → CONTEXT LOADING (contexto mínimo suficiente)
  ↓
PROMPTMASTER → CompiledPrompt → LLM GATEWAY
  ↓
LLM ANALYSIS → LLM PLAN → REPOSITORY INSPECTION → LLM IMPLEMENTATION → ChangeSet
  ↓
SCOPE VALIDATOR → DUPLICATE VALIDATOR → WORKSPACE
  ↓
BUILD → TESTS → TEST ADEQUACY → SECURITY → [HIGH? → HumanApproval obrigatória]
  ↓
LLM SELF-CHECK → REVIEWER (≠ executor)
  ├─ APPROVED → GATE → artifact promovido
  └─ REJECTED → REWORK (máx N) → repete   |  estourou N → BLOCKED_NEEDS_HUMAN
  ↓
HANDOFF (ex: Java Team → Integration Unit valida OpenAPI → Angular Team)
  ↓
todos os Requirements IN_SCOPE = VERIFIED → DELIVERY GATE
  ↓
ENTREGA + MemoryCurator promove KnowledgePatterns
  ↓
empresa virtual encerrada · catálogo e memória permanecem
```

Em paralelo, o tempo todo: **CostGovernor** monitora o ledger (estouro ⇒ Mission
PAUSED_BUDGET) e o **LiveProjector** transmite cada evento à Central de Comando.

---

## 7. Constituição — Invariantes (20)

1. Nenhum agente cognitivo trabalha sem LLM.
2. Nenhum AgentExecution cognitivo termina sem ≥ 1 LlmInvocationRecord.
3. Nenhum AgentInstance trabalha fora da Mission.
4. Nenhum Team usa stack fora da ApprovedSolution.
5. Nenhum Job altera artefato fora do JobScope.
6. Nenhum artifact novo é criado sem busca por equivalente.
7. Reviewer nunca é executor.
8. REVIEWER_REJECTED gera Rework quando elegível.
9. Nenhum requisito obrigatório é removido silenciosamente (waiver ⇒ HumanApproval).
10. Nenhuma entrega ocorre com requisito IN_SCOPE não verificado.
11. Build aprovado não significa projeto aprovado.
12. Testes aprovados só contam se o TestAdequacyGate considerar cobertura suficiente.
13. Security Gate não ignora HIGH sem decisão humana explícita e registrada.
14. LLM nunca promove artifact diretamente.
15. O usuário observa o estado de todo agente em tempo real.
16. Conflito arquitetural gera ARCHITECTURE_CONFLICT com resolução explícita (Arbiter ou humano) antes de avançar.
17. Nenhum agente excede N reworks sem escalar para BLOCKED_NEEDS_HUMAN.
18. Toda AgentDefinition é versionada; toda AgentExecution referencia a versão exata.
19. Todo gasto de LLM respeita o budget cap da Mission; estouro pausa, nunca cancela silenciosamente.
20. Todo padrão reutilizável validado é promovido à Institutional Memory antes do encerramento da empresa virtual.

---

## 8. Observabilidade em tempo real (contrato UI)

Eventos que a Central de Comando consome (via WebSocket/SSE do EventLog):

```
company.assembling / company.ready
agent.summoned / agent.state_changed / agent.metrics
job.planned / job.routed / job.state_changed
llm.invocation (calls, tokens, custo — nunca chain-of-thought)
tool.invocation (build/test/scan started/finished)
gate.result / review.verdict / rework.started
handoff.pending / handoff.validated
cost.warning / cost.exceeded
approval.requested / approval.decided
mission.progress (% jobs done, ETA IA + equivalência humana)
```

Telas: Montagem do time · Agentes da Missão · Painel do agente (drawer com
timeline, capabilities, artifacts, evidence) · Jobs board · Empresa Virtual ·
Central de Comando (layout já definido) · Custos da Mission.

Regra de exibição: mostramos **ações, decisões, resultados e evidências** —
nunca chain-of-thought bruto.

---

## 9. Plano de implementação (slices)

### Fase 0 — Fundações (2–3 semanas)
- Monorepo, CI, ambientes; PostgreSQL multi-tenant + Redis + fila (BullMQ/Kafka).
- EventLog append-only + EventBus + projeção WebSocket básica.
- LlmGateway v1: 1 provider, LlmInvocationRecord, custo por chamada.
- **Critério de saída:** invocar um LLM via gateway e ver o evento chegar em uma UI crua em tempo real.

### Slice C1 — Catálogo e versionamento (2 semanas)
- CRUD de Department/Unit/AgentDefinition/AgentDefVersion + CapabilityTags.
- PromptTemplates versionados; publicação imutável de versões.
- Seeds: Product, Architecture, NestJS Unit, Angular Unit, QA, Security (mínimo viável).
- **Saída:** catálogo navegável; `java-developer@v3` resolvível por versão exata.

### Slice C2 — Agente cognitivo real (3 semanas)  ← já definido como próximo passo
- PromptMaster v1 (AgentDefVersion + Job + contexto → CompiledPrompt com hash).
- AgentRuntime com a máquina de estados completa + timeline.
- Invariantes 1–2 aplicadas em runtime (execução cognitiva sem LLM = erro).
- Primeiro agente fim-a-fim: NestJS Developer produz ChangeSet real.
- **Saída:** um Job simples executado por um agente com LLM, visível na UI ao vivo.

### Slice C3 — Guardas e gates (3 semanas)
- JobScope + ScopeValidator; RepositoryInspector + DuplicateValidator.
- GateEngine: Build + Test em workspace isolado (containers efêmeros).
- Invariantes 5, 6, 11.
- **Saída:** ChangeSet fora de escopo é rejeitado com SCOPE_VIOLATION auditável.

### Slice C4 — Review e rework (2 semanas)
- ReviewOrchestrator (reviewer ≠ executor), findings, loop de rework com teto N.
- ConfidenceScore ⇒ review antecipada.
- Invariantes 7, 8, 17.
- **Saída:** reprovação gera rework automático; estouro escala para humano.

### Slice C5 — Empresa virtual (3 semanas)
- DiscoveryEngine + Requirements; ArchitectureCouncil + Arbiter + ARCHITECTURE_CONFLICT.
- TeamComposer com rationale; ImplementationPlanner + JobPlanner.
- HumanApprovalService (checkpoint de arquitetura, waivers).
- Invariantes 3, 4, 9, 16.
- **Saída:** "Quero um ERP" → empresa virtual montada + Jobs planejados, tudo ao vivo.

### Slice C6 — Roteamento inteligente e paralelismo (2 semanas)
- JobAnalyzer + IntelligentWorkRouter; execução paralela com dependências.
- AgentMessageBus (comunicação lateral auditável).
- **Saída:** múltiplos agentes trabalhando em paralelo na mesma Mission.

### Slice C7 — Segurança, adequação e entrega (2–3 semanas)
- Security Gate (SAST) com waiver humano para HIGH; TestAdequacyGate.
- HandoffCoordinator + Integration Unit; Delivery Gate (Req IN_SCOPE = VERIFIED).
- Invariantes 10, 12, 13, 14.
- **Saída:** primeira Mission completa entregue com evidência de todos os gates.

### Slice C8 — Custo, memória e polimento (2 semanas)
- CostGovernor completo (budget cap, PAUSED_BUDGET, dashboard de custos em R$).
- MemoryCurator + KnowledgePatterns alimentando o PromptMaster.
- Central de Comando final (layout definido na seção de UI).
- Invariantes 15, 19, 20.
- **Saída:** plataforma fecha o ciclo: executa, prova, entrega, aprende e presta contas.

**Total estimado:** ~20 semanas para o Cérebro v1. Cada slice termina com demo funcional visível na UI — nada existe "só no backend".

### Ordem de prioridade se precisar cortar
1. C2 (agente cognitivo real) — sem isso não há produto.
2. C3 (guardas) — sem isso o agente é perigoso.
3. C5 (empresa virtual) — é o coração da proposta de valor.
4. C4, C7, C6, C8 nessa ordem.

---

## 10. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Loop infinito de rework queimando tokens | Invariante 17 (teto N) + CostGovernor |
| Alucinação promovida a código | ConfidenceScore + gates determinísticos + reviewer independente (Inv. 7, 14) |
| Custo de LLM imprevisível | Budget cap por Mission, ledger por agente/job, PAUSED_BUDGET (Inv. 19) |
| Conflito arquitetural travando a Mission | Arbiter + estado explícito + escalonamento humano (Inv. 16) |
| Prompt drift ao evoluir agentes | Versionamento imutável de AgentDefVersion e PromptTemplate (Inv. 18) |
| Empresa virtual "nasce zerada" toda vez | Institutional Memory alimentando o PromptMaster (Inv. 20) |
| LGPD (mercado BR) | Compliance Department + Privacy Officer Agent como gate de dados pessoais |

---

*Documento vivo. Próxima revisão: após conclusão do Slice C2.*
