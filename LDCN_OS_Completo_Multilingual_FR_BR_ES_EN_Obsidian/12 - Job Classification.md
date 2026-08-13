---
title: "12 - Job Classification"
aliases:
  - "Job Classification"
tags:
  - ldcn
  - gerador-inteligente
  - arquitetura
status: canonico
---

# 12 - Job Classification

[[00 - LDCN OS - Mapa Raiz Completo|⬅ Mapa Raiz]] · [[11 - Dynamic Pipeline Composer|← Anterior]] · [[13 - Intelligent Work Router|Próximo →]]

## Objetivo

Entender o tipo de trabalho de cada `AgentTask`.

### JobClassification

```ts
JobClassification {
  jobType
  deliveryTarget
  primaryStackKey
  affectedStacks[]
  affectedDomains[]
  complexity
  riskLevel
  requiredCapabilities[]
  requiresArchitectureReview
  requiresSecurityReview
  requiresDataSpecialist
  requiresRuntimeSpecialist
  requiresIntegration
  scopeExpansionRequired
}
```

### Job Types

```text
REQUIREMENTS_ANALYSIS
ARCHITECTURE_DESIGN
BACKEND_IMPLEMENTATION
FRONTEND_IMPLEMENTATION
MOBILE_IMPLEMENTATION
DATA_MODELING
DATA_ENGINEERING
SECURITY_IMPLEMENTATION
PERFORMANCE_OPTIMIZATION
TEST_CREATION
BUG_FIX
REFACTORING
MIGRATION
ENGINEERING_REPAIR
RUNTIME_CONFIGURATION
DEPLOYMENT_CONFIGURATION
CROSS_STACK_INTEGRATION
EXTERNAL_INTEGRATION
UX_IMPLEMENTATION
SEO_IMPLEMENTATION
AI_ML_WORK
DOCUMENTATION
```

## PROMPT — Job Classifier

```text
# LDCN OS — JOB CLASSIFIER

Entrada:
AgentTask
ApprovedSolution
Relevant Contracts
Mission Team

Classifique:
jobType
deliveryTarget
primaryStack
affectedStacks
complexity
risk
requiredCapabilities
requiresArchitectureReview
requiresSecurityReview
requiresDataSpecialist
requiresRuntimeSpecialist
requiresIntegration

Regras:
- não selecionar agentes;
- não executar;
- não adicionar stack;
- se Job exige target ausente:
  scopeExpansionRequired=true.

Saída:
JobClassificationV1.
```

---



## 🔗 Documentos relacionados

- [[11 - Dynamic Pipeline Composer]]
- [[13 - Intelligent Work Router]]

---

[[00 - LDCN OS - Mapa Raiz Completo|⬅ Mapa Raiz]] · [[11 - Dynamic Pipeline Composer|← Anterior]] · [[13 - Intelligent Work Router|Próximo →]]

> Fonte canônica: [[00 - LDCN OS - Mapa Raiz Completo]]
