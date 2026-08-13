---
title: "04 - Solution Topology"
aliases:
  - "Solution Topology"
tags:
  - ldcn
  - gerador-inteligente
  - arquitetura
status: canonico
---

# 04 - Solution Topology

[[00 - LDCN OS - Gerador + Backend - Mapa Raiz|⬅ Mapa Raiz]] · [[03 - Requirements Intelligence|← Anterior]] · [[05 - Solution Planning|Próximo →]]

## Objetivo

Decidir **quais superfícies realmente precisam existir**.

### Tipos

```text
BACKEND_ONLY
FRONTEND_ONLY
MOBILE_ONLY
BACKEND_FRONTEND
BACKEND_MOBILE
FRONTEND_MOBILE
BACKEND_FRONTEND_MOBILE
FULLSTACK_SINGLE_RUNTIME
DATA_ONLY
AI_ONLY
MIXED
```

### DeliveryTarget

```ts
DeliveryTarget {
  kind
  required
  source
  rationale
  status
}
```

### Source

```text
USER_EXPLICIT
REQUIREMENTS_INFERRED
ARCHITECTURE_RECOMMENDED
```

### Status

```text
PROPOSED
APPROVED
REJECTED
FORBIDDEN_BY_SCOPE
```

## Regra contra invenção

Se o usuário disser:

```text
"Quero só backend."
```

resultado:

```text
BACKEND = APPROVED
FRONTEND = FORBIDDEN_BY_SCOPE
MOBILE = FORBIDDEN_BY_SCOPE
```

Se o backend parecer necessário, mas não foi pedido:

```text
BACKEND = RECOMMENDED
```

Não materializar sem aprovação.

## PROMPT — Topology Resolver

```text
# LDCN OS — SOLUTION TOPOLOGY RESOLVER

Entrada:
RequirementsContract APPROVED
+ explicit user scope.

Objetivo:
decidir apenas quais Delivery Targets são necessários.

Targets possíveis:
BACKEND
FRONTEND
MOBILE
FULLSTACK
DATA
AI
EXTERNAL_INTEGRATION

Regras:
1. Respeite target explicitamente proibido.
2. Não escolha stack ainda.
3. Se algo não foi pedido, mas parece necessário:
   marque ARCHITECTURE_RECOMMENDED.
4. Não materialize recommendation automaticamente.
5. Cada target precisa de rationale e source.
6. Nenhum Team/Room/Contract/Runtime nasce nesta etapa.

Saída:
SolutionTopologyProposalV1.
```

---



## 🔗 Documentos relacionados

- [[03 - Requirements Intelligence]]
- [[05 - Solution Planning]]
- [[16 - Scope Expansion]]

---

[[00 - LDCN OS - Gerador + Backend - Mapa Raiz|⬅ Mapa Raiz]] · [[03 - Requirements Intelligence|← Anterior]] · [[05 - Solution Planning|Próximo →]]

> Fonte canônica: [[00 - LDCN OS - Gerador + Backend - Mapa Raiz]]
