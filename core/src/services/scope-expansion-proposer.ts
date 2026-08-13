import { ApprovedSolution, JobClassification, ScopeExpansionProposal } from '../domain';
import { StackRegistry } from '../registry/stack-registry';
import { generateId } from '../utils/id';
import { createHash } from 'crypto';

export interface ScopeExpansionInput {
  missionId: string;
  taskId: string;
  classification: JobClassification;
  approvedSolution: ApprovedSolution;
  registry: StackRegistry;
}

/** Explains scope change; it never mutates the approved solution. */
export class ScopeExpansionProposer {
  private proposals = new Map<string, ScopeExpansionProposal>();

  propose(input: ScopeExpansionInput): ScopeExpansionProposal | undefined {
    if (input.approvedSolution.status !== 'ACTIVE') throw new Error('Scope expansion requires an ACTIVE ApprovedSolution');
    if (input.missionId !== input.approvedSolution.missionId || input.missionId !== input.classification.missionId) throw new Error('Scope expansion entities belong to different missions');
    if (!input.classification.scopeExpansionRequired || !input.classification.deliveryTarget) return undefined;

    const target = input.classification.deliveryTarget;
    const key = `${input.missionId}:${input.taskId}:${input.classification.contextHash}`;
    const existing = this.proposals.get(key);
    if (existing) return existing;
    const approvedStacks = new Set(input.approvedSolution.selectedStacks.map((s) => s.stackKey));
    const recommendedStacks = input.registry.findByDeliveryTarget(target).filter((s) => !approvedStacks.has(s.key)).map((s) => s.key);
    const proposal: ScopeExpansionProposal = {
      id: generateId(), missionId: input.missionId, version: 1, sourceTaskId: input.taskId,
      requestedDeliveryTarget: target, recommendedStacks,
      reason: `O job exige o target ${target}, que nÃ£o estÃ¡ presente na ApprovedSolution ativa.`,
      requirementsImpact: [`Adicionar requisitos do target ${target}`, 'Revalidar acceptance criteria e contratos afetados.'],
      architectureImpact: ['Compor e aprovar arquitetura para a nova stack.', 'Reavaliar fronteiras e integraÃ§Ãµes existentes.'],
      teamImpact: ['Compor nova equipe somente apÃ³s aprovaÃ§Ã£o.', 'Reavaliar reviewer, capabilities e Integration Unit.'],
      pipelineImpact: ['Adicionar nodes somente apÃ³s a nova soluÃ§Ã£o ser aprovada.', 'Recalcular dependÃªncias e gates cross-stack.'],
      costImpact: recommendedStacks.length > 1 ? 'HIGH' : 'MEDIUM',
      riskImpact: target === 'MOBILE' || target === 'AI' ? 'HIGH' : 'MEDIUM',
      requiresApproval: true, status: 'PROPOSED',
      contextHash: createHash('sha256').update(JSON.stringify({ missionId: input.missionId, taskId: input.taskId, classificationHash: input.classification.contextHash, solutionId: input.approvedSolution.id, target })).digest('hex'),
    };
    this.proposals.set(key, proposal);
    return proposal;
  }
}
