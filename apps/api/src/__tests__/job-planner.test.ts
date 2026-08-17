import { planJobs } from '../generation-engine/job-planner';
import { ScaffoldedResource } from '../generation-engine/scaffolders/nestjs-backend.scaffolder';

function resource(entityName: string, resourcePath: string): ScaffoldedResource {
  return { requirementId: `req-${resourcePath}`, originalContent: entityName, entityName, resourcePath };
}

describe('planJobs', () => {
  const resources: ScaffoldedResource[] = [resource('Vendedore', 'vendedores'), resource('Produto', 'produtos'), resource('Cliente', 'clientes')];

  it('cria um Job quando a regra de negócio menciona exatamente um recurso', () => {
    const { jobs, skippedRequirementIds } = planJobs(
      [{ id: 'r1', content: 'A comissão do vendedor deve ser calculada como 5% do valor da venda.' }],
      resources
    );
    expect(jobs).toHaveLength(1);
    expect(jobs[0].targetResource).toBe('Vendedore');
    expect(jobs[0].targetFile).toBe('src/vendedores/vendedores.service.ts');
    expect(jobs[0].agentKey).toBe('backend.nestjs.data-specialist');
    expect(skippedRequirementIds).toHaveLength(0);
  });

  it('nunca inventa um Job quando nenhum recurso é mencionado — fica honestamente de fora', () => {
    const { jobs, skippedRequirementIds } = planJobs(
      [{ id: 'r1', content: 'O sistema deve enviar um e-mail de boas-vindas ao usuário.' }],
      resources
    );
    expect(jobs).toHaveLength(0);
    expect(skippedRequirementIds).toEqual(['r1']);
  });

  it('nunca advinha quando a regra menciona mais de um recurso — ambiguidade real fica de fora', () => {
    const { jobs, skippedRequirementIds } = planJobs(
      [{ id: 'r1', content: 'Ao criar um pedido, o produto deve ter estoque reservado para o cliente.' }],
      resources
    );
    expect(jobs).toHaveLength(0);
    expect(skippedRequirementIds).toEqual(['r1']);
  });

  it('requirement com texto vazio nunca vira Job', () => {
    const { jobs, skippedRequirementIds } = planJobs([{ id: 'r1', content: '   ' }], resources);
    expect(jobs).toHaveLength(0);
    expect(skippedRequirementIds).toEqual(['r1']);
  });

  it('uma missão com múltiplas regras de negócio válidas gera um Job por regra', () => {
    const { jobs } = planJobs(
      [
        { id: 'r1', content: 'A comissão do vendedor deve ser 5% do valor da venda.' },
        { id: 'r2', content: 'O produto não pode ter preço negativo.' },
      ],
      resources
    );
    expect(jobs).toHaveLength(2);
    expect(jobs.map((j) => j.requirementId).sort()).toEqual(['r1', 'r2']);
  });
});
