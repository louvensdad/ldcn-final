import { computeRequirementCoverage } from '../generation-engine/requirement-coverage';
import { ScaffoldResult } from '../generation-engine/scaffolders/nestjs-backend.scaffolder';

function scaffold(resourceRequirementIds: string[], skippedRequirementIds: string[]): ScaffoldResult {
  return {
    files: [],
    resources: resourceRequirementIds.map((id) => ({ requirementId: id, originalContent: id, entityName: `E${id}`, resourcePath: `e${id}` })),
    skippedRequirementIds,
  };
}

describe('computeRequirementCoverage', () => {
  it('requirement de data com artifact real é EVIDENCED', () => {
    const result = computeRequirementCoverage(
      [{ id: 'r1', section: 'data', content: 'Clientes' }],
      scaffold(['r1'], []),
      []
    );
    expect(result.items).toEqual([{ requirementId: 'r1', section: 'data', content: 'Clientes', status: 'EVIDENCED' }]);
    expect(result.deliveryEligible).toBe(true);
  });

  it('requirement de data fora do teto (maxResources) é OUT_OF_SCOPE_THIS_VERSION e nunca bloqueia entrega', () => {
    const result = computeRequirementCoverage(
      [{ id: 'r1', section: 'data', content: 'Clientes' }, { id: 'r2', section: 'data', content: 'Lotes' }],
      scaffold(['r1'], ['r2']),
      []
    );
    const r2 = result.items.find((i) => i.requirementId === 'r2');
    expect(r2?.status).toBe('OUT_OF_SCOPE_THIS_VERSION');
    expect(result.deliveryEligible).toBe(true); // nunca prometido, nunca bloqueia
  });

  it('businessRule com Job IMPLEMENTED é EVIDENCED', () => {
    const result = computeRequirementCoverage(
      [{ id: 'r1', section: 'businessRules', content: 'Comissão 5%' }],
      scaffold([], []),
      [{ requirementId: 'r1', status: 'IMPLEMENTED' }]
    );
    expect(result.items[0].status).toBe('EVIDENCED');
    expect(result.deliveryEligible).toBe(true);
  });

  it('businessRule com Job FAILED bloqueia deliveryEligible mesmo com tudo mais verde — "mesmo que o build esteja verde"', () => {
    const result = computeRequirementCoverage(
      [{ id: 'r1', section: 'data', content: 'Clientes' }, { id: 'r2', section: 'businessRules', content: 'Comissão 5%' }],
      scaffold(['r1'], []),
      [{ requirementId: 'r2', status: 'FAILED' }]
    );
    const r2 = result.items.find((i) => i.requirementId === 'r2');
    expect(r2?.status).toBe('FAILED');
    expect(result.deliveryEligible).toBe(false);
  });

  it('businessRule sem Job nenhum (nunca casou com um recurso — Job Planner não criou Job) é OUT_OF_SCOPE_THIS_VERSION, nunca FAILED', () => {
    const result = computeRequirementCoverage(
      [{ id: 'r1', section: 'businessRules', content: 'Regra sem recurso correspondente' }],
      scaffold([], []),
      []
    );
    expect(result.items[0].status).toBe('OUT_OF_SCOPE_THIS_VERSION');
    expect(result.deliveryEligible).toBe(true);
  });

  it('nunca inclui seções que este motor nunca prometeu implementar (features, security, flows, ...)', () => {
    const result = computeRequirementCoverage(
      [
        { id: 'r1', section: 'features', content: 'Login social' },
        { id: 'r2', section: 'security', content: 'Autenticação JWT' },
        { id: 'r3', section: 'flows', content: 'Fluxo de checkout' },
      ],
      scaffold([], []),
      []
    );
    expect(result.items).toHaveLength(0);
    expect(result.deliveryEligible).toBe(true);
  });
});
