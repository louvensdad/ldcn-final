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
  - 194 testes unitários passando (`npm test`), build TypeScript limpo (`npm run build`), com validação de política de tentativas, limite no dispatch e na elegibilidade de repair, política de retry pós-repair, métricas operacionais por missão, cenário end-to-end de recuperação, validação do runtime port, idempotência do fluxo FailureSnapshot → RepairAdvisory, proteção cross-mission, sanitização de credenciais e omissão de reasoning privado no audit trail, e o guardrail do doc 34 (Executable Mission nunca aprova com zero stacks/team/pipeline).
  - **Bug real encontrado pelo usuário testando o frontend (Slice F3), corrigido em duas partes:** a ideia "eu quero um **lading** page" (typo de "landing") reabriu a violação do doc 34 — `READY_FOR_EXECUTION`/`START_EXECUTION` com `approvedStackCount=0`/`pipelineNodeCount=0`. A correção original só cobria a frase exata "landing page" no `topology-resolver.ts`; qualquer frase que a IntentAnalyzer não conseguisse mapear pra um `DeliveryTarget` (typo, outra linguagem, ideia genuinamente vaga) escapava por baixo.
    1. **Read model** (`IntelligentGeneratorQueryService#getGeneratorOverview`): agora reporta `SOLUTION_SELECTION_REQUIRED`/`RESOLVE_SOLUTION_SELECTION` sempre que `selectedStacks.length === 0 || pipeline.nodes.length === 0`, independente do motivo. Computado na leitura, então já vale pra missões antigas sem migração.
    2. **Máquina de estados** (`IntelligentGeneratorCommandService#generate`, campo `advanceState`): tinha o mesmo bug numa função diferente — só olhava `governance.allowed` (que continua `true` mesmo com solução vazia) pra decidir gravar `READY_FOR_EXECUTION` vs `BLOCKED` em `GeneratorMissionState`. Corrigido pra também exigir `selectedStacks.length > 0 && pipeline.nodes.length > 0`. **Diferente do read model, esse campo é gravado uma vez em `generate()` e não recalculado depois** — missões criadas antes do fix mantêm o `generatorState` antigo (o `nextAction` delas já está certo, computado na leitura; só o Stage Rail do frontend, que lê `generatorState`, é que fica desatualizado pra elas). Missões novas já saem corretas.
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
  - **Testado:** `ng build` limpo, 16 testes unitários (Vitest, runner padrão do Angular 22) cobrindo `ThemeService`, `TranslationService`, `AuthService`, `mapHttpError`. `ng serve` verificado servindo `/` e `/login` com o bundle correto, e **confirmado visualmente pelo usuário** (shell, tema, i18n, SSE `CONNECTED` de verdade contra o backend real).
  - **Como rodar:** `npm install` na raiz → `npm run start -w apps/web` (porta 4200; a app espera o backend em `http://127.0.0.1:3000`, então rode `apps/api` também para o login/SSE funcionarem de verdade).
- **Frontend Premium — Slice F1 (Workspace) implementada em `apps/web`**: lista de missões + criar nova missão. `Projects`/`Workspace switcher` do doc 44 ficaram fora — pressupõem multi-tenancy que o backend não tem; frontend não inventa essa camada (regra do doc 42 §11/§13).
  - **Gap de backend fechado:** não existia endpoint para *listar* missões (só `GET /missions/:id/overview`, uma de cada vez). Novo `GET /missions` (`apps/api/src/overview/missions.controller.ts` + `OverviewService#listMissions`) consulta `GeneratorMissionState` (já persistida pela Slice 1, nenhum model novo) e enriquece cada linha via `getOverview()` existente — sem paginação real ainda, só `?limit=`.
  - **Frontend:** `MissionClient.list()`, `features/workspace/` (usa `resource()` do Angular 22 para carregar a lista). `Home` agora compõe `<app-workspace />` no lugar do placeholder fixo. O botão "Nova missão" navega para `/wizard` (Slice F2, abaixo) — não há mais um diálogo de criação separado.
  - **Testado:** unit (backend: `listMissions()` com Postgres real; frontend: `MissionClient` com `HttpTestingController`, `WorkspaceComponent` com estado vazio e com missões) + e2e (`GET /missions` reflete uma missão recém-criada) + smoke manual via curl confirmando o fluxo criar→listar de ponta a ponta com o backend restartado na build nova.
- **Frontend Premium — Slice F2 (Mission Wizard) implementada em `apps/web`**: `features/wizard/`, rota `/wizard`. O doc 44 descreve etapas com gate de aprovação real entre elas (Idea→Intent→Requirements→Topology→Solution→**Approval**, e o doc 42 §2 lista comandos separados pra isso). O backend não suporta isso — `Generator.generate()`/`POST .../start` são atômicos, sem pausa entre estágios. Perguntado, optamos pelo **wizard de revisão**: coleta o input (ideia + seção avançada opcional: preferências tecnológicas, targets proibidos, restrições) numa tela só, chama `start()`, e mostra o resultado como um recap navegável organizado pelas mesmas seções do doc — a seção final "Resultado" mostra `nextAction`/`blockers` como o backend realmente decidiu, sem fingir um botão de aprovação que não aprova nada. O diálogo de criação simples da Slice F1 foi retirado (superado pelo wizard, que cobre o mesmo caso mais os campos avançados).
  - **Testado:** 5 testes unitários novos do `WizardComponent` (submit chama `start()` com os campos certos, transição pro recap no sucesso, erro mapeado mantém no formulário, listas separadas por vírgula e checkboxes de target viram os arrays certos no payload) + `ng build` limpo com o chunk `wizard` lazy-loaded separado.
