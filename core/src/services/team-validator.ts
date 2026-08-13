import { generateId } from '../utils/id';
import { createHash } from 'crypto';
import { AgentTeam, AgentTeamCompositionInput } from '../domain/agent-team';

/**
 * Materializa e versiona a AgentTeam da Mission, aplicando a última linha de
 * defesa das regras do doc 10 antes da aprovação (o composer já as aplica na
 * proposta; o validator prova que elas se sustentam — "LLM propõe; contrato
 * limita; gate prova").
 */
export class TeamValidator {
  private teams: Map<string, AgentTeam> = new Map();

  validateAndApprove(input: AgentTeamCompositionInput): AgentTeam {
    // Uma AgentTeam vazia é um estado válido: nenhuma stack foi aprovada
    // ainda (ex.: ApprovedSolution sem DeliveryTargets requeridos). Isso não
    // é um erro do TeamComposer — não há nada de errado para provar aqui.
    this.assertReviewerIsNeverExecutor(input);

    const existing = this.teams.get(input.missionId);
    if (existing && existing.status === 'APPROVED' && existing.approvedSolutionId === input.approvedSolutionId && existing.architectureCompositionId === input.architectureCompositionId && JSON.stringify(existing.instances.map((i) => [i.agentKey, i.role, i.stackKey])) === JSON.stringify(input.instances.map((i) => [i.agentKey, i.role, i.stackKey]))) return existing;
    if (existing) {
      this.teams.set(input.missionId, { ...existing, status: 'PROPOSED' });
    }

    const team: AgentTeam = {
      id: generateId(),
      missionId: input.missionId,
      version: existing ? existing.version + 1 : 1,
      approvedSolutionId: input.approvedSolutionId,
      architectureCompositionId: input.architectureCompositionId,
      complexityProfile: input.complexityProfile,
      riskProfile: input.riskProfile,
      instances: input.instances,
      decisions: input.decisions,
      contextHash: createHash('sha256').update(JSON.stringify({ approvedSolutionId: input.approvedSolutionId, architectureCompositionId: input.architectureCompositionId, instances: input.instances.map((instance) => [instance.agentKey, instance.role, instance.stackKey]) })).digest('hex'),
      status: 'APPROVED',
    };

    this.teams.set(input.missionId, team);
    return team;
  }

  getActive(missionId: string): AgentTeam | undefined {
    const team = this.teams.get(missionId);
    return team?.status === 'APPROVED' ? team : undefined;
  }

  /** Rule 4 (doc 10): "Reviewer != executor". */
  private assertReviewerIsNeverExecutor(input: AgentTeamCompositionInput): void {
    const byStack = new Map<string | undefined, Set<string>>();
    for (const instance of input.instances) {
      const executorRoles = new Set(['LEAD', 'SENIOR_DEVELOPER', 'DEVELOPER']);
      if (!executorRoles.has(instance.role)) continue;
      const key = instance.stackKey;
      if (!byStack.has(key)) byStack.set(key, new Set());
      byStack.get(key)!.add(instance.agentKey);
    }

    for (const instance of input.instances) {
      if (instance.role !== 'REVIEWER' && instance.role !== 'INTEGRATION_REVIEWER') continue;
      const executors = byStack.get(instance.stackKey);
      if (executors?.has(instance.agentKey)) {
        throw new Error(
          `Reviewer inválido: agente ${instance.agentKey} também atua como executor na stack ${instance.stackKey}.`
        );
      }
    }
  }
}
