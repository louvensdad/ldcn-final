import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AppendDecisionEventInput, ArchitectureDecision, RepairAdvisory, TeamCompositionDecision, WorkRoutingDecision } from 'ldcn-core';
import { PrismaService } from '../persistence/prisma.service';
import { MissionPersistenceService } from '../persistence/mission-persistence.service';
import { GeneratorService } from '../generator/generator.service';
import { LLM_CLIENT, LlmClient } from './deepseek-client';

export interface ExplainDecisionUsage {
  provider: 'deepseek';
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
}

export interface ExplainDecisionResult {
  explanation: string;
  usage: ExplainDecisionUsage;
}

const SYSTEM_PROMPT =
  'Você explica decisões de software já tomadas por um sistema determinístico, para uma pessoa não-técnica. ' +
  'Baseie-se SOMENTE nos fatos fornecidos — nunca invente informação que não esteja neles. ' +
  'Não descreva um processo de raciocínio interno, só o resultado e o porquê. Linguagem simples, poucos parágrafos.';

/**
 * doc 43 §5 "Ask AI" — the LLM only narrates a decision core already made deterministically; it
 * never decides anything (doc 1's "LLM proposes; contract limits; gate proves" rule stays
 * intact). The explanation text itself isn't persisted — asking again just re-calls the LLM, so
 * it's always current — only usage metadata (doc 43 §11: provider/model/tokens/latency, no cost
 * — DeepSeek's pricing isn't tracked here to avoid quietly going stale) is recorded, as a
 * DecisionEvent, the same audit trail every other real action in this system already uses.
 */
@Injectable()
export class AssistantService {
  constructor(
    @Inject(LLM_CLIENT) private readonly llm: LlmClient,
    private readonly prisma: PrismaService,
    private readonly missionPersistence: MissionPersistenceService,
    private readonly generator: GeneratorService
  ) {}

  async explainArchitectureDecision(missionId: string, decisionId: string): Promise<ExplainDecisionResult> {
    const decision = await this.findArchitectureDecision(missionId, decisionId);
    return this.explainAndRecord(missionId, 'ArchitectureDecision', decisionId, this.describeArchitectureDecision(decision));
  }

  async explainTeamDecision(missionId: string, decisionId: string): Promise<ExplainDecisionResult> {
    const decision = await this.findTeamDecision(missionId, decisionId);
    return this.explainAndRecord(missionId, 'TeamCompositionDecision', decisionId, this.describeTeamDecision(decision));
  }

  async explainRoutingDecision(missionId: string, taskId: string): Promise<ExplainDecisionResult> {
    const decision = await this.findRoutingDecision(missionId, taskId);
    return this.explainAndRecord(missionId, 'WorkRoutingDecision', decision.id, this.describeRoutingDecision(decision));
  }

  async explainRepairAdvisory(missionId: string, taskId: string): Promise<ExplainDecisionResult> {
    const advisory = await this.findRepairAdvisory(missionId, taskId);
    return this.explainAndRecord(missionId, 'RepairAdvisory', advisory.id, this.describeRepairAdvisory(advisory));
  }

  private async explainAndRecord(missionId: string, aggregateType: string, aggregateId: string, user: string): Promise<ExplainDecisionResult> {
    const startedAt = Date.now();
    let completion;
    try {
      completion = await this.llm.complete({ system: SYSTEM_PROMPT, user });
    } catch {
      throw new Error('AI_EXPLANATION_UNAVAILABLE');
    }
    const latencyMs = Date.now() - startedAt;

    const usage: ExplainDecisionUsage = {
      provider: 'deepseek',
      model: completion.model,
      promptTokens: completion.promptTokens,
      completionTokens: completion.completionTokens,
      totalTokens: completion.promptTokens + completion.completionTokens,
      latencyMs,
    };

    await this.recordUsage(missionId, aggregateType, aggregateId, usage);

    return { explanation: completion.text, usage };
  }

  private async findArchitectureDecision(missionId: string, decisionId: string): Promise<ArchitectureDecision> {
    const queries = await this.generator.queries(missionId);
    const composition = queries.getArchitecture(missionId);
    const decision = composition?.proposals.flatMap((proposal) => proposal.decisions).find((candidate) => candidate.id === decisionId);
    if (!decision) throw new NotFoundException('ARCHITECTURE_DECISION_NOT_FOUND');
    return decision;
  }

  private async findTeamDecision(missionId: string, decisionId: string): Promise<TeamCompositionDecision> {
    const queries = await this.generator.queries(missionId);
    const team = queries.getTeamComposition(missionId);
    const decision = team?.decisions.find((candidate) => candidate.id === decisionId);
    if (!decision) throw new NotFoundException('TEAM_DECISION_NOT_FOUND');
    return decision;
  }

