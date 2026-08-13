---
title: "26 - Critérios de Aceite e Testes"
aliases:
  - "Critérios de Aceite e Testes"
tags:
  - ldcn
  - gerador-inteligente
  - arquitetura
status: canonico
---

# 26 - Critérios de Aceite e Testes

[[00 - LDCN OS - Gerador + Backend - Mapa Raiz|⬅ Mapa Raiz]] · [[25 - Prompts Mestres|← Anterior]] · [[27 - Slices Prompts Codex e Roadmap|Próximo →]]

## Estratégia de testes do cérebro

### Unitários

Priorizar serviços/policies puros:

```text
ProjectIntentPolicy
TopologyPolicy
TechnologySelector
StackFitService
TeamSizingPolicy
TeamCompositionPolicy
JobClassifierPolicy
RoutingPolicy
CapabilityResolver
TeamSwitchPolicy
HandoffPolicy
PipelinePolicy
ScopeExpansionPolicy
FeatureExtractor
HeuristicPredictor
```

### Invariant/property tests

Provar invariantes:

```text
backend-only never selects frontend
frontend-only never creates backend
mobile forbidden never creates mobile
reviewer != executor
out-of-scope stack never routes
team switch cannot target unauthorized team
handoff cannot cross Mission
pipeline contains only approved targets
```

### Integração

Usar:

```text
real PostgreSQL
real Prisma
FakeLlmProvider
deterministic StackRegistry
```

Cenários mínimos:

```text
1 landing page -> Astro -> no backend
2 backend-only -> Java -> no frontend/mobile
3 frontend-only -> Angular -> external API
4 full-stack -> Next.js only
5 Java + Angular -> Integration Unit
6 Java + Angular asks Flutter -> ScopeExpansionProposal
7 simple Java Job -> minimal Job Team
8 security Job -> Security Specialist
9 capability gap -> blocked
10 no reviewer -> blocked
11 stale ApprovedSolution -> blocked
12 double approval -> idempotent
13 Java -> Integration -> Angular Handoff
14 Review -> Rework handoff
```

### ML Shadow tests

Antes de ML influenciar decisão:

```text
prediction recorded
policy decision unchanged
model/version recorded
feature schema recorded
prediction failure does not break Mission
fallback works
```

---

A implementação futura só é correta quando provar:

```text
landing page não cria backend sem necessidade
backend-only não cria frontend/mobile
frontend-only não cria backend
mobile-only pode operar local
Next.js pode operar full-stack
Java não é preferência fixa
TypeScript não é preferência fixa
Stack selection explica trade-offs
FIXED mode respeita usuário
recommended target exige aprovação
Stack Architect é específico
TeamComposer não expande scope
Job Router chama subset mínimo
Team Switch é explícito
Handoff é estruturado
Cross-stack chama Integration Unit quando necessário
out-of-scope stack gera ScopeExpansionProposal
reviewer != executor
pipeline deriva da ApprovedSolution
contracts só existem para targets necessários
no CoT persisted
LLM via LlmGateway
ML advisory
gates independentes
F1-F5 preservadas
```

---


## Fora do escopo inicial

```text
No autonomous ML training
No vector DB by default
No Kubernetes requirement
No new WorkflowEngine
No duplicate AgentExecution
No duplicate Handoff runtime if AgentHandoff can be reused
No generic GlobalArchitect controlling every stack
No provider call outside LlmGateway
No browser orchestration
No deployment runtime unless explicitly phased
```



## 🔗 Documentos relacionados

- [[23 - Backend NestJS APIs e Persistência]]
- [[27 - Slices Prompts Codex e Roadmap]]

---

[[00 - LDCN OS - Gerador + Backend - Mapa Raiz|⬅ Mapa Raiz]] · [[25 - Prompts Mestres|← Anterior]] · [[27 - Slices Prompts Codex e Roadmap|Próximo →]]

> Fonte canônica: [[00 - LDCN OS - Gerador + Backend - Mapa Raiz]]
