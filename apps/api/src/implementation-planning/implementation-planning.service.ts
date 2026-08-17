import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { LLM_CLIENT, LlmClient } from '../assistant/deepseek-client';
import { AgentCatalogService } from '../catalog/agent-catalog.service';
import { EventLogService } from '../events/event-log.service';
import { canonicalHash } from '../generation-engine/canonical-hash';
import { assertCognitiveInvariant } from '../ledger/cognitive-invariant';
import { LlmInvocationLedgerService } from '../ledger/llm-invocation-ledger.service';
import { PrismaService } from '../persistence/prisma.service';
import { PromptMasterService } from '../promptmaster/prompt-master.service';
import { RequirementBaselineService } from '../requirements/requirement-baseline.service';
import { ScopeCoverageService } from '../requirements/scope-coverage.service';
import { IMPLEMENTATION_PLAN_V1_SCHEMA, ImplementationPlanV1, parseImplementationPlan } from './implementation-plan.contracts';
import { ImplementationPlanValidator } from './implementation-plan.validator';

const PLANNER = 'product.implementation-planner';
@Injectable()
export class ImplementationPlanningService {
  private readonly validator = new ImplementationPlanValidator();
  constructor(private readonly prisma: PrismaService, private readonly catalog: AgentCatalogService, private readonly prompts: PromptMasterService, private readonly ledger: LlmInvocationLedgerService, private readonly events: EventLogService, private readonly baselines: RequirementBaselineService, private readonly scope: ScopeCoverageService, @Inject(LLM_CLIENT) private readonly llm: LlmClient) {}

