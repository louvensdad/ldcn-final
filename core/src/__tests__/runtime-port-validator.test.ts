import { RuntimePortValidator } from '../services/runtime-port-validator';

describe('RuntimePortValidator', () => {
  it('accepts a compatible runtime port', () => {
    expect(() => new RuntimePortValidator().assertCompatible({ dispatch: () => ({ executionId: 'execution-1' }) })).not.toThrow();
  });

  it('rejects invalid runtime adapters', () => {
    expect(() => new RuntimePortValidator().assertCompatible({} as never)).toThrow('EXECUTION_RUNTIME_PORT_INVALID');
    expect(() => new RuntimePortValidator().assertCompatible({ dispatch: () => ({ executionId: 'execution-1' }), readStatus: 'invalid' } as never)).toThrow('EXECUTION_RUNTIME_STATUS_PORT_INVALID');
  });
});
