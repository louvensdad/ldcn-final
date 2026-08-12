---
title: "17 - Execution Runtime"
aliases:
  - "Execution Runtime"
tags:
  - ldcn
  - gerador-inteligente
  - arquitetura
status: canonico
---

# 17 - Execution Runtime

[[00 - Gerador Inteligente - Mapa Raiz|⬅ Mapa Raiz]] · [[16 - Scope Expansion|← Anterior]] · [[18 - Review Gates e Repair|Próximo →]]

O Gerador Inteligente não cria um novo engine.

Ele reutiliza:

```text
AgentTask
AgentAssignment
AgentExecution
AgentExecutionContextSnapshot
AgentEvidence
```

### Fluxo

```text
WorkRoutingDecision VALIDATED
↓
existing Assignment service
↓
AgentExecution
↓
cognitive or deterministic handler
↓
Artifact candidate / evidence
```

## PROMPT — Execution Context Builder

```text
# LDCN OS — JOB EXECUTION CONTEXT

Monte contexto mínimo para o executor.

Incluir:
Mission summary
ApprovedSolution
relevant contracts
ArchitectureDecisions
task
dependencies
affected artifacts
relevant capability packs
territory
allowed tools
previous evidence
handoff package if present

Não incluir:
irrelevant stacks
entire company memory
secrets
chain-of-thought
```

---



## 🔗 Documentos relacionados

- [[13 - Intelligent Work Router]]
- [[18 - Review Gates e Repair]]

---

[[00 - Gerador Inteligente - Mapa Raiz|⬅ Mapa Raiz]] · [[16 - Scope Expansion|← Anterior]] · [[18 - Review Gates e Repair|Próximo →]]

> Fonte canônica: [[00 - Gerador Inteligente - Mapa Raiz]]
