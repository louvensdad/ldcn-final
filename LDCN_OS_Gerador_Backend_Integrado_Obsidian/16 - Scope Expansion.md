---
title: "16 - Scope Expansion"
aliases:
  - "Scope Expansion"
tags:
  - ldcn
  - gerador-inteligente
  - arquitetura
status: canonico
---

# 16 - Scope Expansion

[[00 - LDCN OS - Gerador + Backend - Mapa Raiz|⬅ Mapa Raiz]] · [[15 - Integration Unit|← Anterior]] · [[17 - Execution Runtime|Próximo →]]

## Quando usar

Job exige algo fora da ApprovedSolution.

Exemplo:

```text
Mission = Java + Angular
Job = "Criar app mobile"
```

Não chamar Flutter automaticamente.

### ScopeExpansionProposal

```ts
ScopeExpansionProposal {
  missionId
  sourceTaskId
  requestedDeliveryTarget
  recommendedStacks[]
  reason
  requirementsImpact[]
  architectureImpact[]
  teamImpact[]
  pipelineImpact[]
  costImpact
  riskImpact
  requiresApproval
}
```

## PROMPT — Scope Expansion

```text
# LDCN OS — SCOPE EXPANSION PROPOSAL

Entrada:
Job
ApprovedSolution
Requirements
StackRegistry

Objetivo:
explicar por que o Job exige um target/stack fora do escopo.

Retorne:
requestedTarget
candidateStacks
reason
requirementsImpact
architectureImpact
teamImpact
pipelineImpact
costImpact
riskImpact
userDecisionRequired

Não:
- materialize Team;
- altere ApprovedSolution;
- execute Job.

PARE após a proposta.
```

---



## 🔗 Documentos relacionados

- [[04 - Solution Topology]]
- [[09 - Approved Solution]]
- [[14 - Team Switching e Handoffs]]
- [[21 - Governance Segurança e Replanning]]

---

[[00 - LDCN OS - Gerador + Backend - Mapa Raiz|⬅ Mapa Raiz]] · [[15 - Integration Unit|← Anterior]] · [[17 - Execution Runtime|Próximo →]]

> Fonte canônica: [[00 - LDCN OS - Gerador + Backend - Mapa Raiz]]
