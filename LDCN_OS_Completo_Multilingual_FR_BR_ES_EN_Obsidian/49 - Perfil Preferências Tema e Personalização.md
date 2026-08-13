---
title: "Perfil Preferências Tema e Personalização"
aliases:
  - "Profile"
  - "Personalization"
  - "Appearance"
tags:
  - ldcn
  - frontend
  - profile
  - personalization
  - theme
status: canonico
---

# 👤🎨 49 - Perfil, Preferências, Tema e Personalização

[[00 - LDCN OS - Mapa Raiz Completo|⬅ Mapa Raiz]] · [[39 - Design System Premium|Design System]]

# 1. Profile

```text
Avatar
Display name
Email
Role
Organization
Workspace
Language
Timezone
```

---

# 2. Profile menu

Topbar avatar:

```text
Profile
Personalization
Notifications
Billing
Academy
Keyboard shortcuts
Sign out
```

---

# 3. Appearance

```text
System
Light
Dark
```

---

# 4. Accent color

Premium personalization:

```text
Indigo
Violet
Cyan
Emerald
Amber
Rose
Custom brand future
```

---

# 5. Theme model

```ts
AppearancePreferences {
  mode
  accent
  density
  sidebarMode
  reducedMotion
  highContrast
  codeFontSize
}
```

---

# 6. Density

```text
Comfortable
Compact
```

---

# 7. Sidebar

```text
Expanded
Compact
Auto-collapse
```

---

# 8. Dashboard personalization

Usuário pode:

```text
reorder widgets
hide widgets
pin widgets
```

Exemplo:

```text
AI Usage
Needs Attention
Recent Projects
Mission Health
```

---

# 9. Home presets

```text
Builder
Manager
Reviewer
Admin
```

Não bloquear customização.

---

# 10. Language

```text
Português
English
Español
Français
```

---

# 11. Timezone

Usar timezone real do usuário.

Eventos exibidos localmente.

---

# 12. Date format

```text
DD/MM/YYYY
MM/DD/YYYY
YYYY-MM-DD
```

---

# 13. Number/currency

Locale-aware.

---

# 14. Editor preferences

Artifact viewer:

```text
font size
line wrap
line numbers
minimap future
```

---

# 15. Motion

```text
Normal
Reduced
Off where possible
```

---

# 16. Accessibility preferences

```text
high contrast
larger text
reduce motion
focus enhancement
```

---

# 17. Saved preferences

Backend synced.

```text
same experience across devices
```

Local cache only for immediate boot.

---

# 18. Organization branding future

Enterprise:

```text
logo
accent
workspace name
```

Não permitir quebrar accessibility.

---

# 19. Reset

```text
Reset personalization
```

com preview.

---

# 20. Live preview

Settings:

```text
Theme preview card
```

Atualiza sem salvar até Apply.

---

# 21. Acceptance

```text
light
dark
system
accent
density
sidebar
language
timezone
accessibility
dashboard personalization
backend sync
```


## 🌍 Internacionalização

- [[53 - Internacionalização Completa - FR BR ES EN]]
