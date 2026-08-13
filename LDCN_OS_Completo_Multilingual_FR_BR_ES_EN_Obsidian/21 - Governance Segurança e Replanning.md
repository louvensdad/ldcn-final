---
title: "21 - Governance Segurança e Replanning"
aliases:
  - "Governance Segurança e Replanning"
tags:
  - ldcn
  - gerador-inteligente
  - arquitetura
status: canonico
---

# 21 - Governance Segurança e Replanning

[[00 - LDCN OS - Mapa Raiz Completo|⬅ Mapa Raiz]] · [[20 - Memory e Context Budgeting|← Anterior]] · [[22 - Observability Audit e Tracing|Próximo →]]

## Trust Classes

```text
TRUSTED_PLATFORM
APPROVED_PROJECT_CONTEXT
UNTRUSTED_USER_PROJECT_DATA
```

### Regras

```text
no secret in prompt
no API key in snapshot
no arbitrary shell
no arbitrary URL
no cross-mission artifact
no cross-mission routing
no cross-tenant reads
no provider call outside LlmGateway
```

---


### Prompt Boundary

Todo estágio cognitivo deve seguir:

```text
Cognitive Handler
↓
PromptCompiler
↓
LlmGateway
↓
Provider Policy
↓
Structured Output
↓
Schema Validation
↓
Domain/Policy Validation
```

Nunca:

```text
SolutionPlanner -> DeepSeek/Gemini/Claude diretamente
```

### Structured Schemas

Outputs cognitivos precisam de schema versionado.

Exemplos:

```text
ProjectIntentV1
SolutionTopologyProposalV1
SolutionProposalV1
StackSelectionProposalV1
StackArchitectureProposalV1
ArchitectureDecisionV1
JobClassificationV1
WorkRoutingDecisionV1
TeamSwitchDecisionV1
HandoffPackageV1
MissionPipelinePlanV1
```

Texto livre pode acompanhar explicações, mas não é fonte canônica de estado.

### Human Approval Policy

Nem toda etapa precisa bloquear o usuário.

Exemplo de baixa criticidade:

```text
Requirements
→ Topology
→ Recommendation
→ aprovação final da solução
```

Exemplo crítico:

```text
Requirements approval
Topology approval
Solution approval
Architecture approval
Security approval
```

Uma `ApprovalPolicy` deve decidir quais boundaries exigem aprovação humana ou podem seguir automaticamente.

### Segurança contra prompt injection

A ideia do usuário e conteúdo de projeto são dados não confiáveis.

Separar:

```text
SYSTEM RULES
TRUSTED PLATFORM KNOWLEDGE
APPROVED PROJECT CONTEXT
UNTRUSTED USER/PROJECT DATA
```

Nenhum texto do projeto pode substituir regras da plataforma.

---

Podem existir:

```text
REQUIREMENTS_APPROVAL
TOPOLOGY_APPROVAL
SOLUTION_APPROVAL
ARCHITECTURE_APPROVAL
SCOPE_EXPANSION_APPROVAL
PROMOTION_APPROVAL
```

Nem todas exigem humano em todas as Missions.

Policy decide.

---

---

```text
INTENT_PENDING
INTENT_READY
REQUIREMENTS_DRAFT
REQUIREMENTS_APPROVED
TOPOLOGY_PROPOSED
TOPOLOGY_APPROVED
SOLUTION_PLANNING
SOLUTION_PROPOSED
SOLUTION_APPROVED
ARCHITECTURE_COMPOSING
ARCHITECTURE_REVIEW
ARCHITECTURE_APPROVED
TEAM_COMPOSING
TEAM_READY
PIPELINE_PLANNING
READY_FOR_EXECUTION
ACTIVE
BLOCKED
CANCELLED
COMPLETED
```

---

---

Motivos:

```text
REQUIREMENTS_CHANGED
USER_PREFERENCE_CHANGED
RUNTIME_UNSUPPORTED
COST_CONSTRAINT_CHANGED
SECURITY_REQUIREMENT_CHANGED
INTEGRATION_CHANGED
SCOPE_EXPANSION_APPROVED
```

### Fluxo

```text
ApprovedSolution v1
↓
replan
↓
ApprovedSolution v2
↓
affected architectures recomposed
↓
affected teams recomposed
↓
affected pipeline recomposed
```

Somente o escopo impactado deve mudar.

---

---

Toda decisão importante registra:

```text
requirementsVersion
approvedSolutionVersion
contractVersions
contextHash
```

Se mudou:

```text
GENERATOR_CONTEXT_STALE
```

---

---

```text
GENERATOR_INTENT_NOT_READY
GENERATOR_REQUIREMENTS_NOT_APPROVED
GENERATOR_TOPOLOGY_NOT_APPROVED
GENERATOR_SOLUTION_NOT_APPROVED
GENERATOR_ARCHITECTURE_NOT_APPROVED
GENERATOR_TEAM_NOT_READY
GENERATOR_PIPELINE_NOT_READY
GENERATOR_CONTEXT_STALE
GENERATOR_STAGE_ALREADY_RUNNING
GENERATOR_STAGE_NOT_READY

SOLUTION_TARGET_FORBIDDEN
SOLUTION_STACK_UNSUPPORTED
SOLUTION_NO_VALID_STACK
SOLUTION_APPROVAL_REQUIRED

ARCHITECTURE_CONFLICT_OPEN

ROUTING_TARGET_OUT_OF_SCOPE
ROUTING_STACK_OUT_OF_SCOPE
ROUTING_CAPABILITY_GAP
ROUTING_NO_EXECUTOR
ROUTING_NO_REVIEWER
ROUTING_TERRITORY_CONFLICT
ROUTING_DELEGATION_DENIED
ROUTING_TEAM_NOT_READY
ROUTING_DECISION_STALE

TEAM_SWITCH_TARGET_UNAVAILABLE
TEAM_SWITCH_CONTEXT_STALE
HANDOFF_INCOMPLETE

SCOPE_EXPANSION_REQUIRED
```

---



## 🔗 Documentos relacionados

- [[09 - Approved Solution]]
- [[16 - Scope Expansion]]
- [[20 - Memory e Context Budgeting]]
- [[22 - Observability Audit e Tracing]]

---

[[00 - LDCN OS - Mapa Raiz Completo|⬅ Mapa Raiz]] · [[20 - Memory e Context Budgeting|← Anterior]] · [[22 - Observability Audit e Tracing|Próximo →]]

> Fonte canônica: [[00 - LDCN OS - Mapa Raiz Completo]]
