---
title: "Internacionalização Completa - FR BR ES EN"
aliases:
  - "i18n"
  - "Multilanguage"
  - "Localization"
tags:
  - ldcn
  - frontend
  - backend
  - i18n
  - localization
status: canonico
---

# 🌍 53 - Internacionalização Completa — FR, BR, ES, EN

[[00 - LDCN OS - Mapa Raiz Completo|⬅ Mapa Raiz]] · [[49 - Perfil Preferências Tema e Personalização|Preferências]] · [[46 - LDCN Academy - Curso Interativo e Onboarding|Academy]] · [[36 - Backend Completo - Platform Core + Brain Service|Backend]]

> **Toda a plataforma LDCN OS deve estar disponível integralmente no idioma escolhido pelo usuário.**

Idiomas oficiais iniciais:

```text
pt-BR  Português (Brasil)
en     English
es     Español
fr     Français
```

---

# 1. Regra constitucional de idioma

> **Nenhuma tela, mensagem, erro, ajuda, tutorial, notificação, decisão apresentada, email ou experiência de produto pode ficar parcialmente em outro idioma quando houver tradução oficial disponível.**

A preferência de idioma é uma configuração de usuário persistente.

---

# 2. Escopo completo

A tradução deve cobrir:

```text
Landing pública
Pricing
Features
Marketplace
Login
Signup

Workspace
Projects
Missions
Mission Wizard

Intent
Requirements
Topology
Solution
Architecture
Team
Pipeline
Tasks
Executions
Artifacts
Reviews
Gates
Repair

AI Decision Inspector
AI explanations
AI usage

Academy
Help Center
Contextual Help

Search
Command Palette
Notifications
Attention Center

Profile
Settings
Themes
Personalization

Company Center
Members
Roles
Security
Audit

Billing
Plans
Invoices
LLM Wall

Errors
Empty states
Loading states
Tooltips
Confirmation dialogs
Emails
System notifications
```

---

# 3. Preferência de idioma

```ts
UserLocalePreference {
  userId
  locale
  timezone
  dateFormat?
  numberFormat?
  currencyPreference?
  updatedAt
}
```

Locales:

```text
pt-BR
en
es
fr
```

---

# 4. Prioridade de resolução

```text
1. user saved preference
2. workspace preference when policy allows
3. browser language
4. fallback = en
```

Para usuário já autenticado:

```text
saved user preference wins
```

---

# 5. Primeiro acesso

Durante onboarding:

```text
Choose your language
Escolha seu idioma
Elige tu idioma
Choisissez votre langue
```

Opções:

```text
🇧🇷 Português
🇺🇸 English
🇪🇸 Español
🇫🇷 Français
```

Depois disso, todo onboarding muda imediatamente.

---

# 6. Mudança de idioma em tempo real

Perfil:

```text
Language
▾
Português
English
Español
Français
```

Ao selecionar:

```text
update UI immediately
↓
persist preference
↓
future API/AI presentation requests use locale
```

Não exigir logout.

---

# 7. Frontend Angular i18n architecture

Recomendado:

```text
apps/web/src/assets/i18n/
├── pt-BR/
├── en/
├── es/
└── fr/
```

Separar por domínio:

```text
common.json
navigation.json
auth.json
academy.json
projects.json
missions.json
wizard.json
solution.json
architecture.json
team.json
pipeline.json
tasks.json
artifacts.json
reviews.json
gates.json
ai.json
notifications.json
company.json
billing.json
marketplace.json
settings.json
errors.json
```

---

# 8. Chaves semânticas

Correto:

```text
mission.status.ready
solution.approve.action
notifications.build_failed.title
```

Errado:

```text
text1
label2
buttonBlue
```

---

# 9. Nenhum texto hardcoded

Proibido em componentes:

```html
<button>Aprovar solução</button>
```

Correto conceitualmente:

```html
<button>{{ 'solution.approve.action' | translate }}</button>
```

---

