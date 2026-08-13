import { generateId } from '../utils/id';
import { RequirementsContract } from '../domain/requirements-contract';
import {
  DeliveryTarget,
  DeliveryTargetKind,
  SolutionTopology,
  TargetSource,
  TargetStatus,
} from '../domain/solution-topology';
import { ScopePolicy } from '../policies/scope-policy';
import { createHash } from 'crypto';

export interface TopologyResolverInput {
  contract: RequirementsContract;
  forbiddenTargets: DeliveryTargetKind[];
  explicitTargets?: DeliveryTargetKind[];
}

export class TopologyResolver {
  resolve(input: TopologyResolverInput): SolutionTopology {
    if (input.contract.status !== 'APPROVED') {
      throw new Error('RequirementsContract must be APPROVED before topology resolution');
    }

    const deliveryTargets: DeliveryTarget[] = [];
    const allKinds: DeliveryTargetKind[] = [
      'BACKEND',
      'FRONTEND',
      'MOBILE',
      'DATA',
      'AI',
      'EXTERNAL_INTEGRATION',
    ];

    for (const kind of allKinds) {
      const target = this.buildTarget(kind, input);
      deliveryTargets.push(target);
    }

    const scopeValidation = ScopePolicy.validate(deliveryTargets, input.forbiddenTargets);
    if (!scopeValidation.valid) {
      throw new Error(`Scope violation: ${scopeValidation.violations.join('; ')}`);
    }

    return {
      id: generateId(),
      missionId: input.contract.missionId,
      requirementsContractId: input.contract.id,
      version: 1,
      deliveryTargets,
      contextHash: createHash('sha256').update(JSON.stringify({ contractId: input.contract.id, deliveryTargets: deliveryTargets.map((target) => [target.kind, target.required, target.status]) })).digest('hex'),
      status: 'PROPOSED',
    };
  }

  approve(topology: SolutionTopology): SolutionTopology {
    const deliveryTargets = topology.deliveryTargets.map((t) =>
      t.status === 'PROPOSED' && t.required ? { ...t, status: 'APPROVED' as TargetStatus } : t
    );
    return {
      ...topology,
      status: 'APPROVED',
      deliveryTargets,
      contextHash: createHash('sha256').update(JSON.stringify({ contractId: topology.requirementsContractId, deliveryTargets: deliveryTargets.map((target) => [target.kind, target.required, target.status]) })).digest('hex'),
    };
  }

  private buildTarget(
    kind: DeliveryTargetKind,
    input: TopologyResolverInput
  ): DeliveryTarget {
    const forbidden = input.forbiddenTargets.includes(kind);
    const explicit = input.explicitTargets?.includes(kind);
    const inferred = this.inferRequired(kind, input.contract);

    if (forbidden) {
      return {
        kind,
        required: false,
        source: 'USER_EXPLICIT',
        rationale: `Target explicitly forbidden by user scope`,
        status: 'FORBIDDEN_BY_SCOPE',
      };
    }

    if (explicit) {
      return {
        kind,
        required: true,
        source: 'USER_EXPLICIT',
        rationale: `Target explicitly requested by user`,
        status: 'PROPOSED',
      };
    }

    if (inferred) {
      return {
        kind,
        required: true,
        source: 'REQUIREMENTS_INFERRED',
        rationale: `Target inferred from requirements`,
        status: 'PROPOSED',
      };
    }

    return {
      kind,
      required: false,
      source: 'ARCHITECTURE_RECOMMENDED',
      rationale: `Target not required, available as architecture recommendation`,
      status: 'PROPOSED',
    };
  }

  private inferRequired(kind: DeliveryTargetKind, contract: RequirementsContract): boolean {
    const text = contract.items.map((i) => i.description.toLowerCase()).join(' ');
    const has = (...terms: string[]) => terms.some((term) => this.matchesTerm(text, term));

    switch (kind) {
      case 'BACKEND':
        return has('api', 'backend', 'servidor');
      case 'FRONTEND':
        return has(
          'dashboard',
          'tela',
          'interface',
          'landing page',
          'site institucional',
          'página institucional',
          'pagina institucional',
          'blog',
          'portfólio',
          'portfolio'
        );
      case 'MOBILE':
        return has('mobile', 'app', 'celular');
      case 'AI':
        return has('ia', 'modelo', 'prever');
      case 'DATA':
        return has('dados', 'etl', 'lake');
      case 'EXTERNAL_INTEGRATION':
        return has('integração', 'webhook', 'externo');
      default:
        return false;
    }
  }

  /** Palavras curtas/ambíguas usam limite de palavra (\b) para evitar falso positivo
   * como "ia" dentro de "gerenciar" ou "api" dentro de "terapia". Frases com espaço
   * já são específicas o suficiente para usar substring simples. */
  private matchesTerm(text: string, term: string): boolean {
    if (term.includes(' ')) return text.includes(term);
    return new RegExp(`\\b${term}\\b`, 'iu').test(text);
  }
}
