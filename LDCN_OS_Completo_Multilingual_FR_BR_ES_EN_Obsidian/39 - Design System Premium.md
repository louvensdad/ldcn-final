---
title: "Design System Premium"
aliases: ["LDCN Design System", "Premium UI"]
tags: [ldcn, frontend, design-system, premium]
status: canonico
---

# 🎨 39 - Design System Premium

[[00 - LDCN OS - Mapa Raiz Completo|⬅ Mapa Raiz]] · [[38 - Frontend Premium - Cérebro de Experiência|Frontend Brain]]

## Objetivo

Criar uma linguagem visual própria.

Não usar aparência padrão de:

```text
Angular Material default
Bootstrap admin
generic shadcn clone
```

Pode reutilizar Angular CDK para comportamento e acessibilidade.

---

# 1. Tokens

```text
color
typography
spacing
radius
shadow
border
motion
z-index
```

---

# 2. Color semantics

Dark:

```text
bg.canvas
bg.surface
bg.surfaceElevated
bg.overlay

text.primary
text.secondary
text.muted

border.subtle
border.strong

accent.brand
accent.ai
accent.runtime

state.success
state.warning
state.danger
state.info
```

Light mode equivalente.

---

# 3. Tipografia

Sugestão:

```text
UI sans:
Inter / Geist / system-safe fallback

Code:
JetBrains Mono / ui-monospace
```

Hierarchy:

```text
Display
H1
H2
H3
Body
Small
Caption
Code
```

---

# 4. Spacing

Base:

```text
4px
```

Scale:

```text
4 8 12 16 20 24 32 40 48 64
```

---

# 5. Radius

```text
small 8
medium 12
large 16
xl 20
pill 999
```

---

# 6. Cards

Tipos:

```text
default
interactive
decision
status
metric
glass-highlight
```

---

# 7. Buttons

```text
Primary
Secondary
Ghost
Danger
Icon
Split
```

AI button:

```text
não criar estilo totalmente diferente
usar brand accent + sparkle icon discreto
```

---

# 8. Status chips

```text
ACTIVE
BLOCKED
FAILED
READY
RUNNING
APPROVED
CANDIDATE
PROMOTED
```

Sempre combinar:

```text
color + icon + text
```

Nunca só cor.

---

# 9. Icons

Consistência:

```text
Lucide icon family
```

Evitar misturar 4 bibliotecas.

---

# 10. Data density

Modo:

```text
Comfortable
Compact
```

Engineering Console pode oferecer Compact.

---

# 11. Tables

Premium table:

```text
sticky header
column visibility
sorting
filter
row actions
keyboard focus
empty state
```

---

# 12. Drawers

Usar para:

```text
agent detail
decision detail
task detail
artifact metadata
```

Não navegar para nova página por qualquer detalhe pequeno.

---

# 13. Modals

Somente:

```text
confirmation
critical approval
small focused forms
```

---

# 14. Charts

Somente quando ajudam decisão:

```text
AI cost
mission duration
success/failure
token usage
```

Não transformar tudo em gráfico.

---

# 15. Code blocks

```text
syntax highlighting
copy
line numbers optional
collapse
```

---

# 16. Premium polish checklist

```text
consistent spacing
no layout jump
skeleton loading
empty states
focus states
hover states
keyboard
responsive
reduced motion
dark/light
i18n
```
