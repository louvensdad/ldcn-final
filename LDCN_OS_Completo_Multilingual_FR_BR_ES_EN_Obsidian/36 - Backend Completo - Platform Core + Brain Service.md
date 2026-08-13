---
title: "Backend Completo - Platform Core + Brain Service"
aliases:
  - "Backend LDCN OS"
  - "Platform Core e Cérebro"
  - "Backend AI-First"
tags:
  - ldcn
  - backend
  - architecture
  - brain
  - ai-first
  - nestjs
status: canonico
version: v1
---

# 🧠⚙️ 36 - Backend Completo — Platform Core + Brain Service

[[00 - LDCN OS - Mapa Raiz Completo|⬅ Mapa Raiz]] · [[30 - AI-First Intelligence Constitution|AI-First]] · [[35 - Cérebro Operacional AI-First|Cérebro]] · [[23 - Backend NestJS APIs e Persistência|Backend anterior]]

> Este documento define o backend completo do LDCN OS com o **Cérebro separado fisicamente e logicamente**, porém totalmente integrado ao Platform Core por contratos, commands, events, snapshots e policies.
>
> O frontend premium virá depois e deverá conversar **somente com o Platform API**, nunca diretamente com o Brain Service.

---

# 0. Decisão arquitetural principal

```text
┌───────────────────────────────────────────────────────────────┐
│                       LDCN OS BACKEND                         │
├────────────────────────────┬──────────────────────────────────┤
│      PLATFORM CORE         │          BRAIN SERVICE           │
│                            │                                  │
│ fonte canônica de estado   │ inteligência cognitiva          │
│ auth / tenancy             │ agentes LLM                      │
│ missions                   │ planning                         │
│ contracts                  │ architecture proposals           │
│ teams / jobs               │ team recommendations             │
│ routing materialization    │ job analysis                     │
│ execution runtime          │ routing recommendations          │
│ artifacts / workspace      │ handoff analysis                 │
│ review / gates             │ replanning                       │
│ repair runtime             │ learning signals                 │
│ audit / operations         │ cognitive execution              │
└────────────────────────────┴──────────────────────────────────┘
```

> **Brain pensa e propõe. Platform Core valida, materializa, executa e prova.**

O Brain não recebe autoridade para alterar diretamente o estado canônico da plataforma.

---

# 1. Topologia de deployment

Monorepo NestJS com dois apps deployáveis:

```text
ldcn-os/
├── apps/
│   ├── api/            # Platform Core / Control Plane API
│   ├── brain/          # AI Decision + Cognitive Agent Runtime
│   └── web/            # futuro frontend premium Angular
│
├── packages/
│   ├── contracts/      # schemas de comunicação
│   ├── event-envelope/
│   ├── telemetry/
│   ├── config/
│   └── testkit/
│
├── prisma/
│   ├── platform/
│   └── brain/
│
└── docs/
```

## Regra de dependência

```text
apps/api
  └── packages/contracts

apps/brain
  └── packages/contracts

apps/api NÃO importa código interno de apps/brain
apps/brain NÃO importa domínio interno de apps/api
```

Compartilhar contrato. Não compartilhar domínio.

---

# 2. Comunicação Platform ↔ Brain

```text
Platform Command
↓
BrainGateway
↓
Brain Request
↓
AI Decision Runtime
↓
Structured Proposal
↓
Brain Response/Event
↓
Platform Policy Validation
↓
Decision Materializer
↓
Canonical State
```

## Operações rápidas

Síncronas:

```text
health
capabilities
supported schemas
small metadata reads
```

## Operações cognitivas

Assíncronas:

```text
Intent
Requirements
Topology
Solution
Technology Selection
Architecture
Team Proposal
Job Classification
Work Routing
Team Transition
Scope Expansion
Replanning
Cognitive Code ChangeSet
Repair Advisory
```

Fluxo:

```text
POST command
↓
Platform creates Operation
↓
202 Accepted
↓
BrainGateway / Outbox
↓
Brain executes
↓
BrainDecisionCompleted
↓
Platform Inbox
↓
Policy Validation
↓
Materialization
↓
Operation COMPLETED
↓
SSE notification
```

---

# 3. Regra de frontend

O frontend futuro nunca chama:

```text
brain.internal.*
```

Somente:

```text
/api/v1/*
```

```text
Angular Premium Frontend
        ↓
Platform API
        ↓
Application Commands
        ↓
BrainGateway
        ↓
Brain Service
```

---

# 4. Platform Core — módulos

```text
IdentityModule
TenantModule
WorkspaceModule
ProjectModule
MissionModule

ContractModule
SolutionModule
CatalogModule
AgentOsModule
WorkModule
RoutingModule
HandoffModule
PipelineModule

ArtifactModule
WorkspaceRuntimeModule
ToolRuntimeModule
StackRuntimeModule

ReviewModule
GateModule
RepairModule
PromotionModule

OperationModule
EventModule
AuditModule
TelemetryModule

BrainIntegrationModule
```

---

# 5. Brain Service — módulos

```text
BrainApiModule
BrainDecisionModule

IntentIntelligenceModule
RequirementsIntelligenceModule
TopologyIntelligenceModule
SolutionIntelligenceModule
TechnologyIntelligenceModule
ArchitectureIntelligenceModule

TeamIntelligenceModule
JobIntelligenceModule
RoutingIntelligenceModule
TransitionIntelligenceModule
ScopeIntelligenceModule

CognitiveExecutionModule
RepairAdvisoryModule
LearningIntelligenceModule

PromptRuntimeModule
ContextRuntimeModule
LlmGatewayModule
StructuredOutputModule
BrainAuditModule
BrainTelemetryModule
```