- **Frontend Premium — Slice F3 (Command Center) implementada em `apps/web`**: `features/mission-detail/`, rota `/missions/:missionId`. Ao contrário das slices anteriores, é **só frontend** — `MissionClient.getOverview()` já devolvia tudo que essa tela precisa, nenhum endpoint novo no backend. É a primeira feature que reage de verdade a `EventStreamService.events$` (até então só o indicador de conexão do Topbar/Home usava o SSE): filtra os eventos por `missionId` e recarrega o overview quando chega `mission.state.changed`/`team.composed`/`pipeline.updated`/`operation.completed`/`operation.failed`.
  - **`StageRailComponent`** (`shared/ui/stage-rail/`): 8 paradas (Intent→Requirements→Topology→Solution→Architecture→Team→Pipeline→Ready) com status `done`/`current`/`pending` derivado do `generatorState`. Honesto sobre a limitação: como `generate()` é atômico, o rail quase sempre mostra tudo pronto de uma vez (ou fica neutro em `BLOCKED`, sem adivinhar em qual etapa travou) — a estrutura já fica pronta pra quando comandos incrementais existirem.
  - **Reuso:** extraí `shared/ui/mission-overview-cards/` dos cards que o recap do Wizard (F2) já desenhava — agora tanto o Wizard quanto a tela de detalhe usam o mesmo componente.
  - **Navegação:** cada item da lista do Workspace agora é um link pra `/missions/:id` (`withComponentInputBinding()` habilitado no router, o `missionId` chega direto como `input.required<string>()` no componente).
  - **Testado:** 8 testes unitários novos (`StageRailComponent`: status certo por `generatorState`, nunca adivinha etapa em `BLOCKED`; `MissionDetailComponent`: carrega overview pelo `missionId` da rota, recarrega em evento SSE relevante da própria missão, ignora evento de outra missão, ignora tipo de evento irrelevante) + `ng build` limpo com o chunk `mission-detail` lazy-loaded + smoke manual confirmando os dados reais (`GET /missions/:id/overview` de uma missão criada de verdade pelo usuário) batendo com o que a tela espera.
  - **Fora de escopo ainda** (F4-F10 do doc 44): comandos incrementais reais por etapa no backend (exigiria mudar `core/`, não farei sem alinhar antes), Architecture/Team/Pipeline viewers dedicados, Execution/Artifacts, Review/Gates/Repair, AI Decision Inspector, Marketplace/Billing, polish de acessibilidade/responsividade/performance, Projects/Workspace switcher (aguardando tenancy real).
- **Frontend Premium — Slice F4 (Architecture + Team) implementada em `apps/web`**: `features/mission-architecture/` (rota `/missions/:id/architecture`) e `features/mission-team/` (rota `/missions/:id/team`). Como F3, é **só frontend** — `GET /missions/:id/intelligent-generator/architecture-decisions` e `.../team` já existiam desde a Slice 1 do backend e nunca tinham sido consumidos.
  - **Erro pego durante o smoke test:** assumi de cabeça (errado) que esses dois endpoints estavam sob `/missions/:id/...` direto, como o `/overview` da Slice F3. Na verdade estão sob `/missions/:id/intelligent-generator/...` (`generator.controller.ts`, prefixo diferente do `overview.controller.ts`). `curl` contra o backend real pegou o 404 antes de eu reportar como pronto — corrigido nos dois clients.
  - **Architecture viewer:** um card por `StackArchitectureProposal` (stack, estilo, módulos) com as *decision cards* de verdade (`problem`/`selectedOption`/`rationale`/`tradeoffs`/`decidedBy` — sem chain-of-thought, o domínio já não guarda isso) + banner de conflitos quando existem.
  - **Team Room:** instâncias agrupadas por `stackKey` (Integration Unit pras sem stack), com "Agent drawer" — expande inline ao clicar mostrando o `reason` completo e as decisões de composição do time daquele escopo. "Job Team highlight" do doc ficou de fora — precisa de UI de routing/tasks que ainda não existe (F5).
  - **`MissionNavComponent`** novo (`shared/ui/mission-nav/`): abas Overview/Architecture/Team compartilhadas pelas três páginas da missão, prontas pra crescer nas próximas slices (Pipeline, Tasks, Executions...).
  - **Testado:** 11 testes unitários novos (proposals/decisions/conflitos renderizando, agrupamento por stack, drawer expande/recolhe mostrando reason+decisões, estados vazios) + `ng build` limpo com os chunks `mission-architecture`/`mission-team` lazy-loaded + smoke manual com dados reais (criei uma missão "quero uma landing page institucional" de verdade e confirmei os dois endpoints retornando proposals/instances não-vazios batendo com os DTOs do frontend).
- **Frontend Premium — Slice F5 (Pipeline + Tasks) implementada em `apps/web`**: `features/mission-pipeline/` (rota `/missions/:id/pipeline`) e `features/mission-tasks/` + `features/task-detail/` (rotas `/missions/:id/tasks` e `/missions/:id/tasks/:taskId`). Diferente de F3/F4, tem uma parte com gap real de backend.
  - **Pipeline:** só frontend — `GET /missions/:id/intelligent-generator/pipeline` existia desde a Slice 1 e nunca tinha sido consumido. Nós agrupados por `stackKey`, ordenados por tipo de dependência (GENERATION→BUILD→TEST→REVIEW→GATE→PROMOTION). Chamado deliberadamente de "timeline", não "graph": um layout de grafo com setas SVG seria esforço desproporcional pro valor aqui — uma lista ordenada por dependência já deixa a ordem visível, que é o que o doc 44 pede.
  - **Gap de backend fechado:** a Slice 2 (`RoutingController`) só expõe rotas por `taskId` já conhecido (`classify`/`route`/`switch-team`/overview/handoffs) — não existia jeito de *listar* quais tasks existem numa missão. Mesma classe de gap da F1 (lista de missões). Novo `RoutingPersistenceService#listTasks(missionId)` consulta `JobClassificationRecord` (toda task passa por `classify` primeiro), deduplicado por `taskId` mantendo a classificação mais recente, enriquecido com o `status` de `WorkRoutingDecisionRecord` quando existe. Novo `TasksController` (`GET /missions/:id/tasks`) — não deu pra reaproveitar o `RoutingController` porque ele exige `taskId` na própria rota.
  - **Task board:** cards com jobType/complexity/riskLevel/routing status via `TaskClient.list()`. Diálogo "Nova task" (reaproveita o padrão de dialog inline da F1) chama `classify()` e navega pro detalhe.
  - **Task detail + routing explanation:** mostra a classificação completa e, se já roteada, a `WorkRoutingDecision` inteira — o `rationale` já é a explicação de roteamento pronta, gerada pelo `IntelligentWorkRouter`, sem reprocessamento no frontend. Botão "Rotear" quando ainda pendente.
  - **`MissionNavComponent`** ganhou as abas Pipeline e Tasks.
  - **Testado:** 9 testes unitários novos (`MissionPipelineComponent`: agrupamento/ordem, `blockedReason`, estado vazio; `MissionTasksComponent`: lista + fluxo de criar task; `TaskDetailComponent`: classificação/routing/rationale, botão rotear quando pendente) + 2 testes de backend novos (`listTasks()` com Postgres real: dedup por taskId mantendo a mais recente, enriquecimento com routing status) + `ng build` limpo com os chunks `mission-pipeline`/`mission-tasks`/`task-detail` lazy-loaded + smoke manual de ponta a ponta com dados reais contra o backend restartado na build nova: classifiquei uma task real (`REQUIREMENTS_ANALYSIS`/`LOW`/`LOW`), confirmei que apareceu na listagem, roteei (`BLOCKED_NO_REVIEWER` — decisão real do `IntelligentWorkRouter`, a missão de teste não tem reviewer independente no time) e confirmei o `rationale` completo no overview da task.
  - **Fora de escopo ainda** (F6-F10 do doc 44): Execution/Artifacts, Review/Gates/Repair, AI Decision Inspector, Marketplace/Billing, grafo de pipeline interativo (SVG), polish de acessibilidade/responsividade/performance, Projects/Workspace switcher.
