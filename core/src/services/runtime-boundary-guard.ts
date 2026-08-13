import { ExecutionContextSnapshot } from '../domain';

export interface RuntimeBoundaryRequest {
  context: ExecutionContextSnapshot;
  requestedTerritory: string;
  requestedTools: string[];
}

/** Enforces the execution context boundary before an external runtime is called. */
export class RuntimeBoundaryGuard {
  assertAllowed(request: RuntimeBoundaryRequest): void {
    if (request.requestedTerritory !== request.context.territory) throw new Error('RUNTIME_TERRITORY_FORBIDDEN');
    const allowed = new Set(request.context.allowedTools);
    const forbidden = [...new Set(request.requestedTools)].filter((tool) => !allowed.has(tool));
    if (forbidden.length > 0) throw new Error(`RUNTIME_TOOLS_FORBIDDEN:${forbidden.join(',')}`);
  }
}
