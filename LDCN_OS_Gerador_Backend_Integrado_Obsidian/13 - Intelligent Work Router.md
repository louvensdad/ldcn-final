---
title: "13 - Intelligent Work Router"
aliases:
  - "Intelligent Work Router"
tags:
  - ldcn
  - gerador-inteligente
  - arquitetura
status: canonico
---

# 13 - Intelligent Work Router

[[00 - LDCN OS - Gerador + Backend - Mapa Raiz|⬅ Mapa Raiz]] · [[12 - Job Classification|← Anterior]] · [[14 - Team Switching e Handoffs|Próximo →]]

## Objetivo

Decidir **qual Team e quais AgentInstances** atuam no Job.

### WorkRoutingDecision

```ts
WorkRoutingDecision {
  missionId
  taskId
  jobClassificationId
  selectedTeamKey?
  executorAgentInstanceId?
  selectedAgentInstanceIds[]
  reviewerCandidateIds[]
  selectedReviewerIds[]
  requiredSpecialists[]
  requiredCapabilityKeys[]
  requiredGateKeys[]
  routingSource
  confidence
  rationale
  status
}
```

### Routing Sources

```text
DETERMINISTIC
POLICY
LLM_ASSISTED
HYBRID
ML_ASSISTED
```

### Algoritmo

```text
1. validar ApprovedSolution;
2. validar target;
3. validar stack;
4. localizar candidatos da Mission;
5. filtrar por room/stack;
6. filtrar por capabilities;
7. filtrar por territory;
8. filtrar por readiness;
9. aplicar delegation rules;
10. adicionar specialists;
11. rankear executor;
12. resolver reviewer independente;
13. aplicar workload;
14. validar risk policy;
15. persistir WorkRoutingDecision;
16. criar/reusar AgentAssignment existente.
```

## PROMPT — Intelligent Work Router

```text
# LDCN OS — INTELLIGENT WORK ROUTER

Entrada:
JobClassification
ApprovedSolution
AgentTeam
AgentInstances
AgentCatalog
Capabilities
Territories
DelegationRules
Workload
ReviewPolicies
RiskPolicies

Objetivo:
selecionar o menor Job Team capaz de executar com segurança.

Regras:
1. somente AgentInstances da Mission;
2. somente stacks da ApprovedSolution;
3. capability-aware;
4. territory-aware;
5. risk-aware;
6. reviewer != executor;
7. Integration Unit somente quando necessária;
8. não criar AgentDefinition;
9. não alterar ApprovedSolution;
10. se faltar capability -> ROUTING_CAPABILITY_GAP;
11. se target/stack estiver fora -> SCOPE_EXPANSION_REQUIRED.

Saída:
WorkRoutingDecisionV1.
```

---



## 🔗 Documentos relacionados
- [[29 - Empresa de Agentes - Times Stacks e Prompts]]

- [[12 - Job Classification]]
- [[14 - Team Switching e Handoffs]]
- [[10 - TeamComposer V2]]
- [[19 - Learning Intelligence e ML]]

---

[[00 - LDCN OS - Gerador + Backend - Mapa Raiz|⬅ Mapa Raiz]] · [[12 - Job Classification|← Anterior]] · [[14 - Team Switching e Handoffs|Próximo →]]

> Fonte canônica: [[00 - LDCN OS - Gerador + Backend - Mapa Raiz]]
