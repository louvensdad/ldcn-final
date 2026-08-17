import { Injectable } from '@nestjs/common';
import { BuildValidationRun, TestValidationRun, WorkspaceSession } from '@prisma/client';
import { EventLogService } from '../events/event-log.service';
import { CandidateBuildRunner } from './candidate-build-runner';
import { CandidateTestRunner } from './candidate-test-runner';
import { WorkspaceCandidateChange, WorkspaceService } from './workspace.service';
import { WorkspaceSessionService } from './workspace-session.service';

export interface WorkspaceValidationResult {
  status: 'VALIDATED' | 'BUILD_FAILED' | 'TEST_FAILED' | 'WORKSPACE_STATE_CHANGED';
  errorCode: string | null;
  session: WorkspaceSession;
  reused: boolean;
}

@Injectable()
export class WorkspaceValidationService {
  constructor(
    private readonly sessions: WorkspaceSessionService,
    private readonly workspace: WorkspaceService,
    private readonly buildRunner: CandidateBuildRunner,
    private readonly testRunner: CandidateTestRunner,
    private readonly eventLog: EventLogService
  ) {}

  async validate(input: {
    missionId: string;
    generationJobId: string;
    agentExecutionId?: string;
    changeSetHash: string;
    scopeHash: string;
    inspectionHash: string;
    repositoryFingerprint: string;
    changes: WorkspaceCandidateChange[];
    forceNew?: boolean;
  }): Promise<WorkspaceValidationResult> {
    const correlationId = input.agentExecutionId ?? input.generationJobId;
    const created = await this.sessions.createOrReuse(input);
    if (created.reused) return { status: 'VALIDATED', errorCode: null, session: created.session, reused: true };
    let session = created.session;
    await this.eventLog.append({
      missionId: input.missionId, correlationId, actorType: 'GENERATION_ENGINE', type: 'job.workspace_created',
      payload: this.sessionPayload(session),
    });
    try {
      session = await this.sessions.materialize(session, input.changes);
    } catch (error) {
      session = await this.sessions.transition(session.id, 'FAILED', true);
      await this.sessions.discard(session);
      await this.eventLog.append({
        missionId: input.missionId, correlationId, actorType: 'GENERATION_ENGINE', type: 'job.workspace_discarded',
        payload: { ...this.sessionPayload(session), status: 'WORKSPACE_STATE_CHANGED' },
      });
      return { status: 'WORKSPACE_STATE_CHANGED', errorCode: error instanceof Error ? error.message : 'WORKSPACE_STATE_CHANGED', session, reused: false };
    }
    await this.eventLog.append({
      missionId: input.missionId, correlationId, actorType: 'GENERATION_ENGINE', type: 'job.workspace_materialized',
      payload: this.sessionPayload(session),
    });

    session = await this.sessions.transition(session.id, 'BUILDING');
    await this.workspace.assertSessionRootSafe(session.rootRef);
    await this.eventLog.append({
      missionId: input.missionId, correlationId, actorType: 'GENERATION_ENGINE', type: 'job.build_started',
      payload: this.sessionPayload(session),
    });
    const build = await this.buildRunner.run(session);
    if (build.status !== 'PASS') return this.failBuild(session, build, correlationId);
    if (await this.workspace.fingerprintSession(session.rootRef) !== session.candidateFingerprint) {
      return this.failStateChanged(session, correlationId, 'BUILD_MUTATED_CANDIDATE');
    }
    session = await this.sessions.transition(session.id, 'BUILD_PASSED');
    await this.eventLog.append({
      missionId: input.missionId, correlationId, actorType: 'GENERATION_ENGINE', type: 'job.build_passed',
      payload: { ...this.sessionPayload(session), elapsedMs: build.elapsedMs, exitCode: build.exitCode },
    });

    session = await this.sessions.transition(session.id, 'TESTING');
    await this.workspace.assertSessionRootSafe(session.rootRef);
    await this.eventLog.append({
      missionId: input.missionId, correlationId, actorType: 'GENERATION_ENGINE', type: 'job.test_started',
      payload: this.sessionPayload(session),
    });
    const test = await this.testRunner.run(session);
    if (test.status !== 'PASS') return this.failTest(session, test, correlationId);
    if (await this.workspace.fingerprintSession(session.rootRef) !== session.candidateFingerprint) {
      return this.failStateChanged(session, correlationId, 'TEST_MUTATED_CANDIDATE');
    }
    session = await this.sessions.transition(session.id, 'TEST_PASSED');
    await this.eventLog.append({
      missionId: input.missionId, correlationId, actorType: 'GENERATION_ENGINE', type: 'job.test_passed',
      payload: {
        ...this.sessionPayload(session), elapsedMs: test.elapsedMs, exitCode: test.exitCode,
        passedCount: test.passedCount, failedCount: test.failedCount, skippedCount: test.skippedCount,
      },
    });
    session = await this.sessions.transition(session.id, 'VALIDATED', true);
    await this.eventLog.append({
      missionId: input.missionId, correlationId, actorType: 'GENERATION_ENGINE', type: 'job.workspace_validated',
      payload: this.sessionPayload(session),
    });
    return { status: 'VALIDATED', errorCode: null, session, reused: false };
  }

