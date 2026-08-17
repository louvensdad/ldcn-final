/**
 * SLICE C1 constitutional check: a COGNITIVE AgentExecution that reaches a terminal
 * status (SUCCEEDED/FAILED) must have produced at least one LlmInvocationRecord. If it
 * didn't, cognitive work was claimed without a real LLM call — that is a bug, not a
 * valid outcome, so this throws rather than silently accepting the state.
 *
 * Does not apply to DETERMINISTIC executions (scaffold work is never expected to call an LLM).
 */
export const COGNITIVE_EXECUTION_WITHOUT_LLM = 'COGNITIVE_EXECUTION_WITHOUT_LLM';

export function assertCognitiveInvariant(mode: 'COGNITIVE' | 'DETERMINISTIC', llmInvocationCount: number): void {
  if (mode === 'COGNITIVE' && llmInvocationCount < 1) {
    throw new Error(COGNITIVE_EXECUTION_WITHOUT_LLM);
  }
}
