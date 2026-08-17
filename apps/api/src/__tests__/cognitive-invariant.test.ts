import { assertCognitiveInvariant, COGNITIVE_EXECUTION_WITHOUT_LLM } from '../ledger/cognitive-invariant';

describe('assertCognitiveInvariant', () => {
  it('SLICE C1 (teste F): uma AgentExecution COGNITIVE sem nenhuma LlmInvocationRecord viola o invariante', () => {
    expect(() => assertCognitiveInvariant('COGNITIVE', 0)).toThrow(COGNITIVE_EXECUTION_WITHOUT_LLM);
  });

  it('COGNITIVE com pelo menos 1 invocação real nunca viola o invariante', () => {
    expect(() => assertCognitiveInvariant('COGNITIVE', 1)).not.toThrow();
    expect(() => assertCognitiveInvariant('COGNITIVE', 3)).not.toThrow();
  });

  it('SLICE C1 (teste G): DETERMINISTIC nunca exige LlmInvocationRecord — scaffold puro nunca chama LLM', () => {
    expect(() => assertCognitiveInvariant('DETERMINISTIC', 0)).not.toThrow();
  });
});
