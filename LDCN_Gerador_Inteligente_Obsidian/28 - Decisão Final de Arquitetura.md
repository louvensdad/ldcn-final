---
title: "28 - Decisão Final de Arquitetura"
aliases:
  - "Decisão Final de Arquitetura"
tags:
  - ldcn
  - gerador-inteligente
  - arquitetura
status: canonico
---

# 28 - Decisão Final de Arquitetura

[[00 - Gerador Inteligente - Mapa Raiz|⬅ Mapa Raiz]] · [[27 - Slices Prompts Codex e Roadmap|← Anterior]]

O Gerador Inteligente deve ser implementado como:

```text
DECISION SYSTEM
+
COMPOSITION SYSTEM
+
ROUTING SYSTEM
+
TEAM COMMUTATION SYSTEM
+
REPLANNING SYSTEM
+
LEARNING SYSTEM
```

mas **não** como um novo Execution Engine.

A divisão final de autoridade é:

```text
User / Requirements
→ define intenção e constraints

Gerador Inteligente
→ decide solução, stacks, times, routing e handoffs

Stack Architects
→ decidem arquitetura interna das stacks

TeamComposer
→ define Mission Team

IntelligentWorkRouter
→ define Job Team

TeamSwitchResolver
→ define comutação e handoff

Existing AgentExecution Runtime
→ executa

Build/Test
→ produz evidence

Review
→ verifica

Gate
→ prova

Repair Runtime
→ recupera falhas elegíveis

Learning Intelligence
→ aprende com outcomes
```

---

---

> **A empresa completa existe no catálogo. A ApprovedSolution define quais departamentos podem existir na Mission. O TeamComposer monta esses departamentos. O IntelligentWorkRouter escolhe quem trabalha em cada Job. O TeamSwitchResolver controla quando o trabalho muda de equipe. Handoffs transportam contexto estruturado. Os runtimes executam. Reviews e Gates provam. Learning Intelligence aprende com cada resultado.**



## 🔗 Documentos relacionados

- [[01 - Constituição e Visão Geral]]
- [[27 - Slices Prompts Codex e Roadmap]]

---

[[00 - Gerador Inteligente - Mapa Raiz|⬅ Mapa Raiz]] · [[27 - Slices Prompts Codex e Roadmap|← Anterior]]

> Fonte canônica: [[00 - Gerador Inteligente - Mapa Raiz]]
