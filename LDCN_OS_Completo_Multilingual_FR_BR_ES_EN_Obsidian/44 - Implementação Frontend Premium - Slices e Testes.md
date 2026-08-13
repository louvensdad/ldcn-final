---
title: "Implementação Frontend Premium - Slices e Testes"
aliases: ["Frontend Roadmap", "Premium Frontend Slices"]
tags: [ldcn, frontend, implementation, testing]
status: canonico
---

# 🛠️ 44 - Implementação Frontend Premium — Slices e Testes

[[00 - LDCN OS - Mapa Raiz Completo|⬅ Mapa Raiz]] · [[38 - Frontend Premium - Cérebro de Experiência|Frontend Brain]] · [[40 - Arquitetura Angular Premium|Angular]]

## Princípio

Construir depois que Backend + Brain contracts estiverem estáveis.

---

# F0 — Foundation

```text
Angular 18
app shell
routing
design tokens
dark/light
i18n
auth shell
API base client
error handling
```

---

# F1 — Workspace

```text
Home
Projects
Workspace switcher
New Mission entry
```

---

# F2 — Mission Wizard

```text
Idea
Intent
Requirements
Topology
Solution
Approval
```

---

# F3 — Command Center

```text
MissionOverview
Stage Rail
NextAction
Blockers
Live Operation
SSE
```

---

# F4 — Architecture + Team

```text
Architecture viewer
Decision cards
Team Room
Agent drawer
Job Team highlight
```

---

# F5 — Pipeline + Tasks

```text
Pipeline graph/timeline
Task board
Task detail
routing explanation
```

---

# F6 — Execution

```text
Execution viewer
Build/Test console
Evidence
Artifacts
```

---

# F7 — Review + Gates + Repair

```text
Review Center
Gate Center
Repair timeline
```

---

# F8 — AI Experience

```text
Decision Inspector
AI activity
explain decision
usage/cost
```

---

# F9 — Marketplace + Billing

```text
Marketplace
plans
LLM wall
usage
billing
```

---

# F10 — Premium polish

```text
responsive
accessibility
keyboard
command palette
animations
skeletons
empty states
error UX
performance
```

---

# Acceptance tests

## Navigation

```text
all routes lazy
deep-link works
browser refresh works
```

## Wizard

```text
no giant form
state persists
approval boundaries clear
```

## Backend contract

```text
frontend never calls Brain
one command per action
SSE updates
fallback polling
```

## Mission

```text
blockers visible
NextAction correct
READY state honest
```

## Team

```text
Mission Team visible
Job Team distinct
reviewer != executor represented
```

## Pipeline

```text
dependencies visible
failed/blocked nodes distinguishable
```

## AI

```text
decision explanation
no chain-of-thought
trade-offs visible
```

## Accessibility

```text
keyboard
focus
screen reader
contrast
reduced motion
```

## Responsive

```text
375px
768px
1280px
1440px+
```

## Performance

```text
route lazy loading
virtualized logs
no giant initial bundle
```

---

# Prompt Codex — Frontend foundation

```text
# LDCN OS — PREMIUM FRONTEND FOUNDATION

Objetivo:
implementar somente a fundação Angular premium.

Antes:
1. ler Frontend docs 38-44;
2. ler Backend doc 36;
3. mapear APIs/read models reais;
4. não criar mocks como estado canônico;
5. preservar architecture boundaries.

Implementar:
- Angular 18 standalone;
- AppShell;
- Sidebar;
- Topbar;
- theme tokens;
- light/dark;
- i18n infrastructure;
- typed API base;
- global error mapper;
- SSE foundation;
- route skeletons;
- premium loading/empty states.

Não implementar:
- full mission workflow;
- browser orchestration;
- Brain direct access;
- Marketplace logic;
- Billing logic.

Entregar:
A. files
B. architecture
C. screenshots or visual evidence when possible
D. tests
E. lint
F. build
G. bundle size
H. known gaps

Sem commit/push antes de autorização.
```

---

# Prompt Codex — Mission Command Center

```text
# LDCN OS — PREMIUM MISSION COMMAND CENTER

Entrada:
MissionOverviewReadModel
MissionTimeline
MissionTeam
MissionPipeline
Operations
SSE

Implementar:
Mission Header
Stage Rail
NextAction
Blockers
Live Operation
Solution summary
Team summary
Pipeline summary
Task summary
AI usage summary

Regras:
- no backend orchestration in browser;
- one command per user action;
- refresh by SSE/invalidation;
- honest blocked/failed states;
- responsive;
- accessible;
- premium visual quality.
```

---

# Prompt Codex — AI Decision Inspector

```text
# LDCN OS — AI DECISION INSPECTOR

Mostrar:
decision type
proposal
confidence
assumptions
ambiguities
rationale summary
alternatives
tradeoffs
policy checks
provider/model metadata
usage
outcome

Nunca:
chain-of-thought
hidden deliberation
raw secret context

Permitir:
Explain decision
Request adjustment
View related contract
```

---

# Definition of Frontend Complete

```text
public marketing
auth
workspace
projects
wizard
mission command center
architecture
team
pipeline
tasks
executions
artifacts
reviews
gates
repair
AI decision inspector
usage
billing
marketplace preview
settings
i18n
responsive
accessibility
SSE
error UX
premium polish
tests
```
