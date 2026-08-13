---
title: "23 - Backend NestJS APIs e Persistência"
aliases:
  - "Backend NestJS APIs e Persistência"
tags:
  - ldcn
  - gerador-inteligente
  - arquitetura
status: canonico
---

# 23 - Backend NestJS APIs e Persistência

[[00 - LDCN OS - Mapa Raiz Completo|⬅ Mapa Raiz]] · [[22 - Observability Audit e Tracing|← Anterior]] · [[24 - Exemplos End-to-End|Próximo →]]

```text
apps/api/src/intelligent-generator/
├── application/
├── intent/
├── topology/
├── solution/
├── stack/
├── architecture/
├── team/
├── pipeline/
├── routing/
├── handoff/
├── integration/
├── expansion/
├── learning/
├── governance/
├── telemetry/
└── api/
```

---


## Application Services canônicos

### `IntelligentGeneratorCommandService`

Application service fina que coordena serviços existentes.

Métodos conceituais:

```text
analyzeIntent(missionId, input)
generateRequirements(missionId)
resolveTopology(missionId)
planSolution(missionId)
approveSolution(missionId, solutionProposalId)
composeArchitectures(missionId)
composeTeam(missionId)
composePipeline(missionId)
classifyTask(taskId)
routeTask(taskId)
switchTeam(taskId)
createHandoff(taskId)
proposeScopeExpansion(taskId)
replanSolution(missionId, reason)
```

Ela não contém conhecimento técnico de stack e não vira WorkflowEngine.

### `IntelligentGeneratorQueryService`

Read service:

```text
getGeneratorOverview(missionId)
getCurrentIntent(missionId)
getRequirements(missionId)
getTopology(missionId)
getSolutionProposal(missionId)
getStackCandidates(missionId)
getApprovedSolution(missionId)
getArchitectureDecisions(missionId)
getTeamComposition(missionId)
getPipeline(missionId)
getTaskRouting(taskId)
getTaskHandoffs(taskId)
getLearningSignals(missionId)
```

## Organização NestJS detalhada

```text
apps/api/src/intelligent-generator/
├── intelligent-generator.module.ts
├── application/
│   ├── intelligent-generator-command.service.ts
│   ├── intelligent-generator-query.service.ts
│   └── commands/
├── intent/
│   ├── project-intent.service.ts
│   ├── intent-cognitive-handler.ts
│   ├── project-intent.schema.ts
│   └── project-intent.policy.ts
├── topology/
│   ├── solution-topology.service.ts
│   ├── delivery-target-resolver.ts
│   └── topology-policy.ts
├── solution/
│   ├── solution-planner.service.ts
│   ├── technology-selector.service.ts
│   ├── solution-cognitive-handler.ts
│   └── solution-policy.ts
├── stack/
│   ├── stack-registry.service.ts
│   ├── stack-definition.ts
│   ├── stack-catalog.seed.ts
│   └── stack-fit.service.ts
├── architecture/
│   ├── stack-architecture-composer.service.ts
│   ├── architecture-decision.service.ts
│   └── architecture-conflict.service.ts
├── team/
│   ├── team-composer-v2.service.ts
│   ├── stack-team-profile.ts
│   └── team-sizing-policy.ts
├── routing/
│   ├── job-classifier.service.ts
│   ├── intelligent-work-router.service.ts
│   ├── capability-resolver.service.ts
│   ├── reviewer-resolver.service.ts
│   └── routing-policy.ts
├── handoff/
│   ├── team-switch-resolver.service.ts
│   ├── handoff-package.service.ts
│   └── handoff-policy.ts
├── pipeline/
│   ├── pipeline-composer.service.ts
│   ├── pipeline-template-registry.ts
│   └── pipeline-policy.ts
├── expansion/
│   ├── scope-expansion.service.ts
│   └── scope-impact-analyzer.ts
├── learning/
│   ├── learning-intelligence.service.ts
│   ├── prediction-gateway.ts
│   ├── heuristic-predictor.ts
│   ├── model-predictor.ts
│   ├── feature-extractor.ts
│   └── outcome-recorder.service.ts
├── governance/
│   ├── generator-state-machine.ts
│   ├── generator-policy.service.ts
│   ├── approval-policy.service.ts
│   └── generator-errors.ts
├── telemetry/
└── api/
```

## Limite entre domínio novo e runtime existente

Reutilizar obrigatoriamente:

```text
Mission
AgentDefinition
AgentInstance
AgentTeam
AgentTask
AgentTaskDependency
AgentAssignment
AgentExecution
AgentExecutionContextSnapshot
AgentEvidence
AgentHandoff
AgentReview
AgentGate
AgentGateResult
AgentContract
PromptCompiler
LlmGateway
Capability Packs
ContextAssembler
ArtifactRegistry
ProjectArtifact
ArtifactRevision
WorkspaceSession
RestrictedToolRuntime
EngineeringRepairSession
```

