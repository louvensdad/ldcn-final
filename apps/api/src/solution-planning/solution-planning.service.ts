import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { LLM_CLIENT, LlmClient } from '../assistant/deepseek-client';
import { AgentCatalogService } from '../catalog/agent-catalog.service';
import { EventLogService } from '../events/event-log.service';
import { LlmInvocationLedgerService } from '../ledger/llm-invocation-ledger.service';
import { assertCognitiveInvariant } from '../ledger/cognitive-invariant';
import { PrismaService } from '../persistence/prisma.service';
import { PromptMasterService } from '../promptmaster/prompt-master.service';
import { RequirementBaselineService } from '../requirements/requirement-baseline.service';
import { ScopeCoverageItem, ScopeCoverageService } from '../requirements/scope-coverage.service';
import { canonicalHash } from '../requirements/canonical-hash';
import { SolutionPlanResultV1, validateSolutionPlanResultV1 } from './solution-plan-result';
import { SolutionPolicyValidator } from './solution-policy.validator';
import { SolutionRequirementCoverageValidation, SolutionRequirementCoverageValidator } from './solution-requirement-coverage.validator';
import { StackCatalogService } from './stack-catalog.service';

const PLANNER_AGENT_KEY = 'architecture.solution-architect';

export interface ApprovedSolutionDto {
  id: string;
  missionId: string;
  version: number;
  requirementBaselineId: string;
  requirementBaselineVersion: number;
  requirementBaselineHash: string;
  scopeCoverageHash: string;
  solutionPlanResultHash: string;
  solutionHash: string;
  solutionType: string;
  components: SolutionPlanResultV1['components'];
  stackSelections: SolutionPlanResultV1['stackSelections'];
  requirementDecisions: SolutionPlanResultV1['requirementDecisions'];
  deferredRequirementRefs: { requirementId: string; requirementKey: string }[];
  notApplicableRequirementRefs: { requirementId: string; requirementKey: string }[];
  constraints: string[];
  nonFunctionalStrategies: SolutionPlanResultV1['nonFunctionalStrategies'];
  assumptions: string[];
  risks: SolutionPlanResultV1['risks'];
  confidence: number;
  status: string;
  plannerAgentDefinitionKey: string;
  plannerAgentDefinitionVersion: number;
  planningAgentExecutionId: string;
  promptSnapshotId: string;
  approvedAt: Date | null;
}

@Injectable()
export class SolutionPlanningService {
  private readonly coverageValidator = new SolutionRequirementCoverageValidator();
  private readonly policyValidator: SolutionPolicyValidator;

  constructor(
    private readonly prisma: PrismaService,
    private readonly baselines: RequirementBaselineService,
    private readonly scopeCoverage: ScopeCoverageService,
    private readonly catalog: AgentCatalogService,
    private readonly promptMaster: PromptMasterService,
    private readonly ledger: LlmInvocationLedgerService,
    private readonly events: EventLogService,
    private readonly stacks: StackCatalogService,
    @Inject(LLM_CLIENT) private readonly llm: LlmClient,
  ) {
    this.policyValidator = new SolutionPolicyValidator(stacks);
  }

