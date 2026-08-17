import { createHash, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AgentRuntimeService } from '../agent-runtime/agent-runtime.service';
import { AgentCatalogService } from '../catalog/agent-catalog.service';
import { EventLogService } from '../events/event-log.service';
import { PrismaService } from '../persistence/prisma.service';
import { CandidateReviewContext, PreviousStepSummary } from '../promptmaster/types';
import { AgentExecutionService, ReviewExecutionFailedError } from './agent-execution.service';
import { canonicalHash } from './canonical-hash';
import { ChangeSetProposalV1, CodeReviewResultV1 } from './cognitive-schemas';
import { WorkspaceService } from './workspace.service';

export const REVIEWER_KEY = 'backend.nestjs.reviewer';
export const REVIEWER_VERSION = 1;
export const MAX_EXTERNAL_REWORKS = 2;

export interface ReviewOutcome {
  reviewRecordId: string;
  reviewerAgentExecutionId: string;
  verdict: 'APPROVED' | 'REWORK_REQUIRED';
  result: CodeReviewResultV1;
  resultHash: string;
  reviewCycle: number;
  idempotentReplay: boolean;
}

@Injectable()
export class ReviewOrchestrator {
  private readonly inFlight = new Map<string, Promise<ReviewOutcome>>();
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: AgentCatalogService,
    private readonly runtime: AgentRuntimeService,
    private readonly agentExecution: AgentExecutionService,
    private readonly workspace: WorkspaceService,
    private readonly eventLog: EventLogService
  ) {}

  async startReview(input: { workspaceSessionId: string; reviewCycle: number; executorAgentExecutionId?: string }): Promise<ReviewOutcome> {
    const key = `${input.workspaceSessionId}:${input.reviewCycle}`;
    const running = this.inFlight.get(key);
    if (running) return running;
    const operation = this.executeReview(input).finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, operation);
    return operation;
  }

  private async executeReview(input: { workspaceSessionId: string; reviewCycle: number; executorAgentExecutionId?: string }): Promise<ReviewOutcome> {
    const evidence = await this.loadValidatedCandidate(input.workspaceSessionId);
    const existing = await this.prisma.reviewRecord.findUnique({
      where: { workspaceSessionId_candidateFingerprint_reviewCycle: {
        workspaceSessionId: evidence.session.id,
        candidateFingerprint: evidence.session.candidateFingerprint!,
        reviewCycle: input.reviewCycle,
      }},
    });
    if (existing && (existing.verdict === 'APPROVED' || existing.verdict === 'REWORK_REQUIRED')) {
      const findings = await this.prisma.codeReviewFinding.findMany({ where: { reviewRecordId: existing.id }, orderBy: { createdAt: 'asc' } });
      return {
        reviewRecordId: existing.id, reviewerAgentExecutionId: existing.reviewerAgentExecutionId,
        verdict: existing.verdict as ReviewOutcome['verdict'], resultHash: existing.resultHash,
        reviewCycle: existing.reviewCycle, idempotentReplay: true,
        result: { verdict: existing.verdict as ReviewOutcome['verdict'], summary: existing.summary,
          findings: findings.map((finding) => ({ id: finding.id, category: finding.category as CodeReviewResultV1['findings'][number]['category'], severity: finding.severity as CodeReviewResultV1['findings'][number]['severity'], path: finding.path ?? undefined, message: finding.message, requirementIds: finding.requirementIdsJson as string[] })),
          requirementAssessment: existing.requirementAssessmentJson as unknown as CodeReviewResultV1['requirementAssessment'], confidence: existing.confidence },
      };
    }
    if (existing?.verdict === 'REVIEW_EXECUTION_FAILED') throw new Error('REVIEW_EXECUTION_FAILED');
    if (existing?.verdict === 'RUNNING') throw new Error('REVIEW_ALREADY_RUNNING');

    const executor = await this.resolveExecutor(evidence.session.generationJobId, input.executorAgentExecutionId ?? evidence.session.agentExecutionId ?? undefined);
    const reviewer = await this.catalog.getVersion(REVIEWER_KEY, REVIEWER_VERSION);
    if (!reviewer?.publishedAt || !reviewer.canReview) throw new Error('REVIEWER_AGENT_NOT_AVAILABLE');
    if (executor.agentDefinitionKey === REVIEWER_KEY) throw new Error('REVIEWER_CANNOT_REVIEW_OWN_WORK');
    const reviewerInstance = await this.runtime.ensureInstanceExact({ missionId: evidence.session.missionId, agentDefinitionKey: REVIEWER_KEY, agentDefinitionVersion: REVIEWER_VERSION });
    if (executor.agentInstanceId && executor.agentInstanceId === reviewerInstance.id) throw new Error('REVIEWER_CANNOT_REVIEW_OWN_WORK');

    const context = await this.buildReviewContext(evidence);
    const recordId = randomUUID();
    const reviewerAgentExecutionId = randomUUID();
    try {
      await this.prisma.reviewRecord.create({ data: {
        id: recordId, missionId: evidence.session.missionId, generationJobId: evidence.session.generationJobId,
        workspaceSessionId: evidence.session.id, executorAgentExecutionId: executor.id,
        executorAgentDefinitionKey: executor.agentDefinitionKey!, executorAgentDefinitionVersion: executor.agentDefinitionVersion,
        reviewerAgentExecutionId, reviewerAgentDefinitionKey: REVIEWER_KEY, reviewerAgentDefinitionVersion: REVIEWER_VERSION,
        reviewerAgentInstanceId: reviewerInstance.id, candidateFingerprint: evidence.session.candidateFingerprint!,
        manifestHash: evidence.session.manifestHash!, changeSetHash: evidence.session.changeSetHash,
        resultHash: canonicalHash({ status: 'RUNNING', workspaceSessionId: evidence.session.id, reviewCycle: input.reviewCycle }),
        verdict: 'RUNNING', reviewCycle: input.reviewCycle, confidence: 0, summary: 'Review in progress', requirementAssessmentJson: [],
      }});
    } catch (error) {
      const raced = await this.prisma.reviewRecord.findUnique({ where: { workspaceSessionId_candidateFingerprint_reviewCycle: { workspaceSessionId: evidence.session.id, candidateFingerprint: evidence.session.candidateFingerprint!, reviewCycle: input.reviewCycle } } });
      if (raced) throw new Error(raced.verdict === 'RUNNING' ? 'REVIEW_ALREADY_RUNNING' : 'REVIEW_ALREADY_RECORDED');
      throw error;
    }
    await this.eventLog.append({ missionId: evidence.session.missionId, correlationId: evidence.session.id, actorType: 'REVIEW_ORCHESTRATOR', type: 'job.review_started', payload: {
      jobId: evidence.session.generationJobId, workspaceSessionId: evidence.session.id, reviewCycle: input.reviewCycle,
      candidateFingerprint: evidence.session.candidateFingerprint,
    }});

    let execution: Awaited<ReturnType<AgentExecutionService['runIndependentReview']>>;
    try {
      execution = await this.agentExecution.runIndependentReview({
        missionId: evidence.session.missionId, jobId: evidence.session.generationJobId,
        reviewerAgentDefinitionKey: REVIEWER_KEY, reviewerAgentDefinitionVersion: REVIEWER_VERSION,
        reviewerAgentInstanceId: reviewerInstance.id, candidateReviewContext: context, agentExecutionId: reviewerAgentExecutionId,
      });
    } catch (error) {
      const reviewerAgentExecutionId = error instanceof ReviewExecutionFailedError ? error.agentExecutionId : 'REVIEW_EXECUTION_NOT_STARTED';
      const errorCode = error instanceof Error ? error.message : 'REVIEW_EXECUTION_FAILED';
      const failedHash = canonicalHash({ verdict: 'REVIEW_EXECUTION_FAILED', errorCode });
      const step = reviewerAgentExecutionId === 'REVIEW_EXECUTION_NOT_STARTED' ? null : await this.prisma.agentCognitiveStep.findFirst({ where: { agentExecutionId: reviewerAgentExecutionId }, orderBy: { createdAt: 'desc' } });
      await this.prisma.reviewRecord.update({ where: { id: recordId }, data: {
        reviewerAgentExecutionId, resultHash: failedHash, verdict: 'REVIEW_EXECUTION_FAILED', confidence: 0,
        summary: errorCode, promptSnapshotId: step?.promptSnapshotId ?? null, llmInvocationId: step?.llmInvocationId ?? null,
      }});
      await this.eventLog.append({ missionId: evidence.session.missionId, correlationId: evidence.session.id, actorType: 'REVIEW_ORCHESTRATOR', type: 'job.review_completed', payload: {
        jobId: evidence.session.generationJobId, workspaceSessionId: evidence.session.id, reviewRecordId: recordId,
        reviewerAgentExecutionId, reviewCycle: input.reviewCycle, verdict: 'REVIEW_EXECUTION_FAILED',
        findingCount: 0, resultHash: failedHash, candidateFingerprint: evidence.session.candidateFingerprint,
      }});
      throw new Error(errorCode);
    }

    const result = this.applyVerdictPolicy(execution.result);
    const resultHash = canonicalHash(result);
    const step = await this.prisma.agentCognitiveStep.findUniqueOrThrow({ where: { id: execution.stepId } });
    await this.prisma.$transaction(async (tx) => {
      await tx.reviewRecord.update({ where: { id: recordId }, data: {
        reviewerAgentExecutionId: execution.agentExecutionId, resultHash, verdict: result.verdict,
        confidence: result.confidence, summary: this.safeText(result.summary),
        requirementAssessmentJson: result.requirementAssessment.map((assessment) => ({ ...assessment, requirementId: this.safeText(assessment.requirementId), evidenceSummary: this.safeText(assessment.evidenceSummary) })) as Prisma.InputJsonValue,
        promptSnapshotId: step.promptSnapshotId, llmInvocationId: step.llmInvocationId,
      }});
      if (result.findings.length) await tx.codeReviewFinding.createMany({ data: result.findings.map((finding) => ({
        id: finding.id || randomUUID(), reviewRecordId: recordId, missionId: evidence.session.missionId,
        category: finding.category, severity: finding.severity, path: finding.path ? this.safeText(finding.path) : null,
        message: this.safeText(finding.message), requirementIdsJson: (finding.requirementIds ?? []).map((id) => this.safeText(id)) as Prisma.InputJsonValue,
      })) });
    });

    const payload = { jobId: evidence.session.generationJobId, workspaceSessionId: evidence.session.id,
      reviewRecordId: recordId, reviewerAgentExecutionId: execution.agentExecutionId,
      reviewCycle: input.reviewCycle, verdict: result.verdict, findingCount: result.findings.length,
      resultHash, candidateFingerprint: evidence.session.candidateFingerprint };
    await this.eventLog.append({ missionId: evidence.session.missionId, correlationId: execution.agentExecutionId, actorType: 'REVIEW_ORCHESTRATOR', type: 'job.review_completed', payload });
    await this.eventLog.append({ missionId: evidence.session.missionId, correlationId: execution.agentExecutionId, actorType: 'REVIEW_ORCHESTRATOR', type: result.verdict === 'APPROVED' ? 'job.review_approved' : 'job.review_rejected', payload });
    if (result.verdict === 'APPROVED') await this.prisma.workspaceSession.update({ where: { id: evidence.session.id }, data: { status: 'REVIEW_APPROVED' } });
    return { reviewRecordId: recordId, reviewerAgentExecutionId: execution.agentExecutionId, verdict: result.verdict, result, resultHash, reviewCycle: input.reviewCycle, idempotentReplay: false };
  }

  async executeRework(input: { reviewRecordId: string }): Promise<{ agentExecutionId: string; changeset: ChangeSetProposalV1 }> {
    const review = await this.prisma.reviewRecord.findUniqueOrThrow({ where: { id: input.reviewRecordId } });
    if (review.verdict !== 'REWORK_REQUIRED') throw new Error('REWORK_NOT_REQUIRED');
    if (review.reviewCycle > MAX_EXTERNAL_REWORKS) throw new Error('BLOCKED_NEEDS_HUMAN');
    const findings = await this.prisma.codeReviewFinding.findMany({ where: { reviewRecordId: review.id } });
    const summaries: PreviousStepSummary[] = [{ purpose: 'REVIEW', summary: [
      `External review cycle ${review.reviewCycle} rejected candidate ${review.candidateFingerprint}.`,
      `Previous workspace=${review.workspaceSessionId}, manifest=${review.manifestHash}, changeSet=${review.changeSetHash}.`,
      `Findings: ${findings.map((finding) => `[${finding.severity}] ${finding.category}${finding.path ? ` ${finding.path}` : ''}: ${finding.message}`).join(' | ') || '(none)'}`,
      `Requirement assessment: ${JSON.stringify(review.requirementAssessmentJson)}`,
    ].join(' ') }];
    const payload = { jobId: review.generationJobId, workspaceSessionId: review.workspaceSessionId, reviewRecordId: review.id, reviewCycle: review.reviewCycle, verdict: review.verdict, findingCount: findings.length, resultHash: review.resultHash, candidateFingerprint: review.candidateFingerprint };
    await this.eventLog.append({ missionId: review.missionId, correlationId: review.id, actorType: 'REVIEW_ORCHESTRATOR', type: 'job.rework_started', payload });
    try {
      const result = await this.agentExecution.executeExternalReviewRework({ missionId: review.missionId, jobId: review.generationJobId,
        executorAgentDefinitionKey: review.executorAgentDefinitionKey,
        executorAgentDefinitionVersion: review.executorAgentDefinitionVersion ?? (() => { throw new Error('REWORK_EXECUTOR_VERSION_MISSING'); })(),
        reviewCycle: review.reviewCycle + 1, evidenceSummaries: summaries });
      await this.prisma.agentExecution.update({ where: { id: result.agentExecutionId }, data: { reviewRecordId: review.id, sourceWorkspaceSessionId: review.workspaceSessionId } });
      return result;
    } catch (error) {
      await this.eventLog.append({ missionId: review.missionId, correlationId: review.id, actorType: 'REVIEW_ORCHESTRATOR', type: 'job.rework_failed', payload: { ...payload, errorCode: error instanceof Error ? error.message : 'REWORK_EXECUTION_FAILED' } });
      throw error;
    }
  }

  async markReworkCompleted(input: { reviewRecordId: string; workspaceSessionId: string; agentExecutionId: string }): Promise<void> {
    const review = await this.prisma.reviewRecord.findUniqueOrThrow({ where: { id: input.reviewRecordId } });
    const session = await this.prisma.workspaceSession.findUniqueOrThrow({ where: { id: input.workspaceSessionId } });
    await this.eventLog.append({ missionId: review.missionId, correlationId: input.agentExecutionId, actorType: 'REVIEW_ORCHESTRATOR', type: 'job.rework_completed', payload: {
      jobId: review.generationJobId, workspaceSessionId: session.id, reviewRecordId: review.id,
      reviewCycle: review.reviewCycle, verdict: review.verdict, resultHash: review.resultHash,
      candidateFingerprint: session.candidateFingerprint,
    }});
  }

  async markReworkFailed(input: { reviewRecordId: string; agentExecutionId: string; errorCode: string }): Promise<void> {
    const review = await this.prisma.reviewRecord.findUniqueOrThrow({ where: { id: input.reviewRecordId } });
    await this.eventLog.append({ missionId: review.missionId, correlationId: input.agentExecutionId, actorType: 'REVIEW_ORCHESTRATOR', type: 'job.rework_failed', payload: {
      jobId: review.generationJobId, workspaceSessionId: review.workspaceSessionId, reviewRecordId: review.id,
      reviewCycle: review.reviewCycle, verdict: review.verdict, resultHash: review.resultHash,
      candidateFingerprint: review.candidateFingerprint, errorCode: input.errorCode,
    }});
  }

  async markBlocked(input: { reviewRecordId: string }): Promise<void> {
    const review = await this.prisma.reviewRecord.findUniqueOrThrow({ where: { id: input.reviewRecordId } });
    await this.eventLog.append({ missionId: review.missionId, correlationId: review.id, actorType: 'REVIEW_ORCHESTRATOR', type: 'job.blocked_needs_human', payload: {
      jobId: review.generationJobId, workspaceSessionId: review.workspaceSessionId, reviewRecordId: review.id,
      reviewCycle: review.reviewCycle, verdict: review.verdict, resultHash: review.resultHash,
      candidateFingerprint: review.candidateFingerprint,
    }});
  }

  private applyVerdictPolicy(result: CodeReviewResultV1): CodeReviewResultV1 {
    const blockingFinding = result.findings.some((finding) => finding.severity === 'HIGH' || finding.severity === 'BLOCKER');
    const unsatisfied = result.requirementAssessment.some((assessment) => assessment.status === 'UNSATISFIED');
    return { ...result, verdict: blockingFinding || unsatisfied ? 'REWORK_REQUIRED' : result.verdict };
  }

  private async resolveExecutor(jobId: string, executionId?: string) {
    const execution = executionId
      ? await this.prisma.agentExecution.findUnique({ where: { id: executionId } })
      : await this.prisma.agentExecution.findFirst({ where: { generationJobId: jobId, status: 'SUCCEEDED', reason: { in: ['INITIAL', 'REVIEW_REWORK'] } }, orderBy: { createdAt: 'desc' } });
    if (!execution?.agentDefinitionKey || execution.agentDefinitionVersion === null) throw new Error('REVIEW_EXECUTOR_IDENTITY_MISSING');
    return execution;
  }

  private async loadValidatedCandidate(workspaceSessionId: string) {
    const session = await this.prisma.workspaceSession.findUnique({ where: { id: workspaceSessionId } });
    if (!session || !['VALIDATED', 'REVIEW_APPROVED'].includes(session.status) || !session.candidateFingerprint || !session.manifestHash) throw new Error('REVIEW_CANDIDATE_NOT_VALIDATED');
    const [manifest, build, test] = await Promise.all([
      this.prisma.workspaceCandidateManifest.findUnique({ where: { workspaceSessionId } }),
      this.prisma.buildValidationRun.findFirst({ where: { workspaceSessionId, status: 'PASS', candidateFingerprint: session.candidateFingerprint, manifestHash: session.manifestHash }, orderBy: { completedAt: 'desc' } }),
      this.prisma.testValidationRun.findFirst({ where: { workspaceSessionId, status: 'PASS', candidateFingerprint: session.candidateFingerprint, manifestHash: session.manifestHash }, orderBy: { completedAt: 'desc' } }),
    ]);
    if (!manifest || !build || !test || manifest.manifestHash !== session.manifestHash || manifest.changeSetHash !== session.changeSetHash) throw new Error('REVIEW_CANDIDATE_NOT_VALIDATED');
    return { session, manifest, build, test };
  }

  private async buildReviewContext(evidence: Awaited<ReturnType<ReviewOrchestrator['loadValidatedCandidate']>>): Promise<CandidateReviewContext> {
    const manifestFiles = evidence.manifest.filesJson as unknown as { path: string; afterHash: string | null; operation: string }[];
    const relevant = manifestFiles.filter((file) => file.afterHash && file.operation !== 'NO_CHANGE');
    const files = await Promise.all(relevant.map(async (file) => {
      const content = await this.workspace.readSessionFile(evidence.session.rootRef, file.path);
      if (createHash('sha256').update(content).digest('hex') !== file.afterHash) throw new Error('WORKSPACE_STATE_CHANGED');
      return { path: file.path, content: this.sanitizeSource(content), contentHash: file.afterHash! };
    }));
    if (await this.workspace.fingerprintSession(evidence.session.rootRef) !== evidence.session.candidateFingerprint) throw new Error('WORKSPACE_STATE_CHANGED');
    return {
      workspaceSessionId: evidence.session.id, candidateFingerprint: evidence.session.candidateFingerprint!, manifestHash: evidence.session.manifestHash!, changeSetHash: evidence.session.changeSetHash, files,
      build: { status: 'PASS', commandProfile: evidence.build.commandProfile, exitCode: evidence.build.exitCode, stdoutHash: evidence.build.stdoutHash, stderrHash: evidence.build.stderrHash },
      test: { status: 'PASS', commandProfile: evidence.test.commandProfile, exitCode: evidence.test.exitCode, passedCount: evidence.test.passedCount, failedCount: evidence.test.failedCount, skippedCount: evidence.test.skippedCount, stdoutHash: evidence.test.stdoutHash, stderrHash: evidence.test.stderrHash },
    };
  }

  private safeText(value: string): string {
    return value
      .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, '[REDACTED_PRIVATE_KEY]')
      .replace(/(?:bearer\s+|sk-|gh[pousr]_|github_pat_|AKIA)[A-Za-z0-9_\-.]+/gi, '[REDACTED]')
      .slice(0, 2000);
  }

  private sanitizeSource(value: string): string {
    return value
      .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, '[REDACTED_PRIVATE_KEY]')
      .replace(/(?:bearer\s+|sk-|gh[pousr]_|github_pat_|AKIA)[A-Za-z0-9_\-.]+/gi, '[REDACTED_CREDENTIAL]');
  }
}
