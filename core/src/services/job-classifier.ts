import { generateId } from '../utils/id';
import { createHash } from 'crypto';
import { ApprovedSolution, DeliveryTargetKind, JobClassification, JobComplexity, JobRiskLevel, JobType } from '../domain';

export interface JobClassificationInput {
  missionId: string;
  taskId: string;
  description: string;
  affectedDomains?: string[];
  deliveryTarget?: DeliveryTargetKind;
  stackKey?: string;
}

/** Deterministic first-pass classifier. It never selects agents or expands scope. */
export class JobClassifier {
  private classifications = new Map<string, import('../domain').JobClassification>();

  classify(input: JobClassificationInput, solution: ApprovedSolution): JobClassification {
    if (solution.status !== 'ACTIVE') throw new Error('Job classification requires an ACTIVE ApprovedSolution');
    const text = input.description.toLowerCase();
    const contextKey = `${input.missionId}:${input.taskId}:${solution.id}:${input.description.trim().toLowerCase()}`;
    const existing = this.classifications.get(contextKey);
    if (existing) return existing;
    const jobType = this.jobType(text);
    const deliveryTarget = input.deliveryTarget ?? this.targetFor(jobType, text);
    const selected = solution.selectedStacks.filter((s) => !deliveryTarget || s.deliveryTargetKind === deliveryTarget);
    const affectedStacks = input.stackKey
      ? [input.stackKey]
      : selected.map((s) => s.stackKey);
    const approvedTargets = new Set(solution.deliveryTargets.map((t) => t.kind));
    const scopeExpansionRequired = !!deliveryTarget && !approvedTargets.has(deliveryTarget);
    const crossStack = jobType === 'CROSS_STACK_INTEGRATION' || affectedStacks.length > 1;
    const security = /security|seguran|auth|login|permission|permiss|oauth|jwt/.test(text);
    const data = /data|database|dados|schema|migration|persist|sql|orm/.test(text);
    const runtime = /deploy|deployment|runtime|infra|docker|kubernetes|configura/.test(text);
    const highRisk = security || /payment|pagamento|production|produção|critical|critico/.test(text);

    const classification: import('../domain').JobClassification = {
      id: generateId(), missionId: input.missionId, taskId: input.taskId, jobType,
      deliveryTarget, primaryStackKey: input.stackKey ?? selected[0]?.stackKey,
      affectedStacks, affectedDomains: input.affectedDomains ?? this.domains(text),
      complexity: this.complexity(text, crossStack), riskLevel: highRisk ? 'HIGH' : this.risk(text),
      requiredCapabilities: this.capabilities(jobType, text, security, data, runtime, crossStack),
      requiresArchitectureReview: ['ARCHITECTURE_DESIGN', 'MIGRATION', 'CROSS_STACK_INTEGRATION'].includes(jobType) || crossStack,
      requiresSecurityReview: security,
      requiresDataSpecialist: data,
      requiresRuntimeSpecialist: runtime,
      requiresIntegration: crossStack,
      scopeExpansionRequired,
      contextHash: createHash('sha256').update(JSON.stringify({ missionId: input.missionId, taskId: input.taskId, solutionId: solution.id, description: input.description.trim().toLowerCase() })).digest('hex'),
    };
    this.classifications.set(contextKey, classification);
    return classification;
  }

