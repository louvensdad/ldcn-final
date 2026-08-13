import { ReplanImpact, ReplanReason } from '../domain';

export class ReplanImpactAnalyzer {
  analyze(reason: ReplanReason): ReplanImpact {
    const all = { requirements: true, topology: true, solution: true, architecture: true, team: true, pipeline: true };
    switch (reason) {
      case 'REQUIREMENTS_CHANGED':
        return { reason, ...all, explanation: 'Requirements changed; all derived decisions must be reevaluated.' };
      case 'USER_PREFERENCE_CHANGED':
        return { reason, requirements: false, topology: false, solution: true, architecture: true, team: true, pipeline: true, explanation: 'Only technology-dependent decisions and downstream artifacts are affected.' };
      case 'RUNTIME_UNSUPPORTED':
        return { reason, requirements: false, topology: false, solution: true, architecture: true, team: true, pipeline: true, explanation: 'Unsupported runtime invalidates the selected stack and downstream execution plan.' };
      case 'COST_CONSTRAINT_CHANGED':
        return { reason, requirements: true, topology: false, solution: true, architecture: true, team: true, pipeline: true, explanation: 'Cost constraints can change stack fit and delivery design.' };
      case 'SECURITY_REQUIREMENT_CHANGED':
        return { reason, requirements: true, topology: false, solution: true, architecture: true, team: true, pipeline: true, explanation: 'Security changes affect requirements, architecture, specialists, and gates.' };
      case 'INTEGRATION_CHANGED':
        return { reason, requirements: true, topology: true, solution: true, architecture: true, team: true, pipeline: true, explanation: 'Integration boundaries affect all downstream composition layers.' };
      case 'SCOPE_EXPANSION_APPROVED':
        return { reason, requirements: true, topology: true, solution: true, architecture: true, team: true, pipeline: true, explanation: 'Approved expansion introduces a new delivery target and downstream scope.' };
    }
  }
}
