import { ArchitectureProposalV1, ArchitectureReviewResultV1 } from './architecture-contracts';

export class ArchitectureProposalValidator {
  validate(input: { proposal: ArchitectureProposalV1; componentKeys: string[]; stackSelections: { stackKey: string; stackVersion: string }[]; inScopeKeys: string[]; requiredDecisionKeys: string[] }) {
    const errors: { code: string; ref?: string }[] = [];
    const components = new Set(input.componentKeys), requirements = new Set(input.inScopeKeys);
    const stacks = new Set(input.stackSelections.map((s) => `${s.stackKey}@${s.stackVersion}`));
    const modules = new Map(input.proposal.modules.map((m) => [m.key, m]));
    const decisions = new Set(input.proposal.decisions.map((d) => d.key));
    for (const m of input.proposal.modules) {
      if (!m.componentKeys.length && !m.requirementKeys.length) errors.push({ code: 'ARCHITECTURE_ORPHAN_MODULE', ref: m.key });
      for (const c of m.componentKeys) if (!components.has(c)) errors.push({ code: 'ARCHITECTURE_UNKNOWN_COMPONENT', ref: c });
      for (const s of m.stackRefs) if (!stacks.has(`${s.stackKey}@${s.stackVersion}`)) errors.push({ code: 'ARCHITECTURE_STACK_OUTSIDE_APPROVED_SOLUTION', ref: `${s.stackKey}@${s.stackVersion}` });
      for (const d of m.dependsOn) if (d === m.key) errors.push({ code: 'ARCHITECTURE_SELF_DEPENDENCY', ref: m.key }); else if (!modules.has(d)) errors.push({ code: 'ARCHITECTURE_UNKNOWN_MODULE', ref: d });
      for (const r of m.requirementKeys) if (!requirements.has(r)) errors.push({ code: 'ARCHITECTURE_UNKNOWN_REQUIREMENT', ref: r });
    }
    for (const d of input.proposal.decisions) {
      for (const c of d.componentKeys) if (!components.has(c)) errors.push({ code: 'ARCHITECTURE_UNKNOWN_COMPONENT', ref: c });
      for (const m of d.moduleKeys) if (!modules.has(m)) errors.push({ code: 'ARCHITECTURE_UNKNOWN_MODULE', ref: m });
      for (const s of d.stackRefs) if (!stacks.has(`${s.stackKey}@${s.stackVersion}`)) errors.push({ code: 'ARCHITECTURE_STACK_OUTSIDE_APPROVED_SOLUTION', ref: `${s.stackKey}@${s.stackVersion}` });
      for (const r of d.requirementKeys) if (!requirements.has(r)) errors.push({ code: 'ARCHITECTURE_UNKNOWN_REQUIREMENT', ref: r });
    }
    for (const x of [...input.proposal.integrations.flatMap(i => [i.fromModuleKey, ...(i.toModuleKey ? [i.toModuleKey] : [])]), ...input.proposal.dataFlows.flatMap(f => f.moduleKeys), ...input.proposal.securityBoundaries.flatMap(b => b.moduleKeys)]) if (!modules.has(x)) errors.push({ code: 'ARCHITECTURE_UNKNOWN_MODULE', ref: x });
    const counts = new Map<string, number>();
    for (const m of input.proposal.requirementMappings) counts.set(m.requirementKey, (counts.get(m.requirementKey) ?? 0) + 1);
    for (const key of input.inScopeKeys) if (!counts.has(key)) errors.push({ code: 'ARCHITECTURE_REQUIREMENT_COVERAGE_INCOMPLETE', ref: key });
    for (const [key, count] of counts) if (!requirements.has(key)) errors.push({ code: 'ARCHITECTURE_UNKNOWN_REQUIREMENT', ref: key }); else if (count !== 1) errors.push({ code: 'ARCHITECTURE_REQUIREMENT_COVERAGE_INCOMPLETE', ref: key });
    for (const m of input.proposal.requirementMappings) {
      if (!m.moduleKeys.length && !m.decisionKeys.length) errors.push({ code: 'ARCHITECTURE_REQUIREMENT_COVERAGE_INCOMPLETE', ref: m.requirementKey });
      for (const x of m.moduleKeys) if (!modules.has(x)) errors.push({ code: 'ARCHITECTURE_UNKNOWN_MODULE', ref: x });
      for (const x of m.decisionKeys) if (!decisions.has(x)) errors.push({ code: 'ARCHITECTURE_UNKNOWN_DECISION', ref: x });
      if (input.requiredDecisionKeys.includes(m.requirementKey) && !m.decisionKeys.length) errors.push({ code: 'ARCHITECTURE_REQUIRED_DECISION_MISSING', ref: m.requirementKey });
      for (const decisionKey of m.decisionKeys) {
        const decision = input.proposal.decisions.find((item) => item.key === decisionKey);
        if (decision && !decision.requirementKeys.includes(m.requirementKey)) errors.push({ code: 'ARCHITECTURE_REQUIRED_DECISION_MISSING', ref: m.requirementKey });
      }
    }
    for (const r of [...input.proposal.integrations.flatMap(i => i.requirementKeys), ...input.proposal.dataFlows.flatMap(f => f.requirementKeys), ...input.proposal.securityBoundaries.flatMap(b => b.requirementKeys)]) if (!requirements.has(r)) errors.push({ code: 'ARCHITECTURE_UNKNOWN_REQUIREMENT', ref: r });
    if (this.hasCycle(input.proposal.modules)) errors.push({ code: 'ARCHITECTURE_DEPENDENCY_CYCLE' });
    return { status: errors.length ? 'FAIL' as const : 'PASS' as const, errors };
  }
  private hasCycle(modules: ArchitectureProposalV1['modules']): boolean {
    const graph = new Map(modules.map(m => [m.key, m.dependsOn])); const visiting = new Set<string>(), done = new Set<string>();
    const visit = (key: string): boolean => { if (visiting.has(key)) return true; if (done.has(key)) return false; visiting.add(key); for (const next of graph.get(key) ?? []) if (graph.has(next) && visit(next)) return true; visiting.delete(key); done.add(key); return false; };
    return [...graph.keys()].some(visit);
  }
}

export class ArchitectureCouncilPolicy {
  evaluate(reviews: ArchitectureReviewResultV1[]) {
    const blockingFindingIds = reviews.flatMap(r => r.findings.filter(f => f.severity === 'HIGH' || f.severity === 'BLOCKER').map(f => f.id));
    const unsatisfiedRequirementKeys = reviews.flatMap(r => r.requirementAssessment.filter(a => a.status === 'UNSATISFIED').map(a => a.requirementKey));
    const verdictRequires = reviews.some(r => r.verdict !== 'APPROVED');
    return { status: blockingFindingIds.length || unsatisfiedRequirementKeys.length || verdictRequires ? 'RESOLUTION_REQUIRED' as const : 'APPROVED' as const, blockingFindingIds, unsatisfiedRequirementKeys };
  }
}
