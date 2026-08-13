# LDCN Gerador Inteligente

> **Sistema de decisão, composição, roteamento, comutação, replanejamento e aprendizado para execução de software por agentes.**

Este repositório contém a documentação canônica do **Gerador Inteligente**, o cérebro de decisão do LDCN OS. A documentação está organizada como um vault do Obsidian, com notas interligadas por wikilinks (`[[...]]`) e um grafo navegável.

---

## 🧠 O que é

O Gerador Inteligente responde a uma ideia do usuário e a transforma em uma solução executável, roteada entre agentes especializados:

1. O que o usuário quer?
2. O que precisa existir?
3. O que **não** precisa existir?
4. Qual stack combina melhor?
5. Qual arquitetura é adequada?
6. Qual Team pertence à Mission?
7. Qual Team executa este Job?
8. Quando trocar de Team?
9. Quando fazer handoff?
10. Quando executar, bloquear ou replanejar?
11. Como aprender com o resultado?

> **Regra central:** LLM propõe; contrato limita; gate prova.

---

## 📁 Estrutura do repositório

```text
ldcn-final/
├── README.md                              ← este arquivo
├── package.json                           ← npm workspaces (core, apps/api)
├── core/                                  ← implementação do core de decisão (Gerador Inteligente)
│   ├── src/
│   │   ├── domain/                        ← entidades e contratos
│   │   ├── services/                      ← serviços de cada camada
│   │   ├── policies/                      ← políticas de escopo e aprovação
│   │   ├── registry/                      ← catálogo de stacks
│   │   ├── adapters/                      ← transporte HTTP framework-neutral
│   │   ├── __tests__/                     ← testes unitários
│   │   └── generator.ts                   ← orquestração do fluxo principal
│   ├── package.json
│   ├── tsconfig.json
│   └── jest.config.js
├── apps/
│   └── api/                               ← Platform API (NestJS) — wrapper HTTP/Prisma sobre core/
│       ├── src/
│       │   ├── generator/                 ← controller + service do fluxo do Gerador
│       │   ├── runtime/                   ← overview operacional (RuntimeApiController)
│       │   ├── persistence/               ← adapters Prisma (hydrate → core síncrono → flush)
│       │   └── security/                  ← API key guard + filtro de erro
│       └── test/                          ← e2e (supertest) contra Postgres real
├── infra/
│   ├── docker-compose.yml                 ← Postgres local
│   └── prisma/
│       └── schema.prisma                  ← schema Platform (DecisionEvent, GenerationResult, ...)
└── LDCN_OS_Gerador_Backend_Integrado_Obsidian/   ← vault do Obsidian (38 documentos, 00–37)
    ├── 00 - LDCN OS - Gerador + Backend - Mapa Raiz.md
    ├── 01 - Constituição e Visão Geral.md
    ├── ...
    ├── 36 - Backend Completo - Platform Core + Brain Service.md
    ├── 37 - Arquitetura Integrada - Gerador + Backend.md
    └── README.md
```

---

## 🚀 Como usar

### No Obsidian

1. Copie a pasta `LDCN_OS_Gerador_Backend_Integrado_Obsidian` para dentro do seu vault.
2. Abra `00 - LDCN OS - Gerador + Backend - Mapa Raiz`.
3. Navegue pelos links `[[...]]`.
4. Use o **Graph View** do Obsidian para visualizar as relações entre as camadas.

> Não renomeie os arquivos sem atualizar os wikilinks.

### No navegador de arquivos

- Comece por [`LDCN_OS_Gerador_Backend_Integrado_Obsidian/00 - LDCN OS - Gerador + Backend - Mapa Raiz.md`](./LDCN_OS_Gerador_Backend_Integrado_Obsidian/00%20-%20LDCN%20OS%20-%20Gerador%20%2B%20Backend%20-%20Mapa%20Raiz.md).
- Leia [`01 - Constituição e Visão Geral.md`](./LDCN_OS_Gerador_Backend_Integrado_Obsidian/01%20-%20Constituição%20e%20Visão%20Geral.md) para entender as regras fundamentais.
- Consulte [`28 - Decisão Final de Arquitetura.md`](./LDCN_OS_Gerador_Backend_Integrado_Obsidian/28%20-%20Decisão%20Final%20de%20Arquitetura.md) para o resumo da divisão de autoridade.
- Consulte [`37 - Arquitetura Integrada - Gerador + Backend.md`](./LDCN_OS_Gerador_Backend_Integrado_Obsidian/37%20-%20Arquitetura%20Integrada%20-%20Gerador%20%2B%20Backend.md) para a ponte entre o Gerador e o Backend Platform Core + Brain Service.

