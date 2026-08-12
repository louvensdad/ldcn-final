import { generateId } from '../utils/id';
import {
  ClassifiedItem,
  IntentInput,
  ProjectIntent,
  UnknownItem,
} from '../domain/project-intent';
import { DecisionConfidence } from '../domain/shared';
import { DeliveryTargetKind } from '../domain/solution-topology';

export class IntentAnalyzer {
  analyze(input: IntentInput): ProjectIntent {
    const idea = input.rawUserIdea.toLowerCase();

    const targetUsers: ClassifiedItem[] = this.extractTargetUsers(idea);
    const businessGoals: ClassifiedItem[] = this.extractBusinessGoals(idea);
    const explicitRequirements: ClassifiedItem[] = this.extractRequirements(idea);
    const explicitConstraints: ClassifiedItem[] = this.extractConstraints(
      input.constraints ?? []
    );
    const inferredNeeds: ClassifiedItem[] = this.inferNeeds(idea);
    const unknowns: UnknownItem[] = this.identifyUnknowns(idea);

    const confidence: DecisionConfidence = {
      value: this.computeConfidence(unknowns),
      missingInformation: unknowns.map((u) => u.description),
      decisionImpact: this.maxImpact(unknowns),
    };

    return {
      id: generateId(),
      missionId: input.missionId,
      version: 1,
      rawUserIdea: input.rawUserIdea,
      problemStatement: this.extractProblemStatement(idea),
      targetUsers,
      businessGoals,
      explicitRequirements,
      explicitConstraints,
      inferredNeeds,
      unknowns,
      technologyPreferences: input.technologyPreferences ?? [],
      forbiddenDeliveryTargets: input.forbiddenDeliveryTargets ?? [],
      confidence,
      status: confidence.decisionImpact === 'HIGH' ? 'DRAFT' : 'READY',
    };
  }

  private extractProblemStatement(idea: string): string {
    if (idea.includes('gerenciar') || idea.includes('manage')) {
      return 'Organizar e controlar informações ou processos de forma digital.';
    }
    if (idea.includes('vender') || idea.includes('e-commerce') || idea.includes('loja')) {
      return 'Permitir vendas online de produtos ou serviços.';
    }
    if (idea.includes('prever') || idea.includes('classificar') || idea.includes('modelo')) {
      return 'Aplicar inteligência artificial para predição ou classificação.';
    }
    return 'Atender uma necessidade digital do usuário.';
  }

  private extractTargetUsers(idea: string): ClassifiedItem[] {
    const users: ClassifiedItem[] = [];
    if (idea.includes('cliente') || idea.includes('customer')) {
      users.push({ value: 'Clientes finais', source: 'INFERRED' });
    }
    if (idea.includes('admin') || idea.includes('gestor') || idea.includes('manager')) {
      users.push({ value: 'Administradores internos', source: 'INFERRED' });
    }
    if (users.length === 0) {
      users.push({ value: 'Usuários genéricos', source: 'UNKNOWN' });
    }
    return users;
  }

  private extractBusinessGoals(idea: string): ClassifiedItem[] {
    const goals: ClassifiedItem[] = [];
    if (idea.includes('automatizar') || idea.includes('automation')) {
      goals.push({ value: 'Automatizar processos manuais', source: 'INFERRED' });
    }
    if (idea.includes('vender') || idea.includes('receita')) {
      goals.push({ value: 'Aumentar receita', source: 'INFERRED' });
    }
    if (goals.length === 0) {
      goals.push({ value: 'Resolver o problema declarado pelo usuário', source: 'INFERRED' });
    }
    return goals;
  }

  private extractRequirements(idea: string): ClassifiedItem[] {
    const requirements: ClassifiedItem[] = [];
    if (idea.includes('login') || idea.includes('auth')) {
      requirements.push({ value: 'Autenticação de usuários', source: 'INFERRED' });
    }
    if (idea.includes('dashboard') || idea.includes('relatório')) {
      requirements.push({ value: 'Visualização de dados em dashboard', source: 'INFERRED' });
    }
    if (idea.includes('api') || idea.includes('integração')) {
      requirements.push({ value: 'API para integração', source: 'INFERRED' });
    }
    return requirements;
  }

  private extractConstraints(constraints: string[]): ClassifiedItem[] {
    return constraints.map((c) => ({ value: c, source: 'USER_EXPLICIT' }));
  }

  private inferNeeds(idea: string): ClassifiedItem[] {
    const needs: ClassifiedItem[] = [];
    if (idea.includes('rápido') || idea.includes('mvp') || idea.includes('prova de conceito')) {
      needs.push({ value: 'Time-to-market curto', source: 'INFERRED' });
    }
    if (idea.includes('escalar') || idea.includes('milhões')) {
      needs.push({ value: 'Escalabilidade horizontal', source: 'INFERRED' });
    }
    return needs;
  }

  private identifyUnknowns(idea: string): UnknownItem[] {
    const unknowns: UnknownItem[] = [];
    if (!idea.includes('usuário') && !idea.includes('cliente')) {
      unknowns.push({
        description: 'Quem são os usuários principais?',
        impact: 'MEDIUM',
      });
    }
    if (!idea.includes('orçamento') && !idea.includes('budget') && !idea.includes('prazo')) {
      unknowns.push({
        description: 'Qual é o budget e deadline?',
        impact: 'MEDIUM',
      });
    }
    if (!idea.includes('escala') && !idea.includes('usuários simultâneos')) {
      unknowns.push({
        description: 'Qual volume de usuários/dados é esperado?',
        impact: 'LOW',
      });
    }
    return unknowns;
  }

  private computeConfidence(unknowns: UnknownItem[]): number {
    if (unknowns.length === 0) return 1.0;
    const high = unknowns.filter((u) => u.impact === 'HIGH').length;
    const medium = unknowns.filter((u) => u.impact === 'MEDIUM').length;
    return Math.max(0.3, 1.0 - high * 0.25 - medium * 0.1);
  }

  private maxImpact(unknowns: UnknownItem[]): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (unknowns.some((u) => u.impact === 'HIGH')) return 'HIGH';
    if (unknowns.some((u) => u.impact === 'MEDIUM')) return 'MEDIUM';
    return 'LOW';
  }
}