  async planAndApprove(missionId: string, requirementBaselineId: string): Promise<ApprovedSolutionDto> {
    const baseline = await this.baselines.getBaseline(missionId, requirementBaselineId);
    if (baseline.status !== 'FINALIZED') throw new Error('SOLUTION_SCOPE_NOT_READY');
    const readiness = await this.scopeCoverage.assertReadyForSolutionPlanning(missionId, requirementBaselineId);
    if (!readiness.ready || !readiness.scopeCoverageHash) throw new Error('SOLUTION_SCOPE_NOT_READY');
    const coverage = await this.scopeCoverage.getCoverage(missionId, requirementBaselineId);
    const inScope = coverage.filter((item) => item.decision === 'IN_SCOPE');
    const deferred = coverage.filter((item) => item.decision === 'DEFERRED_USER_APPROVED');
    const notApplicable = coverage.filter((item) => item.decision === 'NOT_APPLICABLE');

    const planner = await this.catalog.getCurrentVersion(PLANNER_AGENT_KEY);
    if (!planner || !planner.publishedAt) throw new Error('SOLUTION_PLANNER_AGENT_NOT_FOUND');

    const previous = await this.prisma.approvedSolution.findFirst({ where: { missionId }, orderBy: { version: 'desc' } });
    const version = (previous?.version ?? 0) + 1;
    const candidateId = randomUUID();
    const agentExecutionId = randomUUID();
    const startedAt = new Date();
    await this.prisma.agentExecution.create({ data: {
      id: agentExecutionId, missionId, agentKey: PLANNER_AGENT_KEY,
      agentDefinitionKey: PLANNER_AGENT_KEY, agentDefinitionVersion: planner.version,
      mode: 'COGNITIVE', attempt: 1, reason: 'SOLUTION_PLANNING', status: 'RUNNING', startedAt,
    }});
    await this.events.append({
      missionId, correlationId: agentExecutionId, actorType: 'AGENT', actorId: agentExecutionId,
      type: 'mission.solution_planning_started',
      payload: this.eventPayload(missionId, candidateId, version, baseline.id, baseline.baselineHash, readiness.scopeCoverageHash, null, 0, 0, inScope.length, 'RUNNING'),
    });

    let promptSnapshotId = '';
    try {
      const mission = await this.prisma.discoveryConversation.findUnique({ where: { missionId } });
      let result: SolutionPlanResultV1 | null = null;
      for (let attempt = 1; attempt <= 2; attempt++) {
        const compiled = await this.promptMaster.compileSolutionPlanning({
          missionId, agentExecutionId, agentDefinitionKey: PLANNER_AGENT_KEY, agentDefinitionVersion: planner.version,
          requirementBaselineId: baseline.id, requirementBaselineVersion: baseline.version,
          requirementBaselineHash: baseline.baselineHash, scopeCoverageHash: readiness.scopeCoverageHash,
          missionSummary: mission?.goal ?? mission?.interpretedIntent ?? null,
          requirementsSnapshot: baseline.requirementsSnapshot,
          scopeCoverage: coverage,
          trustedStackCatalog: this.stacks.trustedPromptContext(),
          ...(attempt === 2 ? { repairInstruction: 'The previous response was not valid SolutionPlanResultV1 JSON. Return one corrected object only.' } : {}),
        });
        promptSnapshotId = compiled.promptSnapshotId;
        const invocationId = await this.ledger.startInvocation({
          missionId, agentExecutionId, purpose: attempt === 1 ? 'SOLUTION_PLANNING' : 'REPAIR',
          phase: 'SOLUTION_PLANNING', promptSnapshotId,
        });
        try {
          const response = await this.llm.complete({ system: compiled.systemText, user: compiled.userText, responseFormat: 'json_object' });
          await this.ledger.completeInvocation(invocationId, {
            provider: 'llm-client', model: response.model, inputTokens: response.promptTokens, outputTokens: response.completionTokens,
          });
          result = this.parseResult(response.text);
        } catch (error) {
          await this.ledger.failInvocation(invocationId, error instanceof Error ? error.message.slice(0, 120) : 'SOLUTION_LLM_FAILED');
          throw error;
        }
        if (result) break;
      }
      if (!result) throw new Error('SOLUTION_PLAN_SCHEMA_INVALID');

      const solutionPlanResultHash = canonicalHash(result);
      const requirementValidation = this.coverageValidator.validate(inScope.map((item) => item.requirementKey), result);
      const policyValidation = this.policyValidator.validate(inScope.map((item) => item.requirementKey), result);
      const solutionHash = canonicalHash({
        requirementBaselineHash: baseline.baselineHash,
        scopeCoverageHash: readiness.scopeCoverageHash,
        solutionType: result.solutionType,
        components: result.components,
        stackSelections: result.stackSelections,
        requirementDecisions: result.requirementDecisions,
        constraints: result.constraints,
        nonFunctionalStrategies: result.nonFunctionalStrategies,
      });

      await this.finishExecution(agentExecutionId, startedAt, 'SUCCEEDED', result.confidence, null);
      await this.events.append({
        missionId, correlationId: agentExecutionId, actorType: 'AGENT', actorId: agentExecutionId,
        type: 'mission.solution_planning_completed',
        payload: this.eventPayload(missionId, candidateId, version, baseline.id, baseline.baselineHash, readiness.scopeCoverageHash, solutionHash, result.components.length, result.stackSelections.length, inScope.length, 'COMPLETED'),
      });

      const validationError = this.validationError(requirementValidation, policyValidation.errors);
      if (validationError) {
        await this.persistCandidate({ id: candidateId, missionId, version, baseline, scopeCoverageHash: readiness.scopeCoverageHash,
          agentExecutionId, plannerVersion: planner.version, promptSnapshotId, result, solutionPlanResultHash, solutionHash,
          deferred, notApplicable, validation: { requirementValidation, policyValidation }, status: 'DRAFT' });
        await this.events.append({
          missionId, correlationId: agentExecutionId, actorType: 'SYSTEM',
          type: 'mission.solution_validation_failed',
          payload: { ...this.eventPayload(missionId, candidateId, version, baseline.id, baseline.baselineHash, readiness.scopeCoverageHash, solutionHash, result.components.length, result.stackSelections.length, inScope.length, 'FAILED'), errorCode: validationError },
        });
        throw new Error(validationError);
      }

      const exact = await this.prisma.approvedSolution.findFirst({ where: {
        missionId, status: 'APPROVED', requirementBaselineHash: baseline.baselineHash,
        scopeCoverageHash: readiness.scopeCoverageHash, solutionHash,
      }});
      if (exact) return this.toDto(exact);

      await this.persistCandidate({ id: candidateId, missionId, version, baseline, scopeCoverageHash: readiness.scopeCoverageHash,
        agentExecutionId, plannerVersion: planner.version, promptSnapshotId, result, solutionPlanResultHash, solutionHash,
        deferred, notApplicable, validation: { requirementValidation, policyValidation }, status: 'DRAFT' });
      await this.prisma.approvedSolution.update({ where: { id: candidateId }, data: { status: 'VALIDATED' } });

      const oldApproved = await this.prisma.approvedSolution.findFirst({ where: { missionId, status: 'APPROVED', id: { not: candidateId } } });
      const approvedAt = new Date();
      const approved = await this.prisma.$transaction(async (tx) => {
        if (oldApproved) await tx.approvedSolution.update({ where: { id: oldApproved.id }, data: { status: 'SUPERSEDED' } });
        return tx.approvedSolution.update({ where: { id: candidateId }, data: { status: 'APPROVED', approvedAt } });
      });
      if (oldApproved) await this.events.append({
        missionId, correlationId: agentExecutionId, actorType: 'SYSTEM', type: 'mission.solution_superseded',
        payload: this.eventPayload(missionId, oldApproved.id, oldApproved.version, oldApproved.requirementBaselineId, oldApproved.requirementBaselineHash, oldApproved.scopeCoverageHash, oldApproved.solutionHash, (oldApproved.componentsJson as object[]).length, (oldApproved.stackSelectionsJson as object[]).length, (oldApproved.requirementDecisionsJson as object[]).length, 'SUPERSEDED'),
      });
      await this.events.append({
        missionId, correlationId: agentExecutionId, actorType: 'SYSTEM', type: 'mission.solution_approved',
        payload: this.eventPayload(missionId, candidateId, version, baseline.id, baseline.baselineHash, readiness.scopeCoverageHash, solutionHash, result.components.length, result.stackSelections.length, inScope.length, 'APPROVED'),
      });
      return this.toDto(approved);
    } catch (error) {
      const current = await this.prisma.agentExecution.findUnique({ where: { id: agentExecutionId } });
      if (current?.status === 'RUNNING') {
        const code = error instanceof Error ? error.message.slice(0, 120) : 'SOLUTION_PLANNING_FAILED';
        await this.finishExecution(agentExecutionId, startedAt, 'FAILED', null, code);
        const count = await this.ledger.countInvocations(agentExecutionId);
        if (count > 0) {
          await this.events.append({
            missionId, correlationId: agentExecutionId, actorType: 'AGENT', actorId: agentExecutionId,
            type: 'mission.solution_planning_completed',
            payload: { ...this.eventPayload(missionId, candidateId, version, baseline.id, baseline.baselineHash, readiness.scopeCoverageHash, null, 0, 0, inScope.length, 'FAILED'), errorCode: code },
          });
          await this.events.append({
            missionId, correlationId: agentExecutionId, actorType: 'SYSTEM', type: 'mission.solution_validation_failed',
            payload: { ...this.eventPayload(missionId, candidateId, version, baseline.id, baseline.baselineHash, readiness.scopeCoverageHash, null, 0, 0, inScope.length, 'FAILED'), errorCode: code },
          });
        }
      }
      throw error;
    }
  }

