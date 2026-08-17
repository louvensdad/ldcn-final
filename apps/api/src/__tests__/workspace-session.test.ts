import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PrismaService } from '../persistence/prisma.service';
import { WorkspaceService, WorkspaceCandidateChange } from '../generation-engine/workspace.service';
import { WorkspaceSessionService } from '../generation-engine/workspace-session.service';
import { CandidateBuildRunner } from '../generation-engine/candidate-build-runner';
import { CandidateTestRunner } from '../generation-engine/candidate-test-runner';
import { WorkspaceValidationService } from '../generation-engine/workspace-validation.service';
import { EventBusService } from '../events/event-bus.service';
import { EventLogService } from '../events/event-log.service';
import { SecureRunCommandResult } from '../generation-engine/process-runner.service';
import { ProcessRunnerService } from '../generation-engine/process-runner.service';

const RUN_DB_TESTS = process.env.LDCN_TEST_DATABASE_URL || process.env.DATABASE_URL;

class FakeProcessRunner {
  calls: { command: string; args: string[]; cwd: string; timeoutMs: number }[] = [];
  results: SecureRunCommandResult[] = [];
  runCommandNoShell(command: string, args: string[], cwd: string, timeoutMs: number): Promise<SecureRunCommandResult> {
    this.calls.push({ command, args, cwd, timeoutMs });
    const result = this.results.shift();
    if (!result) throw new Error('FAKE_RUNNER_RESULT_MISSING');
    return Promise.resolve(result);
  }
}

function commandResult(input: Partial<SecureRunCommandResult> = {}): SecureRunCommandResult {
  return {
    command: 'fixed-profile', exitCode: 0, durationMs: 5, logsExcerpt: '', stdout: '', stderr: '', timedOut: false,
    ...input,
  };
}

