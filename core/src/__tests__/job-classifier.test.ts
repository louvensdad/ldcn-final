import { Generator } from '../generator';
import { JobClassifier } from '../services/job-classifier';

describe('JobClassifier', () => {
  it('classifies a security Java job with specialist requirements', () => {
    const solution = new Generator({ mode: 'AUTO', fixedSelections: { BACKEND: 'stack.java.spring-boot' } }).generate({
      missionId: 'classification-java', rawUserIdea: 'Quero um backend Java.',
    }).approvedSolution;
    const classifier = new JobClassifier();
    const input = { missionId: solution.missionId, taskId: 'task-1', description: 'Implementar login OAuth e permissões no backend Java', stackKey: 'stack.java.spring-boot' };
    const result = classifier.classify(input, solution);
    expect(classifier.classify(input, solution)).toBe(result);
    expect(result.jobType).toBe('SECURITY_IMPLEMENTATION');
    expect(result.deliveryTarget).toBe('BACKEND');
    expect(result.requiresSecurityReview).toBe(true);
    expect(result.requiredCapabilities).toEqual(expect.arrayContaining(['security', 'java']));
    expect(result.contextHash).toHaveLength(64);
  });

  it('flags mobile work outside a backend-only approved solution', () => {
    const solution = new Generator({ mode: 'AUTO', fixedSelections: { BACKEND: 'stack.java.spring-boot' } }).generate({
      missionId: 'classification-scope', rawUserIdea: 'Quero um backend Java.',
    }).approvedSolution;
    const result = new JobClassifier().classify({ missionId: solution.missionId, taskId: 'task-2', description: 'Criar aplicativo mobile Flutter' }, solution);
    expect(result.jobType).toBe('MOBILE_IMPLEMENTATION');
    expect(result.scopeExpansionRequired).toBe(true);
  });

  it('marks cross-stack work as integration and high complexity', () => {
    const solution = new Generator({ mode: 'AUTO', fixedSelections: { BACKEND: 'stack.java.spring-boot', FRONTEND: 'stack.typescript.react' } }).generate({
      missionId: 'classification-integration', rawUserIdea: 'Quero backend Java e frontend React.',
    }).approvedSolution;
    const result = new JobClassifier().classify({ missionId: solution.missionId, taskId: 'task-3', description: 'Fazer integração entre backend e frontend', }, solution);
    expect(result.jobType).toBe('CROSS_STACK_INTEGRATION');
    expect(result.requiresIntegration).toBe(true);
    expect(result.complexity).toBe('HIGH');
  });
});