---

# 6. O Brain não pode possuir

```text
canonical Mission state
ApprovedSolution authority
AgentAssignment authority
Artifact promotion authority
Workspace materialization authority
Gate authority
user authorization authority
tenant ownership authority
```

Pode persistir apenas:

```text
DecisionRequest
DecisionRun
PromptSnapshot
StructuredOutputAttempt
BrainDecisionEnvelope
PredictionSnapshot
BrainUsageRecord
BrainAuditEvent
```

---

# 7. Source of Truth

## Platform DB

```text
Organization
Workspace
Project
Mission

ProjectIntentCanonical
RequirementsContract
SolutionTopology
SolutionProposal
ApprovedSolution

StackDefinition
CapabilityDefinition
AgentDefinition
StackTeamProfile

AgentTeam
AgentInstance
AgentTask
AgentAssignment
AgentExecution

JobClassificationCanonical
WorkRoutingDecisionCanonical
TeamSwitchDecisionCanonical
AgentHandoff

MissionPipelinePlan
PipelineNode

ProjectArtifact
ArtifactRevision
WorkspaceSession
ToolInvocation

AgentReview
AgentGate
AgentGateResult

EngineeringRepairSession

Operation
OutboxEvent
InboxEvent
AuditEvent
```

## Brain DB

```text
BrainDecisionRequest
BrainDecisionRun
BrainDecisionEnvelope
PromptSnapshot
StructuredOutputAttempt
BrainUsageRecord
PredictionSnapshot
LearningSignalSnapshot
BrainAuditEvent
```

---

# 8. PostgreSQL

MVP:

```text
platform.*
brain.*
```

Regras:

```text
brain role
→ sem write no schema platform

platform role
→ não depende de query direta no brain para negócio
```

Comunicação sempre por contratos/eventos.

---

# 9. Reliable Messaging

## PlatformOutboxEvent

```ts
PlatformOutboxEvent {
  id
  eventType
  aggregateType
  aggregateId
  missionId?
  operationId?
  payload
  schemaVersion
  idempotencyKey
  createdAt
  publishedAt?
}
```

## BrainInboxEvent

```ts
BrainInboxEvent {
  id
  sourceEventId
  eventType
  idempotencyKey
  receivedAt
  processedAt?
  status
}
```

Brain também possui Outbox. Platform possui Inbox.

---

# 10. Event Envelope

```ts
LdcnEventEnvelope<T> {
  eventId
  eventType
  eventVersion
  correlationId
  causationId?
  operationId?
  tenantId
  workspaceId
  projectId?
  missionId?
  actorType
  actorId?
  occurredAt
  payload: T
}
```

---

# 11. Operation Runtime

```ts
Operation {
  id
  tenantId
  workspaceId
  missionId?
  type
  status
  stage
  progress
  requestedBy
  correlationId
  startedAt?
  completedAt?
  failedAt?
  errorCode?
  errorDetails?
}
```

Status:

```text
PENDING
QUEUED
RUNNING
WAITING_APPROVAL
SUCCEEDED
FAILED
CANCELLED
```

---

# 12. Gerador Inteligente completo

```text
USER IDEA
↓
Platform MissionCommand
↓
Operation
↓
Brain INTENT_ANALYSIS
↓
ProjectIntentProposal
↓
Platform Policy
↓
ProjectIntentCanonical

↓
Brain REQUIREMENTS_ANALYSIS
↓
RequirementsContract DRAFT
↓
approval
↓
APPROVED

↓
Brain TOPOLOGY_RECOMMENDATION
↓
TopologyProposal
↓
TopologyPolicy
↓
SolutionTopology

↓
Brain SOLUTION_PLANNING
↓
Brain STACK_SELECTION
↓
SolutionProposal
↓
Stack Selection Policy
↓
ApprovedSolution

↓
Brain STACK_ARCHITECTURE
↓
StackArchitectureProposals
↓
Review / Contract Approval
↓
Approved Architectures

↓
Brain TEAM_COMPOSITION
↓
TeamCompositionProposal
↓
TeamPolicy
↓
TeamComposer V2
↓
Mission Team

↓
Brain PIPELINE_COMPOSITION
↓
PipelineProposal
↓
PipelinePolicy
↓
MissionPipelinePlan

↓
Jobs
↓
Brain JOB_CLASSIFICATION
↓
JobClassification
↓
Brain WORK_ROUTING
↓
WorkRoutingProposal
↓
RoutingPolicy
↓
IntelligentWorkRouter
↓
Assignment
```

---

# 13. BrainGateway

```ts
interface BrainGateway {
  submitDecision<TInput>(
    request: BrainDecisionRequest<TInput>
  ): Promise<BrainOperationRef>;

  getDecision(
    brainOperationId: string
  ): Promise<BrainDecisionStatus>;

  cancelDecision(
    brainOperationId: string
  ): Promise<void>;

  health(): Promise<BrainHealth>;
}
```

---

# 14. BrainDecisionRequest

```ts
BrainDecisionRequest<T> {
  requestId
  decisionType
  tenantContext
  missionContext?
  input: T
  inputVersionRefs[]
  contextSnapshotRef?
  expectedOutputSchema
  expectedOutputVersion
  idempotencyKey
  correlationId
  requestedAt
}
```

---

# 15. BrainDecisionEnvelope

