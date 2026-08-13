---
title: "Stack Teams Bootstrap do Zero"
aliases: ["Bootstrap dos Teams", "Catálogo inicial da empresa"]
tags: [ldcn, gerador-inteligente, stacks, teams, bootstrap]
status: canonico
---

# 🏗️ 33 - Stack Teams Bootstrap do Zero

[[00 - LDCN OS - Mapa Raiz Completo|⬅ Mapa Raiz]] · [[31 - Agent Definition Factory e Team Factory|Agent Factory]] · [[07 - Stack Registry e Team Catalog|Stack Catalog]]

## Ordem correta

```text
1. StackRegistry
2. CapabilityRegistry
3. PromptCatalog
4. ToolProfiles
5. TerritoryProfiles
6. AgentDefinitionCatalog
7. StackTeamProfiles
8. TeamCompositionPolicies
9. RuntimeSupportProfiles
10. TeamComposer V2 integration
11. JobClassifier
12. IntelligentWorkRouter
13. TeamSwitch/Handoff
14. Learning Intelligence
```

## Stack Engineering Units iniciais

```text
stack.java.spring-boot
stack.typescript.angular
stack.typescript.react
stack.typescript.nextjs
stack.typescript.astro
stack.typescript.nestjs
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
data.sql
integration.unit
```

## Cada stack precisa de

```text
StackDefinition
CapabilityDefinitions
AgentDefinitions
StackTeamProfile
Prompts
Tools
Territories
ReviewPolicies
RuntimeSupportProfile
OutputSchemas
```

## Runtime Support

```text
CATALOG_ONLY
PLANNING_SUPPORTED
GENERATION_SUPPORTED
BUILD_SUPPORTED
REPAIR_SUPPORTED
FULLY_SUPPORTED
```

## PROMPT — Bootstrap de Stack Engineering Unit

```text
# LDCN OS — BOOTSTRAP STACK ENGINEERING UNIT

Stack:
<STACK_KEY>

Objetivo:
criar o catálogo operacional da stack sem instanciar Mission agents.

Entrada:
- StackDefinition draft;
- CapabilityRegistry;
- ToolRegistry;
- Contract types;
- runtime support;
- existing AgentDefinitions;
- existing StackTeamProfiles.

Produzir:
1. StackDefinition final;
2. CapabilityDefinitions;
3. AgentDefinitions;
4. StackTeamProfile LOW/MEDIUM/HIGH;
5. PromptTemplates por AgentDefinition;
6. ToolProfile;
7. TerritoryProfile;
8. ReviewPolicy;
9. output schemas;
10. runtime support declaration;
11. test matrix.

Regras:
- modelar por stack, não apenas linguagem;
- não copiar Java mecanicamente;
- preservar universal governance;
- não instanciar AgentInstances;
- não habilitar runtime inexistente;
- reviewer != executor;
- prompts provider-neutral;
- no commit/push antes de relatório.
```

## Sequência sugerida de bootstrap

```text
1 Java/Spring Boot
2 Angular
3 Astro
4 Next.js
5 NestJS
6 React
7 .NET
8 FastAPI
9 Django
10 Flutter
11 Python AI
12 Python Data
13 Go
14 Rust
15 Kotlin Android
16 Swift iOS
17 SQL/Data
18 Integration Unit
```

A ordem de bootstrap não define preferência arquitetural.

## Critério de pronto

```text
StackDefinition valid
Capability coverage valid
AgentDefinitions valid
Prompt schemas valid
Territories valid
Review policy valid
TeamProfile LOW/MEDIUM/HIGH valid
RuntimeSupport explicit
Unit tests pass
Reference-data bootstrap idempotent
```

## 🔗 Relacionados

- [[29 - Empresa de Agentes - Times Stacks e Prompts]]
- [[31 - Agent Definition Factory e Team Factory]]
- [[34 - Guardrails de Readiness e Correção da Implementação]]
- [[27 - Slices Prompts Codex e Roadmap]]
