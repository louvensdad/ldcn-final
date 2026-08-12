---
title: "Empresa de Agentes - Times, Stacks e Prompts"
aliases:
  - "Guia Completo de Times e Stacks"
  - "Empresa de Tecnologia com Agentes"
tags:
  - ldcn
  - gerador-inteligente
  - times
  - stacks
  - agentes
  - prompts
status: canonico
source: "Guia Completo — Estrutura de Times e Stacks para Empresa de Tecnologia"
---

# 🏢 Empresa de Agentes — Times, Stacks e Prompts

[[00 - Gerador Inteligente - Mapa Raiz|⬅ Mapa Raiz]] · [[07 - Stack Registry e Team Catalog|Stacks]] · [[10 - TeamComposer V2|TeamComposer]] · [[13 - Intelligent Work Router|Job Routing]] · [[25 - Prompts Mestres|Prompts]]

> Este documento é a visão organizacional da empresa virtual do LDCN OS. Ele conecta catálogo de stacks, estrutura dos Teams, composição por Mission, roteamento por Job e prompts operacionais às demais notas do cérebro.

## 🧭 Conexões principais

```text
[[01 - Constituição e Visão Geral]]
        ↓
[[04 - Solution Topology]]
        ↓
[[05 - Solution Planning]]
        ↓
[[06 - Technology Selection]]
        ↓
[[07 - Stack Registry e Team Catalog]]
        ↓
[[08 - Architecture Composition]]
        ↓
[[09 - Approved Solution]]
        ↓
[[10 - TeamComposer V2]]
        ↓
Mission Team
        ↓
[[12 - Job Classification]]
        ↓
[[13 - Intelligent Work Router]]
        ↓
Job Team
        ↓
[[14 - Team Switching e Handoffs]]
        ↓
[[15 - Integration Unit]]
```

> **Regra de leitura:** os prompts deste documento operacionalizam a empresa de agentes. As regras normativas permanecem nas notas canônicas ligadas acima.

---

## 📋 Índice