- **Frontend Premium — Slice F6 (Execution) implementada em `apps/web`**: `features/mission-execution/` (rota `/missions/:id/execution`). Como F3-F5, é **só frontend** — `GET /missions/:id/operations` e `.../operations/events` (`RuntimeController`, pré-existente) já existiam e nunca tinham sido consumidos pelo frontend.
  - **Gap de backend investigado e não encontrado (diferente de F1/F5):** ao contrário de listar missões/tasks, aqui não é "faltou um endpoint" — não existe nenhum modelo de dados de `Artifact`/`Evidence`/build-log/changeset em `core/` nem no Prisma. O único dado real é um resumo/timeline **derivado do log de `DecisionEvent`** (`RuntimeTaskOverview`/`RepairOverview`/`OperationalMissionOverview`, já persistidos). Perguntado, optamos por construir o **Execution viewer honesto** com esse dado real agora, e deixar "Build/Test console", "Evidence" e "Artifacts" (doc 44/41) de fora até esse domínio existir no backend — mesmo padrão de escopo do Wizard (F2) e do Stage Rail (F3).
  - **Tela:** cards de resumo operacional (tasks em execução/rodando/falhas/aguardando review/repair/retry), lista de "Próximas ações" (`OperationalAction[]`, já combina runtime+repair no mesmo payload), lista de runtime tasks (status/tentativas/último gate/próxima ação) e uma timeline de eventos.
  - **Bug de nomenclatura pego antes do smoke virar "pronto":** `getRuntimeEvents()` do core (`intelligent-generator-application.ts`) retorna o log de decisão **inteiro** da missão (só filtra por `taskId`, não por tipo — diferente de `getRepairEvents()`, que já filtra por tipo). Sem tratamento, a timeline da aba "Execução" misturaria `INTENT_ANALYZED`/`TEAM_COMPOSED`/etc. com eventos de execução de verdade. Filtrei no frontend (`mission-execution.ts`) para uma allowlist de tipos realmente de execução (`EXECUTION_DISPATCHED/COMPLETED/FAILED`, `GATE_EVALUATED`, `REVIEW_COMPLETED`), sem tocar no backend.
  - **Honestidade sobre o estado atual:** como `generate()` ainda é atômico e não dispara execução real, nenhuma missão hoje tem `runtimeTasks`/`actions` não-vazios — a tela sempre mostra o estado vazio (`EmptyStateComponent`, mensagem explicando que o runtime de execução ainda não está implementado), confirmado via smoke real contra `GET /missions/f4-smoke-.../operations` retornando todos os contadores zerados.
  - **Testado:** 3 testes unitários novos (`MissionExecutionComponent`: estado vazio quando não há runtime tasks/ações; renderiza contadores/ações/tasks com dados populados; timeline ordenada mais recente primeiro, com filtro de tipo de evento aplicado) + `ng build` limpo com o chunk `mission-execution` lazy-loaded + smoke manual real confirmando os dois endpoints (`/operations` e `/operations/events`) contra a missão `f4-smoke-...`.
- **Frontend Premium — Slice F7 (Gates + Repair) implementada em `apps/web`**: `features/mission-gates/` (rota `/missions/:id/gates`) e `features/mission-repair/` (rota `/missions/:id/repair`). Como F6, é **só frontend** — mesmos endpoints `GET /missions/:id/operations[/events]` do `RuntimeController`, nenhum DTO novo em `runtime.client.ts`.
  - **Gap de backend maior que F6, investigado antes de planejar:** não existe read model nenhum pra `ReviewGateEvaluation` (zero), e o `RepairReadModel` (`core/src/services/repair-read-model.ts`) é parcialmente "com perdas" — os objetos aninhados `advisory`/`eligibility` que ele fabrica a partir do log de eventos têm campos hardcoded vazios (`approvedSolutionId: ''`, `likelyCapabilities: []`, `rationale: ''`, `reason: ''`), porque não existe adapter Prisma ligado pros models reais de `FailureSnapshot`/`RepairAdvisory`/`ReviewGateEvaluation` (só um JSON store local é usado hoje, embora o schema Prisma já tenha os models com `detailJson`). A ação de aprovar reparo (`assessRepairEligibility` aceita `approvalGranted`) nunca foi exposta via HTTP. Perguntado, optamos por **viewer honesto agora** (mesmo padrão do F6): sem botão de aprovar reparo, sem tentar reconstruir os campos fabricados vazios.
  - **Escopo colapsado deliberadamente:** "Review Center" e "Gate Center" do doc 44 são dirigidos exatamente pelos mesmos dois tipos de evento (`GATE_EVALUATED`, `REVIEW_COMPLETED` — `runtime-audit-recorder.ts`), sem nenhuma distinção adicional no backend. Duas telas quase idênticas seriam puro padding, então virou um único tab "Gates".
  - **Estratégia de dado confiável:** em vez dos objetos `advisory`/`eligibility` aninhados de `RepairOverview` (que misturam campo real com campo fabricado), a tela de Repair usa só os campos de topo de `RepairOverview` (`failureCategory`/`failureCode`/`repairCompleted`/`nextAction`, todos reais) mais a timeline de eventos brutos (`FAILURE_CLASSIFIED`/`REPAIR_ADVISORY_CREATED`/`REPAIR_ELIGIBILITY_EVALUATED`/`REPAIR_COMPLETED`), cujos payloads são gravados diretamente no momento do evento (`runtime-audit-recorder.ts`) — 100% reais, sem fabricação.
  - **Reuso:** extraí `shared/ui/event-timeline/` do bloco de timeline que já existia em `mission-execution.html` (F6) — usado agora nas três telas (Execution, Gates, Repair) em vez de duplicar a renderização genérica de `eventType` + payload.
  - **Testado:** 7 testes unitários novos (`EventTimelineComponent`: renderiza eventos e payload, vazio sem eventos; `MissionGatesComponent`: contagem passed/failed/blocked, timeline filtrada ignorando eventos não relacionados a gate, estado vazio; `MissionRepairComponent`: cards de repair task + timeline filtrada, legenda fixa de "sem aprovação real", estado vazio) + os 3 testes existentes de `MissionExecutionComponent` continuam passando depois do refactor + `ng build` limpo com os chunks `mission-gates`/`mission-repair` lazy-loaded + smoke manual confirmando que a missão `f4-smoke-...` não tem nenhum evento de gate/reparo ainda (estado vazio honesto nas duas telas novas).
