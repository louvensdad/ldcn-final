---
title: "22 - Observability Audit e Tracing"
aliases:
  - "Observability Audit e Tracing"
tags:
  - ldcn
  - gerador-inteligente
  - arquitetura
status: canonico
---

# 22 - Observability Audit e Tracing

[[00 - Gerador Inteligente - Mapa Raiz|⬅ Mapa Raiz]] · [[21 - Governance Segurança e Replanning|← Anterior]] · [[23 - Backend NestJS APIs e Persistência|Próximo →]]

## Métricas

```text
generator_intent_duration
generator_requirements_duration
generator_topology_duration
generator_solution_duration
generator_architecture_duration
generator_team_compose_duration
generator_pipeline_duration

generator_llm_calls
generator_llm_cost
generator_structured_repairs

generator_stack_candidate_count
generator_scope_expansion_count
generator_replan_count

routing_duration
routing_capability_gap_count
routing_scope_violation_count
routing_no_reviewer_count

team_switch_count
handoff_failure_count
integration_validation_failure_count

learning_prediction_count
learning_prediction_acceptance
```

---

---

Root:

```text
missionId
```

Spans:

```text
intent
requirements
topology
solution
architecture
team
pipeline
job-classification
job-routing
team-switch
handoff
execution
review
gate
repair
learning
```

---

---

O sistema precisa responder:

```text
Por que escolheu esta stack?
Por que não escolheu outra?
Por que não criou backend?
Por que chamou Security Specialist?
Por que não chamou Architect?
Por que este Job foi para Integration Unit?
Por que houve Team Switch?
Que HandoffPackage foi enviado?
Qual ApprovedSolution estava ativa?
Qual policy autorizou?
Qual provider/model participou?
Quais evidências provaram a promoção?
```

---



## 🔗 Documentos relacionados

- [[19 - Learning Intelligence e ML]]
- [[21 - Governance Segurança e Replanning]]
- [[23 - Backend NestJS APIs e Persistência]]

---

[[00 - Gerador Inteligente - Mapa Raiz|⬅ Mapa Raiz]] · [[21 - Governance Segurança e Replanning|← Anterior]] · [[23 - Backend NestJS APIs e Persistência|Próximo →]]

> Fonte canônica: [[00 - Gerador Inteligente - Mapa Raiz]]
