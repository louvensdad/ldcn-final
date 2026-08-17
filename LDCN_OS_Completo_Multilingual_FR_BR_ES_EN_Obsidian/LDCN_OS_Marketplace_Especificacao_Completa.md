---
title: "LDCN OS - Marketplace - Especificação Completa"
aliases:
  - "Marketplace LDCN"
  - "LDCN Store"
  - "Catalog Service"
tags:
  - ldcn
  - marketplace
  - frontend
  - backend
  - specification
status: canonico
version: 1
parent: "[[LDCN OS - Frontend Premium Completo]]"
---

# 🏪 LDCN OS — Marketplace — Especificação Completa

> Este documento substitui e expande as seções 51 (Marketplace), Tela 18 e F9 do documento canônico do Frontend Premium.
> Cobre frontend, backend, modelos de dados, UX, API e definition of done.

---

## Índice

- [[#01. Visão e Papel do Marketplace]]
- [[#02. Categorias do Marketplace]]
- [[#03. Modelos de Dados]]
- [[#04. Ciclo de Vida de um Item]]
- [[#05. UX — Telas e Jornadas]]
- [[#06. Design System do Marketplace]]
- [[#07. Busca e Descoberta]]
- [[#08. Sistema de Avaliação e Reviews]]
- [[#09. Planos e Controle de Acesso]]
- [[#10. Publisher Experience]]
- [[#11. Integração com Platform API]]
- [[#12. Moderação e Qualidade]]
- [[#13. Analytics para Publishers]]
- [[#14. Implementação Angular]]
- [[#15. Integração Backend]]
- [[#16. Internacionalização]]
- [[#17. Definition of Done]]

---

## 01. Visão e Papel do Marketplace

O Marketplace é a camada de extensibilidade do LDCN OS.

Ele não é loja de software genérico.
É o catálogo curado de inteligência e capacidade que pode ser adicionada às missões.

```
USER
↓
Marketplace (catálogo + descoberta)
↓
Workspace (itens adicionados)
↓
Mission (itens aplicados)
↓
Brain / Generator (itens usados em execução)
```

### Papel na plataforma

```
Platform Core
├── Brain Service
├── Generator
│   ├── Mission Team (usa agentes do Marketplace)
│   ├── Stack Packs (usa definições do Marketplace)
│   └── Capabilities (usa extensões do Marketplace)
└── Marketplace
    ├── Catalog Service
    ├── Publisher Service
    └── Access Control
```

### Princípios

- O Marketplace **não executa** itens. Ele os disponibiliza para o Generator.
- Itens LDCN Core são curados e mantidos pela equipe LDCN.
- Itens Community passam por moderação antes de serem publicados.
- O acesso a itens é controlado por plano, não por compra avulsa inicial.
- O Marketplace deve funcionar como catálogo visual completo **mesmo na fase inicial**, sem necessidade de integração completa com Publisher.

---

## 02. Categorias do Marketplace

### 2.1 Agentes

Agentes de IA especializados que compõem times de missão.

```
AgentListing {
  id
  name
  author
  official          // LDCN Core vs Community
  verified          // passou por verificação técnica
  domain            // Backend | Frontend | Mobile | Infrastructure | Security | QA | Data
  stacks[]          // stacks que domina
  capabilities[]    // capacidades que possui
  description
  longDescription
  compatiblePackIds[]
  rating
  reviewCount
  missionCount
  version
  changelog[]
  plan              // plano mínimo necessário
  badge?            // Top Rated | Editor's Pick | Community | Trending
  featured
  status            // ACTIVE | DEPRECATED | PREVIEW
  createdAt
  updatedAt
}
```

Exemplos de domínios e agentes esperados:

| Domínio       | Exemplos                                                    |
|---------------|-------------------------------------------------------------|
| Backend       | Java Engineer, Python Engineer, Go Architect, Node Engineer |
| Frontend      | Angular Engineer, React Engineer, Vue Engineer, Astro       |
| Mobile        | Flutter Engineer, React Native Engineer                     |
| Infrastructure| DevOps/CI-CD, Cloud Deploy, Security Gates                  |
| Security      | OWASP Specialist, Auth Architect, LGPD Compliance           |
| QA            | Test Engineer, Load Testing Specialist                      |
| Data          | Data Pipeline, Analytics Engineer, ML Integration           |

### 2.2 Stack Packs

Conjuntos curados de agentes pré-configurados para um stack específico.

```
StackPackListing {
  id
  name
  author
  official
  verified
  stacks[]
  agentIds[]
  agentCount
  description
  capabilities[]    // capabilities cobertas pelo pack
  compatibleTopologies[]
  rating
  reviewCount
  missionCount
  version
  plan
  badge?
  featured
  status
}
```

Um Stack Pack define:
- Quais agentes compõem o time
- Como eles se comunicam
- Quais gates são aplicados
- Quais capabilities são ativadas por padrão

Exemplos de packs esperados:

| Pack                         | Agentes                                              |
|------------------------------|------------------------------------------------------|
| Java + Angular Enterprise    | Java BE + Angular FE + DevOps + QA                  |
| Flutter + FastAPI            | Flutter Mobile + Python BE + DevOps                  |
| Go Microservices             | Go Architect + Go BE (x2) + DevOps + DB Admin        |
| Next.js SaaS                 | Next.js Engineer + DevOps + Stripe Integration        |
| Python Data Platform         | FastAPI BE + Data Engineer + ML Integration + DevOps  |

### 2.3 Templates

Templates de missão pré-configurados: intent, requirements, topology e solution aprovada.

```
TemplateListing {
  id
  name
  author
  official
  verified
  stacks[]
  topology          // FRONTEND_ONLY | BACKEND_ONLY | BACKEND_FRONTEND | FULL_STACK
  modules[]         // módulos incluídos no template
  preBuiltRequirements
  approvedSolutionSummary
  estimatedDuration
  estimatedCost
  description
  rating
  reviewCount
  missionCount
  plan
  badge?
  featured
  status
}
```

Exemplos de templates:

| Template              | Topology              | Stacks                          |
|-----------------------|-----------------------|---------------------------------|
| ERP System            | BACKEND_FRONTEND      | Java + Angular + PostgreSQL     |
| Multi-tenant SaaS     | BACKEND_FRONTEND      | Next.js + Node.js + PostgreSQL  |
| Marketing Landing     | FRONTEND_ONLY         | Astro + TailwindCSS             |
| Consumer Mobile App   | BACKEND_FRONTEND      | Flutter + FastAPI + Firebase    |
| Data Dashboard        | BACKEND_FRONTEND      | Python + React + PostgreSQL     |
| REST API Platform     | BACKEND_ONLY          | Java Spring Boot + PostgreSQL   |

### 2.4 Capabilities

Capacidades individuais que ampliam o que os agentes podem fazer.

```
CapabilityListing {
  id
  name
  author
  verified
  category          // Design | Security | Testing | Compliance | Performance | Marketing
  description
  compatibleDomains[]
  compatibleStacks[]
  rating
  installCount
  plan
  badge?
  featured
  status
}
```

Categorias de capabilities:

| Categoria   | Exemplos                                                      |
|-------------|---------------------------------------------------------------|
| Design      | REST API Design, GraphQL Design, Event Schema Design          |
| Security    | OWASP Audit, Penetration Testing, Auth Flow Validator         |
| Compliance  | LGPD, GDPR, SOC2, WCAG AA                                    |
| Testing     | Load Testing (k6), E2E Testing, Contract Testing              |
| Performance | Core Web Vitals, Database Indexing, Caching Strategy          |
| Marketing   | SEO Optimizer, Structured Data, Analytics Integration         |
| Docs        | OpenAPI Generator, Architecture Docs, README Generator        |

### 2.5 Integrações

Conectores com sistemas e ferramentas externas.

```
IntegrationListing {
  id
  name
  author
  official
  verified
  category          // VCS | CI_CD | PROJECT_MGMT | CLOUD | COMMUNICATION | MONITORING
  description
  status            // AVAILABLE | COMING_SOON | BETA | DEPRECATED
  features[]        // o que a integração faz
  requiredScopes[]  // permissões OAuth necessárias
  configSchema      // campos de configuração
  rating
  installCount
  plan
  badge?
  featured
}
```

Roadmap de integrações:

| Integração    | Status       | Plano      |
|---------------|--------------|------------|
| GitHub        | Disponível   | Basic+     |
| GitLab        | Em breve     | Basic+     |
| Jira          | Em breve     | Advanced+  |
| Linear        | Em breve     | Advanced+  |
| Slack         | Em breve     | Basic+     |
| AWS Deploy    | Disponível   | Advanced+  |
| GCP Deploy    | Em breve     | Advanced+  |
| Sentry        | Em breve     | Advanced+  |
| Datadog       | Em breve     | Pro        |

---

## 03. Modelos de Dados

### 3.1 Listing base

```typescript
interface MarketplaceListing {
  id: string
  category: MarketplaceCategory
  slug: string
  name: string
  author: string
  authorId: string
  official: boolean         // LDCN Core
  verified: boolean         // passou por verificação
  description: string
  longDescription?: string
  rating: number | null
  reviewCount: number
  plan: PlanTier            // free | basic | advanced | pro
  badge?: string
  featured: boolean
  status: ListingStatus     // ACTIVE | DEPRECATED | PREVIEW | COMING_SOON
  locale: string            // locale do conteúdo
  createdAt: Date
  updatedAt: Date
  version: string
  changelog?: ChangelogEntry[]
}

type MarketplaceCategory = 'agents' | 'stacks' | 'templates' | 'capabilities' | 'integrations'
type PlanTier = 'free' | 'basic' | 'advanced' | 'pro'
type ListingStatus = 'ACTIVE' | 'DEPRECATED' | 'PREVIEW' | 'COMING_SOON'
```

### 3.2 Workspace Marketplace State

```typescript
interface WorkspaceMarketplaceState {
  workspaceId: string
  installedAgentIds: string[]
  installedStackPackIds: string[]
  installedCapabilityIds: string[]
  activeIntegrationIds: string[]
  watchlistIds: string[]       // "Notificar quando disponível"
  updatedAt: Date
}
```

### 3.3 Review

```typescript
interface MarketplaceReview {
  id: string
  listingId: string
  authorId: string
  authorName: string
  rating: number               // 1–5
  title: string
  body: string
  missionCount: number         // quantas missões o reviewer usou o item
  verified: boolean            // review verificado (requer uso real)
  createdAt: Date
  helpfulCount: number
}
```

### 3.4 Publisher

```typescript
interface PublisherProfile {
  id: string
  name: string
  displayName: string
  bio?: string
  website?: string
  verified: boolean
  totalListings: number
  totalInstalls: number
  averageRating: number
  createdAt: Date
}
```

---

## 04. Ciclo de Vida de um Item

```
DRAFT
↓
SUBMITTED_FOR_REVIEW
↓
IN_REVIEW
↓ (aprovado)        ↓ (rejeitado)
ACTIVE              REJECTED (com feedback)
↓                   ↓
(nova versão)       (revisão e resubmissão)
↓
VERSION_IN_REVIEW
↓
UPDATED (nova versão ativa)
↓
(obsolescência)
↓
DEPRECATED
```

### Regras de moderação (LDCN Core)

- Items oficiais LDCN Core não passam por moderação pública.
- Items Community são revisados em até 5 dias úteis.
- Critérios: segurança, qualidade técnica, documentação, compatibilidade, ausência de comportamento malicioso.
- Feedback detalhado é dado em caso de rejeição.

---

## 05. UX — Telas e Jornadas

### 5.1 Tela principal do Marketplace

```
┌─────────────────────────────────────────────────────────────────┐
│ Marketplace          🔍 Buscar agentes, stacks, templates...    │
├─────────────────────────────────────────────────────────────────┤
│ [Agentes 24] [Stack Packs 12] [Templates 18] [Capacidades 31]  │
│ [Integrações 9]                                                  │
├─────────────────────────────────────────────────────────────────┤
│ Plano: Todos | Grátis | Basic+ | Advanced+ | Pro    12 results  │
├─────────────────────────────────────────────────────────────────┤
│ EM DESTAQUE ──────────────────────────────────────────────────  │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ ⭐ Destaque  [Top Rated]  [Basic+]  LDCN Core ✓          │   │
│ │                                                  [○●○○]  │   │
│ │ Java Backend Engineer                                     │   │
│ │ LDCN Core · Backend · v2.3.1                             │   │
│ │ [Java] [Spring Boot] [JPA] [REST API] [Security] [Tests] │   │
│ │ Engenheiro sênior Spring Boot para backends enterprise... │   │
│ │ ★ 4.9 · 1.2k avaliações · 8.4k missões  [Ver] [Add]     │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│ TODOS · 7 ────────────────────────────────────────────────────  │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│ │ Angular FE   │ │ Flutter      │ │ Python Data  │ ...        │
│ │ ★4.8 6.2k    │ │ ★4.7 3.1k    │ │ ★4.8 2.1k    │            │
│ └──────────────┘ └──────────────┘ └──────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Panel de detalhes (drawer lateral)

Ao clicar em qualquer card:

```
┌─────────────────────────────┐
│ [Badge] [Plan]          [X] │
│ Java Backend Engineer       │
│ LDCN Core ✓ · v2.3.1       │
├─────────────────────────────┤
│ [Capability ring 64px]      │
│ REST API · Database ·       │
│ Testing · Security · Docs   │
├─────────────────────────────┤
│ ★4.9  1.2k  8.4k  3d atrás │
├─────────────────────────────┤
│ DESCRIÇÃO                   │
│ Engenheiro sênior Spring    │
│ Boot para backends...       │
├─────────────────────────────┤
│ STACKS COMPATÍVEIS          │
│ [Java] [Spring Boot] [JPA]  │
├─────────────────────────────┤
│ PLANO NECESSÁRIO            │
│ Basic+  Requer plano Basic+ │
├─────────────────────────────┤
│ [+ Adicionar ao Workspace]  │
└─────────────────────────────┘
```

### 5.3 Jornadas principais

#### Jornada A — Descoberta e adição de agente

```
Marketplace → Agentes
↓
Busca: "java"
↓
Resultados filtrados
↓
Clica em "Java Backend Engineer"
↓
Panel de detalhes abre
↓
[Adicionar ao Workspace]
↓
Confirmação discreta: "Agente adicionado"
↓
Disponível em novas missões
```

#### Jornada B — Stack Pack para nova missão

```
Marketplace → Stack Packs
↓
Filtra: Advanced+
↓
Java + Angular Enterprise Pack
↓
[Ver detalhes] → Agentes incluídos
↓
[Adicionar ao Workspace]
↓
Nova missão → Wizard sugere pack instalado
```

#### Jornada C — Template para ERP

```
Marketplace → Templates
↓
Filtra: Pro
↓
ERP System Template
↓
[Usar template]
↓
Wizard pré-preenchido com requirements do template
↓
Usuário ajusta e inicia missão
```

#### Jornada D — Capability para compliance LGPD

```
Marketplace → Capacidades
↓
Busca: "lgpd"
↓
LGPD Compliance
↓
[Adicionar]
↓
Capability ativa em todas as missões do workspace
↓
Agentes passam a validar conformidade LGPD nos artefatos
```

#### Jornada E — Integração GitHub

```
Marketplace → Integrações
↓
GitHub (Disponível)
↓
[Ver detalhes] → Features listadas
↓
[Conectar]
↓
OAuth flow do GitHub
↓
Integração ativa no workspace
↓
Mission Command Center mostra "Push to GitHub" em artifacts
```

#### Jornada F — "Notificar quando disponível" (Coming Soon)

```
Marketplace → Integrações
↓
GitLab (Em breve)
↓
[Notificar quando disponível]
↓
Watchlist adicionada
↓
Quando GitLab ficar disponível → Notificação para usuário
```

### 5.4 Tela de publisher (fase futura)

```
Meu Perfil Publisher
├── Meus Listings
├── Analytics
├── Reviews recebidas
├── Publicar novo item
└── Configurações
```

---

## 06. Design System do Marketplace

### Identidade visual

O Marketplace segue o design system global do LDCN OS:

- Background: Graphite / Obsidian (`#07080c`)
- Surface: `#0d1018` (cards)
- Surface Elevated: `#13161f` (hover, active)
- Accent AI: Indigo (`#6366f1`) — ações primárias, highlights de agentes
- Accent Runtime: Cyan (`#06b6d4`) — stacks técnicas
- Success: Emerald (`#10b981`) — disponível, free
- Warning: Amber (`#f59e0b`) — em breve, pro tier
- Danger: Red (`#ef4444`) — deprecated, security

### Capability Ring

Elemento visual signature do Marketplace.

Cada card de agente possui um **Capability Ring**: um anel SVG de 8 pontos, cada ponto representando um domínio de capacidade.

Pontos preenchidos (indigo) = capacidade presente.
Pontos vazios = ausente.

Isso cria uma "impressão digital" visual única para cada agente.

```
Domínios do ring:
[12h] REST API
[1h30] Database
[3h]  Security / Auth
[4h30] Testing / QA
[6h]  UI / Frontend
[7h30] Infra / CI-CD
[9h]  Mobile
[10h30] Data / AI
```

### Badges de plano

| Plano    | Cor        | Background           |
|----------|------------|----------------------|
| Grátis   | #10b981    | rgba(16,185,129,0.1) |
| Basic+   | #818cf8    | rgba(99,102,241,0.1) |
| Advanced+| #a78bfa    | rgba(139,92,246,0.1) |
| Pro      | #f59e0b    | rgba(245,158,11,0.1) |

### Status indicators

| Status       | Visual                        |
|--------------|-------------------------------|
| Disponível   | Dot verde + "Disponível"      |
| Em breve     | Amber badge "Em breve"        |
| Beta         | Violet badge "Beta"           |
| Deprecated   | Cinza + aviso visível         |

### Card states

```
default     → border: #161a26
hover       → border: #23293b, translateY(-2px), shadow
selected    → border: indigo 40%, glow sutil
disabled    → opacity 0.5
featured    → gradient bg, indigo border glow
```

---

## 07. Busca e Descoberta

### 7.1 Escopo da busca no Marketplace

```
Search query
↓
name
description
author
stacks[]
capabilities[]
modules[]
category
domain
```

### 7.2 Busca global (Cmd+K) inclui Marketplace

```
GlobalSearch
├── Projects
├── Missions
├── ...
└── Marketplace        ← agentes, packs, templates, help
```

### 7.3 Filtros

```
Categoria:     Todos | Agentes | Stack Packs | Templates | Capabilities | Integrações
Plano:         Todos | Grátis | Basic+ | Advanced+ | Pro
Status:        Todos | Disponível | Em breve
Oficial:       Todos | LDCN Core | Community
Avaliação:     Todos | 4.5+ | 4.0+ | 3.5+
```

### 7.4 Ordenação

```
Relevância (default)
Mais usados (missions / installs)
Mais bem avaliados
Mais recentes
Ordem alfabética
```

### 7.5 Seções editoriais

```
Em destaque
Top Rated
Recém adicionados
Recomendados para o seu stack
Popular no Brasil 🇧🇷
```

### 7.6 Indexação localizada

Busca deve reconhecer sinônimos localizados:

```
"agente" ≈ "agent"
"modelo" ≈ "template"
"capacidade" ≈ "capability"
"integração" ≈ "integration"
```

---

## 08. Sistema de Avaliação e Reviews

### 8.1 Rating

- Escala: 1 a 5 estrelas
- Calculado como média ponderada (reviews verificadas pesam mais)
- Mostrado apenas quando `reviewCount >= 5`
- Abaixo de 5 reviews: mostrar "Novo"

### 8.2 Review verificada

Uma review é "verificada" quando:

```
reviewer usou o item em pelo menos 1 missão concluída
↓
status: verified = true
↓
peso maior no cálculo de rating
```

### 8.3 Display

```
★ 4.9                    (rating)
1.2k avaliações           (count)
8.4k missões usadas       (usage signal)
```

### 8.4 Regras de review

- Uma review por listing por workspace
- Mínimo 1 missão concluída usando o item
- Review pode ser editada
- Reviews podem ser marcadas como "útil"
- Moderação de reviews: filtro automático + reporte manual

---

## 09. Planos e Controle de Acesso

### 9.1 Modelo

```
PlanTier
├── free     → acesso a itens "free" apenas
├── basic    → free + basic
├── advanced → free + basic + advanced
└── pro      → todos
```

### 9.2 Experiência de item bloqueado

```
┌─────────────────────────────┐
│ Go Microservices Architect  │
│ 🔒 Pro                      │
│                             │
│ Este agente requer plano    │
│ Pro ou superior.            │
│                             │
│ [Ver planos]                │
└─────────────────────────────┘
```

Nunca esconder item bloqueado completamente.
Mostrar com lock + explicação + upgrade path.

### 9.3 LLM Wall no Marketplace

Itens que requerem modelos de LLM específicos mostram:

```
Modelos necessários:
[GPT-4o ✓] [Claude Opus 🔒 Pro]
```

### 9.4 Trial

Usuários em Free Trial têm acesso temporário a itens Advanced+.
Após trial, itens instalados ficam desativados (não removidos).
Mensagem clara ao usar item premium em trial.

---

## 10. Publisher Experience

> Fase 2 — não obrigatório para MVP.

### 10.1 Publicar item

```
Publisher Portal
↓
Tipo de item
↓
Formulário: nome, descrição, stacks, capabilities, versão
↓
Upload: spec JSON / YAML do agente ou pack
↓
Preview
↓
Submeter para revisão
↓
Status: IN_REVIEW
↓
Aprovado → ACTIVE
```

### 10.2 Analytics do publisher

```
PublisherDashboard {
  totalInstalls
  activeInstalls
  missionsUsed
  averageRating
  reviewCount
  installsByPlan
  installsOverTime
  topRegions
}
```

### 10.3 Versionamento

- Publishers lançam versões semânticas (ex: 1.3.0)
- Major: mudanças de interface/contrato
- Minor: novas capabilities
- Patch: bug fixes, docs

- Workspaces recebem notificação de atualização disponível
- Opção de auto-update ou atualização manual
- Rollback disponível

---

## 11. Integração com Platform API

### 11.1 Query surface

```
GET /api/v1/marketplace/listings
  ?category=agents
  ?plan=basic,advanced
  ?search=java
  ?featured=true
  ?limit=20
  ?offset=0

GET /api/v1/marketplace/listings/:id
GET /api/v1/marketplace/listings/:id/reviews
GET /api/v1/marketplace/categories
GET /api/v1/marketplace/workspace/installed
GET /api/v1/marketplace/workspace/watchlist
```

### 11.2 Command surface

```
POST /api/v1/marketplace/workspace/install
  { listingId }

DELETE /api/v1/marketplace/workspace/install/:listingId

POST /api/v1/marketplace/workspace/watchlist
  { listingId }

DELETE /api/v1/marketplace/workspace/watchlist/:listingId

POST /api/v1/marketplace/listings/:id/reviews
  { rating, title, body }
```

### 11.3 Modelo de resposta paginado

```typescript
interface MarketplaceListingsResponse {
  items: MarketplaceListing[]
  total: number
  page: number
  pageSize: number
  filters: AppliedFilters
}
```

### 11.4 Read Models

```
MarketplaceOverview {
  categories[]
  featured[]
  recentlyAdded[]
  topRated[]
  recommendedForWorkspace[]
  installedCount
}

MarketplaceListingDetail {
  listing
  reviews[]
  relatedListings[]
  isInstalled
  isWatchlisted
  userReview?
}
```

### 11.5 Locale

Marketplace suporta conteúdo localizado.

```
GET /api/v1/marketplace/listings?locale=pt-BR
```

Campos localizados: name, description, longDescription, changelog

---

## 12. Moderação e Qualidade

### 12.1 Critérios de aprovação (Community items)

```
□ Documentação completa (description, longDescription)
□ Versão semântica definida
□ Stacks e capabilities declaradas corretamente
□ Compatibilidade verificada
□ Sem comportamento malicioso ou exfiltração de dados
□ Sem instrução de bypass de políticas do LDCN
□ Changelog presente na versão
□ Categoria correta
□ Screensots/demos opcionais mas recomendados
```

### 12.2 Política de remoção

Items podem ser removidos se:
- Violam políticas de segurança
- Recebem excesso de reviews negativas verificadas
- Publisher solicita remoção
- Incompatibilidade crítica detectada após update de plataforma

### 12.3 Badge de qualidade

Items LDCN Core ganham badge automático.
Items Community podem ganhar badges por:
- `Top Rated` → rating >= 4.7 e reviews >= 100
- `Community Favorite` → installs >= 1000 em 90 dias
- `Trending` → crescimento de installs em 7 dias

---

## 13. Analytics para Publishers

> Fase 2.

```
InstallEventLog {
  listingId
  workspaceId
  planTier
  locale
  installedAt
}

UsageEventLog {
  listingId
  missionId
  usedAt
  outcome   // SUCCESS | FAILURE
}
```

Dashboard para publisher:

```
Total instalações: 12,043
Instalações ativas: 8,231
Missões que usaram: 45,891

Por plano:
  Basic   42%
  Advanced 31%
  Pro     27%

Por região:
  BR  58%
  US  21%
  Other 21%

Avaliação média: 4.9 / 5.0
```

---

## 14. Implementação Angular

### 14.1 Feature structure

```
features/marketplace/
├── marketplace.routes.ts
├── services/
│   ├── marketplace-catalog.service.ts
│   ├── marketplace-install.service.ts
│   └── marketplace-search.service.ts
├── facades/
│   └── marketplace.facade.ts
├── components/
│   ├── marketplace-shell/
│   ├── category-tabs/
│   ├── search-bar/
│   ├── filter-bar/
│   ├── featured-card/
│   ├── item-card/
│   ├── detail-panel/
│   ├── plan-badge/
│   ├── capability-ring/
│   ├── status-badge/
│   └── empty-state/
├── models/
│   ├── listing.model.ts
│   ├── review.model.ts
│   └── plan.model.ts
└── i18n/
    ├── pt-BR/marketplace.json
    ├── en/marketplace.json
    ├── es/marketplace.json
    └── fr/marketplace.json
```

### 14.2 Routes

```typescript
{
  path: 'marketplace',
  component: MarketplaceShellComponent,
  children: [
    { path: '', redirectTo: 'agents', pathMatch: 'full' },
    { path: 'agents', component: AgentsCatalogComponent },
    { path: 'stacks', component: StacksCatalogComponent },
    { path: 'templates', component: TemplatesCatalogComponent },
    { path: 'capabilities', component: CapabilitiesCatalogComponent },
    { path: 'integrations', component: IntegrationsCatalogComponent },
    { path: ':category/:id', component: ListingDetailComponent },
  ]
}
```

### 14.3 Signals pattern

```typescript
// marketplace.facade.ts
export class MarketplaceFacade {
  readonly listings = signal<MarketplaceListing[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly selectedItem = signal<MarketplaceListing | null>(null);
  readonly searchQuery = signal('');
  readonly planFilter = signal<PlanTier | 'all'>('all');
  readonly activeCategory = signal<MarketplaceCategory>('agents');

  readonly filtered = computed(() =>
    this.listings().filter(i => this.matchesFilters(i))
  );
  
  readonly featured = computed(() =>
    this.filtered().find(i => i.featured) ?? null
  );
}
```

### 14.4 CapabilityRing component

```typescript
// SVG ring showing 8 capability domains
// Input: capabilities: string[]
// Output: SVG com pontos preenchidos/vazios por domínio
// Size: configurável (default 44px card, 64px drawer, 80px featured)
```

---

## 15. Integração Backend

### 15.1 Catalog Service

```
CatalogService {
  getListings(query, filters, locale)
  getListingById(id, locale)
  getFeatured(category, locale)
  getRecommended(workspaceId, locale)
  search(query, filters, locale)
}
```

### 15.2 Install Service

```
InstallService {
  install(workspaceId, listingId)
  uninstall(workspaceId, listingId)
  getInstalled(workspaceId)
  addToWatchlist(userId, listingId)
  removeFromWatchlist(userId, listingId)
  getWatchlist(userId)
}
```

### 15.3 Acoplamento com Generator

Quando o Generator compõe um team:

```
Generator
↓
CatalogService.getAgentById(id)
↓
AgentCapabilityManifest {
  agentId
  stacks[]
  capabilities[]
  allowedTools[]
  territory
  planRequired
}
↓
Generator usa manifest para roteamento e composição
```

O Generator nunca chama o Marketplace diretamente — passa pelo Platform Core.

---

## 16. Internacionalização

### 16.1 Strings do Marketplace

Arquivo: `marketplace.json` por locale

```json
{
  "marketplace.title": "Marketplace",
  "marketplace.subtitle": "Agentes, packs e extensões para suas missões",
  "marketplace.search.placeholder": "Buscar agentes, stacks, templates...",
  "marketplace.filter.plan.all": "Todos",
  "marketplace.filter.plan.free": "Grátis",
  "marketplace.section.featured": "Em destaque",
  "marketplace.section.all": "Todos",
  "marketplace.plan.required": "Requer plano {{plan}} ou superior",
  "marketplace.status.available": "Disponível",
  "marketplace.status.coming_soon": "Em breve",
  "marketplace.action.add": "Adicionar ao Workspace",
  "marketplace.action.notify": "Notificar quando disponível",
  "marketplace.action.view_plans": "Ver planos",
  "marketplace.label.missions": "missões",
  "marketplace.label.installs": "instalações",
  "marketplace.label.reviews": "avaliações",
  "marketplace.label.new": "Novo"
}
```

### 16.2 Conteúdo localizado de listings

```typescript
interface LocalizedContent {
  locale: string
  name: string
  description: string
  longDescription?: string
}

// Agent com conteúdo localizado:
{
  id: "java-backend",
  localizedContent: {
    "pt-BR": { name: "Java Backend Engineer", description: "..." },
    "en":    { name: "Java Backend Engineer", description: "..." },
    "es":    { name: "Java Backend Engineer", description: "..." },
    "fr":    { name: "Java Backend Engineer", description: "..." },
  }
}
```

---

## 17. Definition of Done

### MVP (Fase Inicial — catálogo visual)

```
□ 5 categorias navegáveis
□ Search funcional por texto
□ Filtro por plano
□ Card grid responsivo
□ Featured card para cada categoria
□ Detail panel lateral
□ Plan badges corretos
□ Capability ring visual nos agent cards
□ Status badges (Disponível / Em breve)
□ "Adicionar ao Workspace" (ação registrada)
□ "Notificar quando disponível" (watchlist)
□ i18n: PT-BR, EN, ES, FR
□ Responsive: 375px, 768px, 1280px
□ Acessível: WCAG AA
□ Empty state para busca sem resultado
□ Loading skeleton
□ Integrado ao Global Search (Cmd+K)
```

### Fase 2 (Completo)

```
□ Integração real com Catalog API
□ Ratings e reviews reais
□ Publisher portal
□ Analytics para publishers
□ Versionamento de itens
□ Watchlist com notificação real
□ Recomendações personalizadas
□ Conteúdo localizado por locale via API
□ Acoplamento com Generator (agent manifests)
□ OAuth flow para integrações (GitHub)
□ E2E tests nos 4 idiomas
□ Visual regression nos 4 idiomas
```

### Acceptance final

```
item não listado = não existe para o usuário
item locked mostra razão e upgrade path
item coming_soon tem watchlist funcional
busca é permission-aware
plan filter correto
capability ring legível e preciso
detail panel fecha com ESC
adicionar item confirma com feedback visual
marketplace acessível via Command Palette
marketplace acessível via Global Search
```

---

> Regra final do Marketplace
> 
> O Marketplace torna o LDCN OS extensível sem quebrar o Brain Service.
> Novos agentes, packs e capabilities entram pela porta do Catalog.
> O Generator os usa. A plataforma os governa. O usuário os descobre aqui.
