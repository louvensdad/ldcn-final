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
├── core/                                  ← implementação do core de decisão
│   ├── src/
│   │   ├── domain/                        ← entidades e contratos
│   │   ├── services/                      ← serviços de cada camada
│   │   ├── policies/                      ← políticas de escopo e aprovação
│   │   ├── registry/                      ← catálogo de stacks
│   │   ├── __tests__/                     ← testes unitários
│   │   └── generator.ts                   ← orquestração do fluxo principal
│   ├── package.json
│   ├── tsconfig.json
│   └── jest.config.js
└── LDCN_Gerador_Inteligente_Obsidian/     ← vault do Obsidian
    ├── 00 - Gerador Inteligente - Mapa Raiz.md
    ├── 01 - Constituição e Visão Geral.md
    ├── 02 - Intent Understanding.md
    ├── 03 - Requirements Intelligence.md
    ├── 04 - Solution Topology.md
    ├── 05 - Solution Planning.md
    ├── 06 - Technology Selection.md
    ├── 07 - Stack Registry e Team Catalog.md
    ├── 08 - Architecture Composition.md
    ├── 09 - Approved Solution.md
    ├── 10 - TeamComposer V2.md
    ├── 11 - Dynamic Pipeline Composer.md
    ├── 12 - Job Classification.md
    ├── 13 - Intelligent Work Router.md
    ├── 14 - Team Switching e Handoffs.md
    ├── 15 - Integration Unit.md
    ├── 16 - Scope Expansion.md
    ├── 17 - Execution Runtime.md
    ├── 18 - Review Gates e Repair.md
    ├── 19 - Learning Intelligence e ML.md
    ├── 20 - Memory e Context Budgeting.md
    ├── 21 - Governance Segurança e Replanning.md
    ├── 22 - Observability Audit e Tracing.md
    ├── 23 - Backend NestJS APIs e Persistência.md
    ├── 24 - Exemplos End-to-End.md
    ├── 25 - Prompts Mestres.md
    ├── 26 - Critérios de Aceite e Testes.md
    ├── 27 - Slices Prompts Codex e Roadmap.md
    ├── 28 - Decisão Final de Arquitetura.md
    ├── 29 - Empresa de Agentes - Times Stacks e Prompts.md
    └── README.md
```

---

## 🚀 Como usar

### No Obsidian

1. Copie a pasta `LDCN_Gerador_Inteligente_Obsidian` para dentro do seu vault.
2. Abra `00 - Gerador Inteligente - Mapa Raiz`.
3. Navegue pelos links `[[...]]`.
4. Use o **Graph View** do Obsidian para visualizar as relações entre as camadas.

> Não renomeie os arquivos sem atualizar os wikilinks.

### No navegador de arquivos

- Comece por [`LDCN_Gerador_Inteligente_Obsidian/00 - Gerador Inteligente - Mapa Raiz.md`](./LDCN_Gerador_Inteligente_Obsidian/00%20-%20Gerador%20Inteligente%20-%20Mapa%20Raiz.md).
- Leia [`01 - Constituição e Visão Geral.md`](./LDCN_Gerador_Inteligente_Obsidian/01%20-%20Constituição%20e%20Visão%20Geral.md) para entender as regras fundamentais.
- Consulte [`28 - Decisão Final de Arquitetura.md`](./LDCN_Gerador_Inteligente_Obsidian/28%20-%20Decisão%20Final%20de%20Arquitetura.md) para o resumo da divisão de autoridade.

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
| [`00 - Gerador Inteligente - Mapa Raiz.md`](./LDCN_Gerador_Inteligente_Obsidian/00%20-%20Gerador%20Inteligente%20-%20Mapa%20Raiz.md) | Ponto de entrada e índice canônico |
| [`01 - Constituição e Visão Geral.md`](./LDCN_Gerador_Inteligente_Obsidian/01%20-%20Constituição%20e%20Visão%20Geral.md) | Regras fundamentais e fluxo completo |
| [`07 - Stack Registry e Team Catalog.md`](./LDCN_Gerador_Inteligente_Obsidian/07%20-%20Stack%20Registry%20e%20Team%20Catalog.md) | Catálogo de stacks e times |
| [`09 - Approved Solution.md`](./LDCN_Gerador_Inteligente_Obsidian/09%20-%20Approved%20Solution.md) | Fronteira oficial de escopo |
| [`28 - Decisão Final de Arquitetura.md`](./LDCN_Gerador_Inteligente_Obsidian/28%20-%20Decisão%20Final%20de%20Arquitetura.md) | Resumo da divisão de autoridade |
| [`29 - Empresa de Agentes - Times Stacks e Prompts.md`](./LDCN_Gerador_Inteligente_Obsidian/29%20-%20Empresa%20de%20Agentes%20-%20Times%20Stacks%20e%20Prompts.md) | Visão organizacional completa |

---

## 🛠️ Status

- Documentação canônica em evolução no Obsidian vault.
- **Core de decisão implementado em `core/`** cobrindo Intent → ApprovedSolution com testes passando.