```ts
BrainDecisionEnvelope<T> {
  requestId
  brainRunId
  decisionType
  outputSchema
  outputSchemaVersion
  proposal: T
  confidence
  assumptions[]
  ambiguities[]
  knowledgeRefs[]
  contextHash
  providerMetadata
  usage
  createdAt
}
```

`rationale` é resumo auditável, nunca chain-of-thought.

---

# 16. Brain Decision Types

```text
INTENT_ANALYSIS
REQUIREMENTS_ANALYSIS
TOPOLOGY_RECOMMENDATION
SOLUTION_PLANNING
STACK_SELECTION
STACK_ARCHITECTURE
TEAM_COMPOSITION
PIPELINE_COMPOSITION
JOB_CLASSIFICATION
WORK_ROUTING
TEAM_TRANSITION
SCOPE_EXPANSION
REPLAN
COGNITIVE_CODE_CHANGESET
REPAIR_ADVISORY
LEARNING_INTERPRETATION
```

---

# 17. PlatformContextSnapshot

```ts
PlatformContextSnapshot {
  snapshotId
  missionId
  approvedSolutionVersion?
  contractVersions[]
  taskId?
  artifactRefs[]
  evidenceRefs[]
  capabilityRefs[]
  stackDefinitionRefs[]
  policyRefs[]
  contextHash
}
```

O Brain recebe somente contexto mínimo.

---

# 18. Context minimization

Java Job:

```text
Mission summary
ApprovedSolution
Java StackDefinition
relevant Requirements
Java Architecture Contract
BackendPlan
affected artifacts
capability packs
task
previous evidence
```

Não enviar:

```text
Flutter team
Rust knowledge
entire audit history
unrelated projects
```

---

# 19. Prompt Runtime

```text
DecisionHandler
↓
ContextResolver
↓
KnowledgeSelector
↓
PromptCompiler
↓
LlmGateway
↓
Provider
↓
StructuredOutput
↓
Zod Validator
↓
BrainDecisionEnvelope
```

---

# 20. LlmGateway

Adapters:

```text
DeepSeekProvider
ClaudeProvider
GeminiProvider
FakeProvider
```

Nunca:

```text
Agent -> provider
```

diretamente.

---

# 21. Model Policy

```ts
BrainModelPolicy {
  decisionType
  allowedProviders[]
  preferredModels[]
  maxInputTokens
  maxOutputTokens
  temperatureProfile
  maxAttempts
  budgetClass
}
```

---

# 22. Budget

```text
Platform Budget Authority
↓
BrainBudgetGrant
↓
Brain usage
↓
Platform Usage Ledger
```

```ts
BrainBudgetGrant {
  operationId
  missionId
  maxTokens
  maxCost
  expiresAt
}
```

---

# 23. Structured Output Schemas

```text
ProjectIntentProposalV1
RequirementsProposalV1
TopologyProposalV1
SolutionProposalV1
StackSelectionProposalV1
StackArchitectureProposalV1
TeamCompositionProposalV1
PipelineProposalV1
JobClassificationProposalV1
WorkRoutingProposalV1
TeamTransitionProposalV1
ScopeExpansionProposalV1
JavaCodeChangeSetV1
```

---

# 24. Policy Validation

```text
Brain proposal
↓
Schema valid
↓
Platform Domain Policy
↓
State Transition Guard
↓
Materializer
```

---

# 25. Decision Materializers

```text
IntentDecisionMaterializer
RequirementsDecisionMaterializer
TopologyDecisionMaterializer
SolutionDecisionMaterializer
ArchitectureDecisionMaterializer
TeamDecisionMaterializer
PipelineDecisionMaterializer
JobClassificationMaterializer
RoutingDecisionMaterializer
TeamTransitionMaterializer
ScopeExpansionMaterializer
```

---

# 26. Catálogo permanente da empresa

```text
StackRegistry
CapabilityRegistry
AgentDefinitionCatalog
PromptDefinitionCatalog
ToolProfileCatalog
TerritoryProfileCatalog
StackTeamProfileCatalog
RuntimeSupportRegistry
```

---

# 27. StackDefinition

```ts
StackDefinition {
  key
  version
  languageKey
  frameworkKeys[]
  supportedTargets[]
  supportedVersions[]
  capabilityKeys[]
  architectureAgentKey
  roleKeys[]
  goodFor[]
  weakFor[]
  territoryProfileKey
  buildProfileKey
  testProfileKey
  runtimeProfileKey
  runtimeSupportStatus
  status
}
```

---

# 28. Stack Engineering Units

```text
stack.java.spring-boot

stack.typescript.angular
stack.typescript.react
stack.typescript.nextjs
stack.typescript.astro
stack.typescript.nestjs

stack.csharp.aspnet-core

stack.python.fastapi
stack.python.django
stack.python.ai
stack.python.data

stack.dart.flutter
stack.kotlin.android
stack.swift.ios

stack.go.backend
stack.rust.backend

data.sql
integration.unit
```

---

# 29. AgentDefinition Factory AI-assisted

```text
Admin Bootstrap Command
↓
Brain AGENT_DEFINITION_DESIGN
↓
AgentDefinitionProposal
↓
CatalogPolicy
↓
AgentDefinition persisted
```

Isso é administração de catálogo, não Mission execution.

---

# 30. AgentDefinition

```ts
AgentDefinition {
  key
  version
  stackKey?
  roleName
  roleMission
  level
  knowledgeRefs[]
  capabilityKeys[]
  promptTemplateKey
  outputSchemaKey
  allowedTools[]
  territoryProfileKey?
  reviewPolicyKey?
  delegationPolicyKey?
  memoryPolicy
  contextRequirements[]
  canExecute
  canReview
  canApprove
  canDelegate
  status
}
```

