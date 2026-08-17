import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { Injectable } from '@nestjs/common';
import { BuildValidationRun, WorkspaceSession } from '@prisma/client';
import { PrismaService } from '../persistence/prisma.service';
import { ProcessRunnerService, SecureRunCommandResult } from './process-runner.service';
import { outputHash, sanitizeValidationOutput } from './validation-output';

export const NESTJS_NPM_BUILD_PROFILE = 'NESTJS_NPM_BUILD_V1';

@Injectable()
export class CandidateBuildRunner {
  constructor(private readonly prisma: PrismaService, private readonly runner: ProcessRunnerService) {}

  async run(session: WorkspaceSession): Promise<BuildValidationRun> {
    this.assertCandidateLinked(session);
    const startedAt = new Date();
    const npmCli = this.resolveNpmCli();
    const install = await this.runner.runCommandNoShell(process.execPath, [npmCli, 'install', '--no-audit', '--no-fund', '--package-lock=false'], session.rootRef, 180_000);
    const build = install.exitCode === 0 && !install.timedOut
      ? await this.runner.runCommandNoShell(process.execPath, [npmCli, 'run', 'build'], session.rootRef, 90_000)
      : null;
    const combined = this.combine(install, build);
    const status = install.timedOut || build?.timedOut
      ? 'BUILD_TIMEOUT'
      : install.exitCode === 0 && build?.exitCode === 0 ? 'PASS' : 'FAIL';
    return this.prisma.buildValidationRun.create({
      data: {
        id: randomUUID(), missionId: session.missionId, generationJobId: session.generationJobId,
        workspaceSessionId: session.id, changeSetHash: session.changeSetHash,
        manifestHash: session.manifestHash!, candidateFingerprint: session.candidateFingerprint!,
        status, commandProfile: NESTJS_NPM_BUILD_PROFILE, startedAt, completedAt: new Date(),
        elapsedMs: combined.durationMs, exitCode: combined.exitCode,
        stdoutHash: outputHash(combined.stdout), stderrHash: outputHash(combined.stderr),
        safeSummary: sanitizeValidationOutput(`${combined.stdout}\n${combined.stderr}`),
      },
    });
  }

  private resolveNpmCli(): string {
    const envCandidate = process.env.npm_execpath;
    const candidates = [
      envCandidate && /npm-cli\.js$/i.test(envCandidate) ? resolve(envCandidate) : null,
      resolve(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
      resolve(dirname(process.execPath), '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    ].filter((candidate): candidate is string => Boolean(candidate));
    const found = candidates.find((candidate) => existsSync(candidate));
    if (!found) throw new Error('BUILD_PROFILE_UNAVAILABLE');
    return found;
  }

  private combine(first: SecureRunCommandResult, second: SecureRunCommandResult | null): SecureRunCommandResult {
    if (!second) return first;
    return {
      command: NESTJS_NPM_BUILD_PROFILE,
      exitCode: second.exitCode,
      durationMs: first.durationMs + second.durationMs,
      logsExcerpt: `${first.logsExcerpt}\n${second.logsExcerpt}`,
      stdout: `${first.stdout}\n${second.stdout}`,
      stderr: `${first.stderr}\n${second.stderr}`,
      timedOut: first.timedOut || second.timedOut,
    };
  }

  private assertCandidateLinked(session: WorkspaceSession): void {
    if (!session.manifestHash || !session.candidateFingerprint || session.status !== 'BUILDING') throw new Error('BUILD_CANDIDATE_EVIDENCE_REQUIRED');
  }
}
