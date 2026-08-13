---
title: "07 - Stack Registry e Team Catalog"
aliases:
  - "Stack Registry e Team Catalog"
tags:
  - ldcn
  - gerador-inteligente
  - arquitetura
status: canonico
---

# 07 - Stack Registry e Team Catalog

[[00 - LDCN OS - Gerador + Backend - Mapa Raiz|⬅ Mapa Raiz]] · [[06 - Technology Selection|← Anterior]] · [[08 - Architecture Composition|Próximo →]]

Stacks iniciais:

```text
stack.java.spring-boot
stack.typescript.angular
stack.typescript.nestjs
stack.typescript.nextjs
stack.typescript.react
stack.typescript.astro
stack.csharp.aspnet-core
stack.python.fastapi
stack.python.django
stack.python.ai
stack.python.data
stack.dart.flutter
stack.kotlin.android
stack.swift.ios
stack.go.backend
stack.rust.backend
```

---

---

```ts
StackDefinition {
  key
  version
  languageKey
  frameworkKeys[]
  supportedTargets[]
  supportedVersions[]
  goodFor[]
  weakFor[]
  capabilityKeys[]
  architectureAgentKey
  leadAgentKey
  specialistAgentKeys[]
  territoryProfile
  buildProfile
  testProfile
  runtimeProfile
  deploymentProfiles[]
  sourceInspectorKey?
  symbolInspectorKey?
  changeSetSchemaKey?
  runtimeSupportStatus
}
```

### Runtime Support

```text
CATALOG_ONLY
PLANNING_SUPPORTED
GENERATION_SUPPORTED
BUILD_SUPPORTED
REPAIR_SUPPORTED
FULLY_SUPPORTED
```

---

---

## Java

```text
architecture.java.architect
backend.java.lead
backend.java.senior-developer
backend.java.developer
backend.java.spring-specialist
backend.java.data-specialist
backend.java.security-specialist
backend.java.runtime-specialist
backend.java.performance-specialist
backend.java.reviewer
backend.java.test-engineer
```

## Angular

```text
architecture.angular.architect
frontend.angular.lead
frontend.angular.senior-developer
frontend.angular.developer
frontend.angular.specialist
frontend.angular.security-specialist
frontend.angular.ux-specialist
frontend.angular.performance-specialist
frontend.angular.runtime-specialist
frontend.angular.reviewer
frontend.angular.test-engineer
```

## NestJS

```text
architecture.nestjs.architect
backend.nestjs.lead
backend.nestjs.senior-developer
backend.nestjs.developer
backend.nestjs.specialist
backend.nestjs.data-specialist
backend.nestjs.security-specialist
backend.nestjs.runtime-specialist
backend.nestjs.performance-specialist
backend.nestjs.reviewer
backend.nestjs.test-engineer
```

## Next.js

```text
architecture.nextjs.architect
fullstack.nextjs.lead
fullstack.nextjs.senior-developer
fullstack.nextjs.developer
fullstack.nextjs.specialist
fullstack.nextjs.security-specialist
fullstack.nextjs.data-specialist
fullstack.nextjs.performance-specialist
fullstack.nextjs.seo-specialist
fullstack.nextjs.runtime-specialist
fullstack.nextjs.reviewer
fullstack.nextjs.test-engineer
```

## React

```text
architecture.react.architect
frontend.react.lead
frontend.react.senior-developer
frontend.react.developer
frontend.react.specialist
frontend.react.security-specialist
frontend.react.ux-specialist
frontend.react.performance-specialist
frontend.react.runtime-specialist
frontend.react.reviewer
frontend.react.test-engineer
```

## Astro

```text
architecture.astro.architect
frontend.astro.lead
frontend.astro.senior-developer
frontend.astro.developer
frontend.astro.specialist
frontend.astro.seo-specialist
frontend.astro.performance-specialist
frontend.astro.ux-specialist
frontend.astro.runtime-specialist
frontend.astro.reviewer
frontend.astro.test-engineer
```

## .NET

```text
architecture.dotnet.architect
backend.dotnet.lead
backend.dotnet.senior-developer
backend.dotnet.developer
backend.dotnet.aspnet-specialist
backend.dotnet.data-specialist
backend.dotnet.security-specialist
backend.dotnet.runtime-specialist
backend.dotnet.performance-specialist
backend.dotnet.reviewer
backend.dotnet.test-engineer
```

## FastAPI

```text
architecture.fastapi.architect
backend.fastapi.lead
backend.fastapi.senior-developer
backend.fastapi.developer
backend.fastapi.specialist
backend.fastapi.data-specialist
backend.fastapi.security-specialist
backend.fastapi.runtime-specialist
backend.fastapi.performance-specialist
backend.fastapi.reviewer
backend.fastapi.test-engineer
```

## Django