- **Frontend Premium — Slice F8 (AI Experience) pulada deliberadamente.** Investiguei antes de planejar (mesmo processo de F6/F7): não há dado real pra mostrar além do que F4 (`ArchitectureDecision.rationale/tradeoffs`) e F7 (`RepairAdvisory.rationale` via evento) já expõem. `aiUsageSummary`/`costSummary` são `null` hardcoded por design em `overview.service.ts` — não existe model de tokens/custo no Prisma nem em `core/`, não existe endpoint `/assistant/explain`, e **confirmei que não há nenhuma chamada de LLM em lugar nenhum do código** (`generator.service.ts` já documenta isso: "Today generate() has no LLM/execution I/O"). "Gerador Inteligente" hoje é inteiramente determinístico/baseado em regras. Um viewer honesto aqui teria pouquíssimo valor (duplicaria F4/F7 com campos de custo permanentemente vazios). Fica bloqueada até existir integração real de LLM.
- **Frontend Premium — Slice F9 (Marketplace + Billing) fora de escopo**, como já registrado em toda slice anterior — precisa de infraestrutura de pagamento/planos real que não existe.
- **Frontend Premium — Slice F10 (Premium polish) implementada em `apps/web`, escopo "fundamentos primeiro"**: das 8 áreas do doc 44 (`responsive, accessibility, keyboard, command palette, animations, skeletons, empty states, error UX`), o usuário priorizou responsivo + acessibilidade + error UX — os itens que afetam usabilidade real. Command palette, animações e skeletons ficam pra depois. Diferente das slices anteriores, não é mais gap de backend — são problemas concretos no código frontend já escrito em F0-F7:
  - **Bug real de error UX corrigido:** o interceptor global (`error.interceptor.ts`) já mapeia todo erro HTTP pro `AppError` tipado com `translationKey` específico por categoria (`errors.401/403/409/429/5xx`), mas as **10 telas que usam `resource()`** (`mission-architecture`, `mission-team`, `mission-pipeline`, `mission-tasks`, `task-detail`, `mission-execution`, `mission-gates`, `mission-repair`, `mission-detail`, `workspace`) descartavam esse erro tipado e sempre mostravam a mesma mensagem genérica `common.error`, nunca a mensagem específica que o backend já tinha preparado. Novo `shared/ui/error-state/` (`role="alert" aria-live="assertive"`, botão "Tentar novamente" que chama `resource.reload()`) substitui o bloco antigo nas 10 telas — nenhum `.ts` precisou mudar, só os templates + imports. Bloco de loading ganhou `aria-live="polite" role="status"` nas mesmas 10 telas, pra leitores de tela anunciarem a mudança de estado.
  - **Acessibilidade:** o único modal do app (`new-task-dialog`) ganhou `role="dialog"`, `aria-modal`, `aria-labelledby`, fechar com Escape e foco inicial na textarea (`autofocus` nativo). O drawer expansível do Team Room (`mission-team.html`) ganhou `aria-expanded`/`aria-controls` no botão que abre/fecha. Foco cíclico completo (tab trap) no diálogo fica de fora — é infraestrutura maior, registrado aqui como próximo passo, não inventado agora.
  - **Responsivo:** zero `@media` de largura existia no app inteiro antes desta slice. Novo `styles/breakpoints.scss` (`$breakpoint-mobile: 768px`, mesmo espírito de `tokens.scss`). Uma única redefinição do token `--space-8` em `tokens.scss` sob o breakpoint encolhe o padding de **todas** as telas de feature de uma vez (todas já usam `padding: var(--space-8)` no container raiz) sem tocar cada arquivo individualmente. Sidebar vira uma barra horizontal rolável no topo abaixo de 768px (em vez de coluna fixa de 220px), `app-shell` empilha, `topbar` quebra linha, e `MissionNavComponent` (8 abas desde F7) ganhou `overflow-x: auto` incondicional — não só em mobile, já que 8 abas não cabem em qualquer janela mais estreita que a soma delas.
  - **Testado:** 3 testes unitários novos (`ErrorStateComponent`: mensagem específica por `translationKey`, fallback genérico quando o valor não é um `AppError`, emite `retry` ao clicar) + os 60 testes existentes das 10 telas + `EventTimelineComponent`/`MissionGatesComponent`/`MissionRepairComponent` continuam passando depois da troca do bloco de erro + `ng build` limpo, CSS compilado confirmado contendo os `@media (max-width:768px)` novos + smoke manual real (backend + `ng serve` no ar, `GET /missions/does-not-exist/overview` retornando 404 `MISSION_NOT_FOUND` como caso de teste pro botão de retry).
  - **Fora de escopo ainda:** command palette, animações, F8 (bloqueada por falta de LLM real) e F9 (bloqueada por falta de billing real).
- **Frontend Premium — Slice F10 (continuação: skeletons + foco/contraste) implementada em `apps/web`**: dando sequência ao checklist de qualidade do doc 44 (`keyboard, focus, screen reader, contrast, reduced motion`).
  - **Contraste — auditado, nada pra corrigir.** Calculei o contraste WCAG (fórmula de luminância relativa) de todos os pares texto/fundo relevantes dos tokens em `styles/tokens.scss`, claro e escuro: `text`/`text-muted`/`accent`/`accent-contrast`/`danger`/`warning` contra `bg`/`surface`/`surface-raised`/`danger-bg` — **todos ≥ 4.5:1** (AA normal), a maioria bem acima (ex.: `text` sobre `bg` é 16.85:1 nos dois temas). Nenhuma cor mudou.
  - **Foco visível — já funcionava.** Nenhum `outline: none`/`outline: 0` existe em lugar nenhum do CSS, então o anel de foco padrão do browser já cobre todo elemento interativo.
  - **Reduced motion** — já coberto globalmente desde F0 (`styles.scss`); a nova animação de skeleton herda a regra automaticamente, sem precisar duplicar lógica.
  - **Skeletons:** novo `shared/ui/skeleton/` (`<app-skeleton>`, `aria-hidden="true"`, pulso de opacidade) substitui o `<p>Carregando...</p>` nas 10 telas com `resource()` — pedido desde o Prompt Codex de F0 ("route skeletons", nunca implementado até agora). O texto "Carregando..." continua existindo pra leitor de tela via `.visually-hidden` (utilitário novo em `styles.scss`) dentro da mesma região `aria-live`, só não aparece mais visualmente — quem usa leitor de tela não perde nada, quem enxerga ganha uma tela menos vazia.
  - **Tab trap completo no diálogo "Nova task":** `new-task-dialog.ts` ganhou um ciclo de foco manual (`viewChild.required` + handler de `Tab`/`Shift+Tab`, primeira vez que o app usa a signal query API do Angular) — Tab no último elemento focável volta pro primeiro, Shift+Tab no primeiro vai pro último. `MissionTasksComponent` guarda o elemento com foco antes de abrir o diálogo e devolve o foco pra ele ao fechar, fechando o ciclo completo (botão → diálogo → nunca escapa → volta pro botão).
  - **Bug real pego pelo teste, não hipotético:** a primeira versão do seletor de elementos focáveis incluía o botão "Classify" mesmo `disabled` (que é o estado inicial, formulário vazio) — um botão desabilitado não pode receber foco de verdade, então o ciclo quebrava silenciosamente nesse caso. O teste (`Tab do último elemento volta pro primeiro`) falhou exatamente nesse cenário até eu excluir `:disabled` do seletor.
  - **Testado:** 2 testes novos de `SkeletonComponent` (width/height/aria-hidden) + 4 novos de `NewTaskDialogComponent` (role de diálogo, wrap de Tab, wrap de Shift+Tab, cancelar emite `closed`) + 1 novo de `MissionTasksComponent` (foco volta pro botão que abriu o diálogo) + as 65 specs anteriores continuam passando com o novo bloco de loading + `ng build` limpo.
