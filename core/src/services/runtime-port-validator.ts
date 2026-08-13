import { ExecutionRuntimePort } from './execution-dispatcher';

export class RuntimePortValidator {
  assertCompatible(runtime: ExecutionRuntimePort): void {
    if (!runtime || typeof runtime.dispatch !== 'function') throw new Error('EXECUTION_RUNTIME_PORT_INVALID');
    if (runtime.readStatus !== undefined && typeof runtime.readStatus !== 'function') throw new Error('EXECUTION_RUNTIME_STATUS_PORT_INVALID');
  }
}