# 10. Backend locale context

Toda request autenticada pode carregar:

```text
Accept-Language
```

ou locale derivado do perfil.

Platform resolve:

```ts
RequestLocaleContext {
  locale
  timezone
}
```

---

# 11. Erros de domínio

Backend continua retornando código canônico:

```text
GENERATOR_TEAM_NOT_READY
```

Não retorna verdade de negócio localizada como identificador.

Frontend traduz:

```text
pt-BR:
"O time de agentes ainda não está pronto."

en:
"The agent team is not ready yet."

es:
"El equipo de agentes aún no está listo."

fr:
"L'équipe d'agents n'est pas encore prête."
```

---

# 12. Mensagens do backend

Formato:

```ts
ApiError {
  code
  messageKey
  params?
  correlationId
  retryable
}
```

Exemplo:

```json
{
  "code": "GENERATOR_TEAM_NOT_READY",
  "messageKey": "errors.generator.team_not_ready"
}
```

Frontend resolve a tradução.

---

# 13. IA deve responder no idioma do usuário

Brain recebe:

```text
presentationLocale
```

Exemplo:

```ts
BrainDecisionRequest {
  ...
  presentationLocale: "fr"
}
```

A estrutura canônica continua neutra.

Mas campos destinados ao usuário:

```text
summary
rationaleSummary
explanation
clarificationQuestion
```

devem ser produzidos no idioma solicitado.

---

# 14. Structured outputs

Não traduzir enums canônicos.

Correto:

```json
{
  "riskLevel": "HIGH",
  "summary": "Risque élevé en raison..."
}
```

Não:

```json
{
  "riskLevel": "ÉLEVÉ"
}
```

Enums internos permanecem estáveis.

---

# 15. AI Decision Inspector

Em francês:

```text
Recommandation
Confiance
Alternatives
Compromis
Vérifications de politique
```

Em espanhol:

```text
Recomendación
Confianza
Alternativas
Compensaciones
Validaciones de política
```

Em português:

```text
Recomendação
Confiança
Alternativas
Trade-offs
Validações de política
```

Em inglês:

```text
Recommendation
Confidence
Alternatives
Trade-offs
Policy checks
```

---

# 16. Academy multilíngue

Todos os módulos:

```text
pt-BR
en
es
fr
```

Incluindo:

```text
tour text
practice instructions
quiz
contextual help
completion messages
```

---

# 17. Search multilíngue

Busca deve reconhecer:

```text
Projeto
Project
Proyecto
Projet
```

como intenção equivalente quando possível.

Search index pode armazenar aliases localizados.

---

# 18. Command Palette

Exemplo:

```text
pt-BR: Nova missão
en: New mission
es: Nueva misión
fr: Nouvelle mission
```

O comando interno continua:

```text
CREATE_MISSION
```

---

# 19. Notifications

Notification canônica:

```ts
Notification {
  type: "BUILD_FAILED"
  messageKey: "notifications.build_failed"
  params: {...}
}
```

Renderizada no locale do usuário.

---

# 20. Emails

Email deve respeitar locale do destinatário.

Templates:

```text
emails/pt-BR/
emails/en/
emails/es/
emails/fr/
```

---

# 21. Billing

Localizar:

```text
plan names presentation
currency formatting
dates
numbers
invoice UI
```

Preço canônico permanece no backend.

---

# 22. Currency formatting

Exemplos:

```text
pt-BR → R$ 150,00
en-US → R$150.00 or localized billing representation
es → 150,00 R$
fr → 150,00 R$
```

A moeda contratada não muda automaticamente com idioma.

---

# 23. Datas

Locale-aware:

```text
pt-BR: 13/08/2026
en: Aug 13, 2026
es: 13 ago 2026
fr: 13 août 2026
```

---

# 24. Timezone

Idioma e timezone são configurações separadas.

Usuário francês pode estar no Brasil.

Nunca inferir timezone somente pelo idioma.

---

# 25. Content fallback