### Rodando o core de decisão

O diretório [`core/`](./core) contém a primeira implementação executável do fluxo principal:

```text
IDEIA → ProjectIntent → RequirementsContract → SolutionTopology
→ SolutionProposal → StackSelectionProposal → ApprovedSolution
```

```bash
cd core
npm install
npm test       # executa os testes unitários
npm run build  # compila TypeScript
```

Exemplo de uso:

```ts
import { Generator } from './src/generator';

const generator = new Generator({ mode: 'AUTO' });
const result = generator.generate({
  missionId: 'mission-001',
  rawUserIdea: 'Quero uma plataforma para gerenciar tarefas com login e dashboard.',
});

console.log(result.approvedSolution.selectedStacks);
```

---

## 🧭 Fluxo principal

```text
IDEIA
↓
Intent Understanding
↓
Requirements Intelligence
↓
Solution Topology
↓
Solution Planning
↓
Technology Selection
↓
Approved Solution
↓
Architecture Composition
↓
TeamComposer V2
↓
Dynamic Pipeline Composer
↓
Job Classification
↓
Intelligent Work Router
↓
Execution Runtime
↓
Review Gates e Repair
↓
Learning Intelligence
```

---

## 🏛️ Regras fundamentais

- **Regra de produto:** primeiro entender o problema; depois decidir o que precisa existir; depois escolher como construir; só então montar os agentes e executar.
- **Regra de escopo:** nenhum backend, frontend, mobile, data layer, AI layer ou integração pode ser criado se não estiver na `ApprovedSolution`.
- **Regra de time:** a Mission define quais Teams podem existir; o Gerador Inteligente decide, Job por Job, qual Team e quais agentes atuam.
- **Regra de arquitetura:** cada stack possui seu próprio cérebro técnico.
- **Regra de execução:** o Gerador Inteligente decide e roteia; os runtimes existentes executam.
- **Regra de aprendizado:** ML recomenda e aprende; policies determinísticas autorizam.
- **Regra de memória:** persistir decisões, contratos, evidências, snapshots, outcomes e resumos; nunca persistir chain-of-thought.

---

## 🏢 Empresa de Agentes

A arquitetura é organizada como uma empresa virtual de agentes:

```text
User / Requirements        → define intenção e constraints
Gerador Inteligente        → decide solução, stacks, times, routing e handoffs
Stack Architects           → decidem arquitetura interna das stacks
TeamComposer               → define Mission Team
IntelligentWorkRouter      → define Job Team
TeamSwitchResolver         → define comutação e handoff
Existing AgentExecution    → executa
Build / Test               → produz evidence
Review                     → verifica
Gate                       → prova
Repair Runtime             → recupera falhas elegíveis
Learning Intelligence      → aprende com outcomes
```

A empresa completa existe no catálogo. A `ApprovedSolution` define quais departamentos podem existir na Mission.

---

## ⚠️ O que o Gerador Inteligente NÃO é

- Não é um único agente.
- Não é um único prompt.
- Não é um workflow engine gigante.
- Não é um code generator solto.
- Não é um orquestrador browser-side.
- Não substitui AgentExecution, Review/Gate nem Repair Runtime.

---

## 📚 Documentos-chave

