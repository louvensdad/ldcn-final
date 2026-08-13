import { generateId } from '../utils/id';
import { AgentInstance, AgentRoleKind, TeamCompositionDecision } from '../domain/agent-team';
import { ApprovedArchitectureComposition } from '../domain/approved-architecture-composition';
import { ApprovedSolution } from '../domain/approved-solution';
import { RequirementsContract } from '../domain/requirements-contract';
import { StackArchitectureProposal } from '../domain/stack-architecture-proposal';
import { StackDefinition, StackRegistry } from '../registry/stack-registry';

export interface TeamComposerInput {
  approvedSolution: ApprovedSolution;
  architectureComposition: ApprovedArchitectureComposition;
  contract: RequirementsContract;
  registry: StackRegistry;
}

export interface TeamCompositionDraft {
  instances: AgentInstance[];
  decisions: TeamCompositionDecision[];
}

const RULES = [
  'somente stacks da ApprovedSolution',
  'composição mínima suficiente',
  'especialistas somente se necessário',
  'Reviewer != executor',
  'Integration Unit somente se houver integração real',
  'nenhum novo DeliveryTarget',
  'nenhuma expansão de scope',
];

/**
 * "10 - TeamComposer V2": monta a empresa autorizada para a Mission a partir
 * da ApprovedSolution e da ApprovedArchitectureComposition. Nunca cria stack,
 * DeliveryTarget ou escopo novo — apenas decide QUAIS agentes, dentre os já
 * autorizados pela stack e pela complexidade, participam da Mission Team.
 */
export class TeamComposer {
  compose(input: TeamComposerInput): TeamCompositionDraft {
    const instances: AgentInstance[] = [];
    const decisions: TeamCompositionDecision[] = [];

    const uniqueSelections = [...new Map(input.approvedSolution.selectedStacks.map((selection) => [selection.stackKey, selection])).values()];
    for (const selectedStack of uniqueSelections) {
      // Rule 1: somente stacks da ApprovedSolution.
      const stackDefinition = input.registry.get(selectedStack.stackKey);
      if (!stackDefinition) {
        throw new Error(
          `TeamComposer: stack ${selectedStack.stackKey} não está no registry; não é possível montar o time.`
        );
      }

      const proposal = input.architectureComposition.proposals.find(
        (p) => p.stackKey === selectedStack.stackKey
      );

      const { instances: stackInstances, decision } = this.composeForStack(
        stackDefinition,
        proposal,
        input.approvedSolution.complexityProfile,
        input.contract
      );

      instances.push(...stackInstances);
      decisions.push(decision);
    }

    if (this.needsIntegrationUnit(input.approvedSolution)) {
      const { instances: integrationInstances, decision } = this.composeIntegrationUnit(
        input.approvedSolution
      );
      instances.push(...integrationInstances);
      decisions.push(decision);
    }

    return { instances, decisions };
  }

  private composeForStack(
    stack: StackDefinition,
    proposal: StackArchitectureProposal | undefined,
    complexity: string,
    contract: RequirementsContract
  ): { instances: AgentInstance[]; decision: TeamCompositionDecision } {
    const catalog = stack.agentCatalog;
    const roles: AgentInstance[] = [];

    const push = (agentKey: string | undefined, role: AgentRoleKind, reason: string) => {
      if (!agentKey) return; // role não existe no catálogo desta stack — não fabricar agente.
      roles.push({ id: generateId(), agentKey, role, stackKey: stack.key, reason });
    };

    // Stack Architect participa em qualquer tier: já projetou a arquitetura (doc 08).
    push(
      stack.architectureAgentKey,
      'ARCHITECT',
      'Autor da StackArchitectureProposal aprovada; permanece disponível para dúvidas de design durante a execução.'
    );

    if (complexity === 'LOW') {
      push(
        catalog.leadAgentKey,
        'LEAD',
        'Complexidade LOW: Lead acumula desenvolvimento — composição mínima suficiente (doc 10, tier LOW).'
      );
      push(catalog.testEngineerAgentKey, 'TEST_ENGINEER', 'Cobertura de testes é obrigatória em todo tier.');
    } else if (complexity === 'MEDIUM') {
      push(catalog.leadAgentKey, 'LEAD', 'Complexidade MEDIUM: Lead coordena o time (doc 10, tier MEDIUM).');
      push(catalog.developerAgentKey, 'DEVELOPER', 'Implementação sob a orientação do Lead.');
      push(
        catalog.reviewerAgentKey,
        'REVIEWER',
        'Reviewer != executor: revisão independente é obrigatória a partir do tier MEDIUM.'
      );
      push(catalog.testEngineerAgentKey, 'TEST_ENGINEER', 'Cobertura de testes é obrigatória em todo tier.');
    } else {
      // HIGH
      push(catalog.leadAgentKey, 'LEAD', 'Complexidade HIGH: Lead coordena um time maior (doc 10, tier HIGH).');
      push(catalog.seniorDeveloperAgentKey, 'SENIOR_DEVELOPER', 'Decisões técnicas de maior risco exigem senioridade.');
      push(catalog.developerAgentKey, 'DEVELOPER', 'Capacidade de implementação para o volume de trabalho do tier HIGH.');
      push(
        catalog.developerAgentKey,
        'DEVELOPER',
        'Capacidade de implementação para o volume de trabalho do tier HIGH.'
      );
      push(
        catalog.frameworkSpecialistAgentKey,
        'FRAMEWORK_SPECIALIST',
        'Tier HIGH: profundidade específica do framework é necessária (doc 10, tier HIGH).'
      );
      push(
        catalog.reviewerAgentKey,
        'REVIEWER',
        'Reviewer != executor: revisão independente é obrigatória a partir do tier MEDIUM.'
      );
      push(catalog.testEngineerAgentKey, 'TEST_ENGINEER', 'Cobertura de testes é obrigatória em todo tier.');
      push(
        catalog.testEngineerAgentKey,
        'TEST_ENGINEER',
        'Volume de testes do tier HIGH exige mais de um Test Engineer.'
      );

      if (this.needsDataSpecialist(proposal)) {
        push(
          catalog.dataSpecialistAgentKey,
          'DATA_SPECIALIST',
          `Persistência real identificada na arquitetura (${proposal?.persistence ?? 'dependência de dados'}).`
        );
      }
      if (this.needsSecuritySpecialist(proposal, contract)) {
        push(
          catalog.securitySpecialistAgentKey,
          'SECURITY_SPECIALIST',
          'Requisitos de autenticação/segurança explícitos ou superfície ampliada (microservices).'
        );
      }
      if (this.needsRuntimeSpecialist(proposal, complexity)) {
        push(
          catalog.runtimeSpecialistAgentKey,
          'RUNTIME_SPECIALIST',
          `Estratégia de deployment (${proposal?.deploymentStrategy ?? 'tier HIGH'}) exige especialista de runtime.`
        );
      }
      if (this.needsPerformanceSpecialist(contract, complexity)) {
        push(
          catalog.performanceSpecialistAgentKey,
          'PERFORMANCE_SPECIALIST',
          'Requisito de escala identificado no RequirementsContract.'
        );
      }
    }

    const decision: TeamCompositionDecision = {
      id: generateId(),
      scope: stack.key,
      problem: 'Qual composição mínima suficiente de agentes atende esta stack dado o ComplexityProfile e as necessidades reais?',
      selectedOption: `${complexity} tier: ${roles.map((r) => r.role).join(', ')}`,
      rationale: `Composição derivada do tier ${complexity} (doc 10) e das necessidades reais observadas na StackArchitectureProposal/RequirementsContract.`,
      rulesApplied: RULES,
      decidedBy: 'team-composer.v2',
    };

    return { instances: roles, decision };
  }

