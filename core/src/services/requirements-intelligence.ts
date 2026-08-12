import { generateId } from '../utils/id';
import {
  Priority,
  RequirementCategory,
  RequirementItem,
  RequirementsContract,
} from '../domain/requirements-contract';
import { ClassifiedItem, ProjectIntent } from '../domain/project-intent';

export class RequirementsIntelligence {
  buildContract(intent: ProjectIntent): RequirementsContract {
    const items: RequirementItem[] = [];

    const add = (
      category: RequirementCategory,
      description: string,
      source: 'USER_EXPLICIT' | 'INFERRED',
      priority: Priority,
      impact: 'LOW' | 'MEDIUM' | 'HIGH'
    ) => {
      items.push({
        id: generateId(),
        category,
        description,
        source,
        priority,
        acceptanceCriteria: this.inferAcceptanceCriteria(category, description),
        ambiguity: source === 'USER_EXPLICIT' ? 'CLEAR' : 'MEDIUM',
        impact,
      });
    };

    intent.explicitRequirements.forEach((req: ClassifiedItem) => {
      add('functional', req.value, req.source as 'USER_EXPLICIT' | 'INFERRED', 'must', 'HIGH');
    });

    intent.explicitConstraints.forEach((constraint: ClassifiedItem) => {
      add('deploymentConstraints', constraint.value, 'USER_EXPLICIT', 'must', 'HIGH');
    });

    intent.targetUsers.forEach((user: ClassifiedItem) => {
      add('actors', user.value, user.source as 'USER_EXPLICIT' | 'INFERRED', 'must', 'HIGH');
    });

    intent.businessGoals.forEach((goal: ClassifiedItem) => {
      add('businessRules', goal.value, goal.source as 'USER_EXPLICIT' | 'INFERRED', 'should', 'MEDIUM');
    });

    intent.inferredNeeds.forEach((need: ClassifiedItem) => {
      if (need.value.toLowerCase().includes('time-to-market')) {
        add('timeToMarket', need.value, 'INFERRED', 'should', 'MEDIUM');
      } else if (need.value.toLowerCase().includes('escala')) {
        add('scale', need.value, 'INFERRED', 'could', 'MEDIUM');
      } else {
        add('nonFunctional', need.value, 'INFERRED', 'could', 'LOW');
      }
    });

    add('functional', intent.problemStatement, 'INFERRED', 'must', 'HIGH');

    if (intent.technologyPreferences.length > 0) {
      add(
        'deploymentConstraints',
        `Preferências tecnológicas: ${intent.technologyPreferences.join(', ')}`,
        'USER_EXPLICIT',
        'should',
        'MEDIUM'
      );
    }

    return {
      id: generateId(),
      missionId: intent.missionId,
      version: 1,
      intentId: intent.id,
      items,
      status: 'DRAFT',
    };
  }

  approve(contract: RequirementsContract): RequirementsContract {
    return { ...contract, status: 'APPROVED' };
  }

  private inferAcceptanceCriteria(category: RequirementCategory, description: string): string[] {
    if (category === 'functional' && description.toLowerCase().includes('autenticação')) {
      return ['Usuário consegue fazer login', 'Senha é validada'];
    }
    if (category === 'functional' && description.toLowerCase().includes('dashboard')) {
      return ['Dados são exibidos em tela', 'Filtros funcionam'];
    }
    return ['Critério de aceite ainda será detalhado'];
  }
}
