---
title: "LDCN Academy - Curso Interativo e Onboarding"
aliases:
  - "LDCN Academy"
  - "Curso Inicial"
  - "Onboarding Interativo"
tags:
  - ldcn
  - frontend
  - academy
  - onboarding
  - tutorial
status: canonico
---

# 🎓 46 - LDCN Academy — Curso Interativo e Onboarding

[[00 - LDCN OS - Mapa Raiz Completo|⬅ Mapa Raiz]] · [[38 - Frontend Premium - Cérebro de Experiência|Frontend Premium]] · [[41 - Telas e Jornadas Premium|Jornadas]]

> A primeira experiência do usuário não deve ser uma tela vazia.
>
> O LDCN começa ensinando a própria plataforma por meio de um **curso interativo incorporado ao produto**, ligado às telas reais, aos conceitos reais e ao progresso real do usuário.

---

# 1. Objetivo

Ensinar:

```text
o que é o LDCN OS
como funciona o Gerador Inteligente
o que é Mission
o que é Project
o que é Workspace
o que é Brain
o que é ApprovedSolution
o que são Teams e Agents
o que é Pipeline
como criar uma Mission
como aprovar decisões
como acompanhar execução
como visualizar artifacts
como entender Review/Gates
como usar Repair
como acompanhar custos
como usar Marketplace
como configurar a conta
```

---

# 2. Primeiro acesso

Ao entrar pela primeira vez:

```text
Welcome to LDCN OS
↓
Escolher idioma
↓
Escolher tema
↓
Escolher objetivo principal
↓
Começar Academy
ou
Explorar por conta própria
```

Nunca bloquear completamente o produto.

---

# 3. Welcome Experience

Tela:

```text
Bem-vindo ao LDCN OS

Sua empresa de engenharia com agentes de IA.

[Começar tour]
[Assistir visão geral]
[Explorar sozinho]
```

Mostrar progresso:

```text
0 / 10 módulos
```

---

# 4. Curso inicial

## Módulo 1 — Visão da plataforma

```text
Workspace
Project
Mission
Brain
Platform
Frontend
```

## Módulo 2 — Criando um projeto

```text
Create Project
name
description
workspace
```

## Módulo 3 — Criando uma Mission

```text
idea
intent
requirements
topology
solution
```

## Módulo 4 — Entendendo a IA

```text
Brain proposal
confidence
alternatives
trade-offs
policy validation
```

## Módulo 5 — Arquitetura

```text
selected stacks
architecture decisions
integration
```

## Módulo 6 — Times de agentes

```text
Mission Team
Job Team
specialists
reviewer
```

## Módulo 7 — Pipeline e execução

```text
pipeline nodes
tasks
execution
build
tests
```

## Módulo 8 — Artifacts

```text
candidate
revision
evidence
promotion
```

## Módulo 9 — Reviews / Gates / Repair

```text
review
gate
failure
repair
```

## Módulo 10 — Uso profissional

```text
search
notifications
settings
billing
marketplace
audit
```

---

# 5. Interactive Product Tour

O curso não deve ser só vídeo ou texto.

```text
step
↓
highlight real UI element
↓
explain
↓
user performs action
↓
system validates
↓
next step
```

Exemplo:

```text
"Esta é a barra de busca global."

[Busca Global highlighted]

Digite:
"TaskManager"

Sistema valida
↓
Próximo
```

---

# 6. Practice Mission

Criar uma Mission sandbox:

```text
Academy Demo Project
```

Exemplo:

```text
"Crie uma landing page simples"
```

Sem consumir crédito real.

Usar:

```text
FakeBrainProvider
demo data
sandbox state
```

---

# 7. Course State

```ts
AcademyProgress {
  userId
  courseVersion

  completedModules[]
  currentModule
  currentStep

  startedAt
  updatedAt
  completedAt?

  skipped
  score?
}
```

---

# 8. Resume

Ao voltar:

```text
Continue where you stopped
```

Nunca reiniciar do zero.

---

# 9. Contextual Learning

Além do curso inicial:

```text
?
```

em cada tela.

Exemplo em Pipeline:

```text
O que é Pipeline?
Como ler dependências?
O que significa BLOCKED?
```

---

# 10. Academy Drawer

Pode ser aberto a qualquer momento.

```text
Academy
├── Getting Started
├── Projects
├── Missions
├── AI Decisions
├── Architecture
├── Agents
├── Pipeline
├── Artifacts
├── Reviews/Gates
├── Billing
└── Advanced
```

---

# 11. Knowledge Check

Perguntas rápidas opcionais:

```text
Qual é a diferença entre Mission Team e Job Team?
```

Não transformar em escola formal.

---

# 12. Progress / Achievement

Visual discreto:

```text
Getting Started 80%
```

Badges podem existir:

```text
First Mission
First Approval
First Successful Build
```

Sem gamificação infantil.

---

# 13. Help from AI

Dentro da Academy:

```text
Perguntar ao LDCN
```

Exemplo:

```text
"Por que preciso aprovar a solução?"
```

A resposta usa:

```text
public product knowledge
current screen context
current user role
```

Nunca chain-of-thought.

---

# 14. Screen Walkthrough

Cada tela precisa possuir:

```text
pageId
title
description
purpose
primaryActions[]
importantConcepts[]
tourSteps[]
helpArticles[]
```

---

# 15. Academy Registry

```ts
AcademyModuleDefinition {
  key
  version
  titleKey
  descriptionKey
  required
  estimatedMinutes
  prerequisites[]
  steps[]
}
```

---

# 16. Tour Step

```ts
AcademyStepDefinition {
  key
  route
  targetSelector?
  titleKey
  bodyKey
  actionType
  validationRule?
  nextStep
}
```

---

# 17. Action Types

```text
EXPLAIN
HIGHLIGHT
CLICK
INPUT
NAVIGATE
CONFIRM
QUIZ
WAIT_FOR_EVENT
```

---

# 18. Role-specific Academy

Administrador:

```text
Organization
Members
Roles
Security
Billing
```

Developer/User:

```text
Projects
Missions
Artifacts
```

Viewer:

```text
Navigation
Audit
Read-only experience
```

---

# 19. Course versioning

Quando a UI muda:

```text
courseVersion++
```

Usuário não perde histórico.

Novos módulos:

```text
NEW
```

---

# 20. Onboarding completion

Ao completar:

```text
Você já conhece o essencial do LDCN OS.

[Crie sua primeira missão real]
```

---

# 21. Acceptance

```text
first-time user understands product without documentation externa
course can be skipped
course can be resumed
practice does not consume credits
tour targets real UI
course is versioned
course is localized
contextual help exists
screen help is searchable
```

---

## 🔗 Relacionados

- [[47 - Navegação Enterprise Busca e Command Palette]]
- [[48 - Central de Notificações e Attention Center]]
- [[49 - Perfil Preferências Tema e Personalização]]
- [[50 - Company Center - Organização e Administração]]
- [[51 - Help Center e Suporte Contextual]]


## Internacionalização obrigatória

Todo conteúdo da Academy deve existir em:

```text
pt-BR
en
es
fr
```

A primeira etapa do onboarding permite escolher o idioma e a Academy muda imediatamente.

Veja [[53 - Internacionalização Completa - FR BR ES EN]].