  async getActive(missionId: string): Promise<ApprovedSolutionDto | null> {
    const row = await this.prisma.approvedSolution.findFirst({ where: { missionId, status: 'APPROVED' }, orderBy: { version: 'desc' } });
    return row ? this.toDto(row) : null;
  }

  async getById(missionId: string, id: string): Promise<ApprovedSolutionDto> {
    const row = await this.prisma.approvedSolution.findUnique({ where: { id } });
    if (!row || row.missionId !== missionId) throw new Error('APPROVED_SOLUTION_NOT_FOUND');
    return this.toDto(row);
  }

  private parseResult(text: string): SolutionPlanResultV1 | null {
    try { return validateSolutionPlanResultV1(JSON.parse(text)); } catch { return null; }
  }

  private validationError(coverage: SolutionRequirementCoverageValidation, policyErrors: { code: string }[]): string | null {
    if (coverage.unknownRequirementKeys.length || policyErrors.some((e) => e.code === 'SOLUTION_UNKNOWN_REQUIREMENT')) return 'SOLUTION_UNKNOWN_REQUIREMENT';
    if (coverage.duplicateRequirementKeys.length) return 'SOLUTION_DUPLICATE_REQUIREMENT_DECISION';
    if (coverage.missingRequirementKeys.length) return 'SOLUTION_REQUIREMENT_COVERAGE_INCOMPLETE';
    if (coverage.unsupportedRequirementKeys.length) return 'SOLUTION_UNSUPPORTED_REQUIREMENT';
    return policyErrors[0]?.code ?? null;
  }

