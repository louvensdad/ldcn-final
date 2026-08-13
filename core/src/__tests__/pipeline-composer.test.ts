import { Generator } from '../generator';

describe('PipelineComposer', () => {
  it('derives a backend pipeline without frontend nodes', () => {
    const result = new Generator({ mode: 'AUTO', fixedSelections: { BACKEND: 'stack.java.spring-boot' } }).generate({
      missionId: 'pipeline-backend', rawUserIdea: 'Quero um backend Java para uma API.',
    });
    expect(result.pipeline.status).toBe('APPROVED');
    expect(result.pipeline.contextHash).toHaveLength(64);
    expect(result.pipeline.nodes.some((n) => n.target === 'FRONTEND')).toBe(false);
    expect(result.pipeline.nodes.map((n) => n.type)).toEqual(expect.arrayContaining(['BUILD', 'TEST', 'REVIEW', 'GATE', 'PROMOTION']));
    expect(result.pipeline.dependencies).toEqual(expect.arrayContaining([{ fromNodeKey: 'typescript-nestjs.generation', toNodeKey: 'typescript-nestjs.build' }]));
  });

  it('adds integration validation only for a multi-stack solution', () => {
    const result = new Generator({ mode: 'FIXED', autoApprove: true, fixedSelections: { BACKEND: 'stack.java.spring-boot', FRONTEND: 'stack.typescript.react' } }).generate({
      missionId: 'pipeline-cross-stack', rawUserIdea: 'Quero backend Java e frontend React.',
    });
    expect(result.pipeline.nodes.filter((n) => n.type === 'INTEGRATION_VALIDATION')).toHaveLength(1);
    expect(result.pipeline.nodes.find((n) => n.key === 'integration.validation')?.dependsOn).toHaveLength(2);
    expect(result.pipeline.dependencies).toEqual(expect.arrayContaining([{ fromNodeKey: 'integration.validation', toNodeKey: 'java-spring-boot.promotion' }]));
  });
});
