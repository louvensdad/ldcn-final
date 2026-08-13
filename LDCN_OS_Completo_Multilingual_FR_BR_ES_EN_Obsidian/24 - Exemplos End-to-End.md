---
title: "24 - Exemplos End-to-End"
aliases:
  - "Exemplos End-to-End"
tags:
  - ldcn
  - gerador-inteligente
  - arquitetura
status: canonico
---

# 24 - Exemplos End-to-End

[[00 - LDCN OS - Mapa Raiz Completo|⬅ Mapa Raiz]] · [[23 - Backend NestJS APIs e Persistência|← Anterior]] · [[25 - Prompts Mestres|Próximo →]]

Usuário:

```text
"Quero uma landing page para uma oficina."
```

Fluxo:

```text
Intent
↓
Requirements
↓
FRONTEND_ONLY
↓
Astro score alto
Next.js alternativa
↓
ApprovedSolution = Astro
↓
Astro Architect
↓
Mission Team LOW
↓
Astro Developer + UX/SEO + Test
↓
Pipeline frontend-only
↓
Jobs
↓
Routing
↓
Build/Test
↓
Review/Gate
```

Não existe backend.

---

---

```text
Idea
↓
Requirements
↓
BACKEND_FRONTEND
↓
Java + Angular
↓
Java Architecture
Angular Architecture
Integration Architecture
↓
Mission Team
↓
Backend Jobs routed to Java Team
Frontend Jobs routed to Angular Team
Cross-stack Jobs routed to Integration Unit
↓
Build/Test
↓
Cross-stack Validation
↓
Gates
```

---

---

```text
Idea
↓
MOBILE_ONLY
↓
Flutter
↓
Flutter Architecture
↓
local persistence
↓
no backend
↓
Flutter Team
↓
mobile pipeline
```

---

---

```text
Idea
↓
FULLSTACK_SINGLE_RUNTIME
↓
Next.js
↓
Next.js Architecture
↓
Next.js Team
↓
no separate backend team
↓
no Integration Unit unless external integrations
```

---

---

Mission:

```text
Java + Angular
```

Job:

```text
"Implementar endpoint e consumir no frontend."
```

Fluxo:

```text
JobClassifier
↓
CROSS_STACK_INTEGRATION
↓
Java subtask
↓
Java Team executes
↓
HandoffPackage
↓
Integration Unit validates contract
↓
Angular Team receives handoff
↓
Angular implementation
↓
Integration tests
↓
Review/Gate
```

---

---

Mission:

```text
Java + Angular
```

Novo requisito:

```text
"Agora quero app mobile."
```

Fluxo:

```text
JobClassifier
↓
MOBILE target missing
↓
SCOPE_EXPANSION_REQUIRED
↓
ScopeExpansionProposal
↓
Flutter recommended
↓
User approval
↓
ApprovedSolution v2
↓
Flutter Architecture
↓
TeamComposer adds Flutter Team
↓
PipelineComposer adds mobile branch
↓
Jobs become routable
```

---



## 🔗 Documentos relacionados

- [[04 - Solution Topology]]
- [[06 - Technology Selection]]
- [[13 - Intelligent Work Router]]
- [[14 - Team Switching e Handoffs]]

---

[[00 - LDCN OS - Mapa Raiz Completo|⬅ Mapa Raiz]] · [[23 - Backend NestJS APIs e Persistência|← Anterior]] · [[25 - Prompts Mestres|Próximo →]]

> Fonte canônica: [[00 - LDCN OS - Mapa Raiz Completo]]
