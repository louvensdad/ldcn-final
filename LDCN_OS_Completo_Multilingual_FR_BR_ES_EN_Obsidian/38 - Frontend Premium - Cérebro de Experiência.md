---
title: "Frontend Premium - Cérebro de Experiência"
aliases:
  - "Frontend Premium"
  - "Experience Brain"
  - "Premium UX Brain"
tags:
  - ldcn
  - frontend
  - angular
  - premium
  - ux
  - ai-first
status: canonico
---

# ✨🧠 38 - Frontend Premium — Cérebro de Experiência

[[00 - LDCN OS - Mapa Raiz Completo|⬅ Mapa Raiz]] · [[36 - Backend Completo - Platform Core + Brain Service|Backend]] · [[39 - Design System Premium|Design System]] · [[40 - Arquitetura Angular Premium|Angular]]

> O frontend premium é a camada de experiência do LDCN OS.
>
> Ele **não é o cérebro de negócio** e não substitui o Brain Service. Seu cérebro é um **Experience Brain**, responsável por transformar estado canônico, operações, eventos e decisões do backend em uma experiência clara, elegante, responsiva e orientada à próxima ação.

---

# 0. Princípio central do frontend

```text
Backend decide o que é verdadeiro
↓
Frontend decide como tornar isso compreensível e operável
```

O frontend pode:

```text
compor ViewModels
ordenar informação
priorizar atenção
explicar status
mostrar decisões da IA
sugerir próxima ação com base em NextAction
animar progresso
agrupar eventos
esconder complexidade irrelevante
```

O frontend não pode:

```text
aprovar Solution sozinho
decidir Stack
montar Team
rotear Job
mudar Pipeline
falar com Brain diretamente
encadear workflow de backend
inventar estado
```

---

# 1. Visão premium

O produto deve parecer uma mistura de:

```text
AI engineering studio
+
mission control
+
premium SaaS workspace
+
developer console
```

Sem parecer:

```text
dashboard genérico
admin template
terminal cru
IDE clone
chatbot gigante
```

---

# 2. Direção visual

## Identidade

Nome visual:

```text
LDCN OS
AI Engineering Operating System
```

Personalidade:

```text
preciso
tecnológico
sofisticado
calmo
denso quando necessário
leve na navegação
```

## Tema principal

```text
Graphite / Obsidian background
Soft elevated surfaces
Indigo / violet intelligence accents
Cyan runtime accents
Emerald success
Amber attention
Red critical
```

Gradientes devem aparecer somente em:

```text
brand
AI activity
premium highlights
hero states
```

Não em todo card.

---

# 3. Experience Brain

```text
Backend Read Models
        │
        ▼
┌─────────────────────────────┐
│      EXPERIENCE BRAIN       │
├─────────────────────────────┤
│ LiveStateReducer            │
│ MissionViewModelComposer    │
│ NextActionPresenter         │
│ AttentionEngine             │
│ DecisionNarrativeBuilder    │
│ CommandEligibilityPolicy    │
│ NavigationIntentResolver    │
│ PermissionSurfaceResolver   │
│ EmptyStateResolver          │
│ ErrorExperienceMapper       │
└──────────────┬──────────────┘
               ▼
          Angular UI
```

---

# 4. LiveStateReducer

Recebe:

```text
MissionOverview snapshot
+
SSE events
```

e reduz para:

```ts
MissionLiveState {
  mission
  generator
  operation
  solution
  architecture
  team
  pipeline
  tasks
  artifacts
  reviews
  gates
  costs
  blockers
  nextAction
  connectionState
}
```

## Regra

SSE nunca cria verdade nova.

Ele aplica:

```text
event
↓
invalidate/update view cache
↓
canonical query refresh when necessary
```

---

# 5. MissionViewModelComposer

Não espalhar DTOs crus por componentes.

```text
API DTO
↓
Facade
↓
ViewModel Composer
↓
UI ViewModel
↓
Component
```

Exemplo:

```ts
MissionHeaderVm {
  name
  statusLabel
  statusTone
  stageLabel
  progressPercent
  activeOperationLabel?
  blockerCount
  nextActionLabel
}
```

---

# 6. NextActionPresenter

Backend envia:

```text
NextAction
```

Frontend resolve:

```text
label
icon
description
primary/secondary
confirmation needed?
route after command?
```

Exemplo:

```text
APPROVE_SOLUTION
→ "Aprovar solução"
→ mostrar summary + trade-offs
→ exige confirmação
```

---

# 7. AttentionEngine

Prioriza o que o usuário deve olhar.

Input:

```text
blockers
failed operations
pending approvals
high-risk decisions
unread important events
budget warnings
stale state
```