  private async failBuild(session: WorkspaceSession, build: BuildValidationRun, correlationId: string): Promise<WorkspaceValidationResult> {
    session = await this.sessions.transition(session.id, 'BUILD_FAILED', true);
    await this.eventLog.append({
      missionId: session.missionId, correlationId, actorType: 'GENERATION_ENGINE', type: 'job.build_failed',
      payload: { ...this.sessionPayload(session), status: build.status, elapsedMs: build.elapsedMs, exitCode: build.exitCode },
    });
    await this.sessions.discard(session);
    await this.eventLog.append({ missionId: session.missionId, correlationId, actorType: 'GENERATION_ENGINE', type: 'job.workspace_discarded', payload: this.sessionPayload(session) });
    return { status: 'BUILD_FAILED', errorCode: build.status, session, reused: false };
  }

  private async failTest(session: WorkspaceSession, test: TestValidationRun, correlationId: string): Promise<WorkspaceValidationResult> {
    session = await this.sessions.transition(session.id, 'TEST_FAILED', true);
    await this.eventLog.append({
      missionId: session.missionId, correlationId, actorType: 'GENERATION_ENGINE', type: 'job.test_failed',
      payload: {
        ...this.sessionPayload(session), status: test.status, elapsedMs: test.elapsedMs, exitCode: test.exitCode,
        passedCount: test.passedCount, failedCount: test.failedCount, skippedCount: test.skippedCount,
      },
    });
    await this.sessions.discard(session);
    await this.eventLog.append({ missionId: session.missionId, correlationId, actorType: 'GENERATION_ENGINE', type: 'job.workspace_discarded', payload: this.sessionPayload(session) });
    return { status: 'TEST_FAILED', errorCode: test.status, session, reused: false };
  }

  private async failStateChanged(session: WorkspaceSession, correlationId: string, reason: string): Promise<WorkspaceValidationResult> {
    session = await this.sessions.transition(session.id, 'FAILED', true);
    await this.sessions.discard(session);
    await this.eventLog.append({
      missionId: session.missionId, correlationId, actorType: 'GENERATION_ENGINE', type: 'job.workspace_discarded',
      payload: { ...this.sessionPayload(session), status: 'WORKSPACE_STATE_CHANGED', reason },
    });
    return { status: 'WORKSPACE_STATE_CHANGED', errorCode: 'WORKSPACE_STATE_CHANGED', session, reused: false };
  }

  private sessionPayload(session: WorkspaceSession): Record<string, unknown> {
    return {
      jobId: session.generationJobId,
      agentExecutionId: session.agentExecutionId ?? undefined,
      workspaceSessionId: session.id,
      changeSetHash: session.changeSetHash,
      manifestHash: session.manifestHash ?? undefined,
      baselineFingerprint: session.baselineFingerprint,
      candidateFingerprint: session.candidateFingerprint ?? undefined,
      status: session.status,
    };
  }
}