1. [Resumo das Linguagens e Stacks](#1-resumo-das-linguagens-e-stacks)
2. [Princípios LDCN — Como a IA escolhe a solução](#2-princípios-ldcn--como-a-ia-escolhe-a-solução)
3. [Topologia do Produto](#3-topologia-do-produto)
4. [Estrutura Universal dos Times de Stack](#4-estrutura-universal-dos-times-de-stack)
5. [Times completos por Stack](#5-times-completos-por-stack)
6. [Organograma — Fase 1: MVP](#6-organograma--fase-1-mvp)
7. [Organograma — Fase 2: Produto](#7-organograma--fase-2-produto)
8. [Organograma — Fase 3: Escala](#8-organograma--fase-3-escala)
9. [Agentes Transversais](#9-agentes-transversais)
10. [Integration Unit](#10-integration-unit)
11. [TeamComposer Adaptativo](#11-teamcomposer-adaptativo)
12. [Prioridade de Ativação das Stacks](#12-prioridade-de-ativação-das-stacks)
13. [Estado Atual do LDCN OS](#13-estado-atual-do-ldcn-os)
14. [Princípios Constitucionais Propostos](#14-princípios-constitucionais-propostos)

---

# 🧠 Como usar os prompts integrados

> 🔗 Consulte também [[25 - Prompts Mestres]] e [[27 - Slices Prompts Codex e Roadmap]].

Cada etapa importante deste documento possui um **PROMPT OPERACIONAL LDCN**.

Esses prompts existem para que Codex/LLM implemente ou execute a etapa sem reinterpretar a arquitetura.

## Regras globais para todos os prompts

```
Você está trabalhando no LDCN OS V2.

REGRA CENTRAL:
LLM propõe; contrato limita; gate prova.

Antes de executar qualquer trabalho:

1. Ler a Constituição.
2. Ler Domain Model / Language Model aplicáveis.
3. Localizar os contratos e serviços existentes.
4. Não criar arquitetura paralela.
5. Não renomear conceitos oficiais sem necessidade.
6. Não inventar Delivery Target.
7. Não inventar Stack.
8. Não instanciar agentes que não pertençam à ApprovedSolution.
9. Não chamar provider concreto diretamente.
10. Não escrever diretamente no filesystem quando a plataforma possuir Artifact/Workspace runtime.
11. Não aprovar o próprio trabalho.
12. Não armazenar chain-of-thought.
13. Persistir apenas decisões, evidências, contratos, snapshots e artefatos necessários.
14. Preservar compatibilidade com as Fases 1–5 já fechadas.
15. Antes de commit/push, entregar relatório e aguardar autorização explícita.
```

## Estrutura padrão de saída de cada prompt

Sempre retornar:

```
A. Contexto entendido
B. Entidades/serviços existentes reutilizados
C. Mudanças propostas
D. Impactos arquiteturais
E. Regras/guards
F. Testes
G. Evidências
H. Riscos
I. Dívida técnica
J. Arquivos alterados
K. Git status
L. Próxima ação
```

---

# 1. Resumo das Linguagens e Stacks

> 🔗 **Canônico:** [[07 - Stack Registry e Team Catalog]] · [[06 - Technology Selection]]



## 🌐 1. WEB — JavaScript / TypeScript

| AspectoDetalhes            |                                                                                                          |
| -------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Arquitetura disponível** | SPA, SSR, SSG, ISR, Jamstack, Server Components, API REST/GraphQL, Serverless, Full-stack single runtime |
| **Frontend**               | Angular, React, Next.js, Astro, futuramente Vue/Svelte                                                   |
| **Backend**                | Node.js, NestJS, futuramente Fastify/Express quando necessário                                           |
| **Full-stack**             | Next.js                                                                                                  |
| **Linguagem-base**         | TypeScript                                                                                               |
| **Regra LDCN**             | TypeScript é capability compartilhada; cada framework possui seu próprio Stack Engineering Unit          |

### Stacks oficiais

- `stack.typescript.angular`
- `stack.typescript.react`
- `stack.typescript.nextjs`
- `stack.typescript.astro`
- `stack.typescript.nestjs`

> O LDCN não cria um único "TypeScript Team" para tudo. Angular, React, Next.js, Astro e NestJS possuem arquiteturas e equipes próprias.

---

## 🤖 2. INTELIGÊNCIA ARTIFICIAL / DATA SCIENCE — Python

| Aspecto                    | Detalhes                                                                     |
| -------------------------- | ---------------------------------------------------------------------------- |
| **Arquitetura disponível** | ETL/ELT, Data Lake/Lakehouse, Bronze/Silver/Gold, Model Serving, MLOps, APIs |
| **IA/ML**                  | PyTorch, TensorFlow, Scikit-learn, Hugging Face                              |
| **Backend/API**            | FastAPI, Django                                                              |
| **Dados**                  | Pandas, NumPy, Polars, Spark                                                 |
| **MLOps**                  | MLflow, Kubeflow, Airflow                                                    |
| **Regra LDCN**             | Python AI, Python Data, FastAPI e Django não são tratados como o mesmo time  |

### Unidades oficiais

- `stack.python.fastapi`
- `stack.python.django`
- `stack.python.ai`
- `stack.python.data`

---

## 🏢 3. ENTERPRISE / SISTEMAS CORPORATIVOS — Java

| Aspecto                       | Detalhes                                                                  |
| ----------------------------- | ------------------------------------------------------------------------- |
| **Arquiteturas disponíveis**  | Modular Monolith, Microservices, SOA, Hexagonal, Clean, Event-Driven, DDD |
| **Frameworks**                | Spring Boot, Spring Cloud, Jakarta EE, futuramente Quarkus/Micronaut      |
| **Build/Test**                | Maven, JUnit, Mockito                                                     |
| **Stack de referência atual** | `stack.java.spring-boot`                                                  |

> Java é a implementação de referência madura do runtime LDCN, mas não é imposto a projetos onde uma stack mais leve seja adequada.

---

## 🎮 4. C# / .NET / MICROSOFT

| Aspecto                      | Detalhes                                                        |
| ---------------------------- | --------------------------------------------------------------- |
| **Arquiteturas disponíveis** | MVC/MVVM, Modular Monolith, Microservices, Serverless, DDD      |
| **Frameworks**               | ASP.NET Core, EF Core, Identity, Blazor, MAUI, Unity, Azure SDK |
| **Build/Test**               | `dotnet build`, `dotnet test`, xUnit/NUnit                      |
| **Stack principal**          | `stack.csharp.aspnet-core`                                      |

---

## ☁️ 5. CLOUD / DEVOPS / MICROSERVIÇOS — Go

| Aspecto                      | Detalhes                                                          |
| ---------------------------- | ----------------------------------------------------------------- |
| **Arquiteturas disponíveis** | Microservices, Event-Driven, gRPC, Cloud-Native, Container-native |
| **Frameworks**               | Gin, Echo, Fiber, gRPC-Go, Cobra                                  |
| **Stack**                    | `stack.go.backend`                                                |

---

## 🛡️ 6. ALTA PERFORMANCE / SEGURANÇA — Rust

| Aspecto                      | Detalhes                                                  |
| ---------------------------- | --------------------------------------------------------- |
| **Arquiteturas disponíveis** | Systems Programming, WASM, Actor Model, serviços críticos |
| **Frameworks**               | Axum, Actix-web, Tokio, Tauri, Rocket                     |
| **Stack**                    | `stack.rust.backend`                                      |

---

## 📱 7. MOBILE

### Kotlin / Android

- `stack.kotlin.android`
- Jetpack Compose
- Coroutines
- Room
- Hilt/Koin
- Ktor

### Swift / iOS

- `stack.swift.ios`
- SwiftUI
- UIKit
- Core Data
- Combine

### Flutter / Dart

- `stack.dart.flutter`
- Riverpod/Bloc quando necessário
- Android/iOS/Web
- offline-first/local persistence quando necessário

---

## 🗄️ 8. BANCO DE DADOS / DADOS — SQL

| Aspecto          | Detalhes                                                                         |
| ---------------- | -------------------------------------------------------------------------------- |
| **Arquiteturas** | ACID, OLTP, OLAP, Warehouse, Lakehouse, Replicação, Sharding                     |
| **Bancos**       | PostgreSQL, MySQL, SQL Server, Oracle, BigQuery, Snowflake                       |
| **Capability**   | `language.sql` / `capability.data.sql`                                           |
| **Uso**          | Pode ser especialista local da stack ou Data Unit separada em projetos complexos |

---

# 2. Princípios LDCN — Como a IA escolhe a solução

> 🔗 **Canônico:** [[01 - Constituição e Visão Geral]] · [[05 - Solution Planning]] · [[06 - Technology Selection]] · [[09 - Approved Solution]]



## Regra central

> **Primeiro entender o produto. Depois escolher a arquitetura e a tecnologia. Só depois montar os agentes.**

O LDCN NÃO deve começar com:

```
Java escolhido
→ monta Java Team
```

O fluxo correto é:

```
IDEIA DO USUÁRIO
        ↓
Requirements
        ↓
Solution Topology
        ↓
Solution Planner
        ↓
Architecture Needs
        ↓
Technology Selection
        ↓
Approved Solution
        ↓
TeamComposer
        ↓
Stack Engineering Units
```

## Exemplo: landing page

Usuário:

> "Quero uma landing page para minha oficina, com fotos, localização, formulário e WhatsApp."

O LDCN pode concluir:

```
Complexidade: LOW
Backend: não necessário
Database: não necessária
SEO: importante
Time-to-market: prioridade alta
```

Solução possível:

```
Astro + TypeScript
```

Não deve inventar:

- Java;
- PostgreSQL;
- Kafka;
- Redis;
- Microservices.

## Exemplo: ERP corporativo

Usuário:

> "Quero um ERP com estoque, vendas, financeiro, RH e permissões."

Possível solução:

```
Backend: Java + Spring Boot
Frontend: Angular
Database: PostgreSQL
```

## Exemplo: SaaS pequeno

Usuário:

> "Quero lançar rápido e gastar pouco."

Possível solução:

```
Next.js Full Stack
+
PostgreSQL
```

---

## 🎯 PROMPT OPERACIONAL — ETAPA 1: Entender a ideia do usuário

```
# LDCN OS — PRODUCT INTENT ANALYSIS

Objetivo:
transformar a descrição livre do usuário em um ProjectIntent estruturado,
sem escolher tecnologia cedo demais.

Entrada:
- ideia do usuário;
- objetivos;
- público;
- restrições explícitas;
- prazo;
- orçamento quando informado;
- preferências de tecnologia quando informadas.

Faça:

1. Identifique o problema real.
2. Identifique quem usa.
3. Identifique os principais outcomes.
4. Separe requisito explícito de inferência.
5. Registre dúvidas somente quando elas alterarem uma decisão importante.
6. Não escolha stack ainda.
7. Não crie backend/frontend/mobile ainda.
8. Não invente requisitos.
9. Marque cada informação como:
   USER_EXPLICIT
   REQUIREMENTS_INFERRED
   UNKNOWN
10. Produza ProjectIntent.

Saída mínima:
- productType;
- problem;
- targetUsers;
- goals[];
- explicitConstraints[];
- inferredNeeds[];
- unknowns[];
- acceptanceSignals[];
- preferredTechnologyConstraints[].

PARE antes de Stack Selection.
```

## 🎯 PROMPT OPERACIONAL — ETAPA 2: Requirements

```
# LDCN OS — REQUIREMENTS ANALYSIS

Use:
- ProjectIntent aprovado;
- Business Analyst Agent;
- RequirementsContract existente.

Objetivo:
transformar a ideia em RequirementsContract estruturado.

Não:
- escolher arquitetura interna;
- escolher stack por gosto;
- criar componentes técnicos não justificados.

Extrair:
- functional requirements;
- non-functional requirements;
- business rules;
- actors;
- permissions;
- integrations;
- data sensitivity;
- expected scale;
- availability;
- latency needs;
- offline needs;
- SEO needs;
- regulatory/compliance constraints;
- time-to-market;
- cost constraints.

Para cada requisito:
- source;
- priority;
- acceptance criteria;
- ambiguity status.

O resultado deve permanecer DRAFT até aprovação explícita.

AgentExecution SUCCEEDED != Contract APPROVED.
```

# 3. Topologia do Produto

> 🔗 **Canônico:** [[04 - Solution Topology]] · [[16 - Scope Expansion]]



O LDCN deve determinar quais superfícies realmente existem antes de escolher stack.

## `SolutionTopology`

```
BACKEND_ONLY
FRONTEND_ONLY
MOBILE_ONLY
BACKEND_FRONTEND
BACKEND_MOBILE
FRONTEND_MOBILE
BACKEND_FRONTEND_MOBILE
FULLSTACK_SINGLE_RUNTIME
```

## Exemplos

### Backend only

Usuário:

> "Quero uma API."

```
backend = required
frontend = absent
mobile = absent
```

### Frontend only

Usuário:

> "Já tenho API. Quero só o painel."

```
frontend = required
backend = absent
externalApi = present
```

### Mobile only

Usuário:

> "Quero um app offline."

```
mobile = required
backend = absent
storage = local
```

### Backend + Frontend + Mobile

```
Java
+
Next.js
+
Flutter
```

### Full-stack single runtime

```
Next.js
+
PostgreSQL
```

## Origem da decisão

Cada target deve ter origem explícita:

```
USER_EXPLICIT
REQUIREMENTS_INFERRED
ARCHITECTURE_RECOMMENDED
```

Se o usuário pedir "somente backend":

```
frontend = FORBIDDEN_BY_SCOPE
mobile = FORBIDDEN_BY_SCOPE
```

Se uma nova camada for realmente necessária, o LDCN recomenda e pede aprovação. Não cria silenciosamente.

---

## 🎯 PROMPT OPERACIONAL — ETAPA 3: Solution Topology

```
# LDCN OS — SOLUTION TOPOLOGY

Entrada:
- RequirementsContract APPROVED;
- constraints do usuário.

Objetivo:
decidir QUAIS Delivery Targets realmente precisam existir.

Targets permitidos:
- BACKEND
- FRONTEND
- MOBILE
- FULLSTACK_SINGLE_RUNTIME
- DATA
- AI
- INTEGRATION_EXTERNAL quando aplicável.

Classificações possíveis:
- BACKEND_ONLY
- FRONTEND_ONLY
- MOBILE_ONLY
- BACKEND_FRONTEND
- BACKEND_MOBILE
- FRONTEND_MOBILE
- BACKEND_FRONTEND_MOBILE
- FULLSTACK_SINGLE_RUNTIME

Regras:

1. Se usuário disser "somente backend", frontend/mobile ficam FORBIDDEN_BY_SCOPE.
2. Se usuário disser "somente frontend", backend interno não pode ser criado.
3. Se nova camada parecer necessária:
   gerar RECOMMENDATION;
   explicar motivo;
   não materializar até aprovação.
4. Não escolher stack ainda.
5. Cada DeliveryTarget precisa de:
   kind;
   required;
   source;
   rationale;
   status.
6. Nenhum Room/Team/Contract/Runtime pode nascer para target ausente.

Saída:
SolutionTopologyProposal.

PARE para aprovação quando houver target recomendado não explícito.
```

# 4. Estrutura Universal dos Times de Stack

> 🔗 **Canônico:** [[07 - Stack Registry e Team Catalog]] · [[10 - TeamComposer V2]]



Cada stack possui sua própria equipe técnica completa.

```
STACK ENGINEERING UNIT
│
├── ARCHITECTURE CELL
│   ├── Stack Architect
│   ├── Stack Lead
│   ├── Framework Specialist
│   ├── Data Specialist
│   ├── Security Specialist
│   ├── Runtime/DevOps Specialist
│   └── Performance Specialist quando necessário
│
└── DELIVERY CELL
    ├── Stack Lead
    ├── Senior Developer
    ├── Developer
    ├── Reviewer
    └── Test Engineer
```

## Regra

> **Cada stack possui seu próprio cérebro técnico.**

Um `security.specialist` Java não substitui um `security.specialist` Angular.

Um `architecture.java.architect` não determina a arquitetura interna de Flutter.

---

## 🎯 PROMPT OPERACIONAL — ETAPA 4: Solution Planner + Technology Selection

```
# LDCN OS — SOLUTION PLANNER

Entrada:
- RequirementsContract APPROVED;
- SolutionTopology APPROVED;
- user technology constraints;
- StackRegistry.

Objetivo:
selecionar a MENOR combinação de stacks capaz de atender corretamente a Mission.

Avaliar por target:

- complexity fit;
- time-to-market;
- runtime cost;
- hosting cost;
- scalability;
- security;
- maintainability;
- ecosystem maturity;
- SEO;
- offline support;
- platform support;
- integration fit;
- operational complexity;
- user constraints;
- existing system compatibility.

Não usar popularidade como regra principal.

Exemplo:
landing page simples:
Astro/Next.js podem ter fit maior que Angular+Java.

ERP corporativo:
Java/.NET + Angular/React podem ter fit maior.

Para cada candidato retornar:
- stackKey;
- fitScore;
- strengths[];
- tradeoffs[];
- rejectedBecause[];
- constraintsSatisfied[];
- risks[].

Gerar:
SolutionProposal {
  topology,
  selectedStacks[],
  alternatives[],
  rationale,
  assumptions,
  risks
}

Se modo:
AUTO -> pode selecionar.
GUIDED -> recomendar e aguardar aprovação.
FIXED -> respeitar stack imposta, registrando tradeoffs.

Não montar Team ainda.
```

## 🎯 PROMPT OPERACIONAL — ETAPA 5: ApprovedSolution

```
# LDCN OS — APPROVED SOLUTION CONTRACT

Objetivo:
congelar a solução que o TeamComposer poderá materializar.

Validar:
- topology aprovada;
- selectedStacks aprovadas;
- nenhum target adicional;
- constraints respeitadas;
- architecture recommendations aceitas/rejeitadas registradas.

Produzir ApprovedSolution com:
- deliveryTargets;
- selectedStacks;
- selectionMode;
- constraints;
- complexityProfile;
- riskProfile;
- integrationNeeds;
- dataNeeds;
- securityNeeds;
- runtimeNeeds.

Regra:
TeamComposer só pode consumir ApprovedSolution.
```

# 5. Times completos por Stack

> 🔗 **Canônico:** [[07 - Stack Registry e Team Catalog]] · [[08 - Architecture Composition]] · [[10 - TeamComposer V2]]



## 🧩 PROMPT OPERACIONAL — TEMPLATE PARA QUALQUER STACK ENGINEERING UNIT

```
# LDCN OS — STACK ENGINEERING UNIT COMPOSER

Stack:
<STACK_KEY>

Entrada:
- ApprovedSolution;
- DeliveryTarget;
- ComplexityProfile;
- RiskProfile;
- StackDefinition;
- AgentCatalog;
- CapabilityRegistry.

Objetivo:
montar a equipe técnica específica da stack sem importar decisões de outra stack.

Selecione apenas agentes necessários.

Catálogo possível:

ARCHITECTURE CELL
- Stack Architect
- Stack Lead
- Framework Specialist
- Data Specialist
- Security Specialist
- Runtime/DevOps Specialist
- Performance Specialist

DELIVERY CELL
- Stack Lead
- Senior Developer
- Developer
- Reviewer
- Test Engineer

Regras:
1. Stack Architect é autoridade da arquitetura interna da stack.
2. Reviewer != executor.
3. Especialistas são adicionados por necessidade, não por padrão.
4. Não adicionar agentes de stack ausente da ApprovedSolution.
5. LOW/MEDIUM/HIGH definem composição mínima.
6. Shared/global agents não substituem especialistas da stack.
7. Persistir Team composition determinística e auditável.
8. Registrar por que cada AgentInstance foi incluído.

Saída:
- StackTeamProfile;
- selected AgentDefinitions;
- capabilities;
- rooms;
- territories;
- tools;
- required contracts;
- required gates.
```

## ☕ Java + Spring Boot

### PROMPT — Java/Spring Architecture & Team

```
Atue como architecture.java.architect.

Entrada:
ApprovedSolution + Requirements + Java StackDefinition.

Escolha arquitetura Java adequada ao problema.
Não aplicar Clean/Hexagonal/Microservices por padrão.

Avalie:
- modular monolith vs services;
- Spring MVC vs WebFlux;
- JPA vs JDBC;
- REST vs gRPC/events;
- transactional boundaries;
- packages/modules;
- security;
- observability;
- testing;
- Maven/runtime constraints.

Produza JavaStackArchitectureProposal.
Depois, somente após aprovação, Java Lead transforma isso em BackendPlan.
```

### Architecture Cell

- `architecture.java.architect`
- `backend.java.lead`
- `backend.java.spring-specialist`
- `backend.java.data-specialist`
- `backend.java.security-specialist`
- `backend.java.runtime-specialist`
- `backend.java.performance-specialist`

### Delivery Cell

- `backend.java.lead`
- `backend.java.senior-developer`
- `backend.java.developer`
- `backend.java.reviewer`
- `backend.java.test-engineer`

---

## 🅰️ Angular + TypeScript

### PROMPT — Angular Architecture & Team

```
Atue como architecture.angular.architect.

Entrada:
ApprovedSolution + Requirements + Angular StackDefinition.

Decida conforme a Mission:
- SPA/SSR;
- standalone boundaries;
- routing/lazy loading;
- Signals/RxJS;
- state management somente se necessário;
- API layer;
- guards/interceptors;
- forms;
- design system;
- accessibility;
- performance;
- testing.

Não adicionar NgRx, SSR ou patterns complexos sem necessidade.

Produza AngularStackArchitectureProposal.
```

### Architecture Cell

- `architecture.angular.architect`
- `frontend.angular.lead`
- `frontend.angular.specialist`
- `frontend.angular.security-specialist`
- `frontend.angular.ux-specialist`
- `frontend.angular.performance-specialist`
- `frontend.angular.runtime-specialist`

### Delivery Cell

- `frontend.angular.lead`
- `frontend.angular.senior-developer`
- `frontend.angular.developer`
- `frontend.angular.reviewer`
- `frontend.angular.test-engineer`

---

## 🪺 NestJS + TypeScript

### PROMPT — NestJS Architecture & Team

```
Atue como architecture.nestjs.architect.

Avalie:
- module boundaries;
- controllers/providers;
- REST/GraphQL/events;
- Prisma/TypeORM;
- guards/pipes/interceptors;
- auth;
- queues somente quando justificadas;
- testing;
- runtime/node constraints.

Não transformar toda API em microservice por padrão.

Produza NestJsStackArchitectureProposal.
```

### Architecture Cell

- `architecture.nestjs.architect`
- `backend.nestjs.lead`
- `backend.nestjs.specialist`
- `backend.nestjs.data-specialist`
- `backend.nestjs.security-specialist`
- `backend.nestjs.runtime-specialist`
- `backend.nestjs.performance-specialist`

### Delivery Cell

- `backend.nestjs.lead`
- `backend.nestjs.senior-developer`
- `backend.nestjs.developer`
- `backend.nestjs.reviewer`
- `backend.nestjs.test-engineer`

---

## ▲ Next.js + TypeScript

### PROMPT — Next.js Architecture & Team

```
Atue como architecture.nextjs.architect.

Primeiro determine o modo:
FRONTEND_MODE
ou
FULLSTACK_MODE.

Avalie:
- App Router;
- Server vs Client Components;
- SSR/SSG/ISR;
- Server Actions;
- Route Handlers;
- caching;
- auth;
- SEO;
- streaming;
- database access somente em FULLSTACK_MODE;
- edge/server runtime.

Não criar backend separado se Next.js sozinho atende.
Não usar full-stack se usuário pediu frontend-only consumindo API externa.

Produza NextJsStackArchitectureProposal.
```

Next.js pode operar em:

```
FRONTEND_MODE
FULLSTACK_MODE
```

### Architecture Cell

- `architecture.nextjs.architect`
- `fullstack.nextjs.lead`
- `fullstack.nextjs.specialist`
- `fullstack.nextjs.security-specialist`
- `fullstack.nextjs.data-specialist`
- `fullstack.nextjs.performance-specialist`
- `fullstack.nextjs.seo-specialist`
- `fullstack.nextjs.runtime-specialist`

### Delivery Cell

- `fullstack.nextjs.lead`
- `fullstack.nextjs.senior-developer`
- `fullstack.nextjs.developer`
- `fullstack.nextjs.reviewer`
- `fullstack.nextjs.test-engineer`

---

## ⚛️ React + TypeScript

### PROMPT — React Architecture & Team

```
Atue como architecture.react.architect.

Decida:
- SPA/static/embedded;
- router;
- data-fetching;
- local/global state;
- forms;
- component boundaries;
- accessibility;
- testing;
- performance.

Não adicionar Redux/Zustand/TanStack Query automaticamente.
Use somente se requisitos justificarem.

Produza ReactStackArchitectureProposal.
```

### Architecture Cell

- `architecture.react.architect`
- `frontend.react.lead`
- `frontend.react.specialist`
- `frontend.react.security-specialist`
- `frontend.react.ux-specialist`
- `frontend.react.performance-specialist`
- `frontend.react.runtime-specialist`

### Delivery Cell

- `frontend.react.lead`
- `frontend.react.senior-developer`
- `frontend.react.developer`
- `frontend.react.reviewer`
- `frontend.react.test-engineer`

---

## 🚀 Astro + TypeScript

### PROMPT — Astro Architecture & Team

```
Atue como architecture.astro.architect.

Priorize adequação a:
- landing pages;
- marketing;
- blogs;
- content sites;
- SEO;
- performance;
- static-first.

Decida:
- static vs SSR;
- islands;
- hydration;
- CMS integration;
- forms/external APIs.

Se backend dedicado não for necessário, não inventar um.

Produza AstroStackArchitectureProposal.
```

Ideal para landing pages, marketing, blogs e conteúdo.

### Architecture Cell

- `architecture.astro.architect`
- `frontend.astro.lead`
- `frontend.astro.specialist`
- `frontend.astro.seo-specialist`
- `frontend.astro.performance-specialist`
- `frontend.astro.ux-specialist`
- `frontend.astro.runtime-specialist`

### Delivery Cell

- `frontend.astro.lead`
- `frontend.astro.senior-developer`
- `frontend.astro.developer`
- `frontend.astro.reviewer`
- `frontend.astro.test-engineer`

---

## 🟣 .NET + C# + ASP.NET Core

### PROMPT — .NET Architecture & Team

```
Atue como architecture.dotnet.architect.

Avalie:
- ASP.NET Controllers vs Minimal APIs;
- modular monolith vs services;
- EF Core;
- Identity/OAuth/OIDC;
- middleware;
- background services;
- configuration;
- observability;
- Azure-specific services somente se justificadas;
- testing.

Não impor Clean Architecture ou microservices.

Produza DotNetStackArchitectureProposal.
```

### Architecture Cell

- `architecture.dotnet.architect`
- `backend.dotnet.lead`
- `backend.dotnet.aspnet-specialist`
- `backend.dotnet.data-specialist`
- `backend.dotnet.security-specialist`
- `backend.dotnet.runtime-specialist`
- `backend.dotnet.performance-specialist`

### Delivery Cell

- `backend.dotnet.lead`
- `backend.dotnet.senior-developer`
- `backend.dotnet.developer`
- `backend.dotnet.reviewer`
- `backend.dotnet.test-engineer`

---

## 🐍 FastAPI + Python

### PROMPT — FastAPI Architecture & Team

```
Atue como architecture.fastapi.architect.

Avalie:
- sync/async boundaries;
- Pydantic models;
- SQLAlchemy;
- API structure;
- auth;
- background jobs;
- OpenAPI;
- testing;
- deployment.

Não confundir FastAPI com Django.
Não adicionar Celery/queues sem requisito.

Produza FastApiStackArchitectureProposal.
```

### Architecture Cell

- `architecture.fastapi.architect`
- `backend.fastapi.lead`
- `backend.fastapi.specialist`
- `backend.fastapi.data-specialist`
- `backend.fastapi.security-specialist`
- `backend.fastapi.runtime-specialist`
- `backend.fastapi.performance-specialist`

### Delivery Cell

- `backend.fastapi.lead`
- `backend.fastapi.senior-developer`
- `backend.fastapi.developer`
- `backend.fastapi.reviewer`
- `backend.fastapi.test-engineer`

---

## 🐍 Django + Python

### PROMPT — Django Architecture & Team

```
Atue como architecture.django.architect.

Avalie:
- Django apps;
- ORM;
- DRF;
- admin;
- auth/permissions;
- middleware;
- migrations;
- signals somente quando adequados;
- testing.

Não tratar Django como FastAPI com outro nome.

Produza DjangoStackArchitectureProposal.
```

### Architecture Cell

- `architecture.django.architect`
- `backend.django.lead`
- `backend.django.specialist`
- `backend.django.data-specialist`
- `backend.django.security-specialist`
- `backend.django.runtime-specialist`
- `backend.django.performance-specialist`

### Delivery Cell

- `backend.django.lead`
- `backend.django.senior-developer`
- `backend.django.developer`
- `backend.django.reviewer`
- `backend.django.test-engineer`

---

## 🦋 Flutter + Dart

### PROMPT — Flutter Architecture & Team

```
Atue como architecture.flutter.architect.

Primeiro determine:
- MOBILE_ONLY;
- app com backend próprio;
- app consumindo API externa;
- offline-first;
- Android/iOS/Web targets.

Decida:
- navigation;
- state management;
- local persistence;
- networking;
- platform abstraction;
- responsive/adaptive UI;
- testing;
- build.

Não criar backend se offline/local atende ao problema.

Produza FlutterStackArchitectureProposal.
```

### Architecture Cell

- `architecture.flutter.architect`
- `mobile.flutter.lead`
- `mobile.flutter.specialist`
- `mobile.flutter.security-specialist`
- `mobile.flutter.ux-specialist`
- `mobile.flutter.performance-specialist`
- `mobile.flutter.platform-specialist`
- `mobile.flutter.build-specialist`

### Delivery Cell

- `mobile.flutter.lead`
- `mobile.flutter.senior-developer`
- `mobile.flutter.developer`
- `mobile.flutter.reviewer`
- `mobile.flutter.test-engineer`

---

## 🤖 Kotlin Android

### PROMPT — Kotlin Android Architecture & Team

```
Atue como architecture.kotlin-android.architect.

Avalie:
- Compose;
- MVVM/MVI quando adequados;
- Coroutines/Flow;
- Room;
- Hilt/Koin;
- networking;
- offline;
- platform APIs;
- testing.

Não impor Clean Architecture por padrão.

Produza AndroidStackArchitectureProposal.
```

### Architecture Cell

- `architecture.kotlin-android.architect`
- `mobile.android.lead`
- `mobile.android.kotlin-specialist`
- `mobile.android.security-specialist`
- `mobile.android.ux-specialist`
- `mobile.android.performance-specialist`
- `mobile.android.platform-specialist`
- `mobile.android.build-specialist`

### Delivery Cell

- `mobile.android.lead`
- `mobile.android.senior-developer`
- `mobile.android.developer`
- `mobile.android.reviewer`
- `mobile.android.test-engineer`

---

## 🍎 Swift iOS

### PROMPT — Swift iOS Architecture & Team

```
Atue como architecture.swift-ios.architect.

Avalie:
- SwiftUI/UIKit;
- state/data flow;
- persistence;
- networking;
- platform APIs;
- security;
- testing;
- release constraints.

Não impor VIPER/MVVM automaticamente.

Produza IosStackArchitectureProposal.
```

### Architecture Cell

- `architecture.swift-ios.architect`
- `mobile.ios.lead`
- `mobile.ios.swift-specialist`
- `mobile.ios.security-specialist`
- `mobile.ios.ux-specialist`
- `mobile.ios.performance-specialist`
- `mobile.ios.platform-specialist`
- `mobile.ios.build-specialist`

### Delivery Cell

- `mobile.ios.lead`
- `mobile.ios.senior-developer`
- `mobile.ios.developer`
- `mobile.ios.reviewer`
- `mobile.ios.test-engineer`

---

## 🐹 Go

### PROMPT — Go Architecture & Team

```
Atue como architecture.go.architect.

Escolha Go somente quando houver fit real.

Avalie:
- HTTP/gRPC;
- concurrency;
- service boundaries;
- persistence;
- observability;
- deployment;
- testing.

Não criar microservices apenas porque Go é associado a cloud.

Produza GoStackArchitectureProposal.
```

### Architecture Cell

- `architecture.go.architect`
- `backend.go.lead`
- `backend.go.specialist`
- `backend.go.data-specialist`
- `backend.go.security-specialist`
- `backend.go.runtime-specialist`
- `backend.go.performance-specialist`

### Delivery Cell

- `backend.go.lead`
- `backend.go.senior-developer`
- `backend.go.developer`
- `backend.go.reviewer`
- `backend.go.test-engineer`

---

## 🦀 Rust

### PROMPT — Rust Architecture & Team

```
Atue como architecture.rust.architect.

Escolha Rust quando performance, segurança de memória ou low-level justificar.

Avalie:
- Axum/Actix;
- Tokio;
- ownership boundaries;
- concurrency;
- WASM/Tauri quando aplicável;
- deployment;
- testing.

Não escolher Rust para CRUD comum sem justificativa.

Produza RustStackArchitectureProposal.
```

### Architecture Cell

- `architecture.rust.architect`
- `backend.rust.lead`
- `backend.rust.specialist`
- `backend.rust.security-specialist`
- `backend.rust.runtime-specialist`
- `backend.rust.performance-specialist`

### Delivery Cell

- `backend.rust.lead`
- `backend.rust.senior-developer`
- `backend.rust.developer`
- `backend.rust.reviewer`
- `backend.rust.test-engineer`

---

## 🧠 Python AI / Data Science

### PROMPT — AI/Data Science Architecture & Team

```
Atue como architecture.ai-python.architect.

Distinguir:
- analytics;
- classic ML;
- deep learning;
- LLM;
- data engineering;
- model serving.

Definir:
- datasets;
- training/evaluation;
- reproducibility;
- model registry;
- serving;
- MLOps;
- privacy/security;
- cost;
- monitoring.

Não adicionar treinamento de modelo quando API/modelo existente resolve.

Produza AiDataSolutionProposal.
```

### Architecture / Research Cell

- `architecture.ai-python.architect`
- `ai.python.lead`
- `ai.python.ml-specialist`
- `ai.python.data-science-specialist`
- `ai.python.data-engineering-specialist`
- `ai.python.model-evaluation-specialist`
- `ai.python.security-specialist`
- `ai.python.runtime-specialist`

### Delivery / Experiment Cell

- `ai.python.senior-engineer`
- `ai.python.engineer`
- `ai.python.reviewer`
- `ai.python.test-engineer`

---

## 🗄️ SQL / Data Engineering

### PROMPT — Data Architecture & Team

```
Atue como architecture.data.architect quando a complexidade justificar.

Avalie:
- OLTP/OLAP;
- schema design;
- indexes;
- consistency;
- migrations;
- replication;
- partitioning;
- warehouse/lakehouse;
- retention;
- performance.

Para projetos simples, prefira Data Specialist da própria stack.
Não criar Data Platform separada sem necessidade.

Produza DataArchitectureProposal.
```

### Data Unit

- `architecture.data.architect`
- `data.sql.lead`
- `data.sql.engineer`
- `data.sql.performance-specialist`
- `data.sql.reviewer`
- `data.sql.test-engineer`

---

# 6. Organograma — Fase 1: MVP

> 🔗 **Canônico:** [[10 - TeamComposer V2]] · [[27 - Slices Prompts Codex e Roadmap]]



## PROMPT — Composição de empresa/agentes para MVP

```
Monte a Mission Team para fase MVP.

Objetivo:
entregar o menor time de agentes capaz de validar o produto.

Não instanciar a empresa inteira.

Priorize:
- Product/BA;
- Stack Architect;
- Lead/Developer;
- Test Engineer;
- especialistas somente se necessários.

Se múltiplas stacks:
adicionar Integration Unit mínima.

Retornar:
- agentes selecionados;
- motivo;
- capacidade coberta;
- agentes deliberadamente não selecionados;
- riscos da composição enxuta.
```

O guia original usa 9 pessoas. No LDCN, isso vira um catálogo mínimo de agentes.

## Core mínimo

- `engineering.cto`
- `product.manager`
- `business.analyst`

## Stack principal

Ativar apenas o Stack Engineering Unit escolhido pela solução.

Exemplo para MVP web TypeScript:

- Stack Architect
- Stack Lead
- Developer
- Test Engineer

## Produto/Design

- UX/UI do próprio stack ou agente de produto, conforme necessidade

## Dados/Infra

- Data/Runtime Specialist apenas se a Mission exigir

> O LDCN não precisa instanciar todos os agentes só porque eles existem no catálogo.

---

# 7. Organograma — Fase 2: Produto

> 🔗 **Canônico:** [[10 - TeamComposer V2]] · [[13 - Intelligent Work Router]]



## PROMPT — Expansão do time para Produto

```
Reavalie a Mission após validação do MVP.

Adicionar agentes somente devido a:
- aumento de complexidade;
- segurança;
- volume;
- múltiplas stacks;
- necessidade de reviewer independente;
- performance;
- operação;
- qualidade.

Não escalar por calendário automaticamente.

Retornar delta do Team:
added[]
removed[]
retained[]
reasonByAgent[].
```

Conforme o produto cresce, a Mission pode ativar:

- Lead dedicado;
- Senior Developer;
- Reviewer independente;
- Security Specialist da stack;
- Data Specialist da stack;
- Runtime Specialist;
- UX Specialist;
- QA Lead;
- Integration Unit se houver múltiplas stacks.

---

# 8. Organograma — Fase 3: Escala

> 🔗 **Canônico:** [[10 - TeamComposer V2]] · [[21 - Governance Segurança e Replanning]]



## PROMPT — Expansão para Escala

```
Avalie necessidade de organização de escala.

Critérios:
- múltiplos Stack Teams;
- high availability;
- compliance;
- SRE;
- data platform;
- security governance;
- integration complexity;
- throughput;
- operational load.

Somente então considerar:
- system security architect;
- system data architect;
- platform architect;
- QA governance;
- multiple developers/test engineers.

Produzir TeamScalingProposal.
```

Em projetos grandes, a empresa virtual pode crescer para:

```
Head/CTO
Product
Business Analysis

Stack Architecture Units
Stack Delivery Units

Integration Unit
System Security Architecture
System Data Architecture
Platform Architecture
QA Governance
AI/Data Units
```

A escala é dinâmica e baseada em:

- complexidade;
- risco;
- número de stacks;
- criticidade;
- volume;
- compliance;
- integração;
- orçamento.

---

# 9. Agentes Transversais

> 🔗 **Canônico:** [[10 - TeamComposer V2]] · [[21 - Governance Segurança e Replanning]]



## PROMPT — Seleção de agentes transversais

```
Selecione agentes transversais somente quando a responsabilidade realmente cruza stacks ou produto.

Sempre possíveis:
- engineering.cto
- product.manager
- product.owner
- project.manager
- business.analyst

Somente quando necessário:
- security.system-architect
- data.system-architect
- platform.devops-architect

Proibição:
não usar agente transversal para decidir arquitetura interna de Stack.
```

Nem todos os agentes do guia original devem ser realmente globais.

## Globalmente seguros

```
engineering.cto
product.manager
product.owner
project.manager
business.analyst
```

Esses cuidam de:

- objetivo;
- escopo;
- prioridade;
- produto;
- negócio;
- coordenação.

Eles não determinam internals técnicos de cada stack.

## Globais apenas quando necessário

```
security.system-architect
data.system-architect
platform.devops-architect
```

Eles entram somente quando existe responsabilidade de sistema inteiro.

---

# 10. Integration Unit

> 🔗 **Canônico:** [[15 - Integration Unit]] · [[14 - Team Switching e Handoffs]]



## PROMPT — Integration Unit

```
Crie Integration Unit somente se:
- duas ou mais stacks precisam conversar;
- ou há integração externa relevante.

Agentes:
- integration.architect
- integration.engineer
- integration.reviewer
- integration.test-engineer

Validar:
- API contracts;
- DTO/schema;
- auth;
- errors;
- pagination;
- events;
- version compatibility;
- OpenAPI;
- frontend/mobile clients.

Não modificar arquitetura interna das stacks.
Produzir IntegrationContract/IntegrationPlan.
```

A Integration Unit é transversal porque sua responsabilidade é justamente entre stacks.

```
integration.architect
integration.engineer
integration.reviewer
integration.test-engineer
```

Responsabilidades:

- API contracts;
- DTOs;
- schemas;
- authentication;
- authorization;
- error contracts;
- pagination;
- OpenAPI;
- event contracts;
- compatibility;
- backend/frontend/mobile integration.

Ela só aparece quando existe integração real.

---

# 11. TeamComposer Adaptativo

> 🔗 **Canônico:** [[10 - TeamComposer V2]] · [[12 - Job Classification]] · [[13 - Intelligent Work Router]]



## PROMPT — TeamComposer V2

```
# LDCN OS — TEAM COMPOSER V2

Entrada obrigatória:
- ApprovedSolution;
- SelectedDeliveryTargets;
- SelectedStacks;
- ComplexityProfile;
- RiskProfile;
- AgentCatalog;
- StackRegistry.

Algoritmo conceitual:

1. Para cada DeliveryTarget aprovado:
   resolver StackDefinition.
2. Carregar StackTeamProfile.
3. Selecionar composição LOW/MEDIUM/HIGH.
4. Adicionar especialistas por requirements/risk.
5. Se múltiplas stacks/integrations:
   adicionar Integration Unit.
6. Adicionar Product/Coordination agents necessários.
7. Não adicionar stack ausente.
8. Não expandir scope.
9. Garantir reviewer != executor.
10. Persistir composição determinística e justificativas.

Saída:
AgentTeam + AgentInstances + ContextSnapshots.

Nenhum LLM é necessário para a composição final se os inputs aprovados já estão estruturados.
```

O TeamComposer deve evoluir.

## Entrada futura

```
ApprovedSolution
SelectedDeliveryTargets
SelectedStacks
ComplexityProfile
RequiredCapabilities
RiskProfile
```

## Saída

```
MissionTeam
```

Somente com os agentes necessários.

### LOW

```
Stack Architect
Lead/Developer
Test Engineer
```

### MEDIUM

```
Stack Architect
Lead
Developer
Reviewer
Test Engineer
```

### HIGH

```
Stack Architect
Lead
Senior Developer
Developers
Framework Specialist
Data Specialist
Security Specialist
Runtime Specialist
Performance Specialist
Reviewer
Test Engineers
```

---

# 12. Prioridade de Ativação das Stacks

> 🔗 **Canônico:** [[07 - Stack Registry e Team Catalog]] · [[27 - Slices Prompts Codex e Roadmap]]



## PROMPT — Ativação de um novo Runtime de Stack

```
Quando uma stack passar de catálogo para runtime executável:

1. Não copiar Java literalmente.
2. Reutilizar contratos universais do Stack Engineering Model.
3. Implementar StackPlugin específico.
4. Implementar ChangeSet schema específico.
5. Implementar Source/Symbol Inspector específico.
6. Definir Artifact territories.
7. Definir RestrictedToolRuntime tools.
8. Criar sandbox de build/test específico.
9. Produzir Evidence determinística.
10. Preservar Review/Gate/Promotion existentes.
11. Criar repair runtime somente em fase própria posterior, não junto por acidente.
12. Criar integração E2E com FakeLlmProvider.
13. Nenhum provider real durante validação sem autorização.

Retornar plano antes de implementar.
```

A ordem técnica sugerida do runtime LDCN:

| Ordem | Stack                 | Status           |
| ----- | --------------------- | ---------------- |
| 1     | Java + Spring Boot    | ✅ Runtime maduro |
| 2     | Angular + TypeScript  | Próximo          |
| 3     | NestJS + TypeScript   | Futuro           |
| 4     | Next.js + TypeScript  | Futuro           |
| 5     | .NET + C#             | Futuro           |
| 6     | React + TypeScript    | Futuro           |
| 7     | Python FastAPI/Django | Futuro           |
| 8     | Flutter + Dart        | Futuro           |
| 9     | Astro + TypeScript    | Futuro           |
| 10    | Go                    | Futuro           |
| 11    | Rust                  | Futuro           |
| 12    | Kotlin Android        | Futuro           |
| 13    | Swift iOS             | Futuro           |

A ordem de implementação **não define preferência arquitetural**.

O Solution Planner sempre escolhe pela adequação à Mission.

---

# 13. Estado Atual do LDCN OS

> 🔗 **Canônico:** [[27 - Slices Prompts Codex e Roadmap]] · [[28 - Decisão Final de Arquitetura]]



## PROMPT — Antes de iniciar qualquer nova fase

```
Leia o estado atual do LDCN e confirme:
- Fases oficialmente CLOSED;
- HEAD oficial v2-main;
- branches dirty existentes;
- migrations;
- test baseline;
- arquitetura que deve ser preservada.

Não iniciar nova fase sobre branch errada.
Não misturar Console, Mission Command Flow e Runtime de stack.
Produzir Git/Architecture Baseline antes de código.
```

## Fase 1 — Agent OS Foundation

✅ CLOSED

## Fase 2 — Agent Work Operating Model

✅ CLOSED

## Fase 3 — Agent Intelligence Foundation

✅ CLOSED

## Fase 4 — Java Production Runtime

✅ CLOSED

## Fase 5 — Autonomous Engineering Repair Runtime

✅ CLOSED

Checkpoint oficial da Fase 5:

```
v2-main
199ed9659f38c2424904188b3d718adae1c4d858
```

## Mission Command Flow

Em fechamento operacional / integração.

## Engineering Console

Existe, mas deve ser integrada corretamente à linha oficial V2.

## Fase 6

Ainda não iniciada.

---

# 🏭 PROMPT MESTRE — Missão completa adaptativa

```
# LDCN OS — EXECUTE ADAPTIVE SOFTWARE MISSION

Entrada:
descrição livre do usuário.

FASE A — DISCOVERY
1. Criar ProjectIntent.
2. Gerar RequirementsContract DRAFT.
3. Solicitar/aplicar aprovação.

FASE B — TOPOLOGY
4. Determinar SolutionTopology.
5. Respeitar escopo explícito.
6. Recomendar targets adicionais sem criá-los silenciosamente.

FASE C — SOLUTION
7. Executar SolutionPlanner.
8. Avaliar stacks pelo fit real.
9. Gerar SolutionProposal.
10. Aprovar ApprovedSolution.

FASE D — ORGANIZATION
11. Executar TeamComposer V2.
12. Instanciar somente Stack Teams necessários.
13. Adicionar Integration Unit somente se necessária.

FASE E — ARCHITECTURE
14. Cada Stack Architect produz sua própria StackArchitectureProposal.
15. Especialistas revisam dentro da stack.
16. Integration Architect produz integração entre stacks.
17. Consolidar contratos.
18. Aprovar contratos antes da implementação.

FASE F — DELIVERY
19. Stack Leads materializam planos/tasks.
20. Developers executam.
21. LLM somente via LlmGateway.
22. Generated artifacts começam como CANDIDATE.
23. Workspaces são isoladas.
24. Inspectors derivam símbolos/estrutura do código real.
25. Build/test geram Evidence.

FASE G — GOVERNANCE
26. Reviewer != executor.
27. Gates determinísticos.
28. Technical success != approval.
29. Promotion somente após gates.

FASE H — FAILURE
30. Se stack possuir Engineering Repair Runtime suportado, usar política correspondente.
31. Não inventar repair para stacks sem runtime de repair aprovado.

FASE I — RESULT
32. Persistir histórico, decisões, artifacts, reviews e gates.
33. Exibir ao usuário o projeto real, não estado fictício.

Nunca:
- inventar backend/frontend/mobile;
- impor linguagem preferida;
- usar microservices por padrão;
- criar agentes fora da ApprovedSolution;
- bypassar contracts/gates.
```

# 🧾 PROMPT MESTRE — Relatório de implementação

```
Ao concluir qualquer etapa deste documento, retornar:

1. etapa executada;
2. input utilizado;
3. contracts lidos/criados;
4. agents instanciados;
5. stacks selecionadas;
6. justificativa de seleção;
7. alternatives rejeitadas;
8. files/artifacts criados;
9. executions;
10. evidence;
11. reviews;
12. gates;
13. budget/LLM usage;
14. security checks;
15. tests;
16. lint/build;
17. migrations;
18. known gaps;
19. technical debt;
20. Git branch/HEAD;
21. files modified;
22. provider real usado? yes/no;
23. scope expansion? yes/no;
24. Fase seguinte tocada? yes/no;
25. readiness.
```


---

# 🔀 Da Mission Team para o Job Team

> 🔗 [[10 - TeamComposer V2]] · [[12 - Job Classification]] · [[13 - Intelligent Work Router]] · [[14 - Team Switching e Handoffs]]

Este guia define quais agentes existem e como cada Stack Engineering Unit é formada. A execução diária, porém, não convoca o Team inteiro.

```text
ApprovedSolution
↓
TeamComposer V2
↓
MISSION TEAM
↓
AgentTask / Job
↓
JobClassification
↓
IntelligentWorkRouter
↓
JOB TEAM mínimo
↓
Execution
```

Exemplo:

```text
Mission:
Java + Angular

Job:
"Corrigir uma validação simples no backend"

Mission Team:
Java Unit + Angular Unit + Integration Unit

Job Team:
backend.java.developer
backend.java.reviewer
backend.java.test-engineer
```

Se o ownership mudar:

```text
Java Team
↓
[[14 - Team Switching e Handoffs]]
↓
[[15 - Integration Unit]]
↓
Angular Team
```

Se o Job exigir uma stack que não pertence à `ApprovedSolution`:

```text
Job
↓
SCOPE_EXPANSION_REQUIRED
↓
[[16 - Scope Expansion]]
↓
ApprovedSolution vNext
↓
TeamComposer recompõe apenas o escopo afetado
```

## PROMPT OPERACIONAL — Seleção de Job Team

```text
# LDCN OS — JOB TEAM ROUTING

Entrada:
- AgentTask;
- ApprovedSolution;
- Mission Team;
- relevant Contracts;
- capabilities;
- territories;
- risk;
- workload;
- review policies.

Objetivo:
selecionar o menor conjunto de AgentInstances necessário para executar e revisar o Job.

Regras:
1. Não convocar o Team inteiro por padrão.
2. Selecionar somente AgentInstances pertencentes à Mission.
3. Selecionar somente stacks da ApprovedSolution.
4. Resolver capabilities requeridas.
5. Respeitar territory e delegation rules.
6. Especialistas entram apenas quando risco/capability exigir.
7. Reviewer != executor.
8. Cross-stack usa Integration Unit quando a policy exigir.
9. Target/stack ausente retorna SCOPE_EXPANSION_REQUIRED.
10. Persistir WorkRoutingDecision.

Saída:
WorkRoutingDecisionV1.
```


# 14. Princípios Constitucionais Propostos

> 🔗 **Canônico:** [[01 - Constituição e Visão Geral]] · [[21 - Governance Segurança e Replanning]]



1. **A Mission materializa apenas Delivery Targets explicitamente solicitados, inferidos como necessários e aprovados.**

2. **Nenhum Stack Team, Room, Contract ou Runtime pode ser criado para um Delivery Target ausente da ApprovedSolution.**

3. **O TeamComposer compõe equipes a partir da solução aprovada e nunca expande autonomamente o escopo do produto.**

4. **Requisitos que implicam nova camada não solicitada geram recomendação de arquitetura, não criação silenciosa.**

5. **Cada Stack Engineering Unit é tecnicamente autossuficiente.**

6. **A arquitetura interna de uma stack pertence ao seu Stack Architect e aos contratos aprovados daquela stack.**

7. **Agentes transversais não substituem Stack Architects.**

8. **Integration Unit atua somente nas fronteiras entre stacks ou sistemas externos.**

9. **Capabilities representam possibilidades, não tecnologias obrigatórias.**

10. **A stack é selecionada pela adequação ao problema, requisitos, restrições, segurança, escala, custo, manutenção, prazo e preferência do usuário.**

11. **Popularidade de mercado pode ser sinal secundário, nunca regra arquitetural.**

12. **O LDCN padroniza o processo de decisão, não a arquitetura final.**

13. **O catálogo completo de agentes existe permanentemente; a Mission instancia apenas os agentes necessários.**

14. **Nenhuma camada de produto deve ser inventada.**

---

# 📊 Resumo Executivo

O guia-base descreve uma empresa de tecnologia com pessoas.

No LDCN OS, essa empresa se torna uma **empresa virtual de agentes especializados**.

```
IDEIA
↓
Requirements
↓
Solution Topology
↓
Solution Planner
↓
Technology Selection
↓
Approved Solution
↓
TeamComposer
↓
Stack Engineering Units
↓
Implementation
↓
Build/Test
↓
Review
↓
Gates
↓
Promotion
```

O diferencial central é:

> **A empresa completa existe no catálogo, mas cada Mission recebe somente os times e agentes necessários.**

Exemplos:

```
Landing page
→ Astro Team

API enterprise
→ Java Team ou .NET Team

Frontend sobre API existente
→ Angular/React/Next Team

App offline
→ Flutter Team

ERP
→ Java Team + Angular Team + Integration Unit

Marketplace completo
→ Backend Team + Frontend Team + Mobile Team + Integration Unit
```

E sempre:

> **LLM propõe; contrato limita; gate prova.**

---

## 🔗 Navegação

- [[00 - Gerador Inteligente - Mapa Raiz]]
- [[07 - Stack Registry e Team Catalog]]
- [[08 - Architecture Composition]]
- [[10 - TeamComposer V2]]
- [[12 - Job Classification]]
- [[13 - Intelligent Work Router]]
- [[14 - Team Switching e Handoffs]]
- [[15 - Integration Unit]]
- [[16 - Scope Expansion]]
- [[25 - Prompts Mestres]]
- [[27 - Slices Prompts Codex e Roadmap]]

> **Documento organizacional canônico da empresa de agentes.**
