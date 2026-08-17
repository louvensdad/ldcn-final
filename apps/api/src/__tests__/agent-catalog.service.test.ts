import { randomUUID } from 'node:crypto';
import { PrismaService } from '../persistence/prisma.service';
import { AgentCatalogService } from '../catalog/agent-catalog.service';
import { seedCatalog } from '../catalog/catalog.seed';

const RUN_DB_TESTS = process.env.LDCN_TEST_DATABASE_URL || process.env.DATABASE_URL;

(RUN_DB_TESTS ? describe : describe.skip)('AgentCatalogService (Postgres)', () => {
  let prisma: PrismaService;
  let catalog: AgentCatalogService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    catalog = new AgentCatalogService(prisma);
    await seedCatalog(catalog);
  });

  afterAll(async () => {
    const testDefinitions = await prisma.agentDefinition.findMany({ where: { key: { startsWith: 'test.' } } });
    const testDefinitionIds = testDefinitions.map((d) => d.id);
    if (testDefinitionIds.length > 0) {
      await prisma.agentDefVersion.deleteMany({ where: { agentDefinitionId: { in: testDefinitionIds } } });
      await prisma.agentDefinition.deleteMany({ where: { id: { in: testDefinitionIds } } });
    }
    await prisma.unitDefinition.deleteMany({ where: { key: { startsWith: 'unit.test.' } } });
    await prisma.$disconnect();
  });

  // A. Department seeds corretos.
  it('A: seeds the 5 minimum departments', async () => {
    const departments = await prisma.department.findMany({ orderBy: { key: 'asc' } });
    expect(departments.map((d) => d.key)).toEqual([
      'dept.architecture',
      'dept.documentation',
      'dept.qa',
      'dept.security',
      'dept.web',
    ]);
  });

  // B. UnitDefinition seeds corretos.
  it('B: seeds the 5 minimum units, each linked to its department', async () => {
    const units = await prisma.unitDefinition.findMany({ orderBy: { key: 'asc' } });
    expect(units.map((u) => u.key)).toEqual([
      'unit.architecture',
      'unit.documentation',
      'unit.qa',
      'unit.security',
      'unit.web.nestjs',
    ]);
    const nestjsUnit = units.find((u) => u.key === 'unit.web.nestjs')!;
    const webDept = await prisma.department.findUnique({ where: { key: 'dept.web' } });
    expect(nestjsUnit.departmentId).toBe(webDept!.id);
    expect(nestjsUnit.engineeringType).toBe('nestjs-backend');
  });

  // C. seed duas vezes não duplica.
  it('C: running the seed twice does not duplicate any catalog row', async () => {
    const before = {
      departments: await prisma.department.count(),
      units: await prisma.unitDefinition.count(),
      capabilities: await prisma.capabilityDefinition.count(),
      definitions: await prisma.agentDefinition.count(),
      versions: await prisma.agentDefVersion.count(),
      templates: await prisma.promptTemplate.count(),
    };

    await seedCatalog(catalog);
    await seedCatalog(catalog);

    const after = {
      departments: await prisma.department.count(),
      units: await prisma.unitDefinition.count(),
      capabilities: await prisma.capabilityDefinition.count(),
      definitions: await prisma.agentDefinition.count(),
      versions: await prisma.agentDefVersion.count(),
      templates: await prisma.promptTemplate.count(),
    };

    expect(after).toEqual(before);
  });

  // D. backend.nestjs.developer@v1 resolve exatamente.
  it('D: backend.nestjs.developer@v1 resolves exactly', async () => {
    const version = await catalog.getVersion('backend.nestjs.developer', 1);
    expect(version).not.toBeNull();
    expect(version!.version).toBe(1);
    expect(version!.publishedAt).not.toBeNull();
    expect(version!.outputSchemaKey).toBe('ChangeSetProposalV1');
    expect(version!.promptTemplateKey).toBe('nestjs.developer');

    const current = await catalog.getCurrentVersion('backend.nestjs.developer');
    expect(current!.id).toBe(version!.id);
  });

  // E. backend.nestjs.reviewer@v1 resolve exatamente.
  it('E: backend.nestjs.reviewer@v1 resolves exactly', async () => {
    const version = await catalog.getVersion('backend.nestjs.reviewer', 1);
    expect(version).not.toBeNull();
    expect(version!.publishedAt).not.toBeNull();
    expect(version!.outputSchemaKey).toBe('CodeReviewResultV1');
    expect(version!.promptTemplateKey).toBe('nestjs.reviewer');
  });

  // F. developer e reviewer possuem missions diferentes.
  it('F: developer and reviewer have different roleMission', async () => {
    const developer = await catalog.getVersion('backend.nestjs.developer', 1);
    const reviewer = await catalog.getVersion('backend.nestjs.reviewer', 1);
    expect(developer!.roleMission).not.toBe(reviewer!.roleMission);
  });

  // G. developer e reviewer possuem capabilities diferentes.
  it('G: developer and reviewer have different capability sets', async () => {
    const developer = await catalog.resolveCapabilities('backend.nestjs.developer', 1);
    const reviewer = await catalog.resolveCapabilities('backend.nestjs.reviewer', 1);
    const developerKeys = developer.map((c) => c.key).sort();
    const reviewerKeys = reviewer.map((c) => c.key).sort();
    expect(developerKeys).not.toEqual(reviewerKeys);
    expect(developerKeys).toContain('backend.business-rules');
    expect(reviewerKeys).toContain('review.code');
    expect(developerKeys).not.toContain('review.code');
  });

  // H. developer e reviewer possuem PromptTemplates diferentes.
  it('H: developer and reviewer reference different PromptTemplates', async () => {
    const developer = await catalog.getVersion('backend.nestjs.developer', 1);
    const reviewer = await catalog.getVersion('backend.nestjs.reviewer', 1);
    expect(developer!.promptTemplateKey).not.toBe(reviewer!.promptTemplateKey);
  });

  // I. COGNITIVE publicada exige capability >= 1.
  it('I: publishing a COGNITIVE version with zero capabilities is rejected', async () => {
    const key = `test.cognitive.no-capability.${randomUUID()}`;
    await catalog.upsertUnit({ key: `unit.${key}`, departmentKey: 'dept.web', name: 'Test Unit', engineeringType: 'test' });
    await catalog.ensureDefinition({ key, unitKey: `unit.${key}` });
    await catalog.createVersion(key, 1, {
      identity: { role: 'Test', seniority: 'MID' },
      roleMission: 'test mission',
      capabilityKeys: [],
      promptTemplateKey: 'nestjs.developer',
      promptTemplateVersion: 'v1',
      outputSchemaKey: 'TestV1',
      boundaries: ['no-op'],
      cognitiveMode: 'COGNITIVE',
    });
    await expect(catalog.publishVersion(key, 1)).rejects.toThrow('CATALOG_PUBLISH_REQUIRES_CAPABILITY');
  });

  // J. COGNITIVE publicada exige PromptTemplate.
  it('J: publishing a COGNITIVE version with empty promptTemplateKey is rejected', async () => {
    const key = `test.cognitive.no-prompt.${randomUUID()}`;
    await catalog.upsertUnit({ key: `unit.${key}`, departmentKey: 'dept.web', name: 'Test Unit', engineeringType: 'test' });
    await catalog.ensureDefinition({ key, unitKey: `unit.${key}` });
    await catalog.createVersion(key, 1, {
      identity: { role: 'Test', seniority: 'MID' },
      roleMission: 'test mission',
      capabilityKeys: ['language.typescript'],
      promptTemplateKey: '',
      promptTemplateVersion: '',
      outputSchemaKey: 'TestV1',
      boundaries: ['no-op'],
      cognitiveMode: 'COGNITIVE',
    });
    await expect(catalog.publishVersion(key, 1)).rejects.toThrow('CATALOG_PUBLISH_REQUIRES_PROMPT_TEMPLATE');
  });

  // K. COGNITIVE publicada exige output contract.
  it('K: publishing a COGNITIVE version with empty outputSchemaKey is rejected', async () => {
    const key = `test.cognitive.no-output.${randomUUID()}`;
    await catalog.upsertUnit({ key: `unit.${key}`, departmentKey: 'dept.web', name: 'Test Unit', engineeringType: 'test' });
    await catalog.ensureDefinition({ key, unitKey: `unit.${key}` });
    await catalog.createVersion(key, 1, {
      identity: { role: 'Test', seniority: 'MID' },
      roleMission: 'test mission',
      capabilityKeys: ['language.typescript'],
      promptTemplateKey: 'nestjs.developer',
      promptTemplateVersion: 'v1',
      outputSchemaKey: '',
      boundaries: ['no-op'],
      cognitiveMode: 'COGNITIVE',
    });
    await expect(catalog.publishVersion(key, 1)).rejects.toThrow('CATALOG_PUBLISH_REQUIRES_OUTPUT_CONTRACT');
  });

  it('I2/J2/K2: also rejects missing identity/roleMission/boundaries', async () => {
    const key = `test.cognitive.missing-fields.${randomUUID()}`;
    await catalog.upsertUnit({ key: `unit.${key}`, departmentKey: 'dept.web', name: 'Test Unit', engineeringType: 'test' });
    await catalog.ensureDefinition({ key, unitKey: `unit.${key}` });
    await catalog.createVersion(key, 1, {
      identity: { role: '', seniority: '' },
      roleMission: '',
      capabilityKeys: ['language.typescript'],
      promptTemplateKey: 'nestjs.developer',
      promptTemplateVersion: 'v1',
      outputSchemaKey: 'TestV1',
      boundaries: [],
      cognitiveMode: 'COGNITIVE',
    });
    await expect(catalog.publishVersion(key, 1)).rejects.toThrow('CATALOG_PUBLISH_REQUIRES_IDENTITY');
  });

  // L. AgentDefVersion publicada não pode ser alterada.
  it('L: a published AgentDefVersion cannot be mutated', async () => {
    const key = `test.immutable.${randomUUID()}`;
    await catalog.upsertUnit({ key: `unit.${key}`, departmentKey: 'dept.web', name: 'Test Unit', engineeringType: 'test' });
    await catalog.ensureDefinition({ key, unitKey: `unit.${key}` });
    await catalog.createVersion(key, 1, {
      identity: { role: 'Test', seniority: 'MID' },
      roleMission: 'original mission',
      capabilityKeys: ['language.typescript'],
      promptTemplateKey: 'nestjs.developer',
      promptTemplateVersion: 'v1',
      outputSchemaKey: 'TestV1',
      boundaries: ['no-op'],
      cognitiveMode: 'COGNITIVE',
    });
    const published = await catalog.publishVersion(key, 1);
    expect(published.publishedAt).not.toBeNull();

    await expect(catalog.updateDraftVersion(key, 1, { roleMission: 'mutated mission' })).rejects.toThrow(
      'CATALOG_AGENT_DEF_VERSION_IMMUTABLE'
    );

    const reloaded = await catalog.getVersion(key, 1);
    expect(reloaded!.roleMission).toBe('original mission');
  });

  // M. v2 pode ser criada sem modificar v1.
  it('M: v2 can be created without modifying v1', async () => {
    const key = `test.versioning.${randomUUID()}`;
    await catalog.upsertUnit({ key: `unit.${key}`, departmentKey: 'dept.web', name: 'Test Unit', engineeringType: 'test' });
    await catalog.ensureDefinition({ key, unitKey: `unit.${key}` });
    await catalog.createVersion(key, 1, {
      identity: { role: 'Test v1', seniority: 'MID' },
      roleMission: 'v1 mission',
      capabilityKeys: ['language.typescript'],
      promptTemplateKey: 'nestjs.developer',
      promptTemplateVersion: 'v1',
      outputSchemaKey: 'TestV1',
      boundaries: ['no-op'],
      cognitiveMode: 'COGNITIVE',
    });
    const v1Published = await catalog.publishVersion(key, 1);
    const v1Snapshot = { ...v1Published };

    await catalog.createVersion(key, 2, {
      identity: { role: 'Test v2', seniority: 'SENIOR' },
      roleMission: 'v2 mission — different from v1',
      capabilityKeys: ['language.typescript', 'framework.nestjs'],
      promptTemplateKey: 'nestjs.developer',
      promptTemplateVersion: 'v1',
      outputSchemaKey: 'TestV1',
      boundaries: ['no-op'],
      cognitiveMode: 'COGNITIVE',
    });
    const v2Published = await catalog.publishVersion(key, 2);

    expect(v2Published.version).toBe(2);
    expect(v2Published.roleMission).toBe('v2 mission — different from v1');

    const v1Reloaded = await catalog.getVersion(key, 1);
    expect(v1Reloaded!.roleMission).toBe(v1Snapshot.roleMission);
    expect(v1Reloaded!.createdAt).toEqual(v1Snapshot.createdAt);
    expect((v1Reloaded!.identityJson as unknown as { role?: string }).role).toBe('Test v1');

    const definition = await catalog.getDefinition(key);
    expect(definition!.currentVersion).toBe(2);
  });

  // N. nenhuma AgentDefVersion/PromptTemplate contém credential.
  it('N: no seeded AgentDefVersion or PromptTemplate contains a credential-shaped key', async () => {
    const versions = await prisma.agentDefVersion.findMany();
    const templates = await prisma.promptTemplate.findMany();
    const forbidden = ['apikey', 'api_key', 'secret', 'credential', 'password'];

    for (const version of versions) {
      const text = JSON.stringify(version).toLowerCase();
      for (const term of forbidden) expect(text).not.toContain(term);
    }
    for (const template of templates) {
      const text = JSON.stringify(template).toLowerCase();
      for (const term of forbidden) expect(text).not.toContain(term);
    }
  });

  it('N2: creating a version with a credential-shaped field is rejected', async () => {
    const key = `test.credential.${randomUUID()}`;
    await catalog.upsertUnit({ key: `unit.${key}`, departmentKey: 'dept.web', name: 'Test Unit', engineeringType: 'test' });
    await catalog.ensureDefinition({ key, unitKey: `unit.${key}` });
    await expect(
      catalog.createVersion(key, 1, {
        identity: { role: 'Test', seniority: 'MID' },
        roleMission: 'test mission',
        capabilityKeys: ['language.typescript'],
        promptTemplateKey: 'nestjs.developer',
        promptTemplateVersion: 'v1',
        outputSchemaKey: 'TestV1',
        boundaries: ['no-op'],
        cognitiveMode: 'COGNITIVE',
        llmPolicy: { modelClass: 'standard', maxInputTokens: 1, maxOutputTokens: 1, temperatureProfile: 'x', fallbackPolicy: 'apiKey=sk-should-not-be-here' },
      })
    ).rejects.toThrow('CATALOG_CREDENTIAL_NOT_ALLOWED');
  });

  // O. data-specialist possui capabilities próprias.
  it('O: data-specialist has its own data.* capabilities distinct from developer', async () => {
    const dataSpecialist = await catalog.resolveCapabilities('backend.nestjs.data-specialist', 1);
    const keys = dataSpecialist.map((c) => c.key);
    expect(keys).toContain('data.modeling');
    expect(keys).toContain('data.persistence');
  });

  // P. test-engineer possui testing capabilities.
  it('P: test-engineer has testing.* capabilities', async () => {
    const testEngineer = await catalog.resolveCapabilities('backend.nestjs.test-engineer', 1);
    const keys = testEngineer.map((c) => c.key);
    expect(keys).toContain('testing.unit');
    expect(keys).toContain('testing.integration');
  });

  // Q. security-specialist possui security capability.
  it('Q: security-specialist has security.application capability', async () => {
    const securitySpecialist = await catalog.resolveCapabilities('backend.nestjs.security-specialist', 1);
    const keys = securitySpecialist.map((c) => c.key);
    expect(keys).toContain('security.application');
  });

  // R. AgentCatalogService.listByUnit funciona.
  it('R: listByUnit returns every NestJS agent definition', async () => {
    const nestjsAgents = await catalog.listByUnit('unit.web.nestjs');
    const keys = nestjsAgents.map((a) => a.key).sort();
    expect(keys).toEqual(
      [
        'backend.nestjs.architect',
        'backend.nestjs.data-specialist',
        'backend.nestjs.developer',
        'backend.nestjs.lead',
        'backend.nestjs.reviewer',
        'backend.nestjs.security-specialist',
        'backend.nestjs.test-engineer',
      ].sort()
    );
  });

  it('R2: listByUnit returns empty array for an unknown unit', async () => {
    const result = await catalog.listByUnit('unit.does-not-exist');
    expect(result).toEqual([]);
  });

  // S. resolveCapabilities funciona.
  it('S: resolveCapabilities returns full CapabilityDefinition rows, not just keys', async () => {
    const capabilities = await catalog.resolveCapabilities('backend.nestjs.reviewer', 1);
    expect(capabilities.length).toBeGreaterThan(0);
    for (const capability of capabilities) {
      expect(capability).toHaveProperty('domain');
      expect(capability).toHaveProperty('name');
      expect(capability).toHaveProperty('description');
    }
  });

  it('S2: resolveCapabilities returns empty array for an unresolvable version', async () => {
    const capabilities = await catalog.resolveCapabilities('backend.nestjs.developer', 999);
    expect(capabilities).toEqual([]);
  });

  it('all 11 bootstrap AgentDefinitions are published at v1', async () => {
    const keys = [
      'backend.nestjs.architect',
      'backend.nestjs.lead',
      'backend.nestjs.developer',
      'backend.nestjs.data-specialist',
      'backend.nestjs.test-engineer',
      'backend.nestjs.reviewer',
      'backend.nestjs.security-specialist',
      'architecture.solution-architect',
      'architecture.security-architect',
      'architecture.arbiter',
      'docs.writer',
    ];
    for (const key of keys) {
      const version = await catalog.getVersion(key, 1);
      expect(version).not.toBeNull();
      expect(version!.publishedAt).not.toBeNull();
      const definition = await catalog.getDefinition(key);
      expect(definition!.currentVersion).toBe(1);
    }
  });
});