Output:

```ts
AttentionItem {
  severity
  title
  message
  targetRoute
  action?
}
```

---

# 8. DecisionNarrativeBuilder

Transforma decisão estruturada em apresentação humana.

Exemplo:

```text
Selected:
Astro

Why:
SEO alto
site estático
baixo custo operacional

Alternatives:
Next.js
React
Angular
```

UI:

```text
Recomendamos Astro
Porque combina melhor com seu objetivo de marketing e SEO.

Alternativas avaliadas:
Next.js, React e Angular

Ver decisão completa →
```

Sem esconder trade-offs.

---

# 9. CommandEligibilityPolicy

Frontend não decide domínio.

Mas decide se botão deve estar:

```text
visible
enabled
loading
disabled with reason
hidden due permission
```

usando:

```text
backend nextAction
permissions
operation state
connection state
```

---

# 10. NavigationIntentResolver

Usuário clica em:

```text
"Ver por que escolheu Astro"
```

resolver:

```text
/mission/:id/solution?focus=stack-decision
```

Usuário clica:

```text
"3 bloqueios"
```

resolver:

```text
/mission/:id/overview?panel=blockers
```

---

# 11. ErrorExperienceMapper

Backend:

```text
ROUTING_CAPABILITY_GAP
```

Frontend:

```text
"Não encontramos um agente com todas as capacidades necessárias para este trabalho."

Ação:
"Ver capabilities faltantes"
```

Nunca mostrar somente códigos técnicos.

---

# 12. Estrutura do produto

```text
PUBLIC
├── Home
├── Pricing
├── Features
├── Marketplace Preview
├── Docs/How it works
├── Login
└── Signup

APP
├── Home / Workspace
├── Projects
├── Mission Wizard
├── Mission Command Center
├── Marketplace
├── Usage / Billing
├── Notifications
├── Settings
└── Account

MISSION
├── Overview
├── Requirements
├── Solution
├── Architecture
├── Team
├── Pipeline
├── Tasks
├── Executions
├── Artifacts
├── Reviews & Gates
├── Repair
├── AI Usage
└── Audit
```

---

# 13. Shell premium

Desktop:

```text
┌──────────────┬───────────────────────────────────────────────┐
│ Sidebar      │ Topbar                                        │
│              ├───────────────────────────────────────────────┤
│ LDCN         │ Breadcrumb / Mission Status / Actions         │
│ Workspace    ├───────────────────────────────────────────────┤
│ Projects     │                                               │
│ Marketplace  │                 MAIN AREA                     │
│ Usage        │                                               │
│              │                                               │
│ Settings     │                                               │
└──────────────┴───────────────────────────────────────────────┘
```

Mission mode:

```text
Sidebar global
+
Mission sub-navigation
+
Command Center canvas
+
optional right contextual drawer
```

---

# 14. Sidebar

Itens:

```text
Home
Projects
New Mission
Marketplace
Usage
Notifications

---
Workspace switcher

---
Settings
Profile
```

Colapsável.

No modo compacto:

```text
icons + tooltip
```

---

# 15. Topbar

```text
breadcrumb
search / command palette
live connection indicator
notification center
theme switch
profile
```

Mission:

```text
mission status
current stage
AI activity indicator
primary NextAction
```

---

# 16. Command Palette

Atalho:

```text
Ctrl/Cmd + K
```

Ações:

```text
Go to project
Open mission
Create mission
Open artifacts
Open pipeline
Open team
Show failures
Show pending approvals
Theme
Language
```

Não executar comandos destrutivos sem confirmação.

---

# 17. Home / Workspace

Hero operacional:

```text
Bom dia
O que você quer construir hoje?
```

CTA:

```text
+ Nova missão
```

Cards:

```text
Active Missions
Recent Projects
Needs Attention
AI Usage
Build Health
```

---

# 18. Projects

Visual:

```text
grid / table switch
```

Cada card:

```text
project name
description
stack badges
last mission
health
last activity
artifact count
```

Ações rápidas:

```text
Open
New mission
Duplicate
Archive
```

---

# 19. Mission Wizard

O wizard é conversacional e progressivo.

Nunca:

```text
form gigante com 30 inputs
```

Sempre:

```text
step-by-step
+
AI assistance
+
editable structured summary
```

Fluxo:

```text
1 Idea
2 Product understanding
3 Requirements
4 Topology
5 Solution
6 Approval
7 Architecture
8 Team
9 Pipeline
10 Ready
```

---

# 20. Wizard — etapa Idea

UI:

```text
large prompt box
examples
recent templates
voice future
attach docs future
```

