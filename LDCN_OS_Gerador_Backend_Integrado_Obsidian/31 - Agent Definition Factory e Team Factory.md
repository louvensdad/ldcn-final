---
title: "Agent Definition Factory e Team Factory"
aliases: ["Agent Factory", "Team Factory"]
tags: [ldcn, gerador-inteligente, agents, team, ai-first]
status: canonico
---

# 🤖 31 - Agent Definition Factory e Team Factory

[[00 - LDCN OS - Gerador + Backend - Mapa Raiz|⬅ Mapa Raiz]] · [[30 - AI-First Intelligence Constitution|AI-First]] · [[33 - Stack Teams Bootstrap do Zero|Bootstrap de Teams]]

## Objetivo

Como o LDCN V2 foi iniciado do zero, a empresa precisa construir um **catálogo permanente de AgentDefinitions** e **StackTeamProfiles** para cada Stack Engineering Unit.

Isso não significa instanciar todos os agentes em toda Mission.

```text
EMPRESA LDCN
│
├── AgentDefinition Catalog
├── Capability Catalog
├── StackRegistry
├── StackTeamProfiles
├── Prompt Catalog
├── Tool Profiles
├── Territory Profiles
└── Review Policies
        ↓
ApprovedSolution
        ↓
TeamComposer V2
        ↓
AgentInstances da Mission
```

## Distinção obrigatória

```text
AgentDefinition = função disponível permanentemente na empresa
AgentInstance   = função convocada para uma Mission específica
```

## Modelar por Stack Engineering Unit

Errado:

```text
TypeScript Team
Python Team
```

Correto:

```text
TypeScript
├── Angular Team
├── React Team
├── Next.js Team
├── Astro Team
└── NestJS Team

Python
├── FastAPI Team
├── Django Team
├── AI/ML Team
└── Data Team
```

## Estrutura de um AgentDefinition AI-first

```ts
AgentDefinition {
  key
  version
  roleName
  roleMission
  stackKey?
  layer
  level
  knowledgeRefs[]
  capabilityKeys[]
  promptTemplateKey
  outputSchemaKey
  allowedTools[]
  territoryProfileKey?
  reviewPolicyKey?
  delegationPolicyKey?
  contextRequirements[]
  memoryPolicy
  canExecute
  canReview
  canApprove
  canDelegate
  runtimeSupportStatus
  status
}
```

Cada AgentDefinition precisa ter:

```text
ROLE
CONTEXT
KNOWLEDGE
CAPABILITIES
PROMPT
TOOLS
BOUNDARIES
MEMORY
OUTPUT CONTRACT
```

## PROMPT — Agent Definition Designer

```text
# LDCN OS — AGENT DEFINITION DESIGNER

Objetivo:
definir um AgentDefinition operacional para uma função dentro de uma Stack Engineering Unit.

Entrada:
- StackDefinition;
- roleKey;
- role purpose;
- architecture responsibilities;
- runtime support;
- CapabilityRegistry;
- ToolRegistry;
- ContractRegistry;
- existing AgentDefinitions.

Produza:
AgentDefinitionProposalV1 {
  key,
  roleName,
  roleMission,
  requiredKnowledgeRefs[],
  capabilityKeys[],
  promptTemplateKey,
  outputSchemaKey,
  allowedTools[],
  territoryProfileKey,
  reviewPolicyKey,
  delegationPolicyKey,
  contextRequirements[],
  memoryPolicy,
  canExecute,
  canReview,
  canApprove,
  canDelegate
}

Regras:
1. Não duplicar AgentDefinition semanticamente equivalente.
2. Não usar capability genérica quando a função exige conhecimento de stack.
3. Não permitir self-review.
4. Não permitir tool que excede territory.
5. Não criar output livre como fonte canônica.
6. Todo agente cognitivo produz structured output.
7. Todo agente executor usa runtime existente quando disponível.
8. Não criar AgentInstance.
9. Não alterar ApprovedSolution.
```

## Team Factory AI-first

```text
ApprovedSolution
↓
AI Team Composition Advisor
↓
TeamCompositionProposal
↓
Policy Validation
↓
TeamComposer V2
↓
AgentInstances
```

### TeamCompositionProposal

```ts
TeamCompositionProposal {
  missionId
  approvedSolutionId
  stackKey
  complexityProfile
  riskProfile
  recommendedRoles[]
  optionalRoles[]
  excludedRoles[]
  rationaleByRole[]
  capabilityCoverage[]
  uncoveredCapabilities[]
  reviewModel
  integrationNeed
  confidence
}
```

## PROMPT — AI Team Composition Advisor

```text
# LDCN OS — AI TEAM COMPOSITION ADVISOR

Entrada:
ApprovedSolution
Requirements
StackArchitectureProposal
ComplexityProfile
RiskProfile
StackTeamProfile
AgentCatalog
CapabilityRegistry
runtimeSupport
historicalLearningSignals

Objetivo:
propor o menor Team capaz de executar a Mission com segurança e qualidade.

Analise:
- domínio;
- complexidade;
- segurança;
- dados;
- performance;
- runtime;
- integrations;
- compliance;
- scale;
- delivery speed;
- review independence.

Para cada role:
- incluir;
- excluir;
- marcar optional;
- explicar motivo.

Não:
- adicionar stack ausente;
- adicionar DeliveryTarget;
- instanciar agents;
- substituir policy;
- aprovar própria composição.

Saída:
TeamCompositionProposalV1.
```

## Materialização

```text
TeamCompositionProposal
↓
TeamCompositionPolicy
↓
CapabilityCoverageValidator
↓
ReviewIndependenceValidator
↓
ApprovedSolutionBoundaryValidator
↓
TeamComposer V2
↓
AgentTeam + AgentInstances
```

## 🔗 Relacionados

- [[07 - Stack Registry e Team Catalog]]
- [[10 - TeamComposer V2]]
- [[13 - Intelligent Work Router]]
- [[30 - AI-First Intelligence Constitution]]
- [[33 - Stack Teams Bootstrap do Zero]]