O Gerador Inteligente adiciona decisão e roteamento. Ele não duplica execução, artifact runtime, review, gate ou repair.

---

```text
ProjectIntent
SolutionTopology
DeliveryTarget
SolutionProposal
StackCandidateEvaluation
ApprovedSolution
ApprovedDeliveryTarget
ApprovedStackSelection
ArchitectureDecision
ArchitectureConflict
StackTeamProfile
JobClassification
WorkRoutingDecision
TeamSwitchDecision
HandoffPackage
ScopeExpansionProposal
MissionPipelinePlan
PipelineNode
PipelineDependency
GeneratorDecisionEvent
LearningOutcome
```

---

---

```text
Mission
AgentDefinition
AgentInstance
AgentTeam
AgentTask
AgentTaskDependency
AgentAssignment
AgentExecution
AgentExecutionContextSnapshot
AgentEvidence
AgentHandoff
AgentReview
AgentGate
AgentGateResult
AgentContract
LlmUsageRecord
PromptSnapshot
ArtifactRegistry
ProjectArtifact
ArtifactRevision
WorkspaceSession
EngineeringRepairSession
```

---

---

```text
POST /missions/:id/intelligent-generator/start
POST /missions/:id/intelligent-generator/analyze-intent
POST /missions/:id/intelligent-generator/generate-requirements
POST /missions/:id/intelligent-generator/resolve-topology
POST /missions/:id/intelligent-generator/plan-solution
POST /missions/:id/intelligent-generator/approve-solution
POST /missions/:id/intelligent-generator/compose-architectures
POST /missions/:id/intelligent-generator/compose-team
POST /missions/:id/intelligent-generator/compose-pipeline

POST /tasks/:id/intelligent-routing/classify
POST /tasks/:id/intelligent-routing/route
POST /tasks/:id/intelligent-routing/switch-team
POST /tasks/:id/intelligent-routing/handoff
POST /tasks/:id/intelligent-routing/propose-scope-expansion
```

---

---

```text
GET /missions/:id/intelligent-generator
GET /missions/:id/intelligent-generator/intent
GET /missions/:id/intelligent-generator/requirements
GET /missions/:id/intelligent-generator/topology
GET /missions/:id/intelligent-generator/solution
GET /missions/:id/intelligent-generator/stack-candidates
GET /missions/:id/intelligent-generator/architecture-decisions
GET /missions/:id/intelligent-generator/team
GET /missions/:id/intelligent-generator/pipeline
GET /missions/:id/intelligent-generator/learning

GET /tasks/:id/intelligent-routing
GET /tasks/:id/intelligent-routing/handoffs
```

---

---

Commands precisam ser retry-safe.

```text
same intent command -> same result
same topology -> return existing equivalent
double approve -> same ApprovedSolution
double compose-team -> no duplicate AgentInstances
double route -> no duplicate Assignment
double handoff -> same active HandoffPackage
```

Nunca capturar `P2002` genericamente.

---

---

Usar:

```text
version
expectedVersion
state guards
transactions
specific unique constraints
```

Possíveis keys:

```text
missionId + stage + activeVersion
taskId + classificationVersion
taskId + routingVersion
taskId + handoffSequence
```

---

---

Avaliar antes de implementar:

```text
ProjectIntent
SolutionTopology
DeliveryTarget
SolutionProposal
StackCandidateEvaluation
ApprovedSolution
ApprovedDeliveryTarget
ApprovedStackSelection
ArchitectureDecision
ArchitectureConflict
JobClassification
WorkRoutingDecision
TeamSwitchDecision
HandoffPackage
ScopeExpansionProposal
MissionPipelinePlan
PipelineNode
PipelineDependency
GeneratorDecisionEvent
LearningOutcome
```

`StackDefinition` pode começar em código/reference data.

---

---

Append-only.

```text
INTENT_ANALYZED
REQUIREMENTS_APPROVED
TOPOLOGY_PROPOSED
TOPOLOGY_APPROVED
SOLUTION_PROPOSED
SOLUTION_APPROVED
STACK_SELECTED
ARCHITECTURE_DECIDED
TEAM_COMPOSED
PIPELINE_COMPOSED
JOB_CLASSIFIED
JOB_ROUTED
TEAM_SWITCHED
HANDOFF_CREATED
SCOPE_EXPANSION_PROPOSED
EXECUTION_COMPLETED
REVIEW_COMPLETED
GATE_EVALUATED
LEARNING_OUTCOME_RECORDED
```

---



## 🔗 Documentos relacionados

- [[11 - Dynamic Pipeline Composer]]
- [[13 - Intelligent Work Router]]
- [[22 - Observability Audit e Tracing]]

---

[[00 - LDCN OS - Mapa Raiz Completo|⬅ Mapa Raiz]] · [[22 - Observability Audit e Tracing|← Anterior]] · [[24 - Exemplos End-to-End|Próximo →]]

> Fonte canônica: [[00 - LDCN OS - Mapa Raiz Completo]]