(RUN_DB_TESTS ? describe : describe.skip)('CORE-009 isolated WorkspaceSession + build/test gate', () => {
  let prisma: PrismaService;
  let workspace: WorkspaceService;
  let sessions: WorkspaceSessionService;
  let eventLog: EventLogService;
  const missionIds: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    workspace = new WorkspaceService();
    sessions = new WorkspaceSessionService(prisma, workspace);
    eventLog = new EventLogService(prisma, new EventBusService());
  });

  afterAll(async () => {
    for (const missionId of missionIds) {
      const roots = await prisma.workspaceSession.findMany({ where: { missionId }, select: { rootRef: true } });
      for (const root of roots) await workspace.discardSession(root.rootRef);
      await prisma.testValidationRun.deleteMany({ where: { missionId } });
      await prisma.buildValidationRun.deleteMany({ where: { missionId } });
      await prisma.workspaceCandidateManifest.deleteMany({ where: { missionId } });
      await prisma.workspaceSession.deleteMany({ where: { missionId } });
      await prisma.eventLog.deleteMany({ where: { missionId } });
      await prisma.generatedArtifact.deleteMany({ where: { missionId } });
      await prisma.generationJob.deleteMany({ where: { missionId } });
    }
    await prisma.$disconnect();
  });

  async function fixture() {
    const missionId = `test-core9-${randomUUID()}`;
    const generationJobId = randomUUID();
    missionIds.push(missionId);
    const current = 'export class HealthController { check() { return true; } }';
    const files = [
      { path: 'src/health/health.controller.ts', content: current },
      { path: 'package.json', content: JSON.stringify({ name: 'candidate', version: '1.0.0', scripts: { build: 'node build.js' } }) },
      { path: 'build.js', content: "require('fs').mkdirSync('dist/test',{recursive:true});require('fs').writeFileSync('dist/test/smoke.spec.js',\"require('node:test').test('ok',()=>{})\")" },
    ];
    await workspace.writeFiles(missionId, files.map((file) => ({ ...file, provenance: 'scaffold', ownerAgent: 'test', symbols: [], imports: [], exports: [] })));
    await prisma.generationJob.create({
      data: {
        id: generationJobId, missionId, generationRunId: `run-${missionId}`, requirementId: randomUUID(),
        requirementText: 'health endpoint', targetResource: 'Health', targetFile: files[0].path,
        agentKey: 'backend.nestjs.developer', status: 'PENDING',
      },
    });
    const writtenHash = createHash('sha256').update(current).digest('hex');
    await prisma.generatedArtifact.create({
      data: {
        id: randomUUID(), missionId, generationRunId: `run-${missionId}`, path: files[0].path,
        target: 'BACKEND', pluginId: 'stack.typescript.nestjs', ownerAgent: 'test', hash: writtenHash,
        sizeBytes: Buffer.byteLength(current), symbolsJson: ['HealthController'], importsJson: [], exportsJson: ['HealthController'], provenance: 'scaffold',
      },
    });
    return { missionId, generationJobId, path: files[0].path, current, currentHash: writtenHash };
  }

  function input(fx: Awaited<ReturnType<typeof fixture>>, changes: WorkspaceCandidateChange[], changeSetHash = 'change-hash') {
    return {
      missionId: fx.missionId, generationJobId: fx.generationJobId, changeSetHash,
      scopeHash: 'scope-hash', inspectionHash: 'inspection-hash', repositoryFingerprint: 'repository-fingerprint', changes,
    };
  }

  function serviceWith(results: SecureRunCommandResult[]) {
    const fake = new FakeProcessRunner();
    fake.results.push(...results);
    const build = new CandidateBuildRunner(prisma, fake as never);
    const test = new CandidateTestRunner(prisma, fake as never);
    return { service: new WorkspaceValidationService(sessions, workspace, build, test, eventLog), fake };
  }

  it('A–E/G/J/K: MODIFY is isolated, fingerprints/manifest are deterministic, canonical FS and GeneratedArtifact remain unchanged', async () => {
    const fx = await fixture();
    const canonicalBefore = await workspace.fingerprintCanonical(fx.missionId);
    const artifactBefore = await prisma.generatedArtifact.findFirstOrThrow({ where: { missionId: fx.missionId } });
    const { service, fake } = serviceWith([
      commandResult(), commandResult(), commandResult({ stdout: '# tests 1\n# pass 1\n# fail 0\n# skipped 0' }),
    ]);
    const result = await service.validate(input(fx, [{ operation: 'MODIFY', path: fx.path, content: 'export class HealthController { changed = true; }', expectedBeforeHash: fx.currentHash }]));
    expect(result.status).toBe('VALIDATED');
    expect(result.session.rootRef).not.toBe(workspace.workspacePathFor(fx.missionId));
    expect(await workspace.readWorkspaceFile(fx.missionId, fx.path)).toBe(fx.current);
    expect(await workspace.fingerprintCanonical(fx.missionId)).toBe(canonicalBefore);
    expect(await readFile(join(result.session.rootRef, fx.path), 'utf8')).toContain('changed = true');
    expect(await workspace.fingerprintSession(result.session.rootRef)).toBe(result.session.candidateFingerprint);
    const artifactAfter = await prisma.generatedArtifact.findUniqueOrThrow({ where: { id: artifactBefore.id } });
    expect(artifactAfter.hash).toBe(artifactBefore.hash);
    const manifest = await prisma.workspaceCandidateManifest.findUniqueOrThrow({ where: { workspaceSessionId: result.session.id } });
    expect(manifest.manifestHash).toBe(result.session.manifestHash);
    expect(fake.calls.every((call) => call.cwd === result.session.rootRef)).toBe(true);
    expect(fake.calls.every((call) => call.command === process.execPath)).toBe(true);
  });

  it('B/F/H/I: roots are unique; CREATE writes only session; REUSE and NO_CHANGE do not copy/write', async () => {
    const fx = await fixture();
    const first = await sessions.createOrReuse(input(fx, [], 'first'));
    const second = await sessions.createOrReuse(input(fx, [], 'second'));
    expect(second.session.rootRef).not.toBe(first.session.rootRef);
    const created = await sessions.materialize(first.session, [{ operation: 'CREATE', path: 'src/health/new.service.ts', content: 'export class NewService {}' }]);
    expect(await workspace.pathExists(join(created.rootRef, 'src/health/new.service.ts'))).toBe(true);
    expect(await workspace.pathExists(join(workspace.workspacePathFor(fx.missionId), 'src/health/new.service.ts'))).toBe(false);
    const reused = await sessions.materialize(second.session, [
      { operation: 'REUSE', path: fx.path, expectedBeforeHash: fx.currentHash },
      { operation: 'NO_CHANGE', path: 'src/health/absent.ts' },
    ]);
    const manifest = await prisma.workspaceCandidateManifest.findUniqueOrThrow({ where: { workspaceSessionId: reused.id } });
    const files = manifest.filesJson as Array<{ operation: string; beforeHash: string | null; afterHash: string | null }>;
    expect(files[0].beforeHash).toBe(files[0].afterHash);
    expect(files[1]).toMatchObject({ operation: 'NO_CHANGE', beforeHash: null, afterHash: null });
  });

  it.each(['../escape.ts', '/absolute.ts', 'C:\\Windows\\escape.ts'])('L–N: workspace layer rejects unsafe path %s', async (unsafePath) => {
    const fx = await fixture();
    const created = await sessions.createOrReuse(input(fx, [], randomUUID()));
    await expect(sessions.materialize(created.session, [{ operation: 'CREATE', path: unsafePath, content: 'x' }])).rejects.toThrow('WORKSPACE_PATH_INVALID');
  });

  it('O: symlink escape is rejected by physical filesystem validation', async () => {
    const fx = await fixture();
    const created = await sessions.createOrReuse(input(fx, [], randomUUID()));
    const outside = join(tmpdir(), `core9-outside-${randomUUID()}`);
    await mkdir(outside, { recursive: true });
    await symlink(outside, join(created.session.rootRef, 'src', 'outside-link'), process.platform === 'win32' ? 'junction' : 'dir');
    await expect(sessions.materialize(created.session, [{ operation: 'CREATE', path: 'src/outside-link/escape.ts', content: 'x' }])).rejects.toThrow('WORKSPACE_SYMLINK_ESCAPE');
  });

  it('P: changed expected baseline hash blocks materialization as TOCTOU drift', async () => {
    const fx = await fixture();
    const created = await sessions.createOrReuse(input(fx, [], randomUUID()));
    await expect(sessions.materialize(created.session, [{ operation: 'MODIFY', path: fx.path, content: 'changed', expectedBeforeHash: 'wrong-hash' }])).rejects.toThrow('WORKSPACE_STATE_CHANGED');
  });

  it('W/AA/AD/AF/AG/AI: PASS persists exact build/test links and safe ordered events without promotion', async () => {
    const fx = await fixture();
    const { service } = serviceWith([
      commandResult({ stdout: 'authorization=Bearer abc.def.ghi' }), commandResult(),
      commandResult({ stdout: '# tests 1\n# pass 1\n# fail 0\n# skipped 0' }),
    ]);
    const result = await service.validate(input(fx, [{ operation: 'MODIFY', path: fx.path, content: 'export class HealthController { pass = true; }', expectedBeforeHash: fx.currentHash }]));
    const build = await prisma.buildValidationRun.findFirstOrThrow({ where: { workspaceSessionId: result.session.id } });
    const test = await prisma.testValidationRun.findFirstOrThrow({ where: { workspaceSessionId: result.session.id } });
    expect(build).toMatchObject({ changeSetHash: result.session.changeSetHash, manifestHash: result.session.manifestHash, candidateFingerprint: result.session.candidateFingerprint, status: 'PASS' });
    expect(test).toMatchObject({ changeSetHash: result.session.changeSetHash, manifestHash: result.session.manifestHash, candidateFingerprint: result.session.candidateFingerprint, status: 'PASS' });
    expect(build.safeSummary).not.toContain('Bearer abc.def.ghi');
    const events = await prisma.eventLog.findMany({ where: { missionId: fx.missionId }, orderBy: { sequence: 'asc' } });
    expect(events.map((event) => event.type)).toEqual([
      'job.workspace_created', 'job.workspace_materialized', 'job.build_started', 'job.build_passed',
      'job.test_started', 'job.test_passed', 'job.workspace_validated',
    ]);
    expect(JSON.stringify(events)).not.toContain('HealthController { pass');
    expect((await prisma.generatedArtifact.findFirstOrThrow({ where: { missionId: fx.missionId } })).hash).toBe(fx.currentHash);
  });

  it('X/Y/Z: BUILD failure/timeout persists evidence, discards session and never starts tests', async () => {
    for (const buildResult of [commandResult({ exitCode: 1, stderr: 'compile failed' }), commandResult({ exitCode: null, timedOut: true })]) {
      const fx = await fixture();
      const { service, fake } = serviceWith([buildResult]);
      const result = await service.validate(input(fx, [{ operation: 'MODIFY', path: fx.path, content: 'broken', expectedBeforeHash: fx.currentHash }], randomUUID()));
      expect(result.status).toBe('BUILD_FAILED');
      expect(fake.calls).toHaveLength(1);
      expect(await prisma.testValidationRun.count({ where: { workspaceSessionId: result.session.id } })).toBe(0);
      expect((await prisma.buildValidationRun.findFirstOrThrow({ where: { workspaceSessionId: result.session.id } })).status).toBe(buildResult.timedOut ? 'BUILD_TIMEOUT' : 'FAIL');
      expect(await workspace.pathExists(result.session.rootRef)).toBe(false);
    }
  });

  it('AB/AC/AH: test failure/timeout persists evidence and canonical remains unchanged', async () => {
    for (const testResult of [commandResult({ exitCode: 1, stderr: 'test failed' }), commandResult({ exitCode: null, timedOut: true })]) {
      const fx = await fixture();
      const { service } = serviceWith([commandResult(), commandResult(), testResult]);
      const result = await service.validate(input(fx, [{ operation: 'MODIFY', path: fx.path, content: 'candidate', expectedBeforeHash: fx.currentHash }], randomUUID()));
      expect(result.status).toBe('TEST_FAILED');
      expect((await prisma.testValidationRun.findFirstOrThrow({ where: { workspaceSessionId: result.session.id } })).status).toBe(testResult.timedOut ? 'TEST_TIMEOUT' : 'FAIL');
      expect(await workspace.readWorkspaceFile(fx.missionId, fx.path)).toBe(fx.current);
    }
  });

  it('AJ/AK: validated session is reused only while job, changeSet and baseline fingerprint match', async () => {
    const fx = await fixture();
    const { service, fake } = serviceWith([commandResult(), commandResult(), commandResult({ stdout: '# pass 1\n# fail 0' })]);
    const candidateInput = input(fx, [{ operation: 'CREATE', path: 'src/health/new.ts', content: 'export class New {}' }], 'stable-change');
    const first = await service.validate(candidateInput);
    const callsAfterFirst = fake.calls.length;
    const second = await service.validate(candidateInput);
    expect(second.reused).toBe(true);
    expect(second.session.id).toBe(first.session.id);
    expect(fake.calls).toHaveLength(callsAfterFirst);
    await workspace.writeWorkspaceFile(fx.missionId, 'README.md', 'baseline changed');
    const third = await sessions.createOrReuse(candidateInput);
    expect(third.reused).toBe(false);
    expect(third.session.id).not.toBe(first.session.id);
  });

  it('AL: abandoned BUILDING/TESTING sessions are detectable without pretending success', async () => {
    const fx = await fixture();
    const created = await sessions.createOrReuse(input(fx, [], randomUUID()));
    await prisma.workspaceSession.update({ where: { id: created.session.id }, data: { status: 'BUILDING', lastHeartbeatAt: new Date(0) } });
    const stale = await sessions.detectStaleWorkspaceSessions(1);
    expect(stale.map((session) => session.id)).toContain(created.session.id);
    expect(stale.find((session) => session.id === created.session.id)?.status).toBe('BUILDING');
  });

  it('real npm/node profile executes build and tests inside the isolated session when local tooling is available', async () => {
    const fx = await fixture();
    const processRunner = new ProcessRunnerService();
    const service = new WorkspaceValidationService(
      sessions, workspace,
      new CandidateBuildRunner(prisma, processRunner),
      new CandidateTestRunner(prisma, processRunner),
      eventLog
    );
    const result = await service.validate(input(fx, [{ operation: 'NO_CHANGE', path: fx.path }], randomUUID()));
    expect(result.status).toBe('VALIDATED');
    expect((await prisma.buildValidationRun.findFirstOrThrow({ where: { workspaceSessionId: result.session.id } })).status).toBe('PASS');
    expect((await prisma.testValidationRun.findFirstOrThrow({ where: { workspaceSessionId: result.session.id } })).status).toBe('PASS');
  }, 120_000);
});
