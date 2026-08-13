---
title: "01 - Constituição e Visão Geral"
aliases:
  - "Constituição e Visão Geral"
tags:
  - ldcn
  - gerador-inteligente
  - arquitetura
status: canonico
---

# 01 - Constituição e Visão Geral

[[00 - LDCN OS - Gerador + Backend - Mapa Raiz|⬅ Mapa Raiz]] · [[02 - Intent Understanding|Próximo →]]

## 0.1. Regra central

> **LLM propõe; contrato limita; gate prova.**

## 0.2. Regra de produto

> **Primeiro entender o problema. Depois decidir o que precisa existir. Depois escolher como construir. Só então montar os agentes e executar.**

## 0.3. Regra de escopo

> **Nenhum backend, frontend, mobile, data layer, AI layer ou integração pode ser criado se não estiver na ApprovedSolution.**

## 0.4. Regra de time

> **A Mission define quais Teams podem existir; o Gerador Inteligente decide, Job por Job, qual Team e quais agentes atuam.**

## 0.5. Regra de arquitetura

> **Cada stack possui seu próprio cérebro técnico.**

## 0.6. Regra de execução

> **O Gerador Inteligente decide e roteia. Os runtimes existentes executam.**

## 0.7. Regra de aprendizado

> **ML recomenda e aprende. Policies determinísticas autorizam.**

## 0.8. Regra de memória

> **Persistir decisões, contratos, evidências, snapshots, outcomes e resumos. Nunca persistir chain-of-thought.**

---

---

```text
USER IDEA
   │
   ▼
ProjectIntent
   │
   ▼
RequirementsContract
   │
   ▼
SolutionTopology
   │
   ▼
SolutionPlanner
   │
   ▼
TechnologySelector
   │
   ▼
SolutionProposal
   │
   ▼
ApprovedSolution
   │
   ▼
StackArchitectureComposer
   │
   ▼
Approved Stack Architectures
   │
   ▼
TeamComposer V2
   │
   ▼
MISSION TEAM
   │
   ▼
Dynamic Pipeline Composer
   │
   ▼
JOBS
   │
   ▼
JobClassifier
   │
   ▼
IntelligentWorkRouter
   │
   ▼
JOB TEAM
   │
   ▼
TeamSwitch / Handoff / Integration
   │
   ▼
AgentExecution / Existing Runtime
   │
   ▼
Build / Test / Evidence
   │
   ▼
Review
   │
   ▼
Gate
   │
   ▼
Promotion
   │
   ▼
LearningOutcome
   │
   ▼
Learning Intelligence
```

---

---

O Gerador Inteligente é um **sistema de decisão, composição, roteamento, comutação e replanejamento**.

Ele responde:

1. O que o usuário quer?
2. O que precisa existir?
3. O que não precisa existir?
4. Qual stack combina melhor?
5. Qual arquitetura é adequada?
6. Qual Team pertence à Mission?
7. Qual Team executa este Job?
8. Quais especialistas entram?
9. Quando trocar de Team?
10. Quando fazer handoff?
11. Quando chamar Integration Unit?
12. Quando abrir Scope Expansion?
13. Quando executar?
14. Quando bloquear?
15. Quando replanejar?
16. Como aprender com o resultado?

---

---

Não é:

```text
um único Agent
um único Prompt
um WorkflowEngine gigante
um code generator solto
um orquestrador browser-side
um substituto de AgentExecution
um substituto de Review/Gate
um substituto de Repair Runtime
```

---

---

```text
LAYER 01 — Intent Understanding
LAYER 02 — Requirements Intelligence
LAYER 03 — Solution Topology
LAYER 04 — Solution Planning
LAYER 05 — Technology Selection
LAYER 06 — Architecture Composition
LAYER 07 — Approved Solution
LAYER 08 — Team Composition
LAYER 09 — Dynamic Pipeline
LAYER 10 — Job Classification
LAYER 11 — Intelligent Work Routing
LAYER 12 — Team Switching / Handoff
LAYER 13 — Execution
LAYER 14 — Review & Gates
LAYER 15 — Repair
LAYER 16 — Learning Intelligence
LAYER 17 — Memory & Knowledge
LAYER 18 — Governance & Security
LAYER 19 — Observability & Audit
```

---



---

[[00 - LDCN OS - Gerador + Backend - Mapa Raiz|⬅ Mapa Raiz]] · [[02 - Intent Understanding|Próximo →]]

> Fonte canônica: [[00 - LDCN OS - Gerador + Backend - Mapa Raiz]]
