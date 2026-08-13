import { PipelineValidator } from '../services/pipeline-validator';
import { PipelineNode } from '../domain';

const node = (key: string, dependsOn: string[] = []): PipelineNode => ({ id: key, key, type: 'BUILD', target: 'BACKEND', stackKey: 'stack.java.spring-boot', required: true, dependsOn, ownerRole: 'DEVELOPER', contractRefs: ['contract-1'], gateRefs: [], state: 'PENDING' });

describe('PipelineValidator', () => {
  it('rejects dangling dependencies and cycles', () => {
    const solution = { status: 'ACTIVE', requirementsContractId: 'contract-1', selectedStacks: [{ stackKey: 'stack.java.spring-boot' }], deliveryTargets: [{ kind: 'BACKEND' }] } as never;
    const validator = new PipelineValidator();
    expect(() => validator.validate([node('a', ['missing'])], solution)).toThrow('Dangling pipeline dependency');
    expect(() => validator.validate([node('a', ['b']), node('b', ['a'])], solution)).toThrow('cycle');
  });

  it('rejects a node from an unauthorized stack', () => {
    const solution = { status: 'ACTIVE', requirementsContractId: 'contract-1', selectedStacks: [{ stackKey: 'stack.java.spring-boot' }], deliveryTargets: [{ kind: 'BACKEND' }] } as never;
    const unauthorized = { ...node('x'), stackKey: 'stack.dart.flutter' };
    expect(() => new PipelineValidator().validate([unauthorized], solution)).toThrow('outside ApprovedSolution');
  });

  it('validates secondary targets on grouped full-stack nodes', () => {
    const solution = { status: 'ACTIVE', requirementsContractId: 'contract-1', selectedStacks: [{ stackKey: 'stack.typescript.nextjs' }], deliveryTargets: [{ kind: 'BACKEND' }] } as never;
    const grouped = { ...node('fullstack'), contractRefs: ['contract-1'], stackKey: 'stack.typescript.nextjs', targetKinds: ['BACKEND', 'FRONTEND'] };
    expect(() => new PipelineValidator().validate([grouped], solution)).toThrow('FRONTEND');
  });
});
