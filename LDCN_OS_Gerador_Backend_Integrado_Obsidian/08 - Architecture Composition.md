---
title: "08 - Architecture Composition"
aliases:
  - "Architecture Composition"
tags:
  - ldcn
  - gerador-inteligente
  - arquitetura
status: canonico
---

# 08 - Architecture Composition

[[00 - LDCN OS - Gerador + Backend - Mapa Raiz|⬅ Mapa Raiz]] · [[07 - Stack Registry e Team Catalog|← Anterior]] · [[09 - Approved Solution|Próximo →]]

## Objetivo

Cada stack escolhida recebe seu próprio Stack Architect.

### Exemplos

```text
Java -> architecture.java.architect
Angular -> architecture.angular.architect
Next.js -> architecture.nextjs.architect
Flutter -> architecture.flutter.architect
.NET -> architecture.dotnet.architect
```

### StackArchitectureProposal

```ts
StackArchitectureProposal {
  stackKey
  deliveryTarget
  architectureStyle
  modules[]
  boundaries[]
  dependencies[]
  persistence?
  security?
  communication[]
  observability?
  buildStrategy
  testStrategy
  deploymentStrategy
  decisions[]
  alternatives[]
  tradeoffs[]
  risks[]
}
```

### ArchitectureDecision

```ts
ArchitectureDecision {
  scope
  problem
  optionsConsidered[]
  selectedOption
  rationale
  constraints[]
  tradeoffs[]
  decidedBy
  reviewedBy[]
  status
}
```

## PROMPT — Stack Architect

```text
# LDCN OS — STACK ARCHITECT

Você é o Stack Architect da stack selecionada.

Entrada:
ApprovedSolution
Requirements
StackDefinition
relevant capability packs
existing ArchitectureDecisions

Objetivo:
projetar a arquitetura interna desta stack.

Não aplicar padrão fixo.

Considere:
requirements
scale
security
maintainability
runtime
cost
testing
deployment
integration
platform constraints

Produza:
StackArchitectureProposalV1
ArchitectureDecisionV1[]

Não:
- altere outra stack;
- escolha novo DeliveryTarget;
- execute código;
- aprove seu próprio Contract.
```

---


### Conflict Resolution

Stack Architects e especialistas podem discordar.

Exemplo:

```text
Solution Planner -> microservices
Java Architect -> modular monolith
Runtime Specialist -> custo operacional alto
Security Specialist -> superfície desnecessária
```

A divergência relevante gera:

```text
ArchitectureConflict
```

Um conflito crítico aberto bloqueia a aprovação da arquitetura.

A solução nunca é escolhida silenciosamente porque foi a última resposta do LLM.

### Relação com Contracts

Não criar um lifecycle paralelo de documentos normativos.

Sempre que uma proposta se tornar normativa para implementação, preferir o Contract Runtime existente.

Hierarquia conceitual:

```text
RequirementsContract
SolutionContract / ApprovedSolution boundary
StackArchitectureContract(s)
IntegrationContract
ImplementationPlanContract(s)
```

Somente contratos necessários para Delivery Targets aprovados devem existir.



## 🔗 Documentos relacionados

- [[07 - Stack Registry e Team Catalog]]
- [[09 - Approved Solution]]
- [[15 - Integration Unit]]

---

[[00 - LDCN OS - Gerador + Backend - Mapa Raiz|⬅ Mapa Raiz]] · [[07 - Stack Registry e Team Catalog|← Anterior]] · [[09 - Approved Solution|Próximo →]]

> Fonte canônica: [[00 - LDCN OS - Gerador + Backend - Mapa Raiz]]