---

# 31. StackTeamProfile

```ts
StackTeamProfile {
  key
  stackKey
  version
  lowBaselineRoles[]
  mediumBaselineRoles[]
  highBaselineRoles[]
  specialistRules[]
  reviewRules[]
  minimumCapabilityCoverage[]
}
```

Baselines ajudam. Não substituem análise da IA.

---

# 32. AI Team Composition

```text
ApprovedSolution
↓
Brain TEAM_COMPOSITION
↓
TeamCompositionProposal
↓
TeamCompositionPolicy
↓
TeamComposer V2
↓
AgentInstances
```

---

# 33. TeamCompositionPolicy

Valida:

```text
roles existem
stack autorizada
capabilities cobertas
review independence
territories
runtime support
risk rules
mandatory specialists
```

---

# 34. Job Classification

```text
AgentTask
↓
deterministic pre-analysis
↓
Brain JOB_CLASSIFICATION
↓
JobClassificationProposal
↓
JobClassificationPolicy
↓
JobClassificationCanonical
```

---

# 35. Work Routing

```text
JobClassification
↓
Brain WORK_ROUTING
↓
WorkRoutingProposal
↓
RoutingPolicy
↓
IntelligentWorkRouter
↓
AgentAssignment
```

---

# 36. RoutingPolicy

```text
AgentInstance belongs Mission
stack authorized
capabilities sufficient
territory allowed
delegation allowed
agent READY
reviewer != executor
workload
risk policy
```

---

# 37. Team Switching

```text
Execution Result
↓
Brain TEAM_TRANSITION
↓
TeamTransitionProposal
↓
TeamSwitchPolicy
↓
TeamSwitchDecision
↓
HandoffPackage
```

---

# 38. Handoff

```ts
AgentHandoff {
  id
  missionId
  taskId
  sourceTeamKey
  targetTeamKey
  handoffType
  contractRefs[]
  artifactRefs[]
  evidenceRefs[]
  decisionRefs[]
  unresolvedDependencies[]
  acceptanceCriteria[]
  contextHash
  status
}
```

---

# 39. Integration Unit

```text
Source Stack Team
↓
Handoff
↓
Integration Unit
↓
Integration Validation
↓
Target Stack Team
```

Brain recomenda. Policy decide se é obrigatória.

---

# 40. Scope Expansion

```text
Brain detects missing target
↓
ScopeExpansionProposal
↓
Approval Policy
↓
Approval
↓
ApprovedSolution vNext
↓
recompose affected architecture/team/pipeline
```

---

# 41. Dynamic Pipeline

Brain:

```text
PipelineProposal
```

Platform valida:

```text
approved targets only
supported runtimes only
acyclic dependencies
mandatory gates
```

e materializa:

```text
MissionPipelinePlan
```

---

# 42. Pipeline não executa

```text
PipelinePlan
↓
AgentTasks
↓
Assignment
↓
AgentExecution
```

Não criar WorkflowEngine paralelo.

---

# 43. Execution Runtime

Platform reutiliza:

```text
AgentTask
AgentAssignment
AgentExecution
AgentEvidence
AgentExecutionContextSnapshot
```

Brain participa quando a execução é cognitiva.

---

# 44. Cognitive Execution

```text
AgentExecution
↓
Platform ContextSnapshot
↓
Brain COGNITIVE_CODE_CHANGESET
↓
ChangeSet
↓
Platform Policy
↓
Artifact Candidate
↓
Workspace
↓
Inspector
↓
Build/Test
```

Brain nunca escreve filesystem.

---

# 45. Artifact Runtime

```text
ArtifactRegistry
ProjectArtifact
ArtifactRevision
```

Código gerado nasce:

```text
CANDIDATE
```

---

# 46. Workspace Runtime

```text
Artifact candidate set
↓
isolated WorkspaceSession
↓
materialization
↓
inspect
↓
build
↓
test
↓
evidence
```

Workspace não é source of truth.

---

# 47. Tool Runtime

```text
RestrictedToolRuntime
```

Sem arbitrary shell.

---

# 48. StackRuntimeDefinition

```ts
StackRuntimeDefinition {
  stackKey
  runtimeSupportStatus
  sourceInspectorKey?
  symbolInspectorKey?
  buildToolKey?
  testToolKey?
  changeSetSchemaKey?
  sandboxProfileKey?
  repairSupport
}
```

---

# 49. Runtime status

```text
CATALOG_ONLY
PLANNING_SUPPORTED
GENERATION_SUPPORTED
BUILD_SUPPORTED
REPAIR_SUPPORTED
FULLY_SUPPORTED
```

---

# 50. Honest Capability

Se o Brain recomendar uma stack `CATALOG_ONLY` e a Mission exigir execução completa:

```text
RUNTIME_SUPPORT_REQUIRED
```

Nunca:

```text
READY_FOR_EXECUTION
```

---

# 51. Readiness Guards

```text
ApprovedSolution.deliveryTargets >= 1
selectedStacks >= 1
required architectures approved
AgentTeam valid
Pipeline nodes >= 1
contracts approved
runtime support sufficient
no stale context
no blocking conflict
```

Só então:

```text
READY_FOR_EXECUTION
```

---

# 52. Landing Page constitutional scenario

O resultado vazio atual deve ser impossível.