```text
architecture.django.architect
backend.django.lead
backend.django.senior-developer
backend.django.developer
backend.django.specialist
backend.django.data-specialist
backend.django.security-specialist
backend.django.runtime-specialist
backend.django.performance-specialist
backend.django.reviewer
backend.django.test-engineer
```

## Flutter

```text
architecture.flutter.architect
mobile.flutter.lead
mobile.flutter.senior-developer
mobile.flutter.developer
mobile.flutter.specialist
mobile.flutter.security-specialist
mobile.flutter.ux-specialist
mobile.flutter.performance-specialist
mobile.flutter.platform-specialist
mobile.flutter.build-specialist
mobile.flutter.reviewer
mobile.flutter.test-engineer
```

## Kotlin Android

```text
architecture.kotlin-android.architect
mobile.android.lead
mobile.android.senior-developer
mobile.android.developer
mobile.android.kotlin-specialist
mobile.android.security-specialist
mobile.android.ux-specialist
mobile.android.performance-specialist
mobile.android.platform-specialist
mobile.android.build-specialist
mobile.android.reviewer
mobile.android.test-engineer
```

## Swift iOS

```text
architecture.swift-ios.architect
mobile.ios.lead
mobile.ios.senior-developer
mobile.ios.developer
mobile.ios.swift-specialist
mobile.ios.security-specialist
mobile.ios.ux-specialist
mobile.ios.performance-specialist
mobile.ios.platform-specialist
mobile.ios.build-specialist
mobile.ios.reviewer
mobile.ios.test-engineer
```

## Go

```text
architecture.go.architect
backend.go.lead
backend.go.senior-developer
backend.go.developer
backend.go.specialist
backend.go.data-specialist
backend.go.security-specialist
backend.go.runtime-specialist
backend.go.performance-specialist
backend.go.reviewer
backend.go.test-engineer
```

## Rust

```text
architecture.rust.architect
backend.rust.lead
backend.rust.senior-developer
backend.rust.developer
backend.rust.specialist
backend.rust.security-specialist
backend.rust.runtime-specialist
backend.rust.performance-specialist
backend.rust.reviewer
backend.rust.test-engineer
```

## Python AI / Data

```text
architecture.ai-python.architect
ai.python.lead
ai.python.senior-engineer
ai.python.engineer
ai.python.ml-specialist
ai.python.data-science-specialist
ai.python.data-engineering-specialist
ai.python.model-evaluation-specialist
ai.python.security-specialist
ai.python.runtime-specialist
ai.python.reviewer
ai.python.test-engineer
```

---

---

Globais seguros:

```text
engineering.cto
product.manager
product.owner
project.manager
business.analyst
```

Somente quando necessário:

```text
security.system-architect
data.system-architect
platform.devops-architect
```

Cross-stack:

```text
integration.architect
integration.engineer
integration.reviewer
integration.test-engineer
```

---


## Integração com Mission Command Flow

O Mission Command Flow deve evoluir para consumir o Gerador Inteligente sem criar um segundo orquestrador.

Hoje, conceitualmente:

```text
Start Engineering
→ Requirements
→ Architecture
→ Plan
```

Evolução:

```text
Start Engineering
→ Intent
→ Requirements
→ Topology
→ Solution
→ Stack Architectures
→ Team
→ Pipeline
→ Jobs
→ Routing
→ Existing Execution Runtime
```

Regra:

> um command de aplicação por ação; o browser não encadeia create/assign/start/execute.

## Integração com Engineering Console

A Console deve exibir o estado do cérebro:

```text
IDEIA
REQUIREMENTS
TOPOLOGY
STACK RECOMMENDATION
ALTERNATIVES
APPROVED SOLUTION
ARCHITECTURES
MISSION TEAM
PIPELINE
JOBS
JOB ROUTING
HANDOFFS
EXECUTION
REVIEWS
GATES
LEARNING SIGNALS
```

Ela deve explicar decisões, por exemplo:

```text
Recomendação: Next.js Full Stack

Motivos:
✓ desenvolvimento rápido
✓ atende frontend + backend leve
✓ menor custo operacional

Alternativa: Java + Angular

Não selecionada:
✗ complexidade maior do que a Mission exige
```

A Console é interface de comando e observação, não o orquestrador.



## 🔗 Documentos relacionados
- [[29 - Empresa de Agentes - Times Stacks e Prompts]]

- [[06 - Technology Selection]]
- [[08 - Architecture Composition]]
- [[10 - TeamComposer V2]]

---

[[00 - LDCN OS - Gerador + Backend - Mapa Raiz|⬅ Mapa Raiz]] · [[06 - Technology Selection|← Anterior]] · [[08 - Architecture Composition|Próximo →]]

> Fonte canônica: [[00 - LDCN OS - Gerador + Backend - Mapa Raiz]]