  private needsDataSpecialist(proposal: StackArchitectureProposal | undefined): boolean {
    if (!proposal) return false;
    if (proposal.dependencies.includes('Database')) return true;
    if (!proposal.persistence) return false;
    return !proposal.persistence.toLowerCase().includes('browser storage');
  }

  private needsSecuritySpecialist(
    proposal: StackArchitectureProposal | undefined,
    contract: RequirementsContract
  ): boolean {
    const hasExplicitSecurityNeed = contract.items.some((i) =>
      /auten|login|segurança|security|\bauth\b/i.test(i.description)
    );
    const widerAttackSurface = proposal?.architectureStyle === 'microservices';
    return hasExplicitSecurityNeed || widerAttackSurface;
  }

  private needsRuntimeSpecialist(proposal: StackArchitectureProposal | undefined, complexity: string): boolean {
    if (proposal?.architectureStyle === 'microservices') return true;
    return complexity === 'HIGH';
  }

  private needsPerformanceSpecialist(contract: RequirementsContract, complexity: string): boolean {
    if (contract.items.some((i) => i.category === 'scale')) return true;
    return complexity === 'HIGH';
  }

  private needsIntegrationUnit(approvedSolution: ApprovedSolution): boolean {
    const distinctStacks = new Set(approvedSolution.selectedStacks.map((s) => s.stackKey));
    const hasExternalIntegrationTarget = approvedSolution.deliveryTargets.some(
      (t) => t.kind === 'EXTERNAL_INTEGRATION' && (t.status === 'APPROVED' || t.required)
    );
    // Integração real: mais de uma stack precisa se coordenar, ou há um
    // target de integração externa aprovado (doc 10, doc 15).
    return distinctStacks.size > 1 || hasExternalIntegrationTarget;
  }

  private composeIntegrationUnit(
    approvedSolution: ApprovedSolution
  ): { instances: AgentInstance[]; decision: TeamCompositionDecision } {
    const stackKeys = approvedSolution.selectedStacks.map((s) => s.stackKey).join(', ');
    const reason = `Mais de uma stack (${stackKeys}) ou integração externa aprovada exige coordenação cross-stack (doc 15).`;

    const instances: AgentInstance[] = [
      { id: generateId(), agentKey: 'integration.architect', role: 'INTEGRATION_ARCHITECT', reason },
      { id: generateId(), agentKey: 'integration.engineer', role: 'INTEGRATION_ENGINEER', reason },
      { id: generateId(), agentKey: 'integration.reviewer', role: 'INTEGRATION_REVIEWER', reason },
      { id: generateId(), agentKey: 'integration.test-engineer', role: 'INTEGRATION_TEST_ENGINEER', reason },
    ];

    const decision: TeamCompositionDecision = {
      id: generateId(),
      scope: 'integration-unit',
      problem: 'A Mission precisa de uma Integration Unit cross-stack?',
      selectedOption: 'Integration Unit ativada',
      rationale: reason,
      rulesApplied: RULES,
      decidedBy: 'team-composer.v2',
    };

    return { instances, decision };
  }
}
