---
title: "10 - TeamComposer V2"
aliases:
  - "TeamComposer V2"
tags:
  - ldcn
  - gerador-inteligente
  - arquitetura
status: canonico
---

# 10 - TeamComposer V2

[[00 - Gerador Inteligente - Mapa Raiz|⬅ Mapa Raiz]] · [[09 - Approved Solution|← Anterior]] · [[11 - Dynamic Pipeline Composer|Próximo →]]

## Objetivo

Montar a empresa autorizada para aquela Mission.

### Mission Team

```text
ApprovedSolution
↓
StackTeamProfiles
↓
ComplexityProfile
↓
RiskProfile
↓
TeamComposer V2
↓
AgentTeam + AgentInstances
```

### LOW

```text
Stack Architect
Lead/Developer
Test Engineer
```

### MEDIUM

```text
Stack Architect
Lead
Developer
Reviewer
Test Engineer
```

### HIGH

```text
Stack Architect
Lead
Senior Developer
Developers
Framework Specialist
Data Specialist
Security Specialist
Runtime Specialist
Performance Specialist
Reviewer
Test Engineers
```

## PROMPT — TeamComposer V2

```text
# LDCN OS — TEAM COMPOSER V2

Entrada:
ApprovedSolution
approved StackArchitectures
ComplexityProfile
RiskProfile
AgentCatalog
StackTeamProfiles

Objetivo:
montar a Mission Team.

Regras:
1. somente stacks da ApprovedSolution;
2. composição mínima suficiente;
3. especialistas somente se necessário;
4. Reviewer != executor;
5. Integration Unit somente se houver integração real;
6. nenhum novo DeliveryTarget;
7. nenhuma expansão de scope;
8. registrar motivo de cada AgentInstance.

Saída:
AgentTeam
AgentInstances
TeamCompositionDecision
```

---



## 🔗 Documentos relacionados
- [[29 - Empresa de Agentes - Times Stacks e Prompts]]

- [[09 - Approved Solution]]
- [[13 - Intelligent Work Router]]
- [[07 - Stack Registry e Team Catalog]]

---

[[00 - Gerador Inteligente - Mapa Raiz|⬅ Mapa Raiz]] · [[09 - Approved Solution|← Anterior]] · [[11 - Dynamic Pipeline Composer|Próximo →]]

> Fonte canônica: [[00 - Gerador Inteligente - Mapa Raiz]]