| Documento | Descrição |
|-----------|-----------|
| [`00 - LDCN OS - Gerador + Backend - Mapa Raiz.md`](./LDCN_OS_Gerador_Backend_Integrado_Obsidian/00%20-%20LDCN%20OS%20-%20Gerador%20%2B%20Backend%20-%20Mapa%20Raiz.md) | Ponto de entrada e índice canônico |
| [`01 - Constituição e Visão Geral.md`](./LDCN_OS_Gerador_Backend_Integrado_Obsidian/01%20-%20Constituição%20e%20Visão%20Geral.md) | Regras fundamentais e fluxo completo |
| [`07 - Stack Registry e Team Catalog.md`](./LDCN_OS_Gerador_Backend_Integrado_Obsidian/07%20-%20Stack%20Registry%20e%20Team%20Catalog.md) | Catálogo de stacks e times |
| [`09 - Approved Solution.md`](./LDCN_OS_Gerador_Backend_Integrado_Obsidian/09%20-%20Approved%20Solution.md) | Fronteira oficial de escopo |
| [`23 - Backend NestJS APIs e Persistência.md`](./LDCN_OS_Gerador_Backend_Integrado_Obsidian/23%20-%20Backend%20NestJS%20APIs%20e%20Persistência.md) | Application services e endpoints implementados em `apps/api` |
| [`28 - Decisão Final de Arquitetura.md`](./LDCN_OS_Gerador_Backend_Integrado_Obsidian/28%20-%20Decisão%20Final%20de%20Arquitetura.md) | Resumo da divisão de autoridade |
| [`29 - Empresa de Agentes - Times Stacks e Prompts.md`](./LDCN_OS_Gerador_Backend_Integrado_Obsidian/29%20-%20Empresa%20de%20Agentes%20-%20Times%20Stacks%20e%20Prompts.md) | Visão organizacional completa |
| [`34 - Guardrails de Readiness e Correção da Implementação.md`](./LDCN_OS_Gerador_Backend_Integrado_Obsidian/34%20-%20Guardrails%20de%20Readiness%20e%20Correção%20da%20Implementação.md) | Bug da landing page vazia (corrigido) e invariantes obrigatórios |
| [`36 - Backend Completo - Platform Core + Brain Service.md`](./LDCN_OS_Gerador_Backend_Integrado_Obsidian/36%20-%20Backend%20Completo%20-%20Platform%20Core%20%2B%20Brain%20Service.md) | Arquitetura completa do backend e roadmap de slices (B0–B10) |

---

## 🛠️ Status

- Documentação canônica em evolução no Obsidian vault.
- **Core de decisão implementado em `core/`** cobrindo:
  - Intent Understanding → Requirements Intelligence → Solution Topology → Solution Planning → Technology Selection → **ApprovedSolution** (docs 02–09);
  - **Architecture Composition** (doc 08): `StackArchitect`, `ArchitectureComposer`, `ArchitectureConflictDetector`, `ArchitectureValidator`;
  - **TeamComposer V2** (doc 10): `TeamComposer` monta a `AgentTeam` por tier de complexidade (LOW/MEDIUM/HIGH), com especialistas condicionais e Integration Unit somente quando há integração real; `TeamValidator` aprova e versiona, aplicando a regra "Reviewer != executor".
  - **Dynamic Pipeline Composer** (doc 11): `PipelineComposer` deriva um plano declarativo por stack, encadeia build/test/review/gate/promotion, adiciona validação cross-stack quando necessária e bloqueia runtimes sem suporte.
  - Job Classification, Intelligent Work Router, Team Switching, Handoffs, Scope Expansion, Learning Intelligence, Context Budgeting, Governance, Replanning, Observability, Decision Events, read models da aplicação, contexto mínimo, dispatcher de execução persistível, sincronização de status externo, guard de território/ferramentas, avaliação persistível de Review Gates, FailureSnapshot, Repair Advisory, Repair Eligibility, auditoria do lifecycle de execução, gravação de outcomes e coordenador de runtime;
  - 192 testes unitários passando (`npm test`), build TypeScript limpo (`npm run build`), com validação de política de tentativas, limite no dispatch e na elegibilidade de repair, política de retry pós-repair, métricas operacionais por missão, cenário end-to-end de recuperação, validação do runtime port, idempotência do fluxo FailureSnapshot → RepairAdvisory, proteção cross-mission, sanitização de credenciais e omissão de reasoning privado no audit trail, e o guardrail do doc 34 (Executable Mission nunca aprova com zero stacks/team/pipeline).
