---
title: "Arquitetura Integrada - Gerador + Backend"
aliases:
  - "Gerador + Backend"
  - "Arquitetura Integrada LDCN"
tags:
  - ldcn
  - gerador-inteligente
  - backend
  - ai-first
  - arquitetura
status: canonico
---

# 🧠⚙️ 37 - Arquitetura Integrada — Gerador + Backend

[[00 - LDCN OS - Gerador + Backend - Mapa Raiz|⬅ Mapa Raiz]] · [[35 - Cérebro Operacional AI-First|Cérebro]] · [[36 - Backend Completo - Platform Core + Brain Service|Backend]]

> Este documento é a ponte entre o **Gerador Inteligente AI-first** e o **Backend Platform Core**.
>
> O cérebro permanece separado como bounded context, mas a comunicação é integrada por contratos, snapshots, operations, events e policies.

## Visão final

```text
Usuário
↓
Frontend Premium Angular
↓
Platform API / BFF
↓
Platform Core
├── Identity / Tenant / Workspace / Mission
├── Contracts / ApprovedSolution
├── Catalog / Teams / Jobs
├── Routing / Handoffs / Pipeline
├── Execution / Artifacts / Workspace
├── Review / Gates / Repair / Promotion
├── Operations / Audit / Telemetry
│
└── BrainGateway
      ↓
   Brain Service
   ├── Intent
   ├── Requirements
   ├── Topology
   ├── Solution Planning
   ├── Technology Selection
   ├── Architecture Intelligence
   ├── Team Intelligence
   ├── Job Intelligence
   ├── Routing Intelligence
   ├── Team Transition
   ├── Scope Expansion
   ├── PromptCompiler / LlmGateway
   └── Learning Intelligence / ML
```

## Autoridades

```text
Brain Service
→ pensa, analisa, compara e propõe

Platform Core
→ valida, materializa, executa e mantém o estado canônico

Reviewers
→ verificam

Gates
→ provam deterministicamente

Learning Intelligence
→ aprende com outcomes
```

## Comunicação

```text
Platform Command
↓
Operation
↓
BrainGateway
↓
BrainDecisionRequest
↓
AI Decision Runtime
↓
BrainDecisionEnvelope
↓
Platform Policy
↓
Decision Materializer
↓
Canonical State
↓
SSE/Event para frontend
```

## Fluxo do Gerador dentro do Backend

```text
[[02 - Intent Understanding]]
↓
[[03 - Requirements Intelligence]]
↓
[[04 - Solution Topology]]
↓
[[05 - Solution Planning]]
↓
[[06 - Technology Selection]]
↓
[[09 - Approved Solution]]
↓
[[08 - Architecture Composition]]
↓
[[10 - TeamComposer V2]]
↓
[[11 - Dynamic Pipeline Composer]]
↓
[[12 - Job Classification]]
↓
[[13 - Intelligent Work Router]]
↓
[[14 - Team Switching e Handoffs]]
↓
[[17 - Execution Runtime]]
↓
[[18 - Review Gates e Repair]]
↓
[[19 - Learning Intelligence e ML]]
```

## Catálogo da empresa

```text
[[07 - Stack Registry e Team Catalog]]
↓
[[31 - Agent Definition Factory e Team Factory]]
↓
[[33 - Stack Teams Bootstrap do Zero]]
```

## Cérebro AI-first

```text
[[30 - AI-First Intelligence Constitution]]
↓
[[32 - AI Decision Runtime]]
↓
[[35 - Cérebro Operacional AI-First]]
```

## Backend Platform Core

```text
[[23 - Backend NestJS APIs e Persistência]]
↓
[[36 - Backend Completo - Platform Core + Brain Service]]
```

## Regra de integração

> **O Brain nunca escreve diretamente no estado canônico da Platform.**

> **O Platform nunca chama provider LLM diretamente.**

> **O frontend nunca chama o Brain diretamente.**

## Regra para o próximo passo

O frontend premium só deve começar depois que:

```text
Platform Core estável
Brain Service estável
contratos Platform ↔ Brain versionados
catálogo de stacks e agentes pronto
TeamComposer funcionando
Job routing funcionando
handoffs funcionando
pipeline e operations observáveis
SSE pronto
read models prontos
erros normalizados
auth/tenant guards prontos
```

## 🔗 Documentos principais

- [[35 - Cérebro Operacional AI-First]]
- [[36 - Backend Completo - Platform Core + Brain Service]]
- [[30 - AI-First Intelligence Constitution]]
- [[31 - Agent Definition Factory e Team Factory]]
- [[32 - AI Decision Runtime]]
- [[33 - Stack Teams Bootstrap do Zero]]
- [[34 - Guardrails de Readiness e Correção da Implementação]]
- [[23 - Backend NestJS APIs e Persistência]]
- [[26 - Critérios de Aceite e Testes]]
- [[27 - Slices Prompts Codex e Roadmap]]