  async plan(missionId: string, architectureCompositionId: string) {
    const existing = await this.prisma.implementationPlan.findUnique({ where: { architectureCompositionId } });
    if (existing) return this.toDto(existing);
    const architecture = await this.prisma.architectureComposition.findUnique({ where: { id: architectureCompositionId } });
    if (!architecture || architecture.missionId !== missionId) throw new Error('ARCHITECTURE_COMPOSITION_NOT_FOUND');
    if (architecture.status !== 'APPROVED' || !architecture.humanApprovalRequestId) throw new Error('ARCHITECTURE_HUMAN_APPROVAL_REQUIRED');
    const approval = await this.prisma.humanApprovalRequest.findUnique({ where: { id: architecture.humanApprovalRequestId } });
    if (!approval || approval.status !== 'APPROVED' || approval.subjectHash !== architecture.architectureHash) throw new Error('ARCHITECTURE_HUMAN_APPROVAL_REQUIRED');
    const baseline = await this.baselines.getBaseline(missionId, architecture.requirementBaselineId);
    if (baseline.baselineHash !== architecture.requirementBaselineHash) throw new Error('IMPLEMENTATION_PLAN_INPUT_DRIFT');
    const coverage = await this.scope.getCoverage(missionId, baseline.id);
    const readiness = await this.scope.assertReadyForSolutionPlanning(missionId, baseline.id);
    if (!readiness.ready || readiness.scopeCoverageHash !== architecture.scopeCoverageHash) throw new Error('IMPLEMENTATION_PLAN_INPUT_DRIFT');
    const inScope = coverage.filter((item) => item.decision === 'IN_SCOPE');
    const modules = architecture.modulesJson as Array<{ key: string }>;
    const capabilities = await this.prisma.capabilityDefinition.findMany({ where: { status: 'ACTIVE' }, select: { key: true } });
    const agent = await this.catalog.getCurrentVersion(PLANNER);
    if (!agent?.publishedAt) throw new Error('IMPLEMENTATION_PLANNER_NOT_FOUND');
    const executionId = randomUUID(), startedAt = new Date();
    await this.prisma.agentExecution.create({ data: { id: executionId, missionId, agentKey: PLANNER, agentDefinitionKey: PLANNER, agentDefinitionVersion: agent.version, mode: 'COGNITIVE', attempt: 1, reason: 'IMPLEMENTATION_PLANNING', status: 'RUNNING', startedAt } });
    let result: ImplementationPlanV1 | null = null, promptSnapshotId = '', providerFailure: string | null = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      const compiled = await this.prompts.compileArchitectureOperation({ missionId, agentExecutionId: executionId, agentDefinitionKey: PLANNER, agentDefinitionVersion: agent.version, purpose: attempt === 1 ? 'IMPLEMENTATION_PLANNING' : 'REPAIR', outputSchemaKey: 'ImplementationPlanV1', outputSchema: `${IMPLEMENTATION_PLAN_V1_SCHEMA}${attempt === 2 ? '\nRepair the previous invalid response.' : ''}`, trustedContext: { architecture: { id: architecture.id, hash: architecture.architectureHash, modules: architecture.modulesJson, decisions: architecture.decisionsJson, exactStackSelections: architecture.exactStackSelectionsJson }, allowedCapabilityKeys: capabilities.map((item) => item.key) }, untrustedContext: { requirementBaseline: { id: baseline.id, version: baseline.version, hash: baseline.baselineHash, requirements: baseline.requirementsSnapshot }, scopeCoverage: coverage }, inputVersionRefs: { architectureCompositionId: architecture.id, architectureHash: architecture.architectureHash, requirementBaselineId: baseline.id, requirementBaselineHash: baseline.baselineHash, scopeCoverageHash: architecture.scopeCoverageHash }, requirementRefs: inScope.map((item) => item.requirementId) });
      promptSnapshotId = compiled.promptSnapshotId;
      const invocationId = await this.ledger.startInvocation({ missionId, agentExecutionId: executionId, purpose: attempt === 1 ? 'IMPLEMENTATION_PLANNING' : 'REPAIR', phase: 'IMPLEMENTATION_PLANNING', promptSnapshotId });
      try { const response = await this.llm.complete({ system: compiled.systemText, user: compiled.userText, responseFormat: 'json_object' }); await this.ledger.completeInvocation(invocationId, { provider: 'llm-client', model: response.model, inputTokens: response.promptTokens, outputTokens: response.completionTokens }); try { result = parseImplementationPlan(JSON.parse(response.text)); } catch { result = null; } if (result) { const validation = this.validator.validate({ plan: result, moduleKeys: modules.map((item) => item.key), inScopeRequirementKeys: inScope.map((item) => item.requirementKey), capabilityKeys: capabilities.map((item) => item.key) }); const securityRequired = (architecture.securityBoundariesJson as unknown as object[]).length > 0; const hasSecurityCapability = result.workPackages.some((work) => work.requiredCapabilities.some((key) => key.startsWith('security.') || key.startsWith('architecture.security'))); if (validation.status === 'FAIL' || (securityRequired && !hasSecurityCapability)) result = null; } } catch (error) { providerFailure = error instanceof Error ? error.message.slice(0, 120) : 'IMPLEMENTATION_PLANNING_LLM_FAILED'; await this.ledger.failInvocation(invocationId, providerFailure); break; }
      if (result) break;
    }
    const completedAt = new Date(); await this.prisma.agentExecution.update({ where: { id: executionId }, data: { status: result ? 'SUCCEEDED' : 'FAILED', completedAt, elapsedMs: completedAt.getTime() - startedAt.getTime(), errorCode: result ? null : providerFailure ?? 'IMPLEMENTATION_PLAN_INVALID' } });
    assertCognitiveInvariant('COGNITIVE', await this.ledger.countInvocations(executionId));
    if (!result) throw new Error(providerFailure ?? 'IMPLEMENTATION_PLAN_INVALID');
    const last = await this.prisma.implementationPlan.findFirst({ where: { missionId }, orderBy: { version: 'desc' } });
    const id = randomUUID(), resultHash = canonicalHash(result), planHash = canonicalHash({ architectureHash: architecture.architectureHash, result });
    const row = await this.prisma.implementationPlan.create({ data: { id, missionId, version: (last?.version ?? 0) + 1, architectureCompositionId, architectureHash: architecture.architectureHash, requirementBaselineId: baseline.id, requirementBaselineHash: baseline.baselineHash, scopeCoverageHash: architecture.scopeCoverageHash, plannerAgentExecutionId: executionId, plannerAgentDefinitionKey: PLANNER, plannerAgentDefinitionVersion: agent.version, promptSnapshotId, resultHash, planHash, summary: result.summary, workPackagesJson: result.workPackages as unknown as Prisma.InputJsonValue, risksJson: result.risks as unknown as Prisma.InputJsonValue, assumptionsJson: result.assumptions as Prisma.InputJsonValue, confidence: result.confidence, status: 'VALIDATED', approvedAt: new Date() } });
    await this.events.append({ missionId, correlationId: id, actorType: 'SYSTEM', type: 'mission.implementation_plan_ready', idempotencyKey: `implementation-plan:${id}:ready`, payload: { missionId, implementationPlanId: id, architectureCompositionId, architectureHash: architecture.architectureHash, planHash, workPackageCount: result.workPackages.length, status: 'VALIDATED' } });
    return this.toDto(row);
  }
  private toDto(row: any) { return { ...row, workPackages: row.workPackagesJson, risks: row.risksJson, assumptions: row.assumptionsJson }; }
}