- **Frontend Premium — Slice F10 (continuação: Command Palette) implementada em `apps/web`**: `core/command-palette/command-palette.service.ts` (estado `isOpen` compartilhado, mesmo padrão de `ThemeService`) + `shell/command-palette/` (overlay, sempre montado em `AppShellComponent`).
  - **Escopo cortado deliberadamente do doc canônico** (`47 - Navegação Enterprise Busca e Command Palette.md`): esse doc descreve uma visão enterprise completa — busca sobre Projects/Marketplace/Academy/Company/Billing/Members, workspace switcher, favoritos, itens recentes persistidos, operadores de busca (`type:mission`), busca permission-aware, indexação via "backend search service futuro" (o próprio doc admite que isso não existe ainda). Nenhuma dessas entidades existe nesta app — mesmo corte já feito pra F9. O que ficou: busca sobre **missões reais** (`MissionClient.list()`), navegação estática (Workspace, Nova Missão, e as 8 abas da missão atual quando já dentro de uma), e as **ações reais** que o Topbar já tinha (alternar tema, sair) — doc §8 lista exatamente essas como comandos.
  - **Atalho:** só `Ctrl/Cmd+K` (doc também sugere `/`, que eu deliberadamente não implementei — abrir com `/` quebraria digitar essa tecla em qualquer textarea da app sem um guard cuidadoso contra campos editáveis; `Ctrl/Cmd+K` já cobre a acceptance "search accessible everywhere" sem esse risco). Funciona em qualquer tela, inclusive com o foco dentro de um campo de texto (mesma convenção do GitHub/Linear/Slack) — um único listener em `(document:keydown)` no componente, sempre montado, cuida do atalho global e de toda a navegação por teclado dentro da paleta quando aberta (Escape fecha, setas navegam, Enter executa, Tab cicla só dentro do overlay).
  - **Foco:** `CommandPaletteService.open()` guarda `document.activeElement` de forma síncrona antes de qualquer render (evita a corrida entre "o quê estava focado" e o autofocus do campo de busca) e devolve o foco em `close()` — funciona tanto pro atalho de teclado quanto pro botão de busca novo no Topbar (🔎), que só chama `commandPalette.open()`.
  - **Bug real pego pelo teste, não hipotético:** o botão "Classify" desabilitado (formulário vazio) do `new-task-dialog` também apareceu aqui como um problema latente da mesma classe — reescrevi o seletor de foco compartilhando a lição já aprendida no F10 anterior (`:not([disabled])` em todo elemento focável), então esse bug específico não se repetiu, mas documento a técnica porque foi reaproveitada, não redescoberta.
  - **Testado:** 3 testes novos de `CommandPaletteComponent` (abre com Ctrl+K mesmo com outro input focado e fecha com Escape devolvendo o foco; filtra missões pela query digitada, incluindo excluir as que não batem; navega e fecha ao ativar um resultado com Enter) + as 70 specs anteriores continuam passando + `ng build` limpo (chunk `app-shell` cresceu como esperado, a paleta é sempre montada).
  - **Fora de escopo, documentado:** favoritos, operadores de busca, busca permission-aware, workspace switcher, breadcrumbs, atalhos `G then P`, indexação backend — nenhum tem onde se apoiar hoje. (Itens recentes fechado depois, ver entrada mais abaixo.)
- **Backend + Frontend — Aprovação de reparo real** fecha a limitação documentada no F7: `RuntimeLifecycleCoordinator#assessRepairEligibility` (o gancho humano-no-loop, aceita `approvalGranted: boolean`) nunca era chamado de `apps/api` — uma missão real no Postgres não tinha **nenhum** caminho de escrita de reparo, não era uma versão "com perdas", era literalmente inatingível.
  - **Novo módulo `apps/api/src/repair/`** (`RepairPersistenceService` + `RepairController`, registrado em `app.module.ts`): `POST .../tasks/:taskId/repair/classify`, `POST .../repair/eligibility` (a ação real de aprovar — chamada com `{ approvalGranted: true }`), `GET .../repair`.
  - **Decisão de arquitetura:** deliberadamente **não** usa `RuntimeLifecycleCoordinator` (exigiria inventar um stub de `ExecutionRuntimePort` só pra satisfazer o construtor, já que não existe runtime de execução real). Em vez disso, mirra o padrão já estabelecido por `RoutingPersistenceService` (Slice 2): chama `FailureClassifier`/`RepairAdvisor`/`RepairEligibilityPolicy` como funções puras, descartando seus stores internos em memória, e faz o dedup/persistência manualmente contra o Postgres (`findUnique` por `contextHash`, `create` se novo) — mais simples e sem precisar tocar `core/` pra isso.
  - **Decisão de design registrada com honestidade:** `RepairEligibilityPolicy` só sai do bloqueio "requer execução falhada" se existir um evento `EXECUTION_FAILED` pra aquela task — e nada no sistema emite isso, porque não há runtime real. Classificar uma falha grava `EXECUTION_FAILED` como parte do mesmo passo: isso não é inventar dado falso, é o próprio significado do domínio (classificar uma falha pressupõe que uma execução aconteceu e falhou) — é o mesmo fato que um runtime real gravaria, só que hoje é um humano reportando via API em vez do runtime.
  - **`risk` nunca vem do corpo da requisição** — `RepairAdvisor.advise()` já calcula deterministicamente a partir do texto da falha (ex.: "security"/"critical" → `CRITICAL`); o endpoint de elegibilidade busca o `risk` do advisory mais recente já persistido, então um caller não consegue burlar a exigência de aprovação passando um risk baixo inventado.
  - **Bug real de core pego pelo próprio teste:** `RuntimeAuditRecorder#recordRepairEligibility` gerava a mesma `idempotencyKey` pra uma avaliação `BLOCKED` e a `ELIGIBLE` seguinte após aprovação (não incluía o `status` na chave) — o segundo evento era descartado silenciosamente pelo `skipDuplicates` do Postgres (índice único em `DecisionEvent.idempotencyKey`). Corrigido em `core/src/services/runtime-audit-recorder.ts` incluindo `decision.status` na chave — mudança mínima e cirúrgica, sem quebrar nenhum dos 194 testes existentes do `core/`.
  - **Frontend:** `core/api/repair.client.ts` novo + `features/mission-repair/classify-failure-dialog/` (mesmo padrão de diálogo/tab-trap do `new-task-dialog`). A tela de Repair (F7) trocou a legenda estática "sem aprovação real" por um botão "Classificar falha" de verdade e um botão "Aprovar reparo" que aparece quando `task.nextAction === 'APPROVE_REPAIR'` — condição já calculada pelo mesmo read model que os novos endpoints alimentam, então nenhum estado extra foi necessário no frontend pra saber quando mostrar o botão.
  - **Testado:** 8 testes novos de `RepairPersistenceService` contra Postgres real (rejeita missão inexistente, 404 pra task nunca classificada, classify idempotente pro mesmo input, inputs diferentes geram snapshots diferentes, risk LOW é elegível sem aprovação, risk CRITICAL fica bloqueado até `approvalGranted:true` — e confirma os 2 eventos de elegibilidade distintos, `getOverview` com e sem dado) + 4 testes novos de frontend (`ClassifyFailureDialogComponent`, `MissionRepairComponent` atualizado) + `npm test -w core` (194/194, sem regressão) + `ng build`/`tsc` limpos + smoke manual real de ponta a ponta: classifiquei uma falha com texto de segurança crítica numa missão real, confirmei `risk: CRITICAL` calculado, `BLOCKED` sem aprovação, `ELIGIBLE` com `approvalGranted:true`, e `GET /operations` mostrando `nextAction` mudar de `APPROVE_REPAIR` pra `START_REPAIR` depois da aprovação.
  - **Fora de escopo ainda:** `completeRepair`/retry de execução (não existe runtime real pra executar o reparo), `ReviewGateEvaluation`/Gate Center com dado real (mesma classe de gap, fica pra outra rodada), `RepairEligibilityDecision` como tabela própria no Postgres (hoje só existe como `DecisionEvent`, suficiente pro que a UI precisa — não criei um model novo sem necessidade real).
