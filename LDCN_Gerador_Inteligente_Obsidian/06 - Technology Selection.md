---
title: "06 - Technology Selection"
aliases:
  - "Technology Selection"
tags:
  - ldcn
  - gerador-inteligente
  - arquitetura
status: canonico
---

# 06 - Technology Selection

[[00 - Gerador Inteligente - Mapa Raiz|⬅ Mapa Raiz]] · [[05 - Solution Planning|← Anterior]] · [[07 - Stack Registry e Team Catalog|Próximo →]]

## Objetivo

Escolher stacks adequadas por Delivery Target.

### Modos

```text
AUTO
GUIDED
FIXED
```

### StackCandidateEvaluation

```ts
StackCandidateEvaluation {
  stackKey
  fitScore
  requirementsCoverage[]
  strengths[]
  tradeoffs[]
  risks[]
  rejectedBecause[]
  constraintsSatisfied[]
  runtimeSupport
}
```

### Regra

> FitScore ordena candidatos. Não é aprovação.

## PROMPT — Technology Selector

```text
# LDCN OS — TECHNOLOGY SELECTOR

Entrada:
Requirements
Approved Topology
StackRegistry
UserConstraints
RuntimeSupport
LearningSignals opcional

Para cada DeliveryTarget:
1. filtre stacks compatíveis;
2. elimine stacks proibidas;
3. elimine stacks sem suporte mínimo necessário;
4. avalie fit;
5. gere alternativas;
6. explique trade-offs.

Critérios:
complexityFit
timeToMarket
runtimeCost
operationalCost
securityFit
SEO
offline
scalability
maintainability
integrationFit
userConstraintFit

Modes:
AUTO -> selecionar automaticamente se policy permitir.
GUIDED -> recomendar e aguardar aprovação.
FIXED -> respeitar escolha do usuário.

Não montar Team.
Não escrever código.

Saída:
StackSelectionProposalV1.
```

---


### Recomendação, decisão e scoring

O cérebro deve separar quatro estados conceituais:

```text
PROPOSAL
RECOMMENDATION
DECISION
APPROVAL
```

Exemplo:

```text
Solution Planner recomenda Next.js
↓
usuário/policy aprova
↓
ApprovedSolution registra Next.js
```

`fitScore` é apenas sinal de ordenação. Nunca é autorização.

```text
Astro 0.94
Next.js 0.88
```

Ainda assim o usuário pode escolher Next.js em modo GUIDED/FIXED, desde que a solução permaneça válida.

### Confidence e Ambiguity

Toda decisão cognitiva pode registrar:

```ts
DecisionConfidence {
  value
  missingInformation[]
  decisionImpact
}
```

Regra:

```text
dúvida sem impacto arquitetural relevante
→ não interromper o usuário

dúvida que altera topologia, segurança, custo, stack ou escopo
→ solicitar esclarecimento ou marcar aprovação necessária
```

### Cost, Security e Future Compatibility

A seleção deve equilibrar:

```text
currentFit
cost
security
operationalComplexity
maintainability
futureEvolution
```

Não construir uma fortaleza enterprise para um MVP simples.

Também não selecionar uma solução descartável quando os requisitos já mostram que uma migração imediata será inevitável.



## 🔗 Documentos relacionados

- [[05 - Solution Planning]]
- [[07 - Stack Registry e Team Catalog]]
- [[09 - Approved Solution]]
- [[19 - Learning Intelligence e ML]]

---

[[00 - Gerador Inteligente - Mapa Raiz|⬅ Mapa Raiz]] · [[05 - Solution Planning|← Anterior]] · [[07 - Stack Registry e Team Catalog|Próximo →]]

> Fonte canônica: [[00 - Gerador Inteligente - Mapa Raiz]]
