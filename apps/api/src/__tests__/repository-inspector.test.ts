import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../persistence/prisma.service';
import { WorkspaceService } from '../generation-engine/workspace.service';
import { JobScopeService } from '../generation-engine/job-scope.service';
import { RepositoryInspector } from '../generation-engine/repository-inspector';
import { DuplicateValidator } from '../generation-engine/duplicate-validator';
import { DuplicateValidationService } from '../generation-engine/duplicate-validation.service';

const RUN_DB_TESTS = process.env.LDCN_TEST_DATABASE_URL || process.env.DATABASE_URL;

interface FileFixture {
  path: string;
  content: string;
  symbols?: string[];
  exports?: string[];
}

(RUN_DB_TESTS ? describe : describe.skip)('CORE-008 RepositoryInspector + DuplicateValidator', () => {
  let prisma: PrismaService;
  let workspace: WorkspaceService;
  let inspector: RepositoryInspector;
  let duplicateService: DuplicateValidationService;
  let jobScopeService: JobScopeService;
  const missionIds: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    workspace = new WorkspaceService();
    inspector = new RepositoryInspector(prisma, workspace);
    duplicateService = new DuplicateValidationService(prisma, inspector);
    jobScopeService = new JobScopeService(prisma);
  });

  afterAll(async () => {
    for (const missionId of missionIds) {
      await prisma.duplicateValidation.deleteMany({ where: { missionId } });
      await prisma.jobScopeValidation.deleteMany({ where: { missionId } });
      await prisma.jobScope.deleteMany({ where: { missionId } });
      await prisma.generatedArtifact.deleteMany({ where: { missionId } });
      await prisma.generationJob.deleteMany({ where: { missionId } });
    }
    await prisma.$disconnect();
  });

  async function fixture(input: { workspaceFiles?: FileFixture[]; indexedFiles?: FileFixture[]; targetFile?: string; targetResource?: string }) {
    const missionId = `test-core8-${randomUUID()}`;
    const jobId = randomUUID();
    missionIds.push(missionId);
    const targetFile = input.targetFile ?? 'src/health/uptime.service.ts';
    await workspace.writeFiles(missionId, (input.workspaceFiles ?? []).map((file) => ({
      path: file.path, content: file.content, provenance: 'scaffold', ownerAgent: 'test',
      symbols: file.symbols ?? [], imports: [], exports: file.exports ?? [],
    })));
    await prisma.generationJob.create({
      data: {
        id: jobId, missionId, generationRunId: `run-${missionId}`, requirementId: randomUUID(),
        requirementText: 'Demo API', targetResource: input.targetResource ?? 'Health', targetFile,
        agentKey: 'backend.nestjs.developer', status: 'PENDING',
      },
    });
    for (const file of input.indexedFiles ?? []) {
      await prisma.generatedArtifact.create({
        data: {
          id: randomUUID(), missionId, generationRunId: `run-${missionId}`, path: file.path,
          target: 'BACKEND', pluginId: 'stack.typescript.nestjs', ownerAgent: 'test',
          hash: createHash('sha256').update(file.content).digest('hex'), sizeBytes: Buffer.byteLength(file.content),
          symbolsJson: file.symbols ?? [], importsJson: [], exportsJson: file.exports ?? [], provenance: 'scaffold',
        },
      });
    }
    const scope = await jobScopeService.ensureJobScope({ missionId, generationJobId: jobId, allowedPaths: ['src/health/**', 'src/app.module.ts'] });
    return { missionId, jobId, scope };
  }

  async function inspect(fx: Awaited<ReturnType<typeof fixture>>, change: { operation: 'CREATE' | 'MODIFY' | 'REUSE' | 'NO_CHANGE'; path: string; content?: string }) {
    return inspector.inspect({ missionId: fx.missionId, generationJobId: fx.jobId, proposedChange: change, jobScope: fx.scope });
  }

  const healthService: FileFixture = {
    path: 'src/health/health.service.ts',
    content: 'export class HealthService {}',
    symbols: ['HealthService'],
    exports: ['HealthService'],
  };

  it('A/B: finds an exact normalized path through GeneratedArtifact metadata', async () => {
    const fx = await fixture({ workspaceFiles: [healthService], indexedFiles: [healthService], targetFile: healthService.path });
    const result = await inspect(fx, { operation: 'MODIFY', path: 'src/health/./health.service.ts', content: 'export class HealthService { ok = true }' });
    expect(result.proposedPath).toBe(healthService.path);
    expect(result.exactPathMatch?.path).toBe(healthService.path);
    expect(result.filesystemPathExists).toBe(true);
    expect(result.indexDrift.detected).toBe(false);
  });

  it('C/D: detects a filesystem file missing from GeneratedArtifact as explicit index drift', async () => {
    const fx = await fixture({ workspaceFiles: [healthService], indexedFiles: [], targetFile: healthService.path });
    const result = await inspect(fx, { operation: 'CREATE', path: healthService.path, content: 'export class Other {}' });
    expect(result.filesystemPathExists).toBe(true);
    expect(result.exactPathMatch).toBeNull();
    expect(result.indexDrift).toEqual({ detected: true, reasons: ['FILESYSTEM_PATH_MISSING_FROM_INDEX'] });
    expect(new DuplicateValidator().validate([result]).status).toBe('REPOSITORY_INDEX_DRIFT');
  });

  it('D2: detects DB metadata whose file is missing or whose content hash drifted', async () => {
    const missing = await fixture({ workspaceFiles: [], indexedFiles: [healthService], targetFile: healthService.path });
    expect((await inspect(missing, { operation: 'MODIFY', path: healthService.path })).indexDrift.reasons).toContain('INDEX_PATH_MISSING_FROM_FILESYSTEM');

    const changed = { ...healthService, content: 'export class HealthService { changed = true }' };
    const mismatch = await fixture({ workspaceFiles: [changed], indexedFiles: [healthService], targetFile: healthService.path });
    expect((await inspect(mismatch, { operation: 'MODIFY', path: healthService.path })).indexDrift.reasons).toContain('INDEX_CONTENT_HASH_MISMATCH');
  });

  it('E/P: a new CREATE passes and always persists inspection evidence', async () => {
    const fx = await fixture({ workspaceFiles: [healthService], indexedFiles: [healthService] });
    const outcome = await duplicateService.inspectValidateAndRecord({
      missionId: fx.missionId, generationJobId: fx.jobId, jobScope: fx.scope,
      changes: [{ operation: 'CREATE', path: 'src/health/uptime.service.ts', content: 'export class UptimeService {}' }],
    });
    expect(outcome.result.status).toBe('PASS');
    expect(outcome.inspections).toHaveLength(1);
    expect(outcome.evidence.status).toBe('PASS');
    expect((outcome.evidence.inspectionsJson as unknown[])).toHaveLength(1);
  });

  it('F: CREATE at an existing coherent path returns MODIFY_REQUIRED', async () => {
    const fx = await fixture({ workspaceFiles: [healthService], indexedFiles: [healthService], targetFile: healthService.path });
    const result = new DuplicateValidator().validate([await inspect(fx, { operation: 'CREATE', path: healthService.path, content: 'export class Changed {}' })]);
    expect(result.status).toBe('MODIFY_REQUIRED');
  });

  it('G: identical CREATE content at another path returns REUSE_REQUIRED', async () => {
    const fx = await fixture({ workspaceFiles: [healthService], indexedFiles: [healthService] });
    const result = new DuplicateValidator().validate([await inspect(fx, { operation: 'CREATE', path: 'src/health/health-copy.service.ts', content: healthService.content })]);
    expect(result.status).toBe('REUSE_REQUIRED');
  });

  it('H/I: exact exported symbols are duplicates; merely similar names are not', async () => {
    const fx = await fixture({ workspaceFiles: [healthService], indexedFiles: [healthService] });
    const duplicate = new DuplicateValidator().validate([await inspect(fx, { operation: 'CREATE', path: 'src/health/new-health.service.ts', content: 'export class HealthService { value = 2 }' })]);
    expect(duplicate.status).toBe('DUPLICATE_ARTIFACT_DETECTED');

    const similar = new DuplicateValidator().validate([await inspect(fx, { operation: 'CREATE', path: 'src/health/auth.service.ts', content: 'export class AuthorizationService {}' })]);
    expect(similar.status).toBe('PASS');
  });

  it('J/K: MODIFY requires a coherent existing target', async () => {
    const existing = await fixture({ workspaceFiles: [healthService], indexedFiles: [healthService], targetFile: healthService.path });
    expect(new DuplicateValidator().validate([await inspect(existing, { operation: 'MODIFY', path: healthService.path, content: 'export class HealthService { ok = true }' })]).status).toBe('PASS');

    const missing = await fixture({ workspaceFiles: [], indexedFiles: [], targetFile: 'src/health/missing.ts' });
    expect(new DuplicateValidator().validate([await inspect(missing, { operation: 'MODIFY', path: 'src/health/missing.ts', content: 'x' })]).status).toBe('MODIFY_TARGET_NOT_FOUND');
  });

  it('L/M/N: REUSE must exist while NO_CHANGE never materializes and passes', async () => {
    const existing = await fixture({ workspaceFiles: [healthService], indexedFiles: [healthService], targetFile: healthService.path });
    expect(new DuplicateValidator().validate([await inspect(existing, { operation: 'REUSE', path: healthService.path })]).status).toBe('PASS');

    const missing = await fixture({ workspaceFiles: [], indexedFiles: [], targetFile: 'src/health/missing.ts' });
    expect(new DuplicateValidator().validate([await inspect(missing, { operation: 'REUSE', path: 'src/health/missing.ts' })]).status).toBe('REUSE_TARGET_NOT_FOUND');
    expect(new DuplicateValidator().validate([await inspect(missing, { operation: 'NO_CHANGE', path: 'src/health/missing.ts' })]).status).toBe('PASS');
  });

  it('O: one duplicate blocks a mixed ChangeSet all-or-nothing', async () => {
    const fx = await fixture({ workspaceFiles: [healthService], indexedFiles: [healthService] });
    const inspections = await Promise.all([
      inspect(fx, { operation: 'CREATE', path: 'src/health/uptime.service.ts', content: 'export class UptimeService {}' }),
      inspect(fx, { operation: 'CREATE', path: 'src/health/copy.service.ts', content: healthService.content }),
      inspect(fx, { operation: 'MODIFY', path: healthService.path, content: 'export class HealthService { ok = true }' }),
    ]);
    const result = new DuplicateValidator().validate(inspections);
    expect(result.status).toBe('REUSE_REQUIRED');
    expect(result.findings).toHaveLength(1);
  });

  it('Q/R: inspectionHash and repositoryFingerprint are deterministic for the same proposal and state', async () => {
    const fx = await fixture({ workspaceFiles: [healthService], indexedFiles: [healthService] });
    const change = { operation: 'CREATE' as const, path: 'src/health/uptime.service.ts', content: 'export class UptimeService {}' };
    const first = await inspect(fx, change);
    const second = await inspect(fx, change);
    expect(second.inspectionHash).toBe(first.inspectionHash);
    expect(second.repositoryFingerprint).toBe(first.repositoryFingerprint);
  });

  it('S/T: persisted evidence contains hashes and safe metadata, never raw source or credential values', async () => {
    const fx = await fixture({ workspaceFiles: [healthService], indexedFiles: [healthService] });
    const rawMarker = 'VERY_RAW_SOURCE_MARKER';
    const bearerValue = 'Bearer eyJhbGciOiJIUzI1NiJ9.payload.signature';
    const outcome = await duplicateService.inspectValidateAndRecord({
      missionId: fx.missionId, generationJobId: fx.jobId, jobScope: fx.scope,
      changes: [{ operation: 'CREATE', path: 'src/health/safe.service.ts', content: `export class SafeService { value = '${rawMarker}'; header = '${bearerValue}' }` }],
    });
    const serialized = JSON.stringify(outcome.evidence);
    expect(serialized).not.toContain(rawMarker);
    expect(serialized).not.toContain(bearerValue);
    expect(outcome.evidence.changeSetHash).toMatch(/^[a-f0-9]{64}$/);
    expect(outcome.evidence.inspectionHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('AD: mission isolation excludes artifacts from another mission', async () => {
    const own = await fixture({ workspaceFiles: [], indexedFiles: [] });
    await fixture({ workspaceFiles: [healthService], indexedFiles: [healthService] });
    const result = await inspect(own, { operation: 'CREATE', path: 'src/health/uptime.service.ts', content: healthService.content });
    expect(result.sameContentHashMatches).toHaveLength(0);
    expect(result.candidateArtifacts).toHaveLength(0);
  });

  it('coverage is honest: semantic is unavailable and symbol/hash coverage depends on proposal evidence', async () => {
    const fx = await fixture({ workspaceFiles: [], indexedFiles: [] });
    const withContent = await inspect(fx, { operation: 'CREATE', path: 'src/health/a.ts', content: 'export class A {}' });
    expect(withContent.coverage).toEqual({ exactPath: 'ENFORCED', contentHash: 'ENFORCED', symbols: 'ENFORCED', exports: 'ENFORCED', semantic: 'NOT_AVAILABLE' });
    const withoutContent = await inspect(fx, { operation: 'NO_CHANGE', path: 'src/health/a.ts' });
    expect(withoutContent.coverage.semantic).toBe('NOT_AVAILABLE');
    expect(withoutContent.coverage.contentHash).toBe('NOT_AVAILABLE');
  });
});