```text
quero uma landing page
↓
AI Intent
↓
AI Requirements
↓
AI Topology
→ FRONTEND_ONLY
↓
AI Technology Selection
→ Astro / Next / React / Angular candidates
↓
Selected stack
↓
ApprovedSolution
↓
Stack Architecture
↓
AI Team Proposal
↓
Mission Team
↓
Pipeline
↓
READY_FOR_EXECUTION
```

Não hardcode Astro pela palavra "landing page".

---

# 53. Review Runtime

```text
Execution
↓
ReviewRouting
↓
Independent Reviewer
↓
AgentReview
```

---

# 54. Gate Runtime

```text
BUILD_GATE
TEST_GATE
SYMBOL_GATE
ARTIFACT_GATE
SECURITY_GATE
INTEGRATION_GATE
ARCHITECTURE_GATE
```

---

# 55. Repair Runtime

```text
FAILED Execution
↓
FailureSnapshot
↓
RepairEligibility
↓
EngineeringRepairSession
↓
new AgentExecution
```

Brain pode produzir `RepairAdvisory`.

---

# 56. Promotion

```text
candidate artifacts
↓
evidence
↓
reviews
↓
gates
↓
promotion
```

Brain não possui PromotionService.

---

# 57. Learning Intelligence

```text
Decision
↓
Execution
↓
Outcome
↓
LearningOutcome
↓
FeatureExtractor
↓
HeuristicPredictor / ML Shadow
↓
future Brain signal
```

---

# 58. PredictionGateway

```ts
interface PredictionGateway {
  predictStackFit(...)
  predictJobComplexity(...)
  predictJobRisk(...)
  rankAgents(...)
  rankCapabilities(...)
  predictRepairSuccess(...)
  estimateCost(...)
}
```

---

# 59. ML Shadow

Primeiro:

```text
AI decision
+
ML prediction
```

ML não altera decisão.

Depois, se provado:

```text
ML_ASSISTED
```

---

# 60. Identity e Tenancy

Platform possui:

```text
User
Organization
Workspace
Membership
Role
Permission
```

Brain recebe somente `TenantContext` mínimo.

---

# 61. Authorization interna

Frontend → Platform:

```text
JWT/session
```

Platform → Brain:

```text
internal service identity
signed service token
```

Futuro:

```text
mTLS
```

---

# 62. Secrets

Nunca persistir em:

```text
PromptSnapshot
Event payload
Artifact
Audit payload
BrainDecisionEnvelope
```

---

# 63. Prompt Injection

Brain separa:

```text
SYSTEM RULES
TRUSTED PLATFORM KNOWLEDGE
APPROVED PROJECT CONTEXT
UNTRUSTED USER/PROJECT DATA
```

---

# 64. Internal Brain API

```text
POST /internal/v1/decisions
GET  /internal/v1/decisions/:id
POST /internal/v1/decisions/:id/cancel
GET  /internal/v1/health
GET  /internal/v1/capabilities
```

---

# 65. Public Platform API

```text
/api/v1/session
/api/v1/workspaces
/api/v1/projects
/api/v1/missions

/api/v1/missions/:id/generator
/api/v1/missions/:id/intent
/api/v1/missions/:id/requirements
/api/v1/missions/:id/topology
/api/v1/missions/:id/solution
/api/v1/missions/:id/architectures
/api/v1/missions/:id/team
/api/v1/missions/:id/pipeline
/api/v1/missions/:id/tasks
/api/v1/missions/:id/artifacts
/api/v1/missions/:id/reviews
/api/v1/missions/:id/gates
/api/v1/missions/:id/operations
/api/v1/missions/:id/events
```

---

# 66. Commands públicos

```text
POST /api/v1/missions
POST /api/v1/missions/:id/analyze
POST /api/v1/missions/:id/generate-requirements
POST /api/v1/missions/:id/resolve-topology
POST /api/v1/missions/:id/plan-solution
POST /api/v1/missions/:id/approve-solution
POST /api/v1/missions/:id/compose-architectures
POST /api/v1/missions/:id/compose-team
POST /api/v1/missions/:id/compose-pipeline
POST /api/v1/tasks/:id/route
POST /api/v1/tasks/:id/run
POST /api/v1/tasks/:id/request-reviews
POST /api/v1/missions/:id/replan
```

---

# 67. SSE para frontend premium

```text
GET /api/v1/stream
```

Eventos:

```text
operation.started
operation.progress
operation.completed
operation.failed

mission.state.changed
mission.solution.proposed
mission.solution.approved

architecture.updated
team.composed
pipeline.updated

task.created
task.routed
task.started
task.completed
task.failed

handoff.created
review.created
gate.evaluated

artifact.created
artifact.promoted

brain.decision.started
brain.decision.completed
brain.decision.failed
```

---

# 68. FrontendEvent

```ts
FrontendEvent<T> {
  id
  type
  occurredAt
  workspaceId
  projectId?
  missionId?
  taskId?
  operationId?
  payload: T
}
```

---

# 69. Read models para frontend premium

Criar:

```text
MissionOverviewReadModel
MissionCommandCenterReadModel
MissionPipelineReadModel
MissionTeamReadModel
MissionDecisionTimelineReadModel
MissionCostReadModel
```

---

# 70. MissionOverviewReadModel

```ts
MissionOverviewReadModel {
  mission
  generatorState
  currentOperation?
  intentSummary
  requirementsSummary
  topologySummary
  solutionSummary
  architectureSummary
  teamSummary
  pipelineSummary
  taskSummary
  artifactSummary
  reviewSummary
  gateSummary
  aiUsageSummary
  costSummary
  nextAction
  blockers[]
}
```

