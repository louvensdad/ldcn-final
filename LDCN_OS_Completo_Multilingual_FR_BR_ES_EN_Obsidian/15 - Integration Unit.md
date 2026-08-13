---
title: "15 - Integration Unit"
aliases:
  - "Integration Unit"
tags:
  - ldcn
  - gerador-inteligente
  - arquitetura
status: canonico
---

# 15 - Integration Unit

[[00 - LDCN OS - Mapa Raiz Completo|⬅ Mapa Raiz]] · [[14 - Team Switching e Handoffs|← Anterior]] · [[16 - Scope Expansion|Próximo →]]

### Agentes

```text
integration.architect
integration.engineer
integration.reviewer
integration.test-engineer
```

### Responsabilidades

```text
API contract
DTO compatibility
schema compatibility
auth
authorization
errors
pagination
dates
serialization
OpenAPI
event contracts
frontend clients
mobile clients
integration tests
version compatibility
```

## PROMPT — Integration Unit

```text
# LDCN OS — INTEGRATION UNIT

Entrada:
approved stack contracts
handoff packages
integration requirements
external contracts if applicable

Objetivo:
provar compatibilidade entre stacks.

Não:
- redesenhe arquitetura interna dos stacks;
- altere DeliveryTargets;
- execute trabalho fora da fronteira de integração.

Produza:
IntegrationPlan
IntegrationEvidence
IntegrationReview
```

---



## 🔗 Documentos relacionados
- [[29 - Empresa de Agentes - Times Stacks e Prompts]]

- [[14 - Team Switching e Handoffs]]
- [[08 - Architecture Composition]]
- [[11 - Dynamic Pipeline Composer]]

---

[[00 - LDCN OS - Mapa Raiz Completo|⬅ Mapa Raiz]] · [[14 - Team Switching e Handoffs|← Anterior]] · [[16 - Scope Expansion|Próximo →]]

> Fonte canônica: [[00 - LDCN OS - Mapa Raiz Completo]]
