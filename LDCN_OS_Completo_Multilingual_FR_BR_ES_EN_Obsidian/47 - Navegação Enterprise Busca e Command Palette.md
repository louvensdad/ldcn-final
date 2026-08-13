---
title: "Navegação Enterprise Busca e Command Palette"
aliases:
  - "Enterprise Navigation"
  - "Global Search"
  - "Command Palette"
tags:
  - ldcn
  - frontend
  - navigation
  - search
  - enterprise
status: canonico
---

# 🧭🔎 47 - Navegação Enterprise, Busca e Command Palette

[[00 - LDCN OS - Mapa Raiz Completo|⬅ Mapa Raiz]] · [[38 - Frontend Premium - Cérebro de Experiência|Frontend Premium]]

# 1. Menu principal profissional

```text
LDCN OS
│
├── Home
├── Projects
├── Missions
├── Marketplace
├── Academy
│
├── Intelligence
│   ├── AI Decisions
│   ├── Agents
│   └── Usage
│
├── Operations
│   ├── Tasks
│   ├── Executions
│   ├── Artifacts
│   ├── Reviews
│   └── Gates
│
├── Company
│   ├── Organization
│   ├── Members
│   ├── Teams
│   ├── Roles
│   └── Audit
│
├── Billing
├── Notifications
└── Settings
```

Menu deve mudar conforme:

```text
plan
role
permission
workspace
feature availability
```

---

# 2. Workspace Switcher

Topo da sidebar:

```text
Personal Workspace
▾
```

Dropdown:

```text
current workspace
recent workspaces
create workspace
manage workspaces
```

---

# 3. Project Context Switcher

Dentro de Mission:

```text
Workspace / Project / Mission
```

Rápido:

```text
switch project
switch mission
```

---

# 4. Global Search

Atalho:

```text
Ctrl/Cmd + K
ou
/
```

Busca em:

```text
Projects
Missions
Tasks
Agents
Artifacts
Architecture Decisions
Requirements
Reviews
Gates
Operations
Marketplace
Academy
Settings
Members
```

---

# 5. Search Result Types

```ts
GlobalSearchResult {
  type
  title
  subtitle
  route
  icon
  metadata
  score
  permission
}
```

---

# 6. Search Groups

```text
Recent
Projects
Missions
Tasks
Artifacts
People
AI Decisions
Commands
Help
```

---

# 7. Search operators

Futuro:

```text
type:mission
status:blocked
stack:java
agent:security
```

---

# 8. Command Palette

Além de buscar:

```text
Create Mission
Create Project
Open Marketplace
Open Academy
Switch Workspace
Change Theme
Change Language
Open Notifications
Open Billing
```

Ações destrutivas:

```text
não aparecem ou exigem confirmation
```

---

# 9. Recent Items

Persistir:

```text
last opened projects
last opened missions
last viewed artifacts
```

---

# 10. Favorites

Usuário pode favoritar:

```text
project
mission
artifact
dashboard
```

---

# 11. Breadcrumbs

```text
Workspace
/
Project
/
Mission
/
Pipeline
```

Cada nível clicável.

---

# 12. Enterprise Density

Sidebar:

```text
Expanded
Compact
Auto
```

---

# 13. Mobile Navigation

```text
Bottom nav:
Home
Projects
New
Notifications
More
```

"More":

```text
Academy
Marketplace
Usage
Settings
```

---

# 14. Keyboard Navigation

```text
G then P -> Projects
G then M -> Missions
G then A -> Academy
```

Opcional e configurável.

---

# 15. Search permissions

Resultado sem permissão:

```text
não retornar
```

Nunca mostrar e bloquear depois.

---

# 16. Search indexing

Backend read/search service futuro.

Frontend pode usar:

```text
local recent cache
+
remote global search
```

---

# 17. Acceptance

```text
search accessible everywhere
keyboard shortcut
result grouping
permission-aware
localized
responsive
fast
recent items
favorites
command palette
```
