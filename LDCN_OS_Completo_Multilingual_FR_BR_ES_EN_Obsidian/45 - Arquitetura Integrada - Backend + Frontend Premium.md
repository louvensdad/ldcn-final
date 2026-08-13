---
title: "Arquitetura Integrada - Backend + Frontend Premium"
aliases:
  - "Backend Frontend Integration"
  - "Full Product Architecture"
tags:
  - ldcn
  - frontend
  - backend
  - integration
status: canonico
---

# 🌐⚙️ 45 - Arquitetura Integrada — Backend + Frontend Premium

[[00 - LDCN OS - Mapa Raiz Completo|⬅ Mapa Raiz]] · [[36 - Backend Completo - Platform Core + Brain Service|Backend]] · [[38 - Frontend Premium - Cérebro de Experiência|Frontend]]

## Fluxo completo do produto

```text
USER
↓
Premium Angular Frontend
↓
Experience Brain
↓
Platform API / Read Models / Commands / SSE
↓
Platform Core
↓
BrainGateway
↓
Brain Service
↓
AI Decision
↓
Platform Policy
↓
Canonical State
↓
Event / Read Model
↓
Frontend
```

## Separação de cérebros

```text
Brain Service
= inteligência de negócio/engenharia

Experience Brain
= inteligência de apresentação/UX
```

O Experience Brain nunca redefine verdade de domínio.

## Comunicação

```text
Frontend → Platform:
HTTP Commands
HTTP Queries
SSE

Platform → Brain:
BrainGateway
Internal API
Events

Brain → Platform:
Structured Decision Envelopes
Events

Platform → Frontend:
Canonical Read Models
Operation state
SSE
```

## Regra final

> **O Brain pensa a engenharia. O Platform governa. O Experience Brain torna tudo compreensível e premium.**
