import { generateId } from '../utils/id';
import { ArchitectureDecision } from '../domain/architecture-decision';
import {
  ArchitectureModule,
  StackArchitectureProposal,
} from '../domain/stack-architecture-proposal';
import { RequirementsContract } from '../domain/requirements-contract';
import { ApprovedSolution, SelectedStack } from '../domain/approved-solution';
import { StackDefinition } from '../registry/stack-registry';
import { ArchitectureStyle, findDefaultStyle, findStyleByKey } from '../registry/architecture-styles';

export interface StackArchitectInput {
  approvedSolution: ApprovedSolution;
  selectedStack: SelectedStack;
  stackDefinition: StackDefinition;
  contract: RequirementsContract;
}

export class StackArchitect {
  design(input: StackArchitectInput): StackArchitectureProposal {
    const { approvedSolution, selectedStack, stackDefinition, contract } = input;

    const style = this.selectStyle(selectedStack.stackKey, contract);
    const modules = this.adaptModules(style, contract);
    const decisions = this.generateDecisions(style, selectedStack, contract);

    return {
      id: generateId(),
      missionId: approvedSolution.missionId,
      approvedSolutionId: approvedSolution.id,
      stackKey: selectedStack.stackKey,
      deliveryTargetKind: selectedStack.deliveryTargetKind,
      architectureStyle: style.key,
      modules,
      boundaries: this.inferBoundaries(modules),
      dependencies: this.inferDependencies(selectedStack, contract),
      persistence: style.persistence,
      security: [...style.security],
      communication: [...style.communication],
      observability: [...style.observability],
      buildStrategy: style.build,
      testStrategy: style.test,
      deploymentStrategy: style.deployment,
      decisions,
      alternatives: [...style.tradeoffs.map((t) => `Alternative: ${t}`)],
      tradeoffs: [...style.tradeoffs],
      risks: [...style.risks],
      status: 'PROPOSED',
    };
  }

  private selectStyle(stackKey: string, contract: RequirementsContract): ArchitectureStyle {
    const defaultStyle = findDefaultStyle(stackKey);
    if (!defaultStyle) {
      throw new Error(`No default architecture style found for stack ${stackKey}`);
    }

    const items = contract.items.map((i) => i.description.toLowerCase());
    const needsScale = items.some((t) => t.includes('escala') || t.includes('scale') || t.includes('milhões'));
    const needsTimeToMarket = items.some((t) => t.includes('mvp') || t.includes('rápido') || t.includes('time-to-market'));

    if (stackKey === 'stack.java.spring-boot' || stackKey === 'stack.typescript.nestjs') {
      if (needsScale && !needsTimeToMarket) {
        const microservices = findStyleByKey('microservices');
        if (microservices) return microservices;
      }
    }

    return defaultStyle;
  }

  private adaptModules(style: ArchitectureStyle, contract: RequirementsContract): ArchitectureModule[] {
    const items = contract.items.map((i) => i.description.toLowerCase());
    const modules = style.modules.map((m) => ({ ...m }));

    if (items.some((t) => t.includes('auth') || t.includes('login'))) {
      const hasAuthModule = modules.some((m) => m.name.toLowerCase().includes('auth'));
      if (!hasAuthModule) {
        modules.push({
          name: 'auth',
          responsibility: 'Authentication and authorization',
          exposes: ['login', 'logout', 'token validation'],
          dependsOn: [],
        });
      }
    }

    return modules;
  }

  private generateDecisions(
    style: ArchitectureStyle,
    selectedStack: SelectedStack,
    contract: RequirementsContract
  ): ArchitectureDecision[] {
    const decisions: ArchitectureDecision[] = [
      {
        id: generateId(),
        scope: selectedStack.stackKey,
        problem: 'Which architecture style best fits the approved stack and requirements?',
        optionsConsidered: [style.key, ...style.tradeoffs.map(() => 'alternative considered')],
        selectedOption: style.name,
        rationale: `Selected based on stack ${selectedStack.stackKey} and approved requirements.`,
        constraints: contract.items
          .filter((i) => i.priority === 'must')
          .map((i) => i.description),
        tradeoffs: [...style.tradeoffs],
        decidedBy: selectedStack.stackKey.replace('stack', 'architecture').replace(/\./g, '.') + '.architect',
        reviewedBy: [],
        status: 'PROPOSED',
      },
    ];

    return decisions;
  }

  private inferBoundaries(modules: ArchitectureModule[]): string[] {
    return modules.map((m) => `${m.name} boundary`);
  }

  private inferDependencies(selectedStack: SelectedStack, contract: RequirementsContract): string[] {
    const deps: string[] = [];
    const text = contract.items.map((i) => i.description.toLowerCase()).join(' ');
    if (text.includes('database') || text.includes('persist')) {
      deps.push('Database');
    }
    if (text.includes('externo') || text.includes('integração') || text.includes('api externa')) {
      deps.push('External API');
    }
    if (selectedStack.deliveryTargetKind === 'FRONTEND') {
      deps.push('Backend API');
    }
    return deps;
  }
}

