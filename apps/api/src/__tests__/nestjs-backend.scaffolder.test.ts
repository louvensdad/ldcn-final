import { scaffoldNestjsBackend } from '../generation-engine/scaffolders/nestjs-backend.scaffolder';

describe('CORE-011 REWORK — NestJS scaffolder without silent total truncation', () => {
  it('processes all 27 distinct resources in input order even when legacy maxResources=5 is supplied', () => {
    const requirements = Array.from({ length: 27 }, (_, index) => ({
      id: `REQ-${String(index + 1).padStart(3, '0')}`,
      section: 'data',
      content: `Resource${index + 1}`,
    }));

    const result = scaffoldNestjsBackend({
      missionId: 'mission-27', vision: 'All resources', objective: 'No truncation',
      requirements, maxResources: 5,
    });

    expect(result.resources).toHaveLength(27);
    expect(result.resources.map((resource) => resource.requirementId)).toEqual(requirements.map((requirement) => requirement.id));
    expect(result.resources[26]).toMatchObject({ requirementId: 'REQ-027', originalContent: 'Resource27' });
    expect(result.skippedRequirementIds).toEqual([]);
    expect(result.files.some((file) => file.provenance === 'requirement:REQ-027')).toBe(true);

    const manifest = result.files.find((file) => file.path === 'manifest.json');
    expect(manifest?.content).toContain('REQ-027');
  });
});
