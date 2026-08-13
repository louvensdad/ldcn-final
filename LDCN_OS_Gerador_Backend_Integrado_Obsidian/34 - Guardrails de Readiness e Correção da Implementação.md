---
title: "Guardrails de Readiness e Correção da Implementação"
aliases: ["Correção do Gerador Atual", "Readiness Guards"]
tags: [ldcn, gerador-inteligente, implementation, guards, readiness]
status: canonico
---

# 🚦 34 - Guardrails de Readiness e Correção da Implementação

[[00 - LDCN OS - Gerador + Backend - Mapa Raiz|⬅ Mapa Raiz]] · [[09 - Approved Solution|ApprovedSolution]] · [[10 - TeamComposer V2|TeamComposer]] · [[11 - Dynamic Pipeline Composer|Pipeline]]

## Resultado observado

No cenário:

```text
"quero uma landing page"
```

o Gerador chegou a:

```text
approvedStackCount = 0
pipelineNodeCount = 0
AgentTeam.instances = []
ApprovedSolution.deliveryTargets = []
ApprovedSolution.selectedStacks = []
status = READY_FOR_EXECUTION
nextAction = START_EXECUTION
```

Isso viola a arquitetura.

## Falha estrutural

```text
Topology APPROVED
com nenhum DeliveryTarget aprovado
↓
ApprovedSolution ACTIVE
com zero stacks
↓
ArchitectureComposition APPROVED
com zero proposals
↓
AgentTeam APPROVED
com zero instances
↓
Pipeline APPROVED
com zero nodes
↓
READY_FOR_EXECUTION
```

## Invariantes obrigatórios

```text
Executable Mission
→ ApprovedSolution.deliveryTargets.length >= 1

Target que exige stack
→ selectedStacks.length >= 1

Selected stack que exige arquitetura
→ approved architecture exists

Executable Mission
→ AgentTeam contém composição mínima válida

Executable Mission
→ Pipeline contém nodes executáveis

READY_FOR_EXECUTION
→ solution valid
→ architecture valid
→ team valid
→ pipeline valid
→ contracts approved
→ no blocking conflict
→ no stale context
```

## Estados corretos quando faltar algo

```text
SOLUTION_SELECTION_REQUIRED
RUNTIME_SUPPORT_REQUIRED
GENERATOR_TEAM_NOT_READY
GENERATOR_PIPELINE_NOT_READY
GENERATOR_CONTEXT_STALE
```

## Landing Page como teste constitucional

```text
Intent:
LANDING_PAGE

Topology:
FRONTEND_ONLY

Candidates:
Astro
Next.js
React
Angular

Selected:
stack.typescript.astro
ou outra stack justificada

ApprovedSolution:
deliveryTargets = [FRONTEND]
selectedStacks = [selected stack]

Architecture:
1 approved stack architecture

Mission Team:
mínimo válido da stack

Pipeline:
frontend implementation path

Backend Team:
absent

Mobile Team:
absent

Database:
absent unless requirement justifies it
```

## IA deve participar

```text
ProjectIntent
↓
AI Topology Advisor
↓
TopologyProposal
↓
TopologyPolicy
↓
SolutionTopology

Requirements
↓
AI Stack Evaluation
↓
StackCandidateEvaluations
↓
SelectionPolicy
↓
Approved stack

ApprovedSolution
↓
AI Team Composition Advisor
↓
TeamCompositionProposal
↓
Team Policy
↓
TeamComposer
```

## PROMPT — Diagnóstico da implementação atual

```text
# LDCN OS — INTELLIGENT GENERATOR IMPLEMENTATION DIAGNOSTIC

Cenário:
"quero uma landing page"

Resultado incorreto:
approvedStackCount = 0
pipelineNodeCount = 0
AgentTeam.instances = []
ApprovedSolution.selectedStacks = []
ApprovedSolution.deliveryTargets = []
status = READY_FOR_EXECUTION

Objetivo:
descobrir causa exata sem implementar ainda.

Investigar:
A. causa da Topology sem required target;
B. causa da ApprovedSolution vazia;
C. causa de Architecture APPROVED com zero proposals;
D. causa de Team APPROVED com zero instances;
E. causa de Pipeline APPROVED com zero nodes;
F. guard que produz READY_FOR_EXECUTION;
G. StackRegistry atual;
H. AgentCatalog atual;
I. CapabilityRegistry atual;
J. StackTeamProfiles atuais;
K. runtime support atual.

Também mapear:
- quais AgentDefinitions já existem;
- quais precisam ser criados do zero;
- quais prompts existem;
- quais tools/territories existem.

Não implementar.
Não tocar frontend.
Não criar migration.
Não commit/push.

Entregar:
1. root causes;
2. missing invariants;
3. reuse map;
4. bootstrap plan;
5. test plan;
6. exact files likely affected.
```

## Testes obrigatórios

```text
1 landing page -> at least one frontend target
2 selected stack count > 0 before ACTIVE solution
3 empty AgentTeam cannot be APPROVED for executable Mission
4 empty pipeline cannot be APPROVED for executable Mission
5 READY_FOR_EXECUTION impossible with zero pipeline nodes
6 backend-only never creates frontend
7 frontend-only never creates internal backend
8 mobile-only may remain backendless
9 unsupported stack runtime blocks execution honestly
10 double execution remains idempotent
```

## 🔗 Relacionados

- [[30 - AI-First Intelligence Constitution]]
- [[31 - Agent Definition Factory e Team Factory]]
- [[32 - AI Decision Runtime]]
- [[33 - Stack Teams Bootstrap do Zero]]
- [[26 - Critérios de Aceite e Testes]]