- **API NestJS + Prisma/PostgreSQL implementada em `apps/api`** (Slices 1–3 do backend, ver doc 36 §104 no vault `LDCN_OS_Gerador_Backend_Integrado_Obsidian/`): wrapper HTTP fino sobre os serviços já testados de `core/`, com persistência real em Postgres via um adapter "hydrate → roda o core síncrono → flush" (`apps/api/src/persistence/mission-persistence.service.ts`) — necessário porque as interfaces/serviços do `core/` são síncronos e o Prisma é assíncrono.
  - **Gerador** (`IntelligentGeneratorCommandService`/`IntelligentGeneratorQueryService`): `POST /missions/:id/intelligent-generator/start` e as leituras (`GET /missions/:id/intelligent-generator[...]`), persistindo `DecisionEvent`, `GenerationResult` e `GeneratorMissionState`.
  - **Routing** (`JobClassifier`/`IntelligentWorkRouter`/`TeamSwitchResolver`, doc 27 Slice 2): `POST /missions/:id/tasks/:taskId/intelligent-routing/classify`, `/route`, `/switch-team`, `GET .../intelligent-routing` e `.../handoffs`. Como esses três serviços não recebem repositório injetável (só Map interno), a idempotência/staleness (`ROUTING_DECISION_STALE`, `TEAM_SWITCH_CONTEXT_STALE`) é replicada na camada Postgres em `routing-persistence.service.ts`, comparando o `contextHash` de um cálculo fresco contra o que já foi persistido.
  - **Contrato para o Frontend Premium** (docs 36 §§67-71 e 42, Slice 3): `POST .../start` agora segue o Operation pattern do doc 42 §3 — responde `202 { operationId, missionId, status }` em vez do resultado completo, e o cliente acompanha via `GET /operations/:operationId` ou o stream. `GET /stream` (SSE, `@Sse()`) emite `operation.started/completed/failed`, `mission.state.changed`, `team.composed`, `pipeline.updated` via um `EventBusService` (RxJS `Subject`, só em memória — sem Redis/multi-instância ainda). `GET /missions/:id/overview` é o `MissionOverviewReadModel` composto do doc 36 §70 (intent/requirements/topology/solution/architecture/team/pipeline summaries + `nextAction` + `blockers`); os campos de execução/artifacts/reviews/gates/AI usage ficam `null` até essas slices existirem. **Nota:** hoje `generate()` não tem I/O de LLM, então a Operation já nasce `SUCCEEDED`/`FAILED` antes da resposta 202 voltar — o contrato (operationId, polling, eventos SSE) é o mesmo que vai valer quando execução assíncrona de verdade existir, só que sem latência real por enquanto. Erros de conflito (`GENERATOR_COMMAND_CONFLICT`) continuam voltando como 4xx síncrono, não como uma Operation `FAILED` silenciosa.
  - **Operações do gerador** (`RuntimeController`, pré-existente): `GET /missions/:id/operations[...]` delegando para `RuntimeApiController` (overview de runtime tasks/repair) — não confundir com o `Operation` do parágrafo acima (`GET /operations/:operationId`), que é o envelope assíncrono de um comando; são dois conceitos com nome parecido por coincidência de terminologia do doc 36.
  - Guard de API key (lido de `infra/.env` via `dotenv`, carregado automaticamente por `main.ts`; aceita `?apiKey=` também, já que `EventSource` do browser não permite headers customizados) + filtro de erro global. Testado com Postgres real (unit + e2e, incluindo SSE real via HTTP e o cenário `BLOCKED_NO_REVIEWER` de negócio real, não só o caminho feliz).
  - **Como rodar:** `npm install` na raiz → `docker compose -f infra/docker-compose.yml up -d` → `npx prisma migrate dev --schema infra/prisma/schema.prisma` → `npm run start:dev -w apps/api` (lê `DATABASE_URL`/`LDCN_API_KEY` de `infra/.env` automaticamente).
  - **Fora de escopo ainda** (próximas rodadas, seguindo os slices B3–B10 do doc 36): app `apps/brain` separado, auth/tenancy real, execution runtime (artifacts/workspace/tools), Review/Gate/Repair/Promotion como API, comandos incrementais por etapa do gerador, bootstrap do catálogo de stacks/agentes, cost/AI usage tracking.
