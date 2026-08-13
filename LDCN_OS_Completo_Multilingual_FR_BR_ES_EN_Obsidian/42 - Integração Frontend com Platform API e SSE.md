---
title: "Integração Frontend com Platform API e SSE"
aliases: ["Frontend Backend Integration", "API e SSE"]
tags: [ldcn, frontend, backend, api, sse]
status: canonico
---

# 🔌 42 - Integração Frontend com Platform API e SSE

[[00 - LDCN OS - Mapa Raiz Completo|⬅ Mapa Raiz]] · [[36 - Backend Completo - Platform Core + Brain Service|Backend]] · [[40 - Arquitetura Angular Premium|Angular]]

## Regra

```text
Frontend
↓
Platform API
↓
BrainGateway
↓
Brain
```

Nunca:

```text
Frontend -> Brain
```

---

# 1. Query surface

```text
GET /api/v1/session
GET /api/v1/workspaces
GET /api/v1/projects
GET /api/v1/missions/:id
GET /api/v1/missions/:id/overview
GET /api/v1/missions/:id/timeline
GET /api/v1/missions/:id/team
GET /api/v1/missions/:id/pipeline
GET /api/v1/missions/:id/tasks
GET /api/v1/missions/:id/artifacts
GET /api/v1/missions/:id/reviews
GET /api/v1/missions/:id/gates
GET /api/v1/missions/:id/usage
GET /api/v1/missions/:id/operations
```

---

# 2. Command surface

```text
POST /api/v1/missions
POST /api/v1/missions/:id/analyze
POST /api/v1/missions/:id/generate-requirements
POST /api/v1/missions/:id/resolve-topology
POST /api/v1/missions/:id/plan-solution
POST /api/v1/missions/:id/approve-solution
POST /api/v1/missions/:id/compose-architectures
POST /api/v1/missions/:id/compose-team
POST /api/v1/missions/:id/compose-pipeline
POST /api/v1/tasks/:id/run
POST /api/v1/tasks/:id/request-reviews
POST /api/v1/missions/:id/replan
```

---

# 3. Operation pattern

```text
POST command
↓
202 Accepted
↓
operationId
↓
UI shows progress
↓
SSE events
↓
operation.completed
↓
refresh read model
```

---

# 4. SSE

```text
GET /api/v1/stream
```

Event types:

```text
operation.started
operation.progress
operation.completed
operation.failed

mission.state.changed
mission.solution.proposed
mission.solution.approved

architecture.updated
team.composed
pipeline.updated

task.created
task.routed
task.started
task.completed
task.failed

handoff.created
review.created
gate.evaluated

artifact.created
artifact.promoted

brain.decision.started
brain.decision.completed
brain.decision.failed
```

---

# 5. SSE reducer

```text
event arrives
↓
validate event schema
↓
apply lightweight local update
↓
mark relevant read model stale
↓
refresh if necessary
```

---

# 6. Connection states

```text
CONNECTED
RECONNECTING
DISCONNECTED
DEGRADED
```

---

# 7. Retry

```text
exponential backoff
+
jitter
```

---

# 8. Command idempotency

Frontend gera:

```text
requestId
```

Backend controla idempotência.

Double-click:

```text
disabled while pending
```

---

# 9. Stale conflict

Backend `409`:

```text
BRAIN_DECISION_STALE
GENERATOR_CONTEXT_STALE
```

UI:

```text
"Esta decisão ficou desatualizada porque a missão mudou."

[Atualizar]
```

---

# 10. Permission-aware UI

Backend envia permissions.

Frontend:

```text
hide/disable
```

mas backend continua enforcement final.

---

# 11. Read Model principle

Frontend premium deve depender de read models compostos.

Evitar:

```text
20 parallel calls per screen
```

Preferir:

```text
MissionOverview
MissionTeam
MissionPipeline
MissionTimeline
```

---

# 12. API client convention

```ts
ApiResult<T>
ApiError
OperationAccepted
PagedResult<T>
```

---

# 13. Error mapper

```text
domain code
↓
localized UX message
↓
recommended action
```

---

# 14. Observability

Cada command:

```text
correlationId
requestId
operationId
```

Frontend pode mostrar `correlationId` em detalhes técnicos.
