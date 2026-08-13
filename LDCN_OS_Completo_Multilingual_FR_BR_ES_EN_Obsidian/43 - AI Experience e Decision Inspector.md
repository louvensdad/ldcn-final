---
title: "AI Experience e Decision Inspector"
aliases: ["AI UX", "Decision Inspector"]
tags: [ldcn, frontend, ai, ux, decision]
status: canonico
---

# ✨🤖 43 - AI Experience e Decision Inspector

[[00 - LDCN OS - Mapa Raiz Completo|⬅ Mapa Raiz]] · [[32 - AI Decision Runtime|AI Decision Runtime]] · [[38 - Frontend Premium - Cérebro de Experiência|Frontend Brain]]

## Objetivo

Tornar IA visível sem transformar o produto em um chat.

---

# 1. AI Activity

Indicador:

```text
AI analyzing...
AI comparing stacks...
AI composing team...
AI reviewing architecture...
```

---

# 2. Decision Card

```text
Recommendation
Confidence
Why summary
Alternatives
Trade-offs
Policy checks
```

---

# 3. Decision Inspector

Drawer/page:

```text
Decision type
Created at
Input version refs
Context summary
Proposal
Confidence
Assumptions
Ambiguities
Alternatives
Policy checks
Provider/model
Tokens/cost
Outcome
```

---

# 4. No chain-of-thought

Nunca exibir:

```text
hidden reasoning
private scratchpad
full raw deliberation
```

Exibir:

```text
rationale resumido
decision facts
trade-offs
```

---

# 5. Ask AI

Contextual action:

```text
"Explique esta decisão"
```

Frontend envia ao Platform:

```text
POST /api/v1/missions/:id/assistant/explain
```

Platform decide se usa Brain.

---

# 6. Change request

Usuário:

```text
"Prefiro React em vez de Astro"
```

Frontend não edita ApprovedSolution local.

Envia command:

```text
request solution adjustment
```

---

# 7. AI Copilot panel

Opcional.

Deve ser:

```text
context-aware
mission-aware
read-only by default
command proposals explicit
```

Não deve possuir autorização implícita.

---

# 8. Explainability levels

```text
Simple
Detailed
Technical
```

Usuário escolhe.

---

# 9. Confidence UX

Não mostrar falsa precisão.

Em vez:

```text
0.823746
```

usar:

```text
Alta confiança
Média confiança
Baixa confiança
```

Detalhes técnicos podem mostrar valor.

---

# 10. Ambiguity UX

Se high-impact:

```text
Precisamos confirmar uma coisa
```

Se low-impact:

```text
Assumiremos X por enquanto
```

---

# 11. AI Usage visibility

Em decision detail:

```text
model
provider
tokens
cost
latency
```

quando plano/permissão permitir.

---

# 12. AI failure

UI:

```text
Não conseguimos concluir a análise agora.

[Repetir]
[Ver detalhes]
```

Não culpar usuário.

---

# 13. AI comparison

Solution view:

```text
Recommended
Alternative
Why rejected
```

---

# 14. Team Intelligence UI

Mostrar:

```text
Why this agent was included
Why specialist was not needed
Capability coverage
```

---

# 15. Routing Intelligence UI

Task detail:

```text
Selected Job Team
Why
Required capabilities
Risk
Reviewer
```

---

# 16. Team Switch UX

Timeline:

```text
Java Team
↓
Integration Unit
↓
Angular Team
```

Handoff summary disponível.

---

# 17. Scope Expansion UX

Modal premium:

```text
New requirement:
Mobile app

Impact:
+ Flutter stack
+ Mobile team
+ Architecture work
+ Pipeline nodes
+ estimated cost/time

[Approve expansion]
[Keep current scope]
```