- **AI Experience — primeira integração real de LLM (DeepSeek), "Explicar com IA"**: até aqui `generate()` era 100% determinístico, zero I/O de IA em lugar nenhum do sistema. Escopo confirmado com o usuário (provider DeepSeek — token real já disponível; API compatível com o formato OpenAI, só muda a base URL) e deliberadamente limitado a **só explicação de decisão** (doc 43 §5 "Ask AI"), não dentro do fluxo de decisão em si — a regra constitucional do doc 1 ("LLM propõe; contrato limita; gate prova") continua intacta: o LLM só narra em linguagem natural uma `ArchitectureDecision` **já tomada deterministicamente** (a mesma já exibida no F4 — `problem`/`selectedOption`/`rationale`/`tradeoffs`/`optionsConsidered`/`constraints`), nunca decide nada.
  - **Backend** (`apps/api/src/assistant/`, novo módulo): `POST /missions/:missionId/assistant/explain`. `DeepSeekClient implements LlmClient` (interface injetável — `AssistantService` recebe o client por DI, então os testes automatizados usam um fake e nunca fazem chamada real, que custa dinheiro de verdade) chama `https://api.deepseek.com/chat/completions` com `fetch()` nativo (mesmo estilo do `HttpExecutionRuntimeAdapter` já existente em `core/`), timeout de 15s, mapeando qualquer falha (chave ausente, erro de rede, resposta inválida) pra `AI_EXPLANATION_UNAVAILABLE` → 503 (novo `SERVICE_UNAVAILABLE_CODES` no `DomainErrorFilter`) — o frontend já trata `errors.5xx` como "erro de servidor, tente de novo" (doc 43 §12 bate exatamente com isso).
  - **Decisões de escopo registradas:** sem custo em $ estimado (preço do DeepSeek pode mudar e eu mostraria um número que fica errado sem manutenção contínua — só mostro `provider`/`model`/`promptTokens`/`completionTokens`/`totalTokens`/`latencyMs`, tudo direto da resposta real da API); sem persistir o texto da explicação (pedir de novo re-chama o LLM, sempre atual, em vez de cachear algo que pode ficar desatualizado) — só os metadados de uso viram um `DecisionEvent` novo (`AI_EXPLANATION_GENERATED`, adicionado ao union `GeneratorDecisionEventType` em `core/` — única mudança em `core/` desta slice, aditiva).
  - **Bug real pego pelo próprio teste:** `DecisionEventRepository`'s `sanitize()` (guarda de segurança contra vazar credenciais pro log de auditoria — `decision-event-store.ts`) redige qualquer chave de payload que contenha a substring "token", pra impedir que uma `apiToken`/`authToken` vaze sem querer. Meus campos `promptTokens`/`completionTokens`/`totalTokens` caíam nessa mesma regra e desapareciam silenciosamente do evento persistido, mesmo sendo só contagens, não segredos — o teste (`expect(payload.totalTokens).toBe(160)`) falhou com `undefined` até eu renomear pra `promptUnits`/`completionUnits`/`totalUnits` no payload persistido (a resposta HTTP da API continua usando `promptTokens`/`totalTokens`, nomes naturais — só o payload que passa pela sanitização precisou do ajuste).
  - **Frontend:** `core/api/assistant.client.ts` novo. Cada *decision card* da tela de Architecture (F4) ganhou um botão "Explicar com IA" — estado por decisão (`idle`/`loading`/`done`/`error`) num `Record<string, ExplainState>` já que uma missão pode ter várias decisões, cada uma explicada independentemente. Mostra "IA analisando..." durante a chamada, a explicação + uma legenda com `model · tokens · latência` quando pronta, ou `ErrorStateComponent` com retry em caso de falha.
  - **Testado:** 3 testes novos de `AssistantService` contra Postgres real com `LlmClient` **fake** (decisão inexistente 404, explica com sucesso e grava o evento com os campos de uso corretos, propaga `AI_EXPLANATION_UNAVAILABLE` quando o LLM falha e não grava evento nenhum) + 2 testes novos de `MissionArchitectureComponent` (explica e mostra resultado com metadados de uso, mostra erro com retry) + `npm test -w core` (194/194, sem regressão) + `ng build`/`tsc` limpos + **smoke manual real (única chamada de verdade ao DeepSeek nesta sessão, com custo real de tokens):** classifiquei o `decisionId` real de uma missão com arquitetura aprovada, recebi de volta uma explicação coerente e grounded nos fatos reais da decisão (sem inventar nada, sem chain-of-thought), com `usage` real (`model: deepseek-v4-flash`, 223+176=399 tokens, ~2.85s de latência), e confirmei o evento `AI_EXPLANATION_GENERATED` persistido no log de decisão da missão com os campos corretos.
  - **Fora de escopo ainda:** tracking de custo em $, cache/histórico de explicações já geradas, "AI Copilot panel" (doc 43 §7) e "Change request" (doc 43 §6) — ambos exigiriam o LLM propor mudanças de escopo, que é uma categoria de risco bem maior que só narrar uma decisão já tomada.
