---
title: "02 - Intent Understanding"
aliases:
  - "Intent Understanding"
tags:
  - ldcn
  - gerador-inteligente
  - arquitetura
status: canonico
---

# 02 - Intent Understanding

[[00 - LDCN OS - Gerador + Backend - Mapa Raiz|⬅ Mapa Raiz]] · [[01 - Constituição e Visão Geral|← Anterior]] · [[03 - Requirements Intelligence|Próximo →]]

## Objetivo

Transformar texto livre do usuário em um entendimento estruturado sem escolher tecnologia cedo demais.

### Input

```text
rawUserIdea
userConstraints
technologyPreferences?
forbiddenTargets?
budget?
deadline?
```

### Output

```text
ProjectIntent
```

### Modelo

```ts
ProjectIntent {
  id
  missionId
  version
  rawUserIdea
  productType?
  problemStatement
  targetUsers[]
  businessGoals[]
  explicitRequirements[]
  explicitConstraints[]
  inferredNeeds[]
  unknowns[]
  technologyPreferences[]
  forbiddenDeliveryTargets[]
  confidence
  status
}
```

### Origem das informações

```text
USER_EXPLICIT
INFERRED
UNKNOWN
```

### Regras

- não escolher stack;
- não criar arquitetura;
- não completar escopo por imaginação;
- perguntar somente se a resposta mudar decisão importante.

## PROMPT — Intent Analyzer

```text
# LDCN OS — INTENT ANALYZER

Objetivo:
entender a ideia do usuário sem escolher tecnologia.

Entrada:
descrição livre do usuário.

Extraia:
- problema;
- usuários;
- objetivos;
- requisitos explícitos;
- restrições;
- preferências;
- targets explicitamente pedidos;
- targets explicitamente proibidos;
- ambiguidades de alto impacto.

Classifique cada item como:
USER_EXPLICIT
INFERRED
UNKNOWN

Não:
- escolha stack;
- escolha arquitetura;
- crie backend/frontend/mobile;
- invente requisito;
- escreva código.

Saída:
ProjectIntentV1 estruturado.

Se uma dúvida não mudar arquitetura, stack, custo, segurança ou topologia:
não pergunte.

Se mudar:
marque como HIGH_IMPACT_UNKNOWN.
```

---



## 🔗 Documentos relacionados

- [[03 - Requirements Intelligence]]
- [[04 - Solution Topology]]

---

[[00 - LDCN OS - Gerador + Backend - Mapa Raiz|⬅ Mapa Raiz]] · [[01 - Constituição e Visão Geral|← Anterior]] · [[03 - Requirements Intelligence|Próximo →]]

> Fonte canônica: [[00 - LDCN OS - Gerador + Backend - Mapa Raiz]]
