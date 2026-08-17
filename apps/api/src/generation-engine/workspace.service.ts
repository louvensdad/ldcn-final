import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile, readFile, readdir, stat, rm, copyFile, lstat, realpath } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { dirname, join, resolve, relative, isAbsolute } from 'node:path';
import { tmpdir } from 'node:os';
import { Injectable } from '@nestjs/common';
import type { GeneratedFileSpec } from './scaffolders/nestjs-backend.scaffolder';
import { normalizeScopePath } from './scope-path';
import { canonicalHash } from './canonical-hash';

export interface WrittenFile {
  path: string;
  absolutePath: string;
  hash: string;
  sizeBytes: number;
}

/** Onde os workspaces gerados vivem — fora do repo (nunca commitado), um diretório por mission. */
const WORKSPACE_ROOT = join(tmpdir(), 'ldcn-generated');
const SESSION_ROOT = join(tmpdir(), 'ldcn-workspace-sessions');
const FINGERPRINT_EXCLUDED_DIRS = new Set(['node_modules', 'dist', '.git']);

export interface WorkspaceCandidateChange {
  operation: 'CREATE' | 'MODIFY' | 'REUSE' | 'NO_CHANGE';
  path: string;
  content?: string;
  expectedBeforeHash?: string | null;
}

export interface CandidateManifestFile {
  operation: WorkspaceCandidateChange['operation'];
  path: string;
  beforeHash: string | null;
  afterHash: string | null;
}

@Injectable()
export class WorkspaceService {
  workspacePathFor(missionId: string): string {
    return join(WORKSPACE_ROOT, missionId);
  }

  sessionPathFor(missionId: string, sessionId: string): string {
    const missionRef = createHash('sha256').update(missionId).digest('hex');
    const sessionRef = createHash('sha256').update(sessionId).digest('hex');
    return join(SESSION_ROOT, missionRef, sessionRef);
  }

  async writeFiles(missionId: string, files: GeneratedFileSpec[]): Promise<WrittenFile[]> {
    const root = this.workspacePathFor(missionId);
    await rm(root, { recursive: true, force: true });
    await mkdir(root, { recursive: true });

    const written: WrittenFile[] = [];
    for (const file of files) {
      const absolutePath = join(root, file.path);
      await mkdir(dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, file.content, 'utf8');
      const hash = createHash('sha256').update(file.content).digest('hex');
      written.push({ path: file.path, absolutePath, hash, sizeBytes: Buffer.byteLength(file.content, 'utf8') });
    }
    return written;
  }

  /** MISSÃO "Job Planner + execução por agente cognitivo real" — contexto real que o agente lê
   * antes de propor um ChangeSet (nunca inventa o conteúdo do arquivo atual). */
  async readWorkspaceFile(missionId: string, relativePath: string): Promise<string> {
    const root = this.workspacePathFor(missionId);
    const target = await this.resolveSafeTarget(root, relativePath);
    return readFile(target, 'utf8');
  }

  /** Aplica um ChangeSet de um único arquivo já validado estruturalmente — nunca usado para os
   * arquivos gerados pelo scaffold determinístico (esses só passam por writeFiles). */
  async writeWorkspaceFile(missionId: string, relativePath: string, content: string): Promise<WrittenFile> {
    const root = this.workspacePathFor(missionId);
    await mkdir(root, { recursive: true });
    const absolutePath = await this.resolveSafeTarget(root, relativePath);
    await mkdir(dirname(absolutePath), { recursive: true });
    await this.assertNoSymlinkEscape(root, absolutePath);
    await writeFile(absolutePath, content, 'utf8');
    return {
      path: relativePath, absolutePath,
      hash: createHash('sha256').update(content).digest('hex'),
      sizeBytes: Buffer.byteLength(content, 'utf8'),
    };
  }