- **AI Experience — "Explicar com IA" estendido pra Team e Routing.** `AssistantService` refatorado: extraí um `explainAndRecord(missionId, aggregateType, aggregateId, user)` privado com o que já era comum entre as chamadas (medir latência, chamar o LLM, mapear falha, montar `usage`, gravar o `DecisionEvent`) — o `system` prompt também virou uma constante compartilhada, já que as instruções ("baseie-se só nos fatos, sem chain-of-thought, linguagem simples") não mudam por tipo de decisão, só os fatos enviados mudam.
  - **`explainTeamDecision`**: `TeamCompositionDecision` (mesma forma de `ArchitectureDecision` — `problem`/`selectedOption`/`rationale`/`rulesApplied`), encontrada via `queries.getTeamComposition(missionId)` (helper já usado por `GeneratorService#getTeam`).
  - **`explainRoutingDecision`**: `WorkRoutingDecision`, diferente das outras duas — não é uma lista pra varrer por `id`, é uma linha só por `missionId:taskId` (`workRoutingDecisionRecord.routingKey`, mesma chave que `RoutingPersistenceService` já usa) — por isso o endpoint recebe `taskId` no corpo, não `decisionId`.
  - **`RepairAdvisory` continua de fora, deliberadamente**: seu `rationale` hoje é uma string genérica fixa ("Advisory baseado no padrão determinístico da falha"); "explicar" isso com IA seria só reformular uma frase vaga, não narrar uma decisão real.
  - **Rotas:** `explain` virou `explain-architecture` (mesma slice, frontend já atualizado junto) + `explain-team` + `explain-routing`, todas em `POST /missions/:missionId/assistant/...`, mesmo controller.
  - **Frontend — novo `shared/ui/explain-with-ai/`** (componente presentacional, sem chamada HTTP própria): as 3 telas (Architecture, Team, Task Detail) tinham o mesmo bloco de template idle/loading/done/error/legenda de uso repetido — na 3ª ocorrência justificou extrair (as 2 anteriores, o tab trap do F10, ficaram duplicadas de propósito por serem só 2 casos). A chamada HTTP e o `Record<string, ExplainAiState>`/signal de estado continuam em cada tela (mesmo padrão já usado pra `resource()` em toda a app — nunca centralizei state management num serviço), só o template comum saiu daqui.
  - **Testado:** 4 testes novos de `AssistantService` (404 + sucesso pra team e pra routing, reaproveitando o `LlmClient` fake) + 4 testes novos de `ExplainWithAiComponent` (idle/loading/done/error, emite os outputs certos) + `ng build`/`tsc` limpos + **2 chamadas reais adicionais ao DeepSeek** (mais custo real de tokens): expliquei uma decisão de composição de time real (3 papéis — ARCHITECT/LEAD/TEST_ENGINEER — explicação mencionou corretamente a regra "reviewer != executor" sem eu ter pedido isso especificamente) e uma decisão de roteamento real bloqueada (`BLOCKED_NO_REVIEWER`, explicação corretamente descreveu o motivo do bloqueio), confirmando os dois eventos `AI_EXPLANATION_GENERATED` persistidos com `aggregateType` correto.
- **AI Usage — nova aba mostrando o histórico real de uso de IA da missão** (doc 43 §11 "AI Usage visibility": model/provider/tokens/latência, sem custo — mesma decisão já tomada de não estimar preço do DeepSeek). `features/mission-ai-usage/`, rota `/missions/:id/ai-usage`.
  - **Backend: nenhuma mudança.** Toda chamada de "Explicar com IA" já grava `AI_EXPLANATION_GENERATED` no log de `DecisionEvent`, e esse log já é servido inteiro por `GET /missions/:id/operations/events` (mesmo endpoint que Gates e Repair já consomem via `RuntimeClient.getEvents()`) — bastou filtrar client-side pro tipo de evento novo, mesma técnica já usada 2x antes.
  - **Cards de resumo** (contagem de explicações, soma de tokens, latência média) calculados inteiramente no frontend via `computed()` sobre os eventos filtrados — nenhum agregado novo no backend. `<app-event-timeline>` (4ª reutilização) mostra a lista crua.
  - **Testado:** 2 testes novos de `MissionAiUsageComponent` (soma/média calculadas certas, ignora tipos de evento não relacionados; estado vazio) + `ng build` limpo (chunk `mission-ai-usage` lazy) + smoke manual real (sem chamada nova ao DeepSeek — só leitura): confirmei via curl contra `GET /operations/events` que a missão `f4-smoke-...` (com as 3 explicações reais das slices anteriores) bate exatamente com o que a UI calcula — 3 explicações, 1158 tokens totais, 2613ms de latência média.
- **Gate Center com dado real — avaliar gates de uma task roteada.** Mesma classe de gap que `Repair` tinha: `ReviewGateEvaluation` tem model no Prisma mas nenhum adapter ligado — nenhuma rota chamava `ReviewGateEvaluator`. Novo módulo `apps/api/src/gates/` (`GatePersistenceService` + `GateController`), mesmo padrão de `RepairPersistenceService`/`RoutingPersistenceService` (sem `RuntimeLifecycleCoordinator`, chama `ReviewGateEvaluator` como função pura, dedup replicado contra o Postgres com a mesma `idempotencyKey` que o core computaria).
  - **Pré-requisito real documentado:** `ReviewGateEvaluator.evaluate()` exige `WorkRoutingDecision.status === 'ROUTED'` com `executorAgentInstanceId` definido — só acontece quando o time tem um reviewer elegível distinto do executor. A missão `f4-smoke-...` (3 papéis, sem reviewer independente) sempre bate `BLOCKED_NO_REVIEWER`, então o smoke desta rodada bateu em `REVIEW_ROUTING_NOT_READY`/400 de propósito — confirma que o guard funciona, não é um bug. Os testes automatizados (que controlo) semeiam um `WorkRoutingDecisionRecord` já `ROUTED` diretamente no Postgres pra provar os caminhos `PASSED`/`FAILED`/`BLOCKED` de verdade, sem depender de sorte de composição de time.
  - **2º bug real de core pego pelo próprio teste nesta sessão:** `invalidReviewer` em `review-gate-evaluator.ts` comparava `item.executorAgentInstanceId === item.reviewerAgentInstanceId` sem checar se os dois existiam — quando uma evidência omite os dois campos (nenhum seletor de agente existe na UI ainda), `undefined === undefined` dava falso positivo e bloqueava toda avaliação, mesmo com todos os gates realmente passando. Corrigido exigindo que `executorAgentInstanceId` esteja de fato presente antes de comparar — `npm test -w core` seguiu 194/194 depois do fix, nenhum teste dependia do comportamento antigo.
  - **Frontend:** novo card "Avaliação de gates" em `task-detail`, só quando `routing.status === 'ROUTED'` (mesma honestidade condicional já usada pro card de aprovar reparo). Pra cada `requiredGateKeys[i]` (já carregado via `TaskClient.getOverview()`, nenhuma leitura nova): checkbox "passou" + campo de referência de evidência. `reviewerAgentInstanceId`/`executorAgentInstanceId` deliberadamente omitidos da evidência enviada — sem seletor de agente construído ainda, e omitir os dois nunca dispara o guard de auto-revisão (confirmado lendo o core antes de simplificar).
  - **`mission-gates` (aba da missão, F7) não mudou** — já filtrava `GATE_EVALUATED`/`REVIEW_COMPLETED` do log de eventos desde antes; só passa a ter dado de verdade pra mostrar depois que alguém avalia gates pelo card novo.
  - **Testado:** 7 testes novos de `GatePersistenceService` contra Postgres real (404 sem routing decision, rejeita quando não `ROUTED`, `PASSED`/`FAILED`/`BLOCKED` com decisão semeada diretamente, idempotência, `getOverview` com e sem dado) + 3 testes novos de `TaskDetailComponent` (formulário aparece só quando `ROUTED`, nota "não pronto" quando não, submissão monta a evidência certa e mostra o resultado) + `ng build`/`tsc` limpos + smoke manual real confirmando os 3 caminhos de erro/vazio (`REVIEW_ROUTING_NOT_READY`, `ROUTING_DECISION_REQUIRED`, overview vazio) contra o backend real.