  private jobType(text: string): JobType {
    if (/architecture|arquitetura|design técnico|desenho/.test(text)) return 'ARCHITECTURE_DESIGN';
    if (/cross.?stack|integração entre|integracao entre|api integration|integrar/.test(text)) return 'CROSS_STACK_INTEGRATION';
    if (/external integration|integração externa|integração com|integracao com/.test(text)) return 'EXTERNAL_INTEGRATION';
    if (/security|seguran|auth|login|oauth|jwt|permission/.test(text)) return 'SECURITY_IMPLEMENTATION';
    if (/performance|latency|desempenho|otimiza/.test(text)) return 'PERFORMANCE_OPTIMIZATION';
    if (/bug|defeito|erro|corrigir|fix/.test(text)) return 'BUG_FIX';
    if (/test|teste|coverage|cobertura/.test(text)) return 'TEST_CREATION';
    if (/refactor|refator/.test(text)) return 'REFACTORING';
    if (/migrat|migra/.test(text)) return 'MIGRATION';
    if (/deploy|deployment|produção|producao/.test(text)) return 'DEPLOYMENT_CONFIGURATION';
    if (/data engineering|engenharia de dados|pipeline de dados/.test(text)) return 'DATA_ENGINEERING';
    if (/data model|modelo de dados|schema|database|banco/.test(text)) return 'DATA_MODELING';
    if (/mobile|android|ios|flutter|react native/.test(text)) return 'MOBILE_IMPLEMENTATION';
    if (/frontend|front-end|ui|interface|tela|angular|react/.test(text)) return 'FRONTEND_IMPLEMENTATION';
    if (/backend|back-end|api|endpoint|servidor|nestjs|java|spring/.test(text)) return 'BACKEND_IMPLEMENTATION';
    if (/ux|experiência|experiencia|usabilidade/.test(text)) return 'UX_IMPLEMENTATION';
    if (/seo/.test(text)) return 'SEO_IMPLEMENTATION';
    if (/ai|ia|machine learning|aprendizado de máquina|modelo preditivo/.test(text)) return 'AI_ML_WORK';
    if (/document|documenta/.test(text)) return 'DOCUMENTATION';
    return 'REQUIREMENTS_ANALYSIS';
  }

  private targetFor(type: JobType, text: string): DeliveryTargetKind | undefined {
    if (type === 'BACKEND_IMPLEMENTATION' || type === 'SECURITY_IMPLEMENTATION' || type === 'DATA_MODELING' || type === 'DATA_ENGINEERING') return 'BACKEND';
    if (type === 'FRONTEND_IMPLEMENTATION' || type === 'UX_IMPLEMENTATION' || type === 'SEO_IMPLEMENTATION') return 'FRONTEND';
    if (type === 'MOBILE_IMPLEMENTATION') return 'MOBILE';
    if (type === 'AI_ML_WORK') return 'AI';
    if (type === 'EXTERNAL_INTEGRATION') return 'EXTERNAL_INTEGRATION';
    if (type === 'CROSS_STACK_INTEGRATION' || /backend.*frontend|frontend.*backend/.test(text)) return 'EXTERNAL_INTEGRATION';
    return undefined;
  }

  private complexity(text: string, crossStack: boolean): JobComplexity {
    if (crossStack || /migration|migra|production|produção|distributed|distribu/.test(text)) return 'HIGH';
    if (/security|seguran|performance|desempenho|database|banco|integration|integra/.test(text)) return 'MEDIUM';
    return 'LOW';
  }

  private risk(text: string): JobRiskLevel {
    if (/migration|migra|production|produção|payment|pagamento/.test(text)) return 'HIGH';
    if (/security|seguran|auth|login|performance/.test(text)) return 'MEDIUM';
    return 'LOW';
  }

  private capabilities(type: JobType, text: string, security: boolean, data: boolean, runtime: boolean, crossStack: boolean): string[] {
    const capabilities = new Set<string>([type.toLowerCase()]);
    if (security) capabilities.add('security');
    if (data) capabilities.add('data');
    if (runtime) capabilities.add('runtime');
    if (crossStack) capabilities.add('integration');
    if (/java|spring/.test(text)) capabilities.add('java');
    if (/angular/.test(text)) capabilities.add('angular');
    if (/react|next/.test(text)) capabilities.add('typescript');
    return [...capabilities];
  }

  private domains(text: string): string[] {
    const domains: string[] = [];
    if (/auth|login|security|seguran/.test(text)) domains.push('identity');
    if (/payment|pagamento/.test(text)) domains.push('payments');
    if (/dashboard|report|relatório|relatorio/.test(text)) domains.push('reporting');
    if (/data|database|dados|banco/.test(text)) domains.push('data');
    return domains;
  }
}