  /** Cria uma cópia isolada e verifica o fingerprint antes/depois para detectar mutação durante
   * a cópia. Symlinks são rejeitados em vez de seguidos. */
  async createIsolatedSession(missionId: string, sessionId: string): Promise<{ rootRef: string; baselineFingerprint: string }> {
    const canonicalRoot = this.workspacePathFor(missionId);
    const rootRef = this.sessionPathFor(missionId, sessionId);
    const baselineBefore = await this.fingerprintRoot(canonicalRoot);
    await rm(rootRef, { recursive: true, force: true });
    await mkdir(rootRef, { recursive: true });
    try {
      await this.copyTreeSafe(canonicalRoot, rootRef, '');
      const baselineAfter = await this.fingerprintRoot(canonicalRoot);
      const copiedFingerprint = await this.fingerprintRoot(rootRef);
      if (baselineBefore !== baselineAfter || baselineBefore !== copiedFingerprint) throw new Error('WORKSPACE_STATE_CHANGED');
    } catch (error) {
      await rm(rootRef, { recursive: true, force: true });
      throw error;
    }
    return { rootRef, baselineFingerprint: baselineBefore };
  }

  async fingerprintCanonical(missionId: string): Promise<string> {
    return this.fingerprintRoot(this.workspacePathFor(missionId));
  }

  async fingerprintSession(rootRef: string): Promise<string> {
    await this.assertSessionRootSafe(rootRef);
    return this.fingerprintRoot(rootRef);
  }

  /** Reads one relevant candidate file from an isolated session. Path containment and symlink
   * checks are identical to materialization; callers never need to expose the session root. */
  async readSessionFile(rootRef: string, relativePath: string): Promise<string> {
    await this.assertSessionRootSafe(rootRef);
    const target = await this.resolveSafeTarget(rootRef, relativePath);
    await this.assertNoSymlinkEscape(rootRef, target);
    return readFile(target, 'utf8');
  }

  async assertSessionRootSafe(rootRef: string): Promise<void> {
    const sessionsRoot = resolve(SESSION_ROOT);
    const target = resolve(rootRef);
    if (target === sessionsRoot) throw new Error('WORKSPACE_PATH_ESCAPE');
    this.assertContained(sessionsRoot, target);
    await this.assertNoSymlinkEscape(target, target);
  }

  async applyCandidateChangeSet(rootRef: string, changes: WorkspaceCandidateChange[]): Promise<{ files: CandidateManifestFile[]; candidateFingerprint: string; manifestHash: string }> {
    const files: CandidateManifestFile[] = [];
    for (const change of changes) {
      const target = await this.resolveSafeTarget(rootRef, change.path);
      const exists = await this.pathExists(target);
      const beforeHash = exists ? await this.hashFile(target) : null;
      if (change.operation === 'CREATE') {
        if (exists || change.content === undefined) throw new Error('WORKSPACE_STATE_CHANGED');
        await mkdir(dirname(target), { recursive: true });
        await this.assertNoSymlinkEscape(rootRef, target);
        await writeFile(target, change.content, 'utf8');
      } else if (change.operation === 'MODIFY') {
        if (!exists || !change.expectedBeforeHash || beforeHash !== change.expectedBeforeHash || change.content === undefined) throw new Error('WORKSPACE_STATE_CHANGED');
        await this.assertNoSymlinkEscape(rootRef, target);
        await writeFile(target, change.content, 'utf8');
      } else if (change.operation === 'REUSE') {
        if (!exists || !change.expectedBeforeHash || beforeHash !== change.expectedBeforeHash) throw new Error('WORKSPACE_STATE_CHANGED');
      } else if (change.operation !== 'NO_CHANGE') {
        throw new Error('WORKSPACE_OPERATION_INVALID');
      }
      const afterHash = await this.pathExists(target) ? await this.hashFile(target) : null;
      files.push({ operation: change.operation, path: this.normalizeOrThrow(change.path), beforeHash, afterHash });
    }
    const candidateFingerprint = await this.fingerprintRoot(rootRef);
    const manifestHash = canonicalHash(files);
    return { files, candidateFingerprint, manifestHash };
  }

  async discardSession(rootRef: string): Promise<void> {
    const sessionsRoot = resolve(SESSION_ROOT);
    const target = resolve(rootRef);
    if (target === sessionsRoot) throw new Error('WORKSPACE_PATH_ESCAPE');
    this.assertContained(sessionsRoot, target);
    await rm(target, { recursive: true, force: true });
  }

  /** Fase 24 do brief — package real para download. Nunca inclui `node_modules`/`dist` (não são
   * source, e podem carregar segredos de ambiente local por acidente). */
  async zipWorkspace(missionId: string): Promise<string> {
    const root = this.workspacePathFor(missionId);
    const zipPath = join(WORKSPACE_ROOT, `${missionId}-${randomUUID().slice(0, 8)}.zip`);
    await this.createZip(root, zipPath, (entryPath) => !entryPath.startsWith('node_modules') && !entryPath.startsWith('dist'));
    return zipPath;
  }

