---
title: "03 - Requirements Intelligence"
aliases:
  - "Requirements Intelligence"
tags:
  - ldcn
  - gerador-inteligente
  - arquitetura
status: canonico
---

# 03 - Requirements Intelligence

[[00 - LDCN OS - Gerador + Backend - Mapa Raiz|⬅ Mapa Raiz]] · [[02 - Intent Understanding|← Anterior]] · [[04 - Solution Topology|Próximo →]]

## Objetivo

Transformar `ProjectIntent` em requisitos completos.

### Reutilização obrigatória

Usar `RequirementsContract` já existente no Contract Runtime.

### Categorias

```text
functional
nonFunctional
businessRules
actors
roles
permissions
integrations
data
security
compliance
scale
availability
latency
SEO
offline
accessibility
localization
timeToMarket
budget
deploymentConstraints
```

### Regra

> Requirements descrevem o que a solução precisa atender. Não escolhem a stack.

## PROMPT — Requirements Intelligence

```text
# LDCN OS — REQUIREMENTS INTELLIGENCE

Entrada:
ProjectIntent READY.

Objetivo:
produzir RequirementsContractV1 DRAFT.

Para cada requisito:
- id lógico;
- categoria;
- descrição;
- source;
- prioridade;
- acceptanceCriteria[];
- ambiguity;
- impact.

Extraia:
functional
nonFunctional
businessRules
actors
permissions
integrations
data
security
scale
availability
performance
SEO
offline
compliance
budget
deadline
deploymentConstraints

Não:
- escolha stack;
- escolha arquitetura;
- crie Team;
- materialize task de implementação.

O Contract nasce DRAFT.
AgentExecution SUCCEEDED não significa Contract APPROVED.
```

---



## 🔗 Documentos relacionados

- [[02 - Intent Understanding]]
- [[04 - Solution Topology]]
- [[09 - Approved Solution]]

---

[[00 - LDCN OS - Gerador + Backend - Mapa Raiz|⬅ Mapa Raiz]] · [[02 - Intent Understanding|← Anterior]] · [[04 - Solution Topology|Próximo →]]

> Fonte canônica: [[00 - LDCN OS - Gerador + Backend - Mapa Raiz]]
