---
title: "Central de Notificações e Attention Center"
aliases:
  - "Notifications"
  - "Attention Center"
tags:
  - ldcn
  - frontend
  - notifications
  - enterprise
status: canonico
---

# 🔔 48 - Central de Notificações e Attention Center

[[00 - LDCN OS - Mapa Raiz Completo|⬅ Mapa Raiz]] · [[38 - Frontend Premium - Cérebro de Experiência|Frontend Premium]]

# 1. Objetivo

Cada evento importante precisa chegar ao usuário certo.

Não criar barulho.

---

# 2. Tipos

```text
APPROVAL_REQUIRED
MISSION_BLOCKED
MISSION_COMPLETED

BUILD_FAILED
TEST_FAILED
REPAIR_STARTED
REPAIR_COMPLETED

REVIEW_REQUESTED
REVIEW_REJECTED
GATE_REJECTED

SCOPE_EXPANSION_REQUIRED

AI_DECISION_READY
AI_BUDGET_WARNING

BILLING_WARNING
PAYMENT_FAILED

MEMBER_INVITED
ROLE_CHANGED
SECURITY_ALERT

SYSTEM_MAINTENANCE
```

---

# 3. Severity

```text
INFO
SUCCESS
WARNING
CRITICAL
ACTION_REQUIRED
```

---

# 4. Notification Center

Dropdown rápido:

```text
Unread
All
Mentions
Action required
```

Página completa:

```text
filters
search
mark all read
preferences
```

---

# 5. Notification model

```ts
NotificationItem {
  id
  userId
  type
  severity

  title
  message

  workspaceId?
  projectId?
  missionId?
  taskId?

  action?
  route?

  createdAt
  readAt?
  archivedAt?
}
```

---

# 6. Actionable notification

```text
Solution ready for approval

[Review solution]
```

---

# 7. Attention Center

Não é a mesma coisa que notificações.

Attention Center mostra estado atual:

```text
3 things need your attention
```

Exemplo:

```text
Mission blocked
Review waiting
AI credits at 92%
```

---

# 8. Sources

```text
Operations
Mission State
Reviews
Gates
Billing
Security
Brain decisions
```

---

# 9. Notification preferences

Por categoria:

```text
In-app
Email
Push future
```

Frequência:

```text
Immediate
Daily digest
Off
```

---

# 10. Quiet hours

Configuração futura:

```text
22:00 - 07:00
```

Critical pode ignorar conforme policy.

---

# 11. Workspace policy

Admin pode definir:

```text
mandatory security notifications
mandatory billing notifications
```

---

# 12. Badge

Sidebar:

```text
Notifications  5
```

Não exibir 99+ eternamente.

---

# 13. Notification grouping

Agrupar:

```text
3 builds failed in Project X
```

---

# 14. Deep linking

Toda notificação acionável abre:

```text
exact relevant screen
```

---

# 15. Read state

Sincronizado no backend.

Não somente localStorage.

---

# 16. Acceptance

```text
actionable
categorized
permission-aware
read state synced
preferences
grouping
deep links
attention center separate
```
