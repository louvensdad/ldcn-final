---
title: "27 - Slices Prompts Codex e Roadmap"
aliases:
  - "Slices Prompts Codex e Roadmap"
tags:
  - ldcn
  - gerador-inteligente
  - arquitetura
status: canonico
---

# 27 - Slices Prompts Codex e Roadmap

[[00 - LDCN OS - Mapa Raiz Completo|⬅ Mapa Raiz]] · [[26 - Critérios de Aceite e Testes|← Anterior]] · [[28 - Decisão Final de Arquitetura|Próximo →]]

## Slice 1 — Planning Foundation

```text
ProjectIntent
SolutionTopology
DeliveryTarget
StackRegistry
SolutionProposal
StackCandidateEvaluation
ApprovedSolution
```

## Slice 2 — Team & Routing

```text
StackTeamProfile
TeamComposer V2
JobClassification
WorkRoutingDecision
IntelligentWorkRouter
ScopeExpansionProposal
```

## Slice 3 — Architecture

```text
StackArchitectureProposal via Contract Runtime
ArchitectureDecision
ArchitectureConflict
```

## Slice 4 — Pipeline & Handoff

```text
MissionPipelinePlan
PipelineNode
TeamSwitchDecision
HandoffPackage
Integration handoff
NextAction
```

## Slice 5 — Learning

```text
LearningOutcome
FeatureExtractor
PredictionGateway
HeuristicPredictor
shadow mode
```

## Slice 6 — ML futuro

```text
external inference
model registry
ML-assisted routing
ML-assisted stack fit
```

---

---

```text
# LDCN OS — INTELLIGENT GENERATOR MASTER BACKEND ANALYSIS

Objetivo:
analisar como implementar o Gerador Inteligente completo sem criar arquitetura paralela.

Antes de código:

1. Confirmar remote oficial e HEAD de v2-main.
2. Ler Constituição.
3. Ler Domain Model / Language Model.
4. Ler docs F1-F5.
5. Ler Mission Command Flow.
6. Mapear Mission, AgentTeam, AgentInstance, AgentTask, Assignment,
   Execution, Contract, PromptCompiler, LlmGateway, Capability,
   Review, Gate, Artifact, Workspace e Repair.
7. Mapear AgentHandoff existente e avaliar reutilização para HandoffPackage.
8. Mapear TeamComposer atual e plano de evolução para V2.
9. Mapear unique constraints.
10. Propor modelos mínimos Slice 1.
11. Não implementar.
12. Não tocar frontend.
13. Não criar migration.
14. Não commit/push.

Entregar:
A. Git baseline
B. architecture map
C. reuse map
D. new domain concepts
E. duplication risks
F. migration plan
G. APIs
H. idempotency plan
I. transaction boundaries
J. test matrix
K. slices
L. files previstos
```

---

---

```text
Implementar somente:

ProjectIntent
SolutionTopology
DeliveryTarget
StackRegistry
SolutionProposal
StackCandidateEvaluation
ApprovedSolution

Regras:
NestJS + Prisma + PostgreSQL.
Reutilizar Contract Runtime para Requirements.
StackDefinition em reference-data/code.
LLM via PromptCompiler/LlmGateway.
Zod schemas versionados.
Explicit scope guards.
Version/supersede.
Idempotency.
No frontend.
No TeamComposer V2.
No Router.
No Pipeline.
No ML.

Testar:
landing page
backend-only
frontend-only
mobile-only
Next fullstack
FIXED stack
recommended target
forbidden target
stale context
double approval

Sem commit/push.
Reportar primeiro.
```

---

---

```text
Implementar:

StackTeamProfile
TeamComposer V2 evolution
JobClassification
CapabilityResolver
IntelligentWorkRouter
WorkRoutingDecision
ScopeExpansionProposal

Reutilizar:
AgentCatalog
AgentTeam
AgentInstance
Assignment
Execution
ReviewPolicy
territory
workload
delegation rules.

Invariantes:
ApprovedSolution boundary
no out-of-scope stack
reviewer != executor
minimal Job Team
capability-aware
risk-aware
deterministic final selection
LLM only for ambiguous classification
no new execution engine

Integrated tests:
simple Java Job
security Java Job
Angular Job
cross-stack integration
capability gap
no reviewer
scope expansion
double route
stale routing
```

---

---

```text
Implementar arquitetura específica por stack usando Contract Runtime.

Para cada selected stack:
resolve architecture AgentDefinition
create cognitive task
execute via LlmGateway
validate StackArchitectureProposalV1
persist ArchitectureDecisions
route independent review
approve contract

Provar:
Java architect cannot own Angular architecture.
Angular architect cannot modify Java architecture.
Critical conflict blocks approval.
```

---

---

```text
Implementar:

MissionPipelinePlan
PipelineNode
PipelineDependency
TeamSwitchDecision
HandoffPackage
NextAction read model

Reutilizar AgentHandoff se semanticamente compatível.
Não criar duplicate handoff runtime.

Pipeline é declarativo.
Team Switch é explícito.
Handoff é estruturado.

Provar:
backend-only no frontend nodes.
frontend-only no backend nodes.
Next full-stack single path.
multi-stack integration node.
Java -> Integration -> Angular handoff.
Review -> Rework handoff.
Out-of-scope switch blocked.
```

---

---

```text
Implementar:

LearningOutcome
FeatureExtractor
PredictionGateway
HeuristicPredictor
shadow prediction recording

Não treinar ML.
Não usar external model service.
Não alterar decisão com prediction.

Registrar:
stack selection
team composition
job routing
team switch
build
test
repair
user choice
cost

Garantir:
no CoT
no secrets
versioned feature schema
prediction failure never breaks Mission
```

---

---

```text
66 - Intelligent Generator Overview
67 - Intelligent Generator Master Backend
68 - Project Intent Model
69 - Requirements Intelligence
70 - Solution Topology
71 - Solution Planner
72 - Stack Registry
73 - Technology Selection
74 - Approved Solution
75 - Stack Architecture Composer
76 - Architecture Decision Model
77 - TeamComposer V2
78 - Job Classification
79 - Intelligent Work Router
80 - Team Switching & Handoffs
81 - Dynamic Pipeline Composer
82 - Integration Runtime
83 - Generator Memory
84 - Learning Intelligence
85 - Generator Governance
86 - Generator Security
87 - Generator APIs
88 - Generator Testing Strategy
89 - Generator UX
90 - Generator Observability
91 - Generator MVP Delivery Plan
```

---



## 🔗 Documentos relacionados

- [[23 - Backend NestJS APIs e Persistência]]
- [[26 - Critérios de Aceite e Testes]]

---

[[00 - LDCN OS - Mapa Raiz Completo|⬅ Mapa Raiz]] · [[26 - Critérios de Aceite e Testes|← Anterior]] · [[28 - Decisão Final de Arquitetura|Próximo →]]

> Fonte canônica: [[00 - LDCN OS - Mapa Raiz Completo]]