  private async finishExecution(id: string, startedAt: Date, status: 'SUCCEEDED' | 'FAILED', confidenceScore: number | null, errorCode: string | null): Promise<void> {
    const invocationCount = await this.ledger.countInvocations(id);
    assertCognitiveInvariant('COGNITIVE', invocationCount);
    const completedAt = new Date();
    await this.prisma.agentExecution.update({ where: { id }, data: {
      status, completedAt, elapsedMs: completedAt.getTime() - startedAt.getTime(), confidenceScore, errorCode,
    }});
  }

  private async persistCandidate(input: {
    id: string; missionId: string; version: number; baseline: Awaited<ReturnType<RequirementBaselineService['getBaseline']>>;
    scopeCoverageHash: string; agentExecutionId: string; plannerVersion: number; promptSnapshotId: string;
    result: SolutionPlanResultV1; solutionPlanResultHash: string; solutionHash: string;
    deferred: ScopeCoverageItem[]; notApplicable: ScopeCoverageItem[]; validation: object; status: string;
  }): Promise<void> {
    await this.prisma.approvedSolution.create({ data: {
      id: input.id, missionId: input.missionId, version: input.version,
      requirementBaselineId: input.baseline.id, requirementBaselineVersion: input.baseline.version,
      requirementBaselineHash: input.baseline.baselineHash, scopeCoverageHash: input.scopeCoverageHash,
      planningAgentExecutionId: input.agentExecutionId, plannerAgentDefinitionKey: PLANNER_AGENT_KEY,
      plannerAgentDefinitionVersion: input.plannerVersion, promptSnapshotId: input.promptSnapshotId,
      solutionPlanResultHash: input.solutionPlanResultHash, solutionHash: input.solutionHash,
      solutionType: input.result.solutionType, componentsJson: input.result.components as unknown as Prisma.InputJsonValue,
      stackSelectionsJson: input.result.stackSelections as unknown as Prisma.InputJsonValue,
      requirementDecisionsJson: input.result.requirementDecisions as unknown as Prisma.InputJsonValue,
      deferredRequirementRefsJson: input.deferred.map(({ requirementId, requirementKey }) => ({ requirementId, requirementKey })) as Prisma.InputJsonValue,
      notApplicableRequirementRefsJson: input.notApplicable.map(({ requirementId, requirementKey }) => ({ requirementId, requirementKey })) as Prisma.InputJsonValue,
      constraintsJson: input.result.constraints as Prisma.InputJsonValue,
      nonFunctionalStrategiesJson: input.result.nonFunctionalStrategies as unknown as Prisma.InputJsonValue,
      assumptionsJson: input.result.assumptions as Prisma.InputJsonValue,
      risksJson: input.result.risks as unknown as Prisma.InputJsonValue,
      validationJson: input.validation as Prisma.InputJsonValue, confidence: input.result.confidence, status: input.status,
    }});
  }