---

# 71. NextAction

```text
ANALYZE_INTENT
GENERATE_REQUIREMENTS
APPROVE_REQUIREMENTS
RESOLVE_TOPOLOGY
PLAN_SOLUTION
APPROVE_SOLUTION
COMPOSE_ARCHITECTURES
COMPOSE_TEAM
COMPOSE_PIPELINE
START_EXECUTION
RESOLVE_SCOPE_EXPANSION
CONTINUE_HANDOFF
REQUEST_REVIEW
PROMOTE
NONE
```

Backend calcula. Frontend renderiza.

---

# 72. Regra de orchestration frontend

Nunca:

```text
Angular:
create task
then assign
then start
then execute
```

Sempre:

```text
Angular sends one command
↓
Platform application service coordinates
↓
frontend receives state/events
```

---

# 73. CQRS leve

Separar:

```text
commands mutate
queries read
events notify
```

Sem obrigar framework CQRS.

---

# 74. Queue e Redis

Não obrigatórios no início.

Começar com:

```text
Postgres durable operations
Outbox/Inbox
```

Adicionar Redis/BullMQ quando necessário.

---

# 75. Idempotência

```text
requestId
idempotencyKey
expectedVersion
```

Double-click não duplica estado.

---

# 76. Concurrency

```text
optimistic version
transaction
specific unique constraints
state guards
```

Nunca capturar `P2002` genérico.

---

# 77. Stale Context

Brain registra:

```text
inputVersionRefs
contextHash
```

Platform valida antes de materializar.

Se mudou:

```text
BRAIN_DECISION_STALE
```

---

# 78. Error model

```ts
ApiError {
  code
  message
  status
  correlationId
  details?
  retryable
}
```

---

# 79. Brain errors

```text
BRAIN_UNAVAILABLE
BRAIN_TIMEOUT
BRAIN_BUDGET_EXCEEDED
BRAIN_OUTPUT_INVALID
BRAIN_DECISION_STALE
BRAIN_POLICY_REJECTED
BRAIN_SCHEMA_UNSUPPORTED
BRAIN_PROVIDER_UNAVAILABLE
```

---

# 80. Domain errors

```text
GENERATOR_INTENT_NOT_READY
GENERATOR_REQUIREMENTS_NOT_APPROVED
GENERATOR_TOPOLOGY_NOT_APPROVED
GENERATOR_SOLUTION_NOT_APPROVED

SOLUTION_TARGET_FORBIDDEN
SOLUTION_STACK_UNSUPPORTED
SOLUTION_SELECTION_REQUIRED

ARCHITECTURE_CONFLICT_OPEN

GENERATOR_TEAM_NOT_READY
GENERATOR_PIPELINE_NOT_READY

ROUTING_CAPABILITY_GAP
ROUTING_NO_EXECUTOR
ROUTING_NO_REVIEWER
ROUTING_STACK_OUT_OF_SCOPE

TEAM_SWITCH_TARGET_UNAVAILABLE
HANDOFF_INCOMPLETE

SCOPE_EXPANSION_REQUIRED
RUNTIME_SUPPORT_REQUIRED
```

---

# 81. Audit

Responder:

```text
quem pediu?
qual operation?
qual Brain decision?
qual provider/model?
qual proposal?
qual policy validou?
qual estado canônico foi criado?
qual versão?
qual reviewer?
qual gate?
```

---

# 82. Observability

Spans:

```text
http.command
platform.operation
brain.request
brain.context
brain.prompt
brain.llm
brain.validation
platform.policy
platform.materialize
task.execution
tool.invoke
build
test
review
gate
repair
promotion
```

---

# 83. Platform metrics

```text
operations_total
operations_failed
mission_time_to_ready
mission_blocked_total
routing_duration
routing_failure_total
task_execution_total
task_failure_total
build_success_rate
test_success_rate
gate_reject_rate
repair_success_rate
artifact_promotion_rate
```

---

# 84. Brain metrics

```text
brain_decision_total
brain_decision_duration
brain_decision_failure
brain_llm_calls
brain_tokens_input
brain_tokens_output
brain_cost
brain_schema_repair_total
brain_stale_decision_total
brain_provider_failure
brain_confidence_distribution
```

---

# 85. Logs

Structured JSON com:

```text
correlationId
operationId
missionId
taskId
brainRunId
```

Sem secrets.

---

# 86. Contract tests Platform ↔ Brain

```text
BrainDecisionRequest schema
BrainDecisionEnvelope schema
EventEnvelope schema
version compatibility
```

---

# 87. Integration tests

```text
Platform real Postgres
Brain FakeLlmProvider
real schema validation
Outbox/Inbox
```

---

# 88. Fake Provider

Obrigatório para:

```text
CI deterministic
zero external cost
no real provider
fixture outputs
```

---

# 89. E2E principal

```text
create Mission
↓
intent
↓
requirements
↓
topology
↓
solution
↓
stack selected
↓
architecture
↓
team
↓
pipeline
↓
task
↓
routing
↓
execution
↓
build/test
↓
review
↓
gate
↓
promotion
```

---

# 90. Landing Page E2E

Provar:

```text
FRONTEND_ONLY
no backend
no mobile
no DB unless justified
candidate stacks exist
selected stack exists
AgentTeam non-empty
Pipeline non-empty
READY only after all guards
```

---

# 91. Enterprise E2E

ERP deve provar:

