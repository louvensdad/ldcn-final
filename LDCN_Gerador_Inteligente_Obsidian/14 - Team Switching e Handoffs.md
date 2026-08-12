---
title: "14 - Team Switching e Handoffs"
aliases:
  - "Team Switching e Handoffs"
tags:
  - ldcn
  - gerador-inteligente
  - arquitetura
status: canonico
---

# 14 - Team Switching e Handoffs

[[00 - Gerador Inteligente - Mapa Raiz|⬅ Mapa Raiz]] · [[13 - Intelligent Work Router|← Anterior]] · [[15 - Integration Unit|Próximo →]]

## Objetivo

Permitir que um Job passe de um Team para outro **sem perder contexto, contratos ou evidências**.

Essa é a camada de comutação entre equipes.

## 16.1. Quando acontece Team Switch

```text
Architecture -> Delivery
Backend -> Integration
Integration -> Frontend
Integration -> Mobile
Developer -> Reviewer
Reviewer -> Rework
QA -> Developer
Security -> Developer
Repair -> Review
```

## 16.2. TeamSwitchDecision

```ts
TeamSwitchDecision {
  missionId
  sourceTaskId
  sourceTeamKey
  targetTeamKey
  reason
  handoffType
  requiredContracts[]
  requiredArtifacts[]
  requiredEvidence[]
  contextSnapshotId
  status
}
```

### Handoff Types

```text
ARCHITECTURE_TO_DELIVERY
BACKEND_TO_FRONTEND
BACKEND_TO_MOBILE
STACK_TO_INTEGRATION
INTEGRATION_TO_STACK
DELIVERY_TO_REVIEW
REVIEW_TO_REWORK
QA_TO_REWORK
SECURITY_TO_REWORK
REPAIR_TO_REVIEW
EXTERNAL_INTEGRATION_HANDOFF
```

## 16.3. HandoffPackage

```ts
HandoffPackage {
  missionId
  taskId
  fromTeam
  toTeam
  contractRefs[]
  artifactRefs[]
  evidenceRefs[]
  decisions[]
  constraints[]
  unresolvedDependencies[]
  acceptanceCriteria[]
  contextHash
}
```

### Regra

> Handoff transporta fatos estruturados, não raciocínio oculto.

## PROMPT — Team Switch Resolver

```text
# LDCN OS — TEAM SWITCH RESOLVER

Entrada:
current Job
current Team
current Execution state
contracts
artifacts
evidence
dependencies
ApprovedSolution

Determine:
- se o trabalho permanece no Team atual;
- se precisa de outro Team;
- qual Team é o próximo;
- tipo de handoff;
- quais dados precisam ser transferidos.

Regras:
1. target Team deve existir na Mission;
2. target Team deve pertencer à ApprovedSolution;
3. nenhum artefato cruza Mission;
4. HandoffPackage deve ser mínimo e suficiente;
5. não enviar chain-of-thought;
6. Integration Unit é obrigatória quando ownership cruza stacks e a policy exigir;
7. mudança de stack fora do escopo gera ScopeExpansionProposal.

Saída:
TeamSwitchDecisionV1
HandoffPackageV1.
```

---

---

## Exemplo Java -> Angular

```text
Java Team conclui API
↓
HandoffPackage
↓
Integration Unit
↓
valida OpenAPI / DTO / auth / errors
↓
Angular Team
↓
gera API client / UI integration
```

## Exemplo Java -> Flutter

```text
Backend endpoint
↓
Integration Unit
↓
Mobile contract
↓
Flutter Team
```

## Exemplo Next.js Full-stack

Se tudo está dentro da mesma stack:

```text
Next.js Team
↓
no Integration Unit required
```

a menos que exista integração externa relevante.

---



## 🔗 Documentos relacionados

- [[13 - Intelligent Work Router]]
- [[15 - Integration Unit]]
- [[16 - Scope Expansion]]

---

[[00 - Gerador Inteligente - Mapa Raiz|⬅ Mapa Raiz]] · [[13 - Intelligent Work Router|← Anterior]] · [[15 - Integration Unit|Próximo →]]

> Fonte canônica: [[00 - Gerador Inteligente - Mapa Raiz]]
