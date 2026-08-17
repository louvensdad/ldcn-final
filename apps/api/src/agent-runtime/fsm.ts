/**
 * CORE-005 §4/§5 — FSM canônica do AgentRuntime. 17 estados existem como valores válidos do
 * type (doc §4), mas só os efetivamente exercitados nesta CORE (IDLE → SUMMONED →
 * CONTEXT_LOADING → ANALYZING → PLANNING → IMPLEMENTING → SELF_CHECKING → COMPLETED, + FAILED/
 * CANCELLED de qualquer estado operacional) têm transições permitidas. Os demais
 * (WAITING_DEPENDENCY, WAITING_REVIEW, REWORKING, TOOL_RUNNING, BUILDING, TESTING, BLOCKED)
 * existem só como reserva de nome para CORE futuras — mapeiam para [] (nenhuma transição
 * implementada os alcança ou os deixa ainda), nunca fabricando comportamento falso.
 */
export type AgentRuntimeState =
  | 'IDLE'
  | 'SUMMONED'
  | 'CONTEXT_LOADING'
  | 'ANALYZING'
  | 'PLANNING'
  | 'IMPLEMENTING'
  | 'SELF_CHECKING'
  | 'WAITING_DEPENDENCY'
  | 'WAITING_REVIEW'
  | 'REWORKING'
  | 'TOOL_RUNNING'
  | 'BUILDING'
  | 'TESTING'
  | 'COMPLETED'
  | 'FAILED'
  | 'BLOCKED'
  | 'CANCELLED';

export const TERMINAL_STATES: ReadonlySet<AgentRuntimeState> = new Set(['COMPLETED', 'FAILED', 'CANCELLED', 'BLOCKED']);

export const ALLOWED_TRANSITIONS: Record<AgentRuntimeState, AgentRuntimeState[]> = {
  IDLE: ['SUMMONED'],
  SUMMONED: ['CONTEXT_LOADING', 'CANCELLED', 'FAILED'],
  CONTEXT_LOADING: ['ANALYZING', 'FAILED', 'CANCELLED'],
  ANALYZING: ['PLANNING', 'FAILED', 'CANCELLED'],
  PLANNING: ['IMPLEMENTING', 'FAILED', 'CANCELLED'],
  IMPLEMENTING: ['SELF_CHECKING', 'FAILED', 'CANCELLED'],
  // SELF_CHECKING → IMPLEMENTING: somente para o self-check repair interno (doc §22/CORE-004 §22).
  SELF_CHECKING: ['IMPLEMENTING', 'COMPLETED', 'FAILED', 'CANCELLED'],
  WAITING_DEPENDENCY: [],
  WAITING_REVIEW: [],
  REWORKING: [],
  TOOL_RUNNING: [],
  BUILDING: [],
  TESTING: [],
  COMPLETED: [],
  FAILED: [],
  BLOCKED: [],
  CANCELLED: [],
};

export const AGENT_STATE_TRANSITION_INVALID = 'AGENT_STATE_TRANSITION_INVALID';

/** Nunca corrige estado silenciosamente (doc §5) — lança se `to` não estiver na lista de `from`. */
export function assertTransition(from: AgentRuntimeState, to: AgentRuntimeState): void {
  const allowed = ALLOWED_TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    throw new Error(AGENT_STATE_TRANSITION_INVALID);
  }
}