  private async findRoutingDecision(missionId: string, taskId: string): Promise<WorkRoutingDecision> {
    const row = await this.prisma.workRoutingDecisionRecord.findUnique({ where: { routingKey: `${missionId}:${taskId}` } });
    if (!row) throw new NotFoundException('ROUTING_DECISION_NOT_FOUND');
    return row.detailJson as unknown as WorkRoutingDecision;
  }

  private async findRepairAdvisory(missionId: string, taskId: string): Promise<RepairAdvisory> {
    const row = await this.prisma.repairAdvisory.findFirst({ where: { missionId, taskId }, orderBy: { createdAt: 'desc' } });
    if (!row) throw new NotFoundException('REPAIR_ADVISORY_NOT_FOUND');
    return row.detailJson as unknown as RepairAdvisory;
  }

  private describeArchitectureDecision(decision: ArchitectureDecision): string {
    return [
      `Tipo de decisão: arquitetura de software`,
      `Escopo: ${decision.scope}`,
      `Problema: ${decision.problem}`,
      `Opções consideradas: ${decision.optionsConsidered.join(', ') || 'nenhuma listada'}`,
      `Opção escolhida: ${decision.selectedOption}`,
      `Justificativa registrada: ${decision.rationale}`,
      `Restrições: ${decision.constraints.join(', ') || 'nenhuma'}`,
      `Trade-offs: ${decision.tradeoffs.join(', ') || 'nenhum listado'}`,
      `Decidido por: ${decision.decidedBy}`,
    ].join('\n');
  }

  private describeTeamDecision(decision: TeamCompositionDecision): string {
    return [
      `Tipo de decisão: composição de time de agentes`,
      `Escopo: ${decision.scope}`,
      `Problema: ${decision.problem}`,
      `Opção escolhida: ${decision.selectedOption}`,
      `Justificativa registrada: ${decision.rationale}`,
      `Regras aplicadas: ${decision.rulesApplied.join(', ') || 'nenhuma listada'}`,
      `Decidido por: ${decision.decidedBy}`,
    ].join('\n');
  }

  private describeRoutingDecision(decision: WorkRoutingDecision): string {
    return [
      `Tipo de decisão: roteamento de uma task para um time/agente executor`,
      `Task: ${decision.taskId}`,
      `Time selecionado: ${decision.selectedTeamKey ?? 'nenhum'}`,
      `Especialistas requeridos: ${decision.requiredSpecialists.join(', ') || 'nenhum'}`,
      `Capacidades requeridas: ${decision.requiredCapabilityKeys.join(', ') || 'nenhuma'}`,
      `Confiança da decisão: ${decision.confidence}`,
      `Justificativa registrada: ${decision.rationale}`,
      `Status: ${decision.status}`,
    ].join('\n');
  }

  private describeRepairAdvisory(advisory: RepairAdvisory): string {
    return [
      `Tipo de decisão: recomendação de reparo (advisory) após uma falha`,
      `Task: ${advisory.taskId}`,
      `Código da falha: ${advisory.failureCode}`,
      `Especialista recomendado: ${advisory.likelySpecialistRole}`,
      `Capacidades necessárias: ${advisory.likelyCapabilities.join(', ') || 'nenhuma listada'}`,
      `Risco: ${advisory.risk}`,
      `Taxa de sucesso estimada: ${Math.round(advisory.estimatedSuccess * 100)}%`,
      `Justificativa registrada: ${advisory.rationale}`,
    ].join('\n');
  }

  private async recordUsage(missionId: string, aggregateType: string, aggregateId: string, usage: ExplainDecisionUsage): Promise<void> {
    const session = await this.missionPersistence.hydrate(missionId);
    const event: AppendDecisionEventInput = {
      missionId,
      eventType: 'AI_EXPLANATION_GENERATED',
      aggregateType,
      aggregateId,
      idempotencyKey: `ai-explanation:${missionId}:${aggregateType}:${aggregateId}:${Date.now()}`,
      // Field names deliberately avoid the substring "token": DecisionEventRepository's sanitize()
      // (decision-event-store.ts) redacts any payload key matching /secret|token|password|.../i to
      // guard against credentials leaking into the audit log — promptTokens/totalTokens etc. would
      // silently disappear from the persisted event even though they're just counts, not secrets.
      payload: {
        aggregateType,
        aggregateId,
        provider: usage.provider,
        model: usage.model,
        promptUnits: usage.promptTokens,
        completionUnits: usage.completionTokens,
        totalUnits: usage.totalTokens,
        latencyMs: usage.latencyMs,
      },
    };
    session.eventStore.append(event);
    await this.missionPersistence.flush(missionId, session);
  }
}
