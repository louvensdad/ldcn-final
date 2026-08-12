---
title: "18 - Review Gates e Repair"
aliases:
  - "Review Gates e Repair"
tags:
  - ldcn
  - gerador-inteligente
  - arquitetura
status: canonico
---

# 18 - Review Gates e Repair

[[00 - Gerador Inteligente - Mapa Raiz|⬅ Mapa Raiz]] · [[17 - Execution Runtime|← Anterior]] · [[19 - Learning Intelligence e ML|Próximo →]]

## Regra

> Technical success não significa aprovação.

### Review

```text
executor != reviewer
```

### Gate

Determinístico sempre que possível.

### Exemplos

```text
BUILD_GATE
TEST_GATE
SECURITY_GATE
SYMBOL_GATE
ARTIFACT_GATE
INTEGRATION_GATE
ARCHITECTURE_GATE
SOLUTION_GATE
```

## PROMPT — Review Router

```text
# LDCN OS — REVIEW ROUTER

Entrada:
completed execution
WorkRoutingDecision
ReviewPolicy
AgentTeam
evidence

Selecione reviewer elegível.

Regras:
- reviewer != executor;
- reviewer pertence à Mission;
- reviewer possui capability adequada;
- respeitar stack/territory;
- risco pode exigir múltiplos reviews.

Saída:
ReviewRoutingDecision.
```

---

---

Repair continua responsabilidade do runtime existente.

### Fluxo

```text
Execution FAILED
↓
FailureSnapshot
↓
EngineeringFailureClassifier
↓
RepairEligibilityPolicy
↓
EngineeringRepairSession
↓
new AgentExecution
```

### Gerador Inteligente pode ajudar com

```text
risk prediction
capability recommendation
agent ranking
historical repair success
```

mas não substitui Fase 5.

## PROMPT — Repair Advisory

```text
# LDCN OS — REPAIR ADVISORY

Entrada:
FailureSnapshot
RepairPolicy
ApprovedSolution
historical outcomes

Retorne advisory:
likely capabilities
likely specialist role
repair success estimate
risk

Não:
- inicie repair;
- altere RepairPolicy;
- escreva patch;
- bypass Repair Coordinator.
```

---



## 🔗 Documentos relacionados

- [[17 - Execution Runtime]]
- [[19 - Learning Intelligence e ML]]

---

[[00 - Gerador Inteligente - Mapa Raiz|⬅ Mapa Raiz]] · [[17 - Execution Runtime|← Anterior]] · [[19 - Learning Intelligence e ML|Próximo →]]

> Fonte canônica: [[00 - Gerador Inteligente - Mapa Raiz]]
