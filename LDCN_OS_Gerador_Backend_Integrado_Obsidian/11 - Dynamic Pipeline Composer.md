---
title: "11 - Dynamic Pipeline Composer"
aliases:
  - "Dynamic Pipeline Composer"
tags:
  - ldcn
  - gerador-inteligente
  - arquitetura
status: canonico
---

# 11 - Dynamic Pipeline Composer

[[00 - LDCN OS - Gerador + Backend - Mapa Raiz|⬅ Mapa Raiz]] · [[10 - TeamComposer V2|← Anterior]] · [[12 - Job Classification|Próximo →]]

## Objetivo

Montar o plano operacional da Mission com base na solução real.

### Exemplo Backend-only Java

```text
Requirements
→ Java Architecture
→ Backend Plan
→ Tasks
→ Generation
→ Compile
→ Test
→ Review
→ Gate
→ Promotion
```

### Frontend-only Angular

```text
Requirements
→ Angular Architecture
→ Frontend Plan
→ Tasks
→ ng build
→ tests
→ review
→ gates
→ promotion
```

### Multi-stack

```text
Requirements
       ↓
ApprovedSolution
       ↓
┌──────┼──────────┐
↓      ↓          ↓
Java   Angular    Flutter
↓      ↓          ↓
Build  Build      Build
└──────┼──────────┘
       ↓
Integration Validation
       ↓
Gates
       ↓
Promotion
```

### PipelineNode

```ts
PipelineNode {
  key
  type
  target?
  stackKey?
  required
  dependsOn[]
  ownerRole
  contractRefs[]
  gateRefs[]
  state
}
```

## PROMPT — Pipeline Composer

```text
# LDCN OS — DYNAMIC PIPELINE COMPOSER

Entrada:
ApprovedSolution
Approved Contracts
AgentTeam
Stack Runtime Capabilities

Objetivo:
produzir MissionPipelinePlan.

Regras:
- criar somente nodes necessários;
- respeitar dependencies;
- não executar pipeline;
- não criar WorkflowEngine;
- não criar node para stack ausente;
- unsupported runtime deve bloquear estado executável de forma explícita.

Saída:
MissionPipelinePlanV1
PipelineNodeV1[]
```

---

---

Read model para Console:

```text
ANALYZE_INTENT
GENERATE_REQUIREMENTS
APPROVE_REQUIREMENTS
RESOLVE_TOPOLOGY
APPROVE_TOPOLOGY
PLAN_SOLUTION
APPROVE_SOLUTION
COMPOSE_ARCHITECTURES
APPROVE_ARCHITECTURES
COMPOSE_TEAM
COMPOSE_PIPELINE
START_EXECUTION
RESOLVE_SCOPE_EXPANSION
CONTINUE_HANDOFF
REVIEW_JOB
NONE
```

Frontend renderiza.

Frontend não orquestra.

---



## 🔗 Documentos relacionados

- [[09 - Approved Solution]]
- [[10 - TeamComposer V2]]
- [[12 - Job Classification]]
- [[23 - Backend NestJS APIs e Persistência]]

---

[[00 - LDCN OS - Gerador + Backend - Mapa Raiz|⬅ Mapa Raiz]] · [[10 - TeamComposer V2|← Anterior]] · [[12 - Job Classification|Próximo →]]

> Fonte canônica: [[00 - LDCN OS - Gerador + Backend - Mapa Raiz]]
