/**
 * MISSÃO "Targeted Generation no Marketplace" — Fase 1 do audit: este sistema não tem uma camada
 * de artifacts/symbols/rooms de código (confirmado por auditoria — ver relatório). O "delta" real
 * que existe para reaproveitar é o conjunto de DECISÕES já governadas de uma mission de
 * referência: stack selecionada, composição de arquitetura, equipe de agentes. `generate()`
 * sempre as redecide do zero a partir de um `rawUserIdea`; isso é uma fonte real de risco de
 * regressão (o mesmo PromptMaster quase idêntico pode produzir uma stack/arquitetura/equipe
 * DIFERENTE da já aprovada e revisada), não um custo de IA (este Generator não chama LLM).
 * `GenerationReuseScope` é o contrato que diz a `Generator.generateTargeted()` quais decisões já
 * aprovadas devem ser reaproveitadas (revalidadas contra o contexto novo, nunca copiadas sem
 * checagem) em vez de redecididas.
 */
export interface GenerationReuseScope {
  /** true = reaproveita `reference.approvedSolution`/`reference.selection` (revalidados contra a
   * topologia nova); false = roda o TechnologySelector do zero. */
  reuseStackSelection: boolean;
  /** true = reaproveita `reference.architectureComposition.proposals/conflicts` (revalidados);
   * false = roda o ArchitectureComposer do zero. */
  reuseArchitecture: boolean;
  /** true = reaproveita `reference.agentTeam.instances/decisions` (revalidados); false = roda o
   * TeamComposer do zero. */
  reuseTeam: boolean;
}

/** Fase 25 do brief ("Scope Escalation"), na forma real que este sistema (determinístico, sem
 * I/O de LLM em generate()) pode provar: reaproveitar uma decisão antiga pode falhar a
 * revalidação contra o contexto novo (ex: a equipe antiga não cobre um papel agora exigido) — não
 * é "um agente descobriu um impacto no meio da execução" (não existe execução multi-etapa aqui),
 * é a mesma validação real que qualquer geração usa recusando um reuso que não se sustenta.
 * `generateTargeted` nunca esconde isso: cada estágio que caiu para recomputação por causa de uma
 * falha de revalidação aparece aqui. */
export interface GenerationScopeEscalation {
  stage: 'STACK_SELECTION' | 'ARCHITECTURE' | 'TEAM';
  reason: string;
}
