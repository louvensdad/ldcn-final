import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { TestValidationRun, WorkspaceSession } from '@prisma/client';
import { PrismaService } from '../persistence/prisma.service';
import { ProcessRunnerService } from './process-runner.service';
import { outputHash, sanitizeValidationOutput } from './validation-output';

export const NESTJS_NODE_TEST_PROFILE = 'NESTJS_NODE_TEST_V1';

@Injectable()
export class CandidateTestRunner {
  constructor(private readonly prisma: PrismaService, private readonly runner: ProcessRunnerService) {}

  async run(session: WorkspaceSession): Promise<TestValidationRun> {
    if (!session.manifestHash || !session.candidateFingerprint || session.status !== 'TESTING') throw new Error('TEST_CANDIDATE_EVIDENCE_REQUIRED');
    const startedAt = new Date();
    const executed = await this.runner.runCommandNoShell(process.execPath, ['--test', 'dist/test/smoke.spec.js'], session.rootRef, 60_000);
    const counts = this.parseCounts(`${executed.stdout}\n${executed.stderr}`);
    const status = executed.timedOut ? 'TEST_TIMEOUT' : executed.exitCode === 0 && counts.failed === 0 ? 'PASS' : 'FAIL';
    return this.prisma.testValidationRun.create({
      data: {
        id: randomUUID(), missionId: session.missionId, generationJobId: session.generationJobId,
        workspaceSessionId: session.id, changeSetHash: session.changeSetHash,
        manifestHash: session.manifestHash, candidateFingerprint: session.candidateFingerprint,
        status, commandProfile: NESTJS_NODE_TEST_PROFILE, startedAt, completedAt: new Date(),
        elapsedMs: executed.durationMs, exitCode: executed.exitCode,
        passedCount: counts.passed, failedCount: counts.failed, skippedCount: counts.skipped,
        stdoutHash: outputHash(executed.stdout), stderrHash: outputHash(executed.stderr),
        safeSummary: sanitizeValidationOutput(`${executed.stdout}\n${executed.stderr}`),
      },
    });
  }

  private parseCounts(output: string): { passed: number; failed: number; skipped: number } {
    const read = (label: string): number => Number(output.match(new RegExp(`[#ℹ]\\s*${label}\\s+(\\d+)`))?.[1] ?? 0);
    return { passed: read('pass'), failed: read('fail'), skipped: read('skipped') };
  }
}