Prompt:

```text
"Descreva o que você quer construir..."
```

---

# 21. Wizard — Intent

Mostrar:

```text
O que entendemos
Problema
Usuários
Objetivos
Restrições
Dúvidas importantes
```

Permitir:

```text
Editar
Corrigir
Adicionar detalhe
```

---

# 22. Wizard — Requirements

Agrupar:

```text
Funcionais
Regras de negócio
Segurança
Dados
Integrações
Performance
SEO
Offline
Compliance
```

Cada requirement:

```text
priority
source
ambiguity
acceptance criteria
```

---

# 23. Wizard — Topology

Visual:

```text
Backend
Frontend
Mobile
Data
AI
Integration
```

Estados:

```text
required
recommended
not needed
forbidden
```

Cards conectados.

---

# 24. Wizard — Solution Comparison

Layout premium:

```text
Recommended Solution
vs
Alternative A
vs
Alternative B
```

Comparar:

```text
fit
speed
cost
security
maintainability
scalability
runtime support
complexity
```

---

# 25. Wizard — Approval

Resumo final:

```text
What will be built
What will NOT be built
Stacks
Architecture direction
Risk
Cost estimate
Team estimate
```

CTA:

```text
Aprovar solução
Voltar e ajustar
```

---

# 26. Mission Command Center

É a tela principal do produto.

```text
Mission Header
↓
Stage Rail
↓
Live Operation
↓
Next Action
↓
Main Panels
```

Painéis:

```text
Solution
Architecture
Team
Pipeline
Tasks
Artifacts
Review/Gates
AI Usage
```

---

# 27. Mission Header

```text
TaskManager API
ACTIVE

Java + Angular
Medium complexity
Low risk

Stage:
Implementation

Current operation:
Generating backend plan...

Next:
Review architecture
```

---

# 28. Stage Rail

```text
Intent
Requirements
Topology
Solution
Architecture
Team
Pipeline
Execution
Review
Promotion
```

Estados:

```text
complete
current
pending
blocked
failed
```

---

# 29. Live Operation Card

```text
Brain is analyzing architecture...
```

Mostrar:

```text
operation type
elapsed
stage
progress
provider/model when useful
token/cost live optional
cancel if allowed
```

Animação discreta.

---

# 30. Solution View

Seções:

```text
Approved Solution
Delivery Targets
Selected Stacks
Alternatives
Trade-offs
Constraints
Decision Timeline
```

---

# 31. Architecture Viewer

Não começar com diagrama impossível.

Primeira versão:

```text
stack cards
module tree
decision list
integration edges
contracts
```

Futuro:

```text
interactive graph
```

---

# 32. Architecture Decision Card

```text
Modular Monolith

Status: Approved
Stack: Java
Risk: Low

Why:
...

Alternatives:
Microservices
Layered monolith
```

---

# 33. Team Room

Visual de organização.

```text
Mission Team
├── Java Unit
├── Angular Unit
└── Integration Unit
```

Cada agente:

```text
role
stack
capabilities
current workload
status
current task
```

---

# 34. Agent Detail Drawer

```text
Role
Mission
Capabilities
Knowledge
Allowed tools
Territory
Current assignments
Recent evidence
Reviews
```

Não mostrar prompt interno completo por padrão.

---

# 35. Job Team Highlight

Ao abrir task:

```text
Mission Team
```

fica esmaecido.

`Job Team` selecionado aparece destacado.

Isso torna o roteamento compreensível.

---

# 36. Pipeline

Representação:

```text
horizontal graph desktop
vertical timeline mobile
```

Node:

```text
type
stack
status
owner
dependencies
gates
duration
```

---

# 37. Pipeline zoom

Níveis:

```text
Mission
Stack
Task
Execution
```

---

# 38. Task Board

Views:

```text
Board
List
Dependency graph future
```

Columns:

```text
Ready
Assigned
Running
Review
Blocked
Done
```

---

# 39. Task Card

```text
title
type
stack
risk
assigned agent
reviewer
status
dependencies
```

Badges sem carnaval visual.

---

# 40. Execution Viewer

Painéis:

```text
Context
Agent
ChangeSet
Artifacts
Tools
Build
Tests
Evidence
Timeline
```

---

# 41. Build/Test Console

Visual inspirado em CI premium.

```text
Build
✓ compile
✓ tests
✓ symbols
```

Logs colapsáveis.

Não despejar console inteiro inicialmente.

---

# 42. Artifact Explorer

Layout:

```text
file tree
+
preview/editor read-only initially
+
revision history
+
evidence
```

Estados:

```text
CANDIDATE
APPROVED
PROMOTED
```

