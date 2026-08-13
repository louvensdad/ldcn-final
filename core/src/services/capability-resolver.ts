import { AgentInstance } from '../domain';

export interface CapabilityResolution {
  required: string[];
  missing: string[];
  capableAgentIds: string[];
}

export class CapabilityResolver {
  resolve(required: string[], candidates: AgentInstance[]): CapabilityResolution {
    const missing = required.filter((capability) => !this.has(capability, candidates));
    return { required, missing, capableAgentIds: candidates.filter((agent) => this.canContribute(agent, required)).map((agent) => agent.id) };
  }

  private has(capability: string, candidates: AgentInstance[]): boolean {
    if (capability === 'security') return candidates.some((a) => a.role === 'SECURITY_SPECIALIST');
    if (capability === 'data') return candidates.some((a) => a.role === 'DATA_SPECIALIST' || a.role === 'LEAD');
    if (capability === 'integration') return candidates.some((a) => a.role.startsWith('INTEGRATION_'));
    if (capability === 'java') return candidates.some((a) => a.agentKey.includes('.java.'));
    if (capability === 'angular') return candidates.some((a) => a.agentKey.includes('.angular.'));
    if (capability === 'typescript') return candidates.some((a) => /\.typescript\.|\.nextjs\.|\.react\./.test(a.agentKey));
    return candidates.length > 0;
  }

  private canContribute(agent: AgentInstance, required: string[]): boolean {
    return required.every((capability) => {
      if (capability === 'security') return agent.role === 'SECURITY_SPECIALIST' || agent.role === 'LEAD' || agent.role === 'SENIOR_DEVELOPER';
      if (capability === 'data') return ['DATA_SPECIALIST', 'LEAD', 'SENIOR_DEVELOPER'].includes(agent.role);
      if (capability === 'integration') return agent.role.startsWith('INTEGRATION_');
      if (capability === 'java') return agent.agentKey.includes('.java.');
      if (capability === 'angular') return agent.agentKey.includes('.angular.');
      if (capability === 'typescript') return /\.typescript\.|\.nextjs\.|\.react\./.test(agent.agentKey);
      return true;
    });
  }
}