  private async createZip(root: string, zipPath: string, include: (relativePath: string) => boolean): Promise<void> {
    // Zip mínimo e real (store, sem compressão) — evita depender de um pacote de zip externo só
    // para este slice; ainda é um .zip válido, abrível por qualquer ferramenta padrão.
    const entries = await this.listFiles(root, '', include);
    const out = createWriteStream(zipPath);
    const centralRecords: Buffer[] = [];
    let offset = 0;

    const write = (buffer: Buffer): Promise<void> => new Promise((resolve, reject) => out.write(buffer, (err) => err ? reject(err) : resolve()));

    for (const entry of entries) {
      const data = await this.readFileBuffer(join(root, entry));
      const crc = this.crc32(data);
      const nameBuffer = Buffer.from(entry.replace(/\\/g, '/'), 'utf8');

      const localHeader = Buffer.alloc(30);
      localHeader.writeUInt32LE(0x04034b50, 0);
      localHeader.writeUInt16LE(20, 4);
      localHeader.writeUInt16LE(0, 6);
      localHeader.writeUInt16LE(0, 8);
      localHeader.writeUInt16LE(0, 10);
      localHeader.writeUInt16LE(0, 12);
      localHeader.writeUInt32LE(crc, 14);
      localHeader.writeUInt32LE(data.length, 18);
      localHeader.writeUInt32LE(data.length, 22);
      localHeader.writeUInt16LE(nameBuffer.length, 26);
      localHeader.writeUInt16LE(0, 28);

      await write(localHeader);
      await write(nameBuffer);
      await write(data);

      const centralHeader = Buffer.alloc(46);
      centralHeader.writeUInt32LE(0x02014b50, 0);
      centralHeader.writeUInt16LE(20, 4);
      centralHeader.writeUInt16LE(20, 6);
      centralHeader.writeUInt16LE(0, 8);
      centralHeader.writeUInt16LE(0, 10);
      centralHeader.writeUInt16LE(0, 12);
      centralHeader.writeUInt16LE(0, 14);
      centralHeader.writeUInt32LE(crc, 16);
      centralHeader.writeUInt32LE(data.length, 20);
      centralHeader.writeUInt32LE(data.length, 24);
      centralHeader.writeUInt16LE(nameBuffer.length, 28);
      centralHeader.writeUInt16LE(0, 30);
      centralHeader.writeUInt16LE(0, 32);
      centralHeader.writeUInt16LE(0, 34);
      centralHeader.writeUInt16LE(0, 36);
      centralHeader.writeUInt32LE(0, 38);
      centralHeader.writeUInt32LE(offset, 42);
      centralRecords.push(Buffer.concat([centralHeader, nameBuffer]));

      offset += localHeader.length + nameBuffer.length + data.length;
    }

    const centralStart = offset;
    for (const record of centralRecords) {
      await write(record);
      offset += record.length;
    }
    const centralSize = offset - centralStart;

    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(0, 4);
    end.writeUInt16LE(0, 6);
    end.writeUInt16LE(centralRecords.length, 8);
    end.writeUInt16LE(centralRecords.length, 10);
    end.writeUInt32LE(centralSize, 12);
    end.writeUInt32LE(centralStart, 16);
    end.writeUInt16LE(0, 20);
    await write(end);

    await new Promise<void>((resolve, reject) => out.end((err: unknown) => err ? reject(err) : resolve()));
  }

  private async listFiles(root: string, relative: string, include: (relativePath: string) => boolean): Promise<string[]> {
    const currentDir = join(root, relative);
    const entries = await readdir(currentDir, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const entryRelative = relative ? join(relative, entry.name) : entry.name;
      if (!include(entryRelative)) continue;
      if (entry.isDirectory()) {
        files.push(...await this.listFiles(root, entryRelative, include));
      } else {
        files.push(entryRelative);
      }
    }
    return files;
  }

  private async readFileBuffer(path: string): Promise<Buffer> {
    return readFile(path);
  }