- ML externo permanece posterior e em shadow mode — ver [`27 - Slices Prompts Codex e Roadmap.md`](./LDCN_OS_Gerador_Backend_Integrado_Obsidian/27%20-%20Slices%20Prompts%20Codex%20e%20Roadmap.md).
- **Frontend Premium — Slice F0 (Foundation) implementada em `apps/web`** (Angular, ver docs 38-44 no vault `LDCN_OS_Completo_Multilingual_FR_BR_ES_EN_Obsidian/`, roadmap F0-F10 no doc 44): primeira app Angular do repositório, escopo estritamente o que o "Prompt Codex — Frontend foundation" do doc 44 pede — sem wizard completo, sem orquestração no browser, sem Marketplace/Billing.
  - **Versão:** Angular 22 (última estável), não a "18" citada no doc — projeto novo começando hoje, sem razão para já nascer defasado. Standalone components (sem `NgModule`), Signals para estado local, **sem NgRx** (doc 40 diz explicitamente não ser obrigatório).
  - **Estrutura** (doc 40 §1): `core/` (api, auth, sse, errors, i18n, theme), `shell/` (app-shell, sidebar, topbar), `features/` (home, login), `shared/ui/` (button, empty-state).
  - **API client tipado** (doc 40 §5): `ApiClient` central + `MissionClient`/`GeneratorClient`/`OperationClient` — só os três necessários para provar a forma; os demais entram quando as features que os usam existirem. DTOs próprios do frontend (doc 40 §6), nunca os tipos internos do `core/`/`apps/api`.
  - **SSE** (`EventStreamService`, doc 40 §11): conecta em `GET /stream` já no shell (`?apiKey=` como fallback, já que `EventSource` não permite headers customizados). Nenhuma feature ainda reage a `events$` — isso é F3 (Command Center).
  - **i18n:** `TranslationService` baseado em `signal()` + dicionários JSON (`pt-BR`/`en`/`es`/`fr`), troca em runtime sem rebuild — deliberadamente não `@angular/localize` (que compila um bundle por idioma, desnecessário nesta fase). PT-BR/EN/ES/FR são detectados do browser ou persistidos em `localStorage`.
  - **Auth shell:** o backend ainda não tem auth/tenancy real (só API key global). `AuthService` + rota `/login` são só a *forma* — guardam a API key, não autenticam de verdade. `authGuard` protege as rotas do shell.
  - **Erros:** `HttpInterceptor` global (doc 40 §10) mapeando 401/403/409/429/5xx para mensagens localizadas; 401 desloga automaticamente.
  - **Testado:** `ng build` limpo, 16 testes unitários (Vitest, runner padrão do Angular 22) cobrindo `ThemeService`, `TranslationService`, `AuthService`, `mapHttpError`. `ng serve` verificado servindo `/` e `/login` com o bundle correto.
  - **Limitação conhecida:** sem ferramenta de browser/screenshot neste ambiente — build/testes/roteamento foram verificados, mas a qualidade visual ("premium") ainda não foi revisada visualmente por ninguém. Recomendo `npm run start -w apps/web` + abrir `http://localhost:4200` antes de dar como pronta.
  - **Como rodar:** `npm install` na raiz → `npm run start -w apps/web` (porta 4200; a app espera o backend em `http://127.0.0.1:3000`, então rode `apps/api` também para o login/SSE funcionarem de verdade).
  - **Fora de escopo desta slice** (F1-F10 do doc 44): Workspace/Projects, Mission Wizard, Command Center reagindo a SSE, Architecture/Team/Pipeline viewers, Execution/Artifacts, Review/Gates/Repair, AI Decision Inspector, Marketplace/Billing, polish de acessibilidade/responsividade/performance.