Se chave ausente:

```text
requested locale
↓
en
↓
translation_missing telemetry
```

Nunca mostrar chave crua em produção.

---

# 26. Translation Quality

Cada release roda:

```text
missing key check
unused key check
placeholder parity check
ICU syntax validation
locale completeness
```

---

# 27. Placeholders

Exemplo:

```text
"mission.completed": "Mission {{name}} completed."
```

Todas traduções precisam conter os mesmos placeholders obrigatórios.

---

# 28. Pluralization

Usar regras reais de idioma.

Exemplo:

```text
1 mission
2 missions

1 missão
2 missões
```

Não concatenar strings manualmente.

---

# 29. Gender / grammar

Evitar construir frases por pedaços.

Preferir mensagem completa por locale.

---

# 30. Layout resilience

Francês pode ocupar mais espaço que inglês.

Componentes precisam aceitar:

```text
+30% text expansion
```

Botões não podem depender de largura fixa apertada.

---

# 31. RTL future

Não obrigatório inicialmente.

Mas evitar arquitetura que impossibilite suporte futuro.

---

# 32. Marketplace translations

Cada listing pode ter:

```ts
LocalizedContent {
  locale
  title
  description
  highlights[]
}
```

---

# 33. User-generated content

Não traduzir automaticamente por padrão:

```text
project names
user descriptions
artifact content
code
```

Pode oferecer:

```text
Translate
```

via ação explícita futura.

---

# 34. Project requirements

Se usuário escreve em espanhol:

```text
Brain understands Spanish
```

e pode manter Requirements presentation em espanhol.

Canonical fields/enums continuam estáveis.

---

# 35. Audit

Eventos canônicos:

```text
SOLUTION_APPROVED
```

UI traduz.

Audit export técnico pode usar código canônico + label localizada.

---

# 36. Accessibility

`lang` do HTML precisa atualizar:

```html
<html lang="fr">
```

Isso afeta leitores de tela.

---

# 37. SEO público

Landing pública:

```text
/pt-BR/
/en/
/es/
/fr/
```

ou estratégia equivalente.

Metadata:

```text
title
description
og
hreflang
```

---

# 38. Locale routing

App autenticado não precisa obrigatoriamente de locale na URL.

Pode usar preferência persistida.

Páginas públicas podem usar locale na rota.

---

# 39. Translation management

Inicialmente:

```text
JSON versionado no Git
```

Futuro:

```text
translation management platform
```

sem acoplar arquitetura.

---

# 40. Telemetry

Registrar:

```text
locale
translation_missing
fallback_used
```

sem dados pessoais desnecessários.

---

# 41. Tests

## Unit

```text
locale resolver
message interpolation
error mapping
date/number formatting
```

## Integration

```text
saved preference
API locale context
Brain presentationLocale
notifications
```

## E2E

Executar fluxos principais nos 4 idiomas:

```text
pt-BR
en
es
fr
```

---

# 42. E2E mínimo por locale

```text
Login
Academy
Create Project
Create Mission
Wizard
Approve Solution
Mission Command Center
Notifications
Profile
Billing
```

---

# 43. Screenshot regression

Rodar visual regression para:

```text
pt-BR
en
es
fr
```

Principalmente:

```text
navigation
buttons
tables
modals
wizard
notifications
```

---

# 44. Definition of multilingual complete

```text
100% navigation translated
100% Academy translated
100% Wizard translated
100% errors translated
100% notifications translated
100% settings translated
100% billing translated
100% Marketplace UI translated
AI explanations use selected locale
emails use recipient locale
dates/numbers locale-aware
no hardcoded UI strings
translation tests green
```

---

# 45. Regra final

> **O idioma é uma preferência transversal do usuário e acompanha toda a experiência LDCN OS, do primeiro acesso ao audit, incluindo IA, Academy, notificações e billing.**

> **PT-BR, EN, ES e FR são idiomas de primeira classe, não traduções secundárias.**
