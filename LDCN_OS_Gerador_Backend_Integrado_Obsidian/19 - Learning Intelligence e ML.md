---
title: "19 - Learning Intelligence e ML"
aliases:
  - "Learning Intelligence e ML"
tags:
  - ldcn
  - gerador-inteligente
  - arquitetura
status: canonico
---

# 19 - Learning Intelligence e ML

[[00 - LDCN OS - Gerador + Backend - Mapa Raiz|⬅ Mapa Raiz]] · [[18 - Review Gates e Repair|← Anterior]] · [[20 - Memory e Context Budgeting|Próximo →]]

## Objetivo

Aprender com a própria engenharia.

### Serviços

```text
StackFitPredictor
JobComplexityPredictor
JobRiskPredictor
TeamRecommendationModel
AgentPerformanceRanker
CapabilityRanker
FailurePredictor
RepairSuccessPredictor
CostEstimator
```

### Regra

> ML nunca é autoridade final.

---

---

## Fase A

```text
Rules + LLM + telemetry
```

## Fase B

```text
Historical heuristics
```

## Fase C

```text
Machine Learning models
```

---

---

```ts
LearningOutcome {
  missionId
  taskId?
  outcomeType
  features
  decision
  result
  success
  qualityScore?
  cost?
  durationMs?
  repairCount?
  buildPassed?
  testsPassed?
  userAccepted?
}
```

### Outcome Types

```text
STACK_SELECTION
TEAM_COMPOSITION
JOB_ROUTING
AGENT_EXECUTION
BUILD
TEST
REVIEW
GATE
REPAIR
PROMOTION
USER_DECISION
COST
```

---

---

```ts
interface PredictionGateway {
  predictStackFit(input): Promise<StackFitPrediction[]>
  predictJobComplexity(input): Promise<JobComplexityPrediction>
  predictJobRisk(input): Promise<JobRiskPrediction>
  rankAgents(input): Promise<AgentRanking>
  rankCapabilities(input): Promise<CapabilityRanking>
  predictRepairSuccess(input): Promise<RepairPrediction>
  estimateCost(input): Promise<CostPrediction>
}
```

---

---

Primeiro o ML observa.

```text
Policy chose Java
ML predicted .NET
```

Registrar ambos.

Não alterar decisão.

Depois, quando validado:

```text
ML_ASSISTED
```

---

---

```text
# LDCN OS — LEARNING SIGNAL INTERPRETER

Entrada:
historical outcomes
current requirements
candidate stacks
current Job classification

Objetivo:
transformar histórico em sinais auxiliares.

Retorne:
historicalSuccessRates
repairRates
averageCost
averageDuration
userAcceptance
agentPerformanceSignals
capabilitySignals

Não:
- selecione stack sozinho;
- selecione AgentInstance sozinho;
- ignore policies;
- use PII desnecessária.
```

---


### HeuristicPredictor e ModelPredictor

A primeira implementação real de `PredictionGateway` deve ser heurística.

```text
HeuristicPredictor
→ usa histórico de sucesso, falha, repair, custo, duração e aceitação
```

ML real entra depois:

```text
NestJS
↓
PredictionGateway
↓
ML Inference Service
↓
versioned model
```

Não é necessário embutir Python no NestJS.

### Model Registry futuro

Quando ML real for ativado:

```text
modelKey
modelVersion
featureSchemaVersion
trainedAt
datasetVersion
metrics
status
```

Status:

```text
SHADOW
ACTIVE
RETIRED
```



## 🔗 Documentos relacionados

- [[06 - Technology Selection]]
- [[13 - Intelligent Work Router]]
- [[18 - Review Gates e Repair]]
- [[22 - Observability Audit e Tracing]]

---

[[00 - LDCN OS - Gerador + Backend - Mapa Raiz|⬅ Mapa Raiz]] · [[18 - Review Gates e Repair|← Anterior]] · [[20 - Memory e Context Budgeting|Próximo →]]

> Fonte canônica: [[00 - LDCN OS - Gerador + Backend - Mapa Raiz]]
