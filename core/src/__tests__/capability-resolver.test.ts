import { CapabilityResolver } from '../services/capability-resolver';
import { AgentInstance } from '../domain';

describe('CapabilityResolver', () => {
  it('resolves Java and security capabilities', () => {
    const agents: AgentInstance[] = [
      { id: 'dev', agentKey: 'backend.java.developer', role: 'DEVELOPER', stackKey: 'stack.java.spring-boot', reason: 'test' },
      { id: 'sec', agentKey: 'backend.java.security-specialist', role: 'SECURITY_SPECIALIST', stackKey: 'stack.java.spring-boot', reason: 'test' },
    ];
    const result = new CapabilityResolver().resolve(['java', 'security'], agents);
    expect(result.missing).toEqual([]);
    expect(result.capableAgentIds).toContain('sec');
  });

  it('reports a capability gap', () => {
    const result = new CapabilityResolver().resolve(['angular'], []);
    expect(result.missing).toEqual(['angular']);
  });
});