  private crc32(data: Buffer): number {
    let crc = ~0;
    for (const byte of data) {
      crc ^= byte;
      for (let i = 0; i < 8; i++) {
        crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
      }
    }
    return (~crc) >>> 0;
  }

  async pathExists(path: string): Promise<boolean> {
    try { await stat(path); return true; } catch { return false; }
  }

  private normalizeOrThrow(path: string): string {
    const normalized = normalizeScopePath(path);
    if (!normalized.ok) throw new Error('WORKSPACE_PATH_INVALID');
    return normalized.path;
  }

  private async resolveSafeTarget(root: string, relativePath: string): Promise<string> {
    const normalized = this.normalizeOrThrow(relativePath);
    const rootResolved = resolve(root);
    const target = resolve(rootResolved, ...normalized.split('/'));
    this.assertContained(rootResolved, target);
    if (await this.pathExists(rootResolved)) await this.assertNoSymlinkEscape(rootResolved, target);
    return target;
  }

  private assertContained(root: string, target: string): void {
    const relation = relative(root, target);
    if (relation === '' || (!relation.startsWith('..') && !isAbsolute(relation))) return;
    throw new Error('WORKSPACE_PATH_ESCAPE');
  }

  private async assertNoSymlinkEscape(root: string, target: string): Promise<void> {
    const rootResolved = resolve(root);
    const physicalRoot = await realpath(rootResolved);
    if (relative(rootResolved, physicalRoot) !== '') throw new Error('WORKSPACE_SYMLINK_ESCAPE');
    const relation = relative(rootResolved, target);
    this.assertContained(rootResolved, target);
    let current = rootResolved;
    for (const segment of relation.split(/[\\/]/).filter(Boolean)) {
      current = join(current, segment);
      try {
        const info = await lstat(current);
        if (info.isSymbolicLink()) throw new Error('WORKSPACE_SYMLINK_ESCAPE');
        const physical = await realpath(current);
        this.assertContained(physicalRoot, physical);
      } catch (error) {
        if (error instanceof Error && (error.message === 'WORKSPACE_SYMLINK_ESCAPE' || error.message === 'WORKSPACE_PATH_ESCAPE')) throw error;
        break; // primeiro ancestor inexistente; os descendentes também ainda não existem.
      }
    }
  }

  private async copyTreeSafe(sourceRoot: string, targetRoot: string, currentRelative: string): Promise<void> {
    const source = currentRelative ? join(sourceRoot, currentRelative) : sourceRoot;
    const entries = await readdir(source, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isSymbolicLink()) throw new Error('WORKSPACE_SYMLINK_ESCAPE');
      if (entry.isDirectory() && FINGERPRINT_EXCLUDED_DIRS.has(entry.name)) continue;
      const nextRelative = currentRelative ? join(currentRelative, entry.name) : entry.name;
      const target = join(targetRoot, nextRelative);
      if (entry.isDirectory()) {
        await mkdir(target, { recursive: true });
        await this.copyTreeSafe(sourceRoot, targetRoot, nextRelative);
      } else if (entry.isFile()) {
        await mkdir(dirname(target), { recursive: true });
        await copyFile(join(sourceRoot, nextRelative), target);
      }
    }
  }

  private async fingerprintRoot(root: string): Promise<string> {
    const records: { path: string; hash: string }[] = [];
    await this.collectFingerprintRecords(root, '', records);
    return canonicalHash(records.sort((a, b) => a.path.localeCompare(b.path)));
  }

  private async collectFingerprintRecords(root: string, currentRelative: string, records: { path: string; hash: string }[]): Promise<void> {
    const current = currentRelative ? join(root, currentRelative) : root;
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.isSymbolicLink()) throw new Error('WORKSPACE_SYMLINK_ESCAPE');
      if (entry.isDirectory() && FINGERPRINT_EXCLUDED_DIRS.has(entry.name)) continue;
      const nextRelative = currentRelative ? join(currentRelative, entry.name) : entry.name;
      if (entry.isDirectory()) await this.collectFingerprintRecords(root, nextRelative, records);
      else if (entry.isFile()) records.push({ path: nextRelative.replace(/\\/g, '/'), hash: await this.hashFile(join(root, nextRelative)) });
    }
  }

  private async hashFile(path: string): Promise<string> {
    return createHash('sha256').update(await readFile(path)).digest('hex');
  }
}