```text
multi-surface possible
Java/.NET evaluated
Angular/React evaluated
DB required
higher security risk
larger Team proposal
Integration Unit when cross-stack
```

---

# 92. Scope Expansion E2E

```text
Java + Angular
↓
request mobile
↓
no Flutter agent before approval
↓
ScopeExpansionProposal
↓
ApprovedSolution vNext
↓
Flutter architecture/team/pipeline
```

---

# 93. Routing E2E

Simple Job:

```text
minimal Job Team
no architect if unnecessary
reviewer != executor
```

Security Job:

```text
Security Specialist recommended/required
risk-aware routing
```

---

# 94. Team Switch E2E

```text
Java endpoint
↓
Integration Unit
↓
Angular client
```

Provar Handoff estruturado.

---

# 95. Failure E2E

```text
compile fail
↓
FailureSnapshot
↓
RepairPolicy
↓
new Execution
↓
repair
↓
tests
↓
review/gate
```

---

# 96. Security tests

```text
cross-tenant denied
brain cannot write platform schema
prompt injection cannot alter system rules
secret never persisted
artifact cannot cross Mission
unsupported tool rejected
```

---

# 97. Platform folder structure

```text
apps/api/src/
├── identity/
├── tenancy/
├── workspace/
├── project/
├── mission/
├── generator/
├── catalog/
├── work/
├── runtime/
├── review/
├── gates/
├── repair/
├── operations/
├── events/
├── audit/
├── telemetry/
└── brain-integration/
```

---

# 98. Brain folder structure

```text
apps/brain/src/
├── api/
├── decisions/
├── intent/
├── requirements/
├── topology/
├── solution/
├── technology/
├── architecture/
├── team/
├── jobs/
├── routing/
├── transitions/
├── scope/
├── cognitive-execution/
├── repair-advisory/
├── learning/
├── context/
├── knowledge/
├── prompts/
├── schemas/
├── llm/
├── providers/
├── usage/
├── audit/
└── telemetry/
```

---

# 99. packages/contracts

```text
packages/contracts/
├── events/
├── brain/
├── frontend/
├── operations/
└── common/
```

Sem shared domain services.

---

# 100. Prompt — Boundary Audit

```text
# LDCN OS — PLATFORM/BRAIN BOUNDARY AUDIT

Verifique:

Platform owns:
canonical state
auth/tenancy
contracts
AgentTeam
Assignment
Execution
Artifacts
Reviews
Gates
Repair
Promotion

Brain owns:
cognitive decision runs
prompt snapshots
provider calls
structured proposals
learning predictions

Proibir:
Brain direct write em Platform DB
Platform direct provider call
frontend direct Brain access
shared domain service imports
Brain self-materialization

Entregar:
violations[]
requiredRefactors[]
contractGaps[]
securityRisks[]
testGaps[]
```

---

# 101. Prompt — Brain Foundation

```text
# LDCN OS — IMPLEMENT BRAIN SERVICE FOUNDATION

Implementar primeiro:

BrainModule
BrainDecisionRequestV1
BrainDecisionEnvelopeV1
BrainDecisionRegistry
BrainDecisionRun
BrainGateway contract
FakeLlmProvider
PromptCompiler integration
LlmGateway integration
StructuredOutput validation
Brain health endpoint
Brain audit/usage
Platform BrainGateway adapter
contract tests

NÃO implementar ainda:
all decision handlers
frontend
Redis
ML real

Provar:
Platform -> Brain -> proposal -> policy -> canonical state.

Sem commit/push antes do relatório.
```

---

# 102. Prompt — Company Catalog Bootstrap

```text
# LDCN OS — BOOTSTRAP COMPANY CATALOG

Stacks:
Java/Spring Boot
Angular
React
Next.js
Astro
NestJS
ASP.NET Core
FastAPI
Django
Python AI
Python Data
Flutter
Kotlin Android
Swift iOS
Go
Rust
SQL/Data
Integration Unit

Para cada:
StackDefinition
CapabilityDefinitions
AgentDefinitions
StackTeamProfile LOW/MEDIUM/HIGH
PromptTemplates
ToolProfile
TerritoryProfile
ReviewPolicy
RuntimeSupportProfile
OutputSchemas

AgentDefinitions são catálogo.
AgentInstances só em Mission.

AI pode produzir AgentDefinitionProposal.
Platform policy valida e persiste.

Não marcar runtime como supported se não existir.
```

---

# 103. Prompt — Fix Landing Page

```text
# LDCN OS — FIX EMPTY READY_FOR_EXECUTION

Reproduzir:
"quero uma landing page"

Estado atual incorreto:
0 selected stacks
0 AgentInstances
0 pipeline nodes
READY_FOR_EXECUTION

Corrigir semanticamente:

AI Intent
→ Requirements
→ AI Topology
→ FRONTEND
→ AI Stack Selection
→ selected stack
→ ApprovedSolution
→ architecture
→ AI Team Proposal
→ TeamComposer
→ Pipeline
→ READY

Adicionar guards:
empty executable solution cannot activate
empty executable team cannot approve
empty executable pipeline cannot approve
READY requires complete prerequisites

Não hardcode Astro por palavra-chave.
```

---

# 104. Slices de implementação

## B0 — Boundary

```text
apps/api
apps/brain
packages/contracts
BrainGateway
health
contract tests
```

## B1 — Brain Decision Runtime

```text
DecisionRequest
DecisionRun
DecisionEnvelope
PromptCompiler
LlmGateway
FakeProvider
schema validation
usage
```

## B2 — Planning

```text
Intent
Requirements
Topology
Solution
Technology Selection
```