---

# 43. Review Center

```text
Pending Reviews
Completed
Rejected
```

Review card:

```text
reviewer
subject
decision
findings
evidence
```

---

# 44. Gate Center

```text
BUILD_GATE ✓
TEST_GATE ✓
SECURITY_GATE !
INTEGRATION_GATE pending
```

Cada Gate:

```text
inputs
policy
evidence
result
```

---

# 45. Repair Timeline

Mostrar:

```text
Failure
↓
Classification
↓
Repair eligible
↓
Repair execution
↓
Retest
↓
Review
```

---

# 46. AI Decision Inspector

Tela premium essencial.

```text
Decision
Input context summary
Recommendation
Confidence
Alternatives
Trade-offs
Policy checks
Model metadata
Cost
Outcome
```

Nunca chain-of-thought.

---

# 47. AI Usage

Dashboard:

```text
calls
tokens
cost
by mission
by decision type
by provider
by model
```

---

# 48. Cost Experience

O usuário precisa entender:

```text
AI Credits
Platform usage
Estimated remaining
```

Alertas:

```text
80%
95%
100%
```

---

# 49. Audit Timeline

Timeline filtrável:

```text
User action
Brain decision
Policy validation
Team composition
Routing
Execution
Review
Gate
Promotion
```

---

# 50. Notifications

Tipos:

```text
approval needed
mission blocked
build failed
review requested
gate rejected
budget warning
mission completed
```

---

# 51. Marketplace

Premium preview:

```text
Agents
Stack Packs
Templates
Capabilities
Integrations
```

Fase inicial pode ser somente catálogo visual.

---

# 52. Billing

Planos:

```text
Free Trial
Basic
Advanced
Pro
Student
```

Mostrar:

```text
AI credits
storage
features
model access
usage
billing history
```

---

# 53. LLM Wall

Visualizar modelos por plano.

```text
Free
├── baseline models

Basic
├── more models

Advanced
├── stronger models

Pro
└── premium models
```

Locked model:

```text
why locked
upgrade action
```

---

# 54. Localization

Idiomas:

```text
PT-BR
EN
ES
FR
```

Todas strings em i18n.

Nunca hardcode texto em componente.

---

# 55. Responsive

Breakpoints conceituais:

```text
mobile
tablet
desktop
wide
```

Mobile:

```text
bottom/nav drawer
stacked cards
timeline vertical
context drawer fullscreen
```

---

# 56. Accessibility

Obrigatório:

```text
WCAG AA target
keyboard navigation
focus visible
semantic landmarks
ARIA where needed
reduced motion
contrast
screen reader labels
```

---

# 57. Microinteractions

Premium:

```text
soft hover lift
active glow subtle
progress shimmer only for AI work
stage transitions
drawer motion
card expand
skeletons
```

Evitar:

```text
excessive bouncing
neon everywhere
constant animations
```

---

# 58. Empty States

Nunca:

```text
"No data"
```

Exemplo:

```text
Ainda não há arquitetura.
Ela aparecerá depois que a solução for aprovada.

[Ir para solução]
```

---

# 59. Loading

Usar:

```text
skeleton
stage message
operation progress
```

Evitar spinner central infinito.

---

# 60. Offline / reconnection

Frontend detecta:

```text
SSE disconnected
```

Mostra:

```text
Reconectando...
```

Com fallback:

```text
poll MissionOverview
```

---

# 61. Command Confirmation

Confirmar somente ações de alto impacto:

```text
approve solution
scope expansion
cancel mission
promotion
delete/archive
billing changes
```

---

# 62. Premium frontend invariants

```text
frontend never calls Brain directly
frontend never invents canonical state
frontend never orchestrates multi-step backend workflow
frontend always reflects permissions
frontend always shows blockers honestly
frontend always exposes important AI trade-offs
frontend never shows chain-of-thought
frontend never claims READY when backend is blocked
```

---

# 63. Fluxo visual final

```text
Idea
↓
Wizard
↓
Intent
↓
Requirements
↓
Topology
↓
Solution Comparison
↓
Approval
↓
Architecture
↓
AI Team
↓
Pipeline
↓
Command Center
↓
Tasks
↓
Execution
↓
Artifacts
↓
Reviews/Gates
↓
Promotion
```

---

## 🔗 Relacionados

- [[39 - Design System Premium]]
- [[40 - Arquitetura Angular Premium]]
- [[41 - Telas e Jornadas Premium]]
- [[42 - Integração Frontend com Platform API e SSE]]
- [[43 - AI Experience e Decision Inspector]]
- [[44 - Implementação Frontend Premium - Slices e Testes]]