- **Rationale real do `RepairAdvisor` + "Explicar com IA" pra Repair Advisory** — fecha o último tipo de decisão que eu tinha deixado de fora do AI Experience. `RepairAdvisor.advise()` já calculava `likelyCapabilities`/`likelySpecialistRole`/`risk`/`estimatedSuccess` mas descartava tudo isso numa frase fixa genérica ("Advisory baseado no padrão determinístico da falha"). Troquei por uma composição determinística (zero LLM, só string building a partir dos mesmos campos que a função já calculava) que resume a decisão de verdade — ex.: `"Falha "X" indica necessidade de SECURITY_SPECIALIST, com foco em security e authentication. Risco classificado como CRITICAL, sem histórico de reparos anteriores para esse tipo de falha (taxa de sucesso estimada neutra: 50%)."`. Não muda nenhuma regra de decisão (capabilities/specialist/risk continuam calculados exatamente como antes), só o texto que descreve o que já foi decidido.
  - **`explainRepairAdvisory`** novo em `AssistantService` (mesmo padrão dos outros 3 — `explainAndRecord` compartilhado) + `POST /missions/:missionId/assistant/explain-repair` (body `{ taskId }`, mesma convenção de `explain-routing` já que `RepairAdvisory` também é buscado por `missionId:taskId`).
  - **Frontend:** `<app-explain-with-ai>` (4ª reutilização) dentro de cada card de task em `mission-repair` — `Record<string, ExplainAiState>` por `taskId`, mesmo padrão de `mission-team`. Precisou de um pequeno ajuste de layout (`.mission-repair__task` ganhou `flex-wrap` — o componente compartilhado força quebra de linha via `flex-basis: 100%` no seletor do elemento hospedeiro, já que esse card é uma linha horizontal, diferente dos cards em coluna de Architecture/Team).
  - **Testado:** 2 testes novos em `core/repair-advisor.test.ts` (rationale contém os fatos reais, não a frase genérica antiga; reflete histórico de reparos quando existe) + 2 testes novos de `AssistantService` (404 sem advisory, explica com sucesso incluindo o rationale real no prompt) + 1 teste novo de `MissionRepairComponent` + `npm test -w core` (196/196) + `ng build`/`tsc` limpos + **última chamada real ao DeepSeek desta rodada**: classifiquei uma falha de segurança crítica numa missão real, confirmei o rationale novo (`"...indica necessidade de SECURITY_SPECIALIST, com foco em security e authentication..."`), pedi a explicação e recebi de volta uma narrativa coerente que realmente reflete esse rationale — não mais uma paráfrase de frase vazia — e confirmei os 4 tipos de decisão (`ArchitectureDecision`/`TeamCompositionDecision`/`WorkRoutingDecision`/`RepairAdvisory`) agora presentes no histórico de `AI_EXPLANATION_GENERATED` da missão.
- **Command Palette — Itens recentes** fecha o item que o F10 tinha deixado de fora por não ter onde se apoiar. Doc 47 §9 "Recent Items"/§6 "Search Groups" (`Recent` é o primeiro grupo, antes até de `Missions`) — **zero mudança de backend**: "recente" é local ao navegador de cada usuário, mesmo padrão de `localStorage` já usado por `ThemeService`/`TranslationService`/`AuthService`, não uma entidade que precise de tenancy/persistência real.
  - **Novo `core/command-palette/recent-missions.service.ts`** (`providedIn: 'root'`): `recent` signal de `{ missionId, rawUserIdea, visitedAt }[]`, lido de `localStorage` na inicialização. `record(missionId, rawUserIdea)` remove qualquer entrada existente pro mesmo `missionId`, insere no início e corta em 5 — dedupe por "mover pro topo" em vez de permitir duplicata ou deixar a entrada antiga on lugar.
  - **Onde grava:** só `MissionDetailComponent` (a tela de Overview, entrada natural de uma missão) — um `effect()` novo no construtor observa `overviewResource.value()` e chama `record()` quando os dados chegam. Deliberadamente não replicado em cada sub-aba (Architecture/Team/Tasks/...) pra não gravar de novo a cada troca de aba dentro da mesma missão já visitada.
  - **`CommandPaletteComponent`:** novo grupo `'recent'` no union de `PaletteResult['group']`, listado **antes** do grupo de navegação e sem filtro pela query digitada (recentes são um atalho fixo, não somem ao digitar — a lista completa de missões já tem seu próprio filtro por texto no grupo `Missions` separado). Grupo aditivo: convive com `Missions`, não o substitui.
  - **Testado:** 5 testes novos de `RecentMissionsService` (começa vazio, grava e persiste, move pro topo em vez de duplicar numa segunda visita, corta em 5 descartando o mais antigo, sobrevive um "reload" simulado via nova instância lendo do mesmo `localStorage`) + 1 teste novo de `MissionDetailComponent` (grava a missão como recente quando o overview carrega) + 1 teste novo de `CommandPaletteComponent` (grupo "Recentes" aparece primeiro, continua visível depois de digitar uma query que não bate com ele, navega ao clicar) + `ng build`/`tsc` limpos.
