import { generateId } from '../utils/id';
import { RequirementsContract } from '../domain/requirements-contract';
import { SolutionProposal } from '../domain/solution-proposal';
import { SolutionTopology } from '../domain/solution-topology';

export interface SolutionPlannerInput {
  contract: RequirementsContract;
  topology: SolutionTopology;
  userConstraints?: string[];
}

export class SolutionPlanner {
  plan(input: SolutionPlannerInput): SolutionProposal {
    if (input.contract.status !== 'APPROVED') {
      throw new Error('RequirementsContract must be APPROVED before solution planning');
    }
    if (input.topology.status !== 'APPROVED') {
      throw new Error('SolutionTopology must be APPROVED before solution planning');
    }

    const approvedTargets = input.topology.deliveryTargets
      .filter((t) => t.status === 'APPROVED' || (t.status === 'PROPOSED' && t.required))
      .map((t) => t.kind);

    const hasBackend = approvedTargets.includes('BACKEND');
    const hasFrontend = approvedTargets.includes('FRONTEND');
    const hasAI = approvedTargets.includes('AI');

    let recommended = 'Aplicação web simples';
    const alternatives: string[] = [];

    if (hasBackend && hasFrontend) {
      recommended = 'Aplicação web full-stack com API backend e interface frontend';
      alternatives.push('Monolito full-stack single runtime');
    } else if (hasBackend) {
      recommended = 'API backend headless';
      alternatives.push('Serverless functions');
    } else if (hasFrontend) {
      recommended = 'Aplicação frontend estática ou SPA';
      alternatives.push('Jamstack com SSG');
    }

    if (hasAI) {
      recommended += ', com componentes de IA integrados';
      alternatives.push('Pipeline de ML separado');
    }

    return {
      id: generateId(),
      missionId: input.contract.missionId,
      version: 1,
      requirementsContractId: input.contract.id,
      topologyId: input.topology.id,
      recommendedSolution: recommended,
      alternatives,
      rationale: this.buildRationale(input),
      tradeoffs: this.buildTradeoffs(approvedTargets),
      risks: this.buildRisks(input),
      assumptions: ['Usuário validará a proposta antes da seleção de stacks'],
    };
  }

  private buildRationale(input: SolutionPlannerInput): string {
    const items = input.contract.items;
    const hasTimeToMarket = items.some((i) => i.category === 'timeToMarket');
    const hasScale = items.some((i) => i.category === 'scale');
    const parts: string[] = ['Solução escolhida para atender os requisitos aprovados.'];
    if (hasTimeToMarket) parts.push('Prioriza time-to-market curto.');
    if (hasScale) parts.push('Considera escalabilidade desde o início.');
    return parts.join(' ');
  }

  private buildTradeoffs(targets: string[]): string[] {
    const tradeoffs: string[] = [];
    if (targets.includes('BACKEND') && targets.includes('FRONTEND')) {
      tradeoffs.push('Maior flexibilidade, mas mais componentes para operar.');
    }
    if (!targets.includes('FRONTEND')) {
      tradeoffs.push('Menor superfície de usuário, mas depende de consumidores externos.');
    }
    return tradeoffs;
  }

  private buildRisks(input: SolutionPlannerInput): string[] {
    const risks: string[] = ['Requisitos podem evoluir durante a implementação.'];
    if (input.contract.items.some((i) => i.ambiguity === 'HIGH')) {
      risks.push('Alto nível de ambiguidade em requisitos críticos.');
    }
    return risks;
  }
}