  private eventPayload(missionId: string, id: string, version: number, baselineId: string, baselineHash: string, scopeCoverageHash: string, solutionHash: string | null, componentCount: number, stackCount: number, requirementCount: number, status: string) {
    return { missionId, approvedSolutionId: id, solutionVersion: version, requirementBaselineId: baselineId,
      baselineHash, scopeCoverageHash, solutionHash, componentCount, stackCount, requirementCount, status };
  }

  private toDto(row: Awaited<ReturnType<PrismaService['approvedSolution']['findUniqueOrThrow']>>): ApprovedSolutionDto {
    return {
      id: row.id, missionId: row.missionId, version: row.version,
      requirementBaselineId: row.requirementBaselineId, requirementBaselineVersion: row.requirementBaselineVersion,
      requirementBaselineHash: row.requirementBaselineHash, scopeCoverageHash: row.scopeCoverageHash,
      solutionPlanResultHash: row.solutionPlanResultHash, solutionHash: row.solutionHash, solutionType: row.solutionType,
      components: row.componentsJson as unknown as SolutionPlanResultV1['components'],
      stackSelections: row.stackSelectionsJson as unknown as SolutionPlanResultV1['stackSelections'],
      requirementDecisions: row.requirementDecisionsJson as unknown as SolutionPlanResultV1['requirementDecisions'],
      deferredRequirementRefs: row.deferredRequirementRefsJson as unknown as ApprovedSolutionDto['deferredRequirementRefs'],
      notApplicableRequirementRefs: row.notApplicableRequirementRefsJson as unknown as ApprovedSolutionDto['notApplicableRequirementRefs'],
      constraints: row.constraintsJson as unknown as string[],
      nonFunctionalStrategies: row.nonFunctionalStrategiesJson as unknown as SolutionPlanResultV1['nonFunctionalStrategies'],
      assumptions: row.assumptionsJson as unknown as string[], risks: row.risksJson as unknown as SolutionPlanResultV1['risks'],
      confidence: row.confidence, status: row.status, plannerAgentDefinitionKey: row.plannerAgentDefinitionKey,
      plannerAgentDefinitionVersion: row.plannerAgentDefinitionVersion, planningAgentExecutionId: row.planningAgentExecutionId,
      promptSnapshotId: row.promptSnapshotId, approvedAt: row.approvedAt,
    };
  }
}
