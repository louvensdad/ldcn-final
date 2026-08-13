---
title: "Arquitetura Angular Premium"
aliases: ["Angular Premium Architecture"]
tags: [ldcn, frontend, angular, architecture]
status: canonico
---

# 🅰️ 40 - Arquitetura Angular Premium

[[00 - LDCN OS - Mapa Raiz Completo|⬅ Mapa Raiz]] · [[38 - Frontend Premium - Cérebro de Experiência|Frontend Brain]] · [[42 - Integração Frontend com Platform API e SSE|API/SSE]]

## Stack

```text
Angular 18
Standalone Components
Signals
RxJS
Angular Router
Angular CDK
SCSS Design Tokens
typed HttpClient clients
```

NgRx não é obrigatório.

---

# 1. Estrutura

```text
apps/web/src/app/
├── core/
│   ├── api/
│   ├── auth/
│   ├── sse/
│   ├── errors/
│   ├── permissions/
│   ├── i18n/
│   └── telemetry/
│
├── shell/
│   ├── app-shell/
│   ├── sidebar/
│   ├── topbar/
│   └── command-palette/
│
├── features/
│   ├── home/
│   ├── projects/
│   ├── wizard/
│   ├── mission/
│   ├── solution/
│   ├── architecture/
│   ├── team/
│   ├── pipeline/
│   ├── tasks/
│   ├── executions/
│   ├── artifacts/
│   ├── reviews/
│   ├── gates/
│   ├── repair/
│   ├── usage/
│   ├── marketplace/
│   ├── billing/
│   └── settings/
│
├── shared/
│   ├── ui/
│   ├── icons/
│   ├── pipes/
│   ├── directives/
│   └── utils/
│
└── app.routes.ts
```

---

# 2. Regra de estado

```text
Component
↓
Feature Facade
↓
Api Client / SSE Store
↓
ViewModel
```

Componentes não fazem fetch arbitrário.

---

# 3. Signals

Usar para:

```text
local feature state
computed view models
selection
filters
UI state
```

RxJS:

```text
HTTP
SSE
debounce
retry
multi-source async composition
```

---

# 4. Facade

Exemplo:

```ts
MissionOverviewFacade {
  state
  loading
  error
  blockers
  nextAction

  load()
  refresh()
  executePrimaryAction()
}
```

---

# 5. API clients

Separados por domínio:

```text
SessionClient
WorkspaceClient
ProjectClient
MissionClient
GeneratorClient
ArchitectureClient
TeamClient
PipelineClient
TaskClient
ArtifactClient
ReviewClient
GateClient
UsageClient
OperationClient
```

---

# 6. DTO vs ViewModel

Nunca usar DTO diretamente em template complexo.

```text
MissionOverviewDto
↓
MissionOverviewMapper
↓
MissionOverviewVm
```

---

# 7. Router

```text
/
├── pricing
├── marketplace
├── login
└── app
    ├── home
    ├── projects
    ├── wizard
    ├── missions/:missionId
    │   ├── overview
    │   ├── requirements
    │   ├── solution
    │   ├── architecture
    │   ├── team
    │   ├── pipeline
    │   ├── tasks
    │   ├── executions
    │   ├── artifacts
    │   ├── reviews
    │   ├── gates
    │   ├── usage
    │   └── audit
    ├── marketplace
    ├── billing
    └── settings
```

---

# 8. Lazy routes

Cada feature:

```text
lazy-loaded
```

Mission shell pode manter shared context.

---

# 9. Guards

```text
authGuard
workspaceGuard
missionAccessGuard
planFeatureGuard
```

Não usar guard para lógica de negócio.

---

# 10. Error handling

Global interceptor:

```text
401 → session handling
403 → permission experience
409 → stale/conflict UI
429 → rate limit
5xx → retry experience
```

Domain errors passam para mapper.

---

# 11. SSE Service

```ts
MissionEventStreamService {
  connect(workspaceId)
  disconnect()
  events$
  connectionState
}
```

---

# 12. Cache

Cache de leitura:

```text
mission overview
catalog metadata
team
pipeline
```

Invalidar por event/version.

---

# 13. Optimistic UI

Somente:

```text
safe UI-only preferences
filters
labels
```

Nunca:

```text
ApprovedSolution
Gate
Promotion
Team composition
```

---

# 14. Forms

Usar typed reactive forms.

Wizard:

```text
step state
validation
draft persistence
```

---

# 15. Testing

```text
unit facades
component tests
route tests
API contract mocks
SSE reducer tests
E2E critical journeys
accessibility checks
```

---

# 16. Performance

```text
OnPush/default signal optimization
route lazy loading
defer heavy views
virtual scroll for logs/events
avoid giant JSON in DOM
```

---

# 17. Security

```text
no secrets in localStorage
no provider keys
sanitize rendered markdown
CSP compatible
no direct Brain calls
```

---

# 18. Observability

Frontend events:

```text
route viewed
command submitted
command failed
approval opened
approval completed
SSE disconnected
```

Sem registrar conteúdo sensível.
