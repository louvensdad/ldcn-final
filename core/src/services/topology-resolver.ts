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
      version: 1,
      deliveryTargets,
      status: 'PROPOSED',
    };
  }

  approve(topology: SolutionTopology): SolutionTopology {
    return {
      ...topology,
      status: 'APPROVED',
      deliveryTargets: topology.deliveryTargets.map((t) =>
        t.status === 'PROPOSED' && t.required ? { ...t, status: 'APPROVED' as TargetStatus } : t
      ),
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

    switch (kind) {
      case 'BACKEND':
        return text.includes('api') || text.includes('backend') || text.includes('servidor');
      case 'FRONTEND':
        return text.includes('dashboard') || text.includes('tela') || text.includes('interface');
      case 'MOBILE':
        return text.includes('mobile') || text.includes('app') || text.includes('celular');
      case 'AI':
        return text.includes('ia') || text.includes('modelo') || text.includes('prever');
      case 'DATA':
        return text.includes('dados') || text.includes('etl') || text.includes('lake');
      case 'EXTERNAL_INTEGRATION':
        return text.includes('integração') || text.includes('webhook') || text.includes('externo');
      default:
        return false;
    }
  }
}
