---
title: "09 - Approved Solution"
aliases:
  - "Approved Solution"
tags:
  - ldcn
  - gerador-inteligente
  - arquitetura
status: canonico
---

# 09 - Approved Solution

[[00 - LDCN OS - Mapa Raiz Completo|⬅ Mapa Raiz]] · [[08 - Architecture Composition|← Anterior]] · [[10 - TeamComposer V2|Próximo →]]

## Objetivo

Congelar a boundary técnica autorizada.

### Modelo

```ts
ApprovedSolution {
  missionId
  version
  topology
  deliveryTargets[]
  selectedStacks[]
  selectionMode
  requirementsContractId
  architectureRefs[]
  complexityProfile
  riskProfile
  integrationNeeds[]
  securityNeeds[]
  dataNeeds[]
  runtimeNeeds[]
  approvedAt
}
```

### Regra

> Tudo que vem depois precisa obedecer à ApprovedSolution.

## PROMPT — Approved Solution Validator

```text
# LDCN OS — APPROVED SOLUTION VALIDATOR

Valide:
- topology aprovada;
- targets aprovados;
- stacks selecionadas;
- constraints do usuário;
- architectures aprovadas;
- conflicts críticos resolvidos;
- runtime support compatível.

Não adicione nada.

Se algum item estiver ausente:
retorne SOLUTION_NOT_APPROVABLE.

Se válido:
materialize nova ApprovedSolution versionada.

A versão anterior deve virar SUPERSEDED, nunca apagada.
```

---



## 🔗 Documentos relacionados

- [[08 - Architecture Composition]]
- [[10 - TeamComposer V2]]
- [[16 - Scope Expansion]]
- [[21 - Governance Segurança e Replanning]]

---

[[00 - LDCN OS - Mapa Raiz Completo|⬅ Mapa Raiz]] · [[08 - Architecture Composition|← Anterior]] · [[10 - TeamComposer V2|Próximo →]]

> Fonte canônica: [[00 - LDCN OS - Mapa Raiz Completo]]