## B3 — Catalog

```text
StackRegistry
CapabilityRegistry
AgentDefinitions
StackTeamProfiles
RuntimeSupport
```

## B4 — Architecture + Team

```text
StackArchitecture
ArchitectureConflict
TeamCompositionProposal
TeamComposer V2
```

## B5 — Pipeline + Jobs

```text
PipelineProposal
PipelinePlan
JobClassification
WorkRouting
```

## B6 — Team Switching

```text
TeamTransitionProposal
TeamSwitchDecision
Handoff
Integration Unit
Scope Expansion
```

## B7 — Execution Integration

```text
cognitive execution via Brain
Artifact candidate
Workspace
Tools
Build/Test
Evidence
```

## B8 — Governance

```text
Review
Gates
Repair
Promotion
```

## B9 — Frontend Readiness

```text
Operation read models
MissionOverview
NextAction
SSE
Decision timeline
Cost/AI usage
```

## B10 — Learning

```text
LearningOutcome
HeuristicPredictor
ML Shadow
```

---

# 105. Backend pronto para Frontend Premium quando

```text
Platform Core stable
Brain Service stable
Platform ↔ Brain contracts versioned
idempotency working
operations observable
SSE available

planning flow works
catalog exists
team generation works
routing works
handoff works

execution runtime integrated
artifact/workspace works
build/test evidence works
reviews/gates work
repair works where supported

MissionOverview exists
NextAction exists
errors normalized
auth/tenant guards exist
audit exists
telemetry exists

frontend has no direct Brain dependency
```

---

# 106. Contrato para o futuro Frontend Premium

Frontend precisa somente de:

```text
GET MissionOverview
GET MissionTimeline
GET MissionTeam
GET Pipeline
GET Tasks
GET Artifacts
GET Reviews/Gates
GET Cost/AI Usage
GET Operations
SSE stream
POST application commands
```

---

# 107. Futuro Frontend Premium

Não implementar agora.

Backend já prepara dados para:

```text
Premium Command Center
Mission Wizard
AI Decision Inspector
Solution Comparison
Architecture Viewer
Agent Team Room
Pipeline Timeline
Task Board
Execution Viewer
Build/Test Console
Artifact Explorer
Review/Gate Center
Repair Timeline
Cost/Token Dashboard
Audit Timeline
```

---

# 108. Fluxo premium futuro

```text
User creates Mission
↓
Wizard
↓
Operation starts
↓
live SSE progress
↓
Intent
↓
Requirements
↓
Topology
↓
Stack Comparison
↓
Approval
↓
Architecture
↓
AI Team
↓
Pipeline
↓
Execution
↓
Build/Test
↓
Review/Gates
↓
Preview/Deploy later
```

---

# 109. Regra final

> **O Brain Service é o cérebro da empresa, mas o Platform Core é o corpo, o sistema nervoso e a constituição operacional.**

> **O Brain não é acoplado ao frontend e não possui o estado canônico.**

> **A comunicação Platform ↔ Brain usa contratos versionados, snapshots mínimos, operations, events e policies.**

> **Quando o backend estiver fechado, o frontend premium será construído sobre read models e commands estáveis, sem conhecer a complexidade interna.**

---

# 110. Mapa final

```text
                            ┌────────────────────┐
                            │  PREMIUM FRONTEND  │
                            │     Angular        │
                            └─────────┬──────────┘
                                      │
                               Public API + SSE
                                      │
                                      ▼
┌──────────────────────────────────────────────────────────────────┐
│                        PLATFORM CORE                             │
│                                                                  │
│ Identity / Tenant / Workspace / Project / Mission                │
│ Contracts / ApprovedSolution / Catalog                           │
│ TeamComposer / Jobs / Routing / Handoffs / Pipeline              │
│ AgentExecution / Artifacts / Workspace / Tools                   │
│ Reviews / Gates / Repair / Promotion                             │
│ Operations / Audit / Telemetry / Read Models                     │
└──────────────────────────────┬───────────────────────────────────┘
                               │
                    BrainGateway + Events
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                         BRAIN SERVICE                            │
│                                                                  │
│ Intent / Requirements / Topology / Solution / Stack Selection   │
│ Architecture / Team Intelligence / Job Intelligence              │
│ Routing Advice / Team Transition / Scope / Replanning            │
│ PromptCompiler / LlmGateway / Providers                          │
│ Structured Output / Usage / Learning / ML                        │
└──────────────────────────────────────────────────────────────────┘
```

## 🔗 Documentos relacionados

- [[30 - AI-First Intelligence Constitution]]
- [[31 - Agent Definition Factory e Team Factory]]
- [[32 - AI Decision Runtime]]
- [[33 - Stack Teams Bootstrap do Zero]]
- [[34 - Guardrails de Readiness e Correção da Implementação]]
- [[35 - Cérebro Operacional AI-First]]
- [[23 - Backend NestJS APIs e Persistência]]
- [[26 - Critérios de Aceite e Testes]]
- [[27 - Slices Prompts Codex e Roadmap]]


# Internacionalização Platform ↔ Brain

Toda request cognitiva destinada a produzir conteúdo visível ao usuário deve carregar:

```text
presentationLocale
```

Valores iniciais:

```text
pt-BR
en
es
fr
```

Enums e códigos canônicos permanecem neutros. `summary`, `rationaleSummary`, `clarificationQuestion` e demais campos de apresentação devem respeitar o idioma do usuário.

Veja [[53 - Internacionalização Completa - FR BR ES EN]].
