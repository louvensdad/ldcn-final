import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { LLM_CLIENT, LlmClient } from '../assistant/deepseek-client';
import { HumanApprovalService } from '../approvals/human-approval.service';
import { AgentCatalogService } from '../catalog/agent-catalog.service';
import { EventLogService } from '../events/event-log.service';
import { assertCognitiveInvariant } from '../ledger/cognitive-invariant';
import { LlmInvocationLedgerService } from '../ledger/llm-invocation-ledger.service';
import { PrismaService } from '../persistence/prisma.service';
import { PromptMasterService } from '../promptmaster/prompt-master.service';
import { RequirementBaselineService } from '../requirements/requirement-baseline.service';
import { ScopeCoverageService } from '../requirements/scope-coverage.service';
import { canonicalHash } from '../requirements/canonical-hash';
import { ApprovedSolutionDto } from '../solution-planning/solution-planning.service';
import {
  ARCHITECTURE_ARBITRATION_SCHEMA, ARCHITECTURE_PROPOSAL_SCHEMA, ARCHITECTURE_REVIEW_SCHEMA,
  ArchitectureArbitrationResultV1, ArchitectureProposalV1, ArchitectureReviewResultV1,
  validateArchitectureArbitrationResultV1, validateArchitectureProposalV1, validateArchitectureReviewResultV1,
} from './architecture-contracts';
import { ArchitectureCouncilPolicy, ArchitectureProposalValidator } from './architecture-validators';

const PROPOSER = 'architecture.solution-architect';
const REVIEWERS = ['backend.nestjs.architect', 'architecture.security-architect'] as const;
const ARBITER = 'architecture.arbiter';

@Injectable()
export class ArchitecturePlanningService {
  private readonly validator = new ArchitectureProposalValidator();
  private readonly council = new ArchitectureCouncilPolicy();
  private readonly active = new Set<string>();

  constructor(
    private readonly prisma: PrismaService, private readonly baselines: RequirementBaselineService,
    private readonly scope: ScopeCoverageService, private readonly catalog: AgentCatalogService,
    private readonly prompts: PromptMasterService, private readonly ledger: LlmInvocationLedgerService,
    private readonly events: EventLogService, private readonly approvals: HumanApprovalService,
    @Inject(LLM_CLIENT) private readonly llm: LlmClient,
  ) {}

  async start(missionId: string, approvedSolutionId: string) {
    const solution = await this.prisma.approvedSolution.findUnique({ where: { id: approvedSolutionId } });
    if (!solution || solution.missionId !== missionId || solution.status !== 'APPROVED') throw new Error('ARCHITECTURE_SOLUTION_NOT_APPROVED');
    const existing = await this.prisma.architectureComposition.findUnique({ where: { approvedSolutionId } });
    if (existing) {
      if (['APPROVED', 'AWAITING_HUMAN_APPROVAL', 'REJECTED'].includes(existing.status)) return this.toDto(existing);
      throw new Error('ARCHITECTURE_CONFLICT');
    }
    if (this.active.has(approvedSolutionId)) throw new Error('ARCHITECTURE_PLANNING_IN_PROGRESS');
    this.active.add(approvedSolutionId);
    try { return await this.execute(missionId, solution); } finally { this.active.delete(approvedSolutionId); }
  }

  async getActive(missionId: string) {
    const row = await this.prisma.architectureComposition.findFirst({ where: { missionId, status: { in: ['APPROVED', 'AWAITING_HUMAN_APPROVAL'] } }, orderBy: { version: 'desc' } });
    return row ? this.toDto(row) : null;
  }

  private async execute(missionId: string, solution: any) {
    const baseline = await this.baselines.getBaseline(missionId, solution.requirementBaselineId);
    if (baseline.baselineHash !== solution.requirementBaselineHash) throw new Error('ARCHITECTURE_SOLUTION_NOT_APPROVED');
    const coverage = await this.scope.getCoverage(missionId, baseline.id);
    const inScope = coverage.filter(x => x.decision === 'IN_SCOPE');
    const components = solution.componentsJson as ApprovedSolutionDto['components'];
    const stacks = solution.stackSelectionsJson as ApprovedSolutionDto['stackSelections'];
    const solutionDecisions = solution.requirementDecisionsJson as ApprovedSolutionDto['requirementDecisions'];
    const requiredDecisionKeys = solutionDecisions.filter(x => x.disposition === 'REQUIRES_ARCHITECTURE_DECISION').map(x => x.requirementKey);
    const last = await this.prisma.architectureComposition.findFirst({ where: { missionId }, orderBy: { version: 'desc' } });
    const version = (last?.version ?? 0) + 1, compositionId = randomUUID();
    await this.emit('mission.architecture_planning_started', missionId, solution.id, compositionId, version, null, 0, 0, 'RUNNING');

    const trusted = { approvedSolution: this.solutionContext(solution), components, stackSelections: stacks, requirementDecisions: solutionDecisions, constraints: solution.constraintsJson, nonFunctionalStrategies: solution.nonFunctionalStrategiesJson };
    const untrusted = { requirementBaseline: { id: baseline.id, version: baseline.version, hash: baseline.baselineHash, snapshot: baseline.requirementsSnapshot }, scopeCoverage: coverage };
    const proposalRun = await this.runAgent<ArchitectureProposalV1>({ missionId, agentKey: PROPOSER, purpose: 'ARCHITECTURE_PROPOSAL', outputSchemaKey: 'ArchitectureProposalV1', outputSchema: ARCHITECTURE_PROPOSAL_SCHEMA, trusted, untrusted, refs: this.refs(solution), requirementRefs: baseline.requirementsSnapshot.map(x => x.requirementId), validate: validateArchitectureProposalV1, repair: true });
    let proposal = proposalRun.result;
    const validate = (candidate: ArchitectureProposalV1) => this.validator.validate({ proposal: candidate, componentKeys: components.map(x => x.key), stackSelections: stacks.map(x => ({ stackKey: x.stackKey, stackVersion: x.stackVersion })), inScopeKeys: inScope.map(x => x.requirementKey), requiredDecisionKeys });
    const initialValidation = validate(proposal);
    if (initialValidation.status === 'FAIL') throw new Error(initialValidation.errors[0].code);
    await this.emit('mission.architecture_proposed', missionId, solution.id, compositionId, version, null, 0, 0, 'PROPOSED');

    const proposalHash = canonicalHash(proposal);
    let architectureHash = this.architectureHash(solution.solutionHash, proposal);
    await this.prisma.architectureComposition.create({ data: {
      id: compositionId, missionId, version, approvedSolutionId: solution.id, approvedSolutionVersion: solution.version,
      solutionHash: solution.solutionHash, requirementBaselineId: baseline.id, requirementBaselineHash: baseline.baselineHash,
      scopeCoverageHash: solution.scopeCoverageHash, proposalAgentExecutionId: proposalRun.executionId,
      proposalAgentDefinitionKey: PROPOSER, proposalAgentDefinitionVersion: proposalRun.agentVersion,
      proposalPromptSnapshotId: proposalRun.promptSnapshotId, architectureStyle: proposal.architectureStyle,
      modulesJson: proposal.modules as unknown as Prisma.InputJsonValue, decisionsJson: proposal.decisions as unknown as Prisma.InputJsonValue,
      integrationsJson: proposal.integrations as unknown as Prisma.InputJsonValue, dataFlowsJson: proposal.dataFlows as unknown as Prisma.InputJsonValue,
      securityBoundariesJson: proposal.securityBoundaries as unknown as Prisma.InputJsonValue,
      requirementMappingsJson: proposal.requirementMappings as unknown as Prisma.InputJsonValue,
      exactStackSelectionsJson: stacks as unknown as Prisma.InputJsonValue, proposalResultHash: proposalHash, architectureHash, status: 'VALIDATED',
    }});

    const review = await this.prisma.architectureReview.create({ data: { id: randomUUID(), missionId, approvedSolutionId: solution.id, architectureCompositionId: compositionId, reviewMode: 'CANONICAL_COUNCIL', status: 'PENDING' } });
    await this.emit('mission.architecture_review_started', missionId, solution.id, compositionId, version, architectureHash, 0, 0, 'RUNNING');
    const reviewResults: ArchitectureReviewResultV1[] = [];
    for (const reviewerKey of REVIEWERS) {
      if ((reviewerKey as string) === PROPOSER) throw new Error('ARCHITECTURE_REVIEWER_NOT_INDEPENDENT');
      const run = await this.runAgent<ArchitectureReviewResultV1>({ missionId, agentKey: reviewerKey, purpose: 'ARCHITECTURE_REVIEW', outputSchemaKey: 'ArchitectureReviewResultV1', outputSchema: ARCHITECTURE_REVIEW_SCHEMA, trusted: { ...trusted, architectureProposal: proposal }, untrusted: { requirementSnapshot: baseline.requirementsSnapshot }, refs: { ...this.refs(solution), architectureCompositionId: compositionId }, requirementRefs: baseline.requirementsSnapshot.map(x => x.requirementId), validate: validateArchitectureReviewResultV1 });
      reviewResults.push(run.result);
      await this.prisma.architectureReviewerExecution.create({ data: { id: randomUUID(), missionId, architectureReviewId: review.id, reviewerKey, status: 'PASSED', findingCount: run.result.findings.length, attemptCount: 1, startedAt: run.startedAt, finishedAt: new Date(), agentExecutionId: run.executionId, agentDefinitionKey: reviewerKey, agentDefinitionVersion: run.agentVersion, promptSnapshotId: run.promptSnapshotId, resultHash: canonicalHash(run.result), resultJson: run.result as unknown as Prisma.InputJsonValue } });
      for (const finding of run.result.findings) await this.prisma.architectureReviewFinding.create({ data: { id: finding.id, missionId, architectureReviewId: review.id, reviewerKey, code: `COUNCIL_${finding.category}`, severity: finding.severity, finding: finding.message, recommendedResolutionsJson: finding.proposedResolution ? [finding.proposedResolution] : [], requiresUserDecision: finding.severity === 'HIGH' || finding.severity === 'BLOCKER', reviewerAgentExecutionId: run.executionId, reviewerAgentDefinitionKey: reviewerKey, reviewerAgentDefinitionVersion: run.agentVersion, category: finding.category, moduleKeysJson: finding.moduleKeys ?? [], decisionKeysJson: finding.decisionKeys ?? [], requirementKeysJson: finding.requirementKeys ?? [], proposedResolution: finding.proposedResolution } });
    }
    const policy = this.council.evaluate(reviewResults);
    await this.prisma.architectureReview.update({ where: { id: review.id }, data: { status: policy.status } });
    await this.emit('mission.architecture_review_completed', missionId, solution.id, compositionId, version, architectureHash, reviewResults.reduce((n,r) => n + r.findings.length, 0), policy.blockingFindingIds.length, policy.status);

    if (policy.status === 'RESOLUTION_REQUIRED') {
      await this.emit('mission.architecture_conflict_detected', missionId, solution.id, compositionId, version, architectureHash, policy.blockingFindingIds.length, policy.blockingFindingIds.length, 'RESOLUTION_REQUIRED');
      if (([PROPOSER, ...REVIEWERS] as readonly string[]).includes(ARBITER)) throw new Error('ARCHITECTURE_ARBITER_NOT_INDEPENDENT');
      await this.emit('mission.architecture_arbitration_started', missionId, solution.id, compositionId, version, architectureHash, policy.blockingFindingIds.length, policy.blockingFindingIds.length, 'RUNNING');
      const arbitration = await this.runAgent<ArchitectureArbitrationResultV1>({ missionId, agentKey: ARBITER, purpose: 'ARCHITECTURE_ARBITRATION', outputSchemaKey: 'ArchitectureArbitrationResultV1', outputSchema: ARCHITECTURE_ARBITRATION_SCHEMA, trusted: { ...trusted, architectureProposal: proposal, councilReviews: reviewResults }, untrusted: { requirementSnapshot: baseline.requirementsSnapshot }, refs: { ...this.refs(solution), architectureCompositionId: compositionId }, requirementRefs: baseline.requirementsSnapshot.map(x => x.requirementId), validate: validateArchitectureArbitrationResultV1 });
      await this.prisma.architectureArbitration.create({ data: { id: randomUUID(), missionId, architectureCompositionId: compositionId, agentExecutionId: arbitration.executionId, agentDefinitionKey: ARBITER, agentDefinitionVersion: arbitration.agentVersion, promptSnapshotId: arbitration.promptSnapshotId, resultHash: canonicalHash(arbitration.result), resultJson: arbitration.result as unknown as Prisma.InputJsonValue, verdict: arbitration.result.verdict, unresolvedFindingIdsJson: arbitration.result.unresolvedFindingIds } });
      await this.emit('mission.architecture_arbitration_completed', missionId, solution.id, compositionId, version, architectureHash, policy.blockingFindingIds.length, arbitration.result.unresolvedFindingIds.length, arbitration.result.verdict);
      if (arbitration.result.verdict !== 'RESOLVED' || arbitration.result.unresolvedFindingIds.length || !arbitration.result.finalArchitecture) return this.block(missionId, solution.id, compositionId, version, architectureHash, policy.blockingFindingIds.length, arbitration.result.unresolvedFindingIds.length);
      const finalValidation = validate(arbitration.result.finalArchitecture);
      if (finalValidation.status === 'FAIL') return this.block(missionId, solution.id, compositionId, version, architectureHash, policy.blockingFindingIds.length, finalValidation.errors.length);
      proposal = arbitration.result.finalArchitecture;
      architectureHash = this.architectureHash(solution.solutionHash, proposal);
      await this.prisma.architectureComposition.update({ where: { id: compositionId }, data: { architectureStyle: proposal.architectureStyle, modulesJson: proposal.modules as unknown as Prisma.InputJsonValue, decisionsJson: proposal.decisions as unknown as Prisma.InputJsonValue, integrationsJson: proposal.integrations as unknown as Prisma.InputJsonValue, dataFlowsJson: proposal.dataFlows as unknown as Prisma.InputJsonValue, securityBoundariesJson: proposal.securityBoundaries as unknown as Prisma.InputJsonValue, requirementMappingsJson: proposal.requirementMappings as unknown as Prisma.InputJsonValue, architectureHash } });
    }
    return this.requestHumanApproval(missionId, solution.id, compositionId, version, architectureHash);
  }

  private async runAgent<T>(input: { missionId: string; agentKey: string; purpose: 'ARCHITECTURE_PROPOSAL'|'ARCHITECTURE_REVIEW'|'ARCHITECTURE_ARBITRATION'; outputSchemaKey: string; outputSchema: string; trusted: object; untrusted: object; refs: Record<string, unknown>; requirementRefs: string[]; validate: (v: unknown) => T|null; repair?: boolean }) {
    const agent = await this.catalog.getCurrentVersion(input.agentKey); if (!agent?.publishedAt) throw new Error('ARCHITECTURE_AGENT_NOT_FOUND');
    const executionId = randomUUID(), startedAt = new Date();
    await this.prisma.agentExecution.create({ data: { id: executionId, missionId: input.missionId, agentKey: input.agentKey, agentDefinitionKey: input.agentKey, agentDefinitionVersion: agent.version, mode: 'COGNITIVE', attempt: 1, reason: input.purpose, status: 'RUNNING', startedAt } });
    let result: T|null = null, promptSnapshotId = '';
    for (let attempt=1; attempt <= (input.repair ? 2 : 1); attempt++) {
      const compiled = await this.prompts.compileArchitectureOperation({ missionId: input.missionId, agentExecutionId: executionId, agentDefinitionKey: input.agentKey, agentDefinitionVersion: agent.version, purpose: attempt === 1 ? input.purpose : 'REPAIR', outputSchemaKey: input.outputSchemaKey, outputSchema: input.outputSchema + (attempt === 2 ? ' Correct the previous invalid schema response.' : ''), trustedContext: input.trusted, untrustedContext: input.untrusted, inputVersionRefs: input.refs, requirementRefs: input.requirementRefs });
      promptSnapshotId = compiled.promptSnapshotId;
      const invocationId = await this.ledger.startInvocation({ missionId: input.missionId, agentExecutionId: executionId, purpose: attempt === 1 ? input.purpose : 'REPAIR', phase: input.purpose, promptSnapshotId });
      try { const response = await this.llm.complete({ system: compiled.systemText, user: compiled.userText, responseFormat: 'json_object' }); await this.ledger.completeInvocation(invocationId, { provider: 'llm-client', model: response.model, inputTokens: response.promptTokens, outputTokens: response.completionTokens }); try { result = input.validate(JSON.parse(response.text)); } catch { result = null; } } catch (e) { await this.ledger.failInvocation(invocationId, e instanceof Error ? e.message.slice(0,120) : 'ARCHITECTURE_LLM_FAILED'); throw e; }
      if (result) break;
    }
    const completedAt = new Date(); const count = await this.ledger.countInvocations(executionId); assertCognitiveInvariant('COGNITIVE', count);
    await this.prisma.agentExecution.update({ where: { id: executionId }, data: { status: result ? 'SUCCEEDED':'FAILED', completedAt, elapsedMs: completedAt.getTime()-startedAt.getTime(), errorCode: result ? null : `${input.purpose}_SCHEMA_INVALID` } });
    if (!result) throw new Error(input.purpose === 'ARCHITECTURE_PROPOSAL' ? 'ARCHITECTURE_PROPOSAL_SCHEMA_INVALID' : input.purpose === 'ARCHITECTURE_REVIEW' ? 'ARCHITECTURE_REVIEW_EXECUTION_FAILED' : 'ARCHITECTURE_ARBITRATION_FAILED');
    return { result, executionId, agentVersion: agent.version, promptSnapshotId, startedAt };
  }

  private async requestHumanApproval(missionId:string, solutionId:string, compositionId:string, version:number, hash:string) { await this.approvals.requestArchitectureApproval({missionId,architectureCompositionId:compositionId,architectureHash:hash}); const row=await this.prisma.architectureComposition.findUniqueOrThrow({where:{id:compositionId}});await this.emit('mission.architecture_awaiting_human_approval',missionId,solutionId,compositionId,version,hash,0,0,'AWAITING_HUMAN_APPROVAL');return this.toDto(row); }
  private async block(missionId:string,solutionId:string,id:string,version:number,hash:string,findings:number,unresolved:number):Promise<never>{await this.prisma.architectureComposition.update({where:{id},data:{status:'ARCHITECTURE_CONFLICT'}});await this.emit('mission.architecture_blocked',missionId,solutionId,id,version,hash,findings,unresolved,'ARCHITECTURE_CONFLICT');throw new Error('ARCHITECTURE_CONFLICT');}
  private architectureHash(solutionHash:string,p:ArchitectureProposalV1){return canonicalHash({solutionHash,architectureStyle:p.architectureStyle,modules:p.modules,decisions:p.decisions,integrations:p.integrations,dataFlows:p.dataFlows,securityBoundaries:p.securityBoundaries,requirementMappings:p.requirementMappings});}
  private solutionContext(s:any){return{id:s.id,version:s.version,solutionHash:s.solutionHash,requirementBaselineId:s.requirementBaselineId,requirementBaselineHash:s.requirementBaselineHash,scopeCoverageHash:s.scopeCoverageHash};}
  private refs(s:any){return{approvedSolutionId:s.id,approvedSolutionVersion:s.version,solutionHash:s.solutionHash,requirementBaselineId:s.requirementBaselineId,requirementBaselineHash:s.requirementBaselineHash,scopeCoverageHash:s.scopeCoverageHash};}
  private async emit(type:string,missionId:string,approvedSolutionId:string,architectureCompositionId:string,architectureVersion:number,architectureHash:string|null,findingCount:number,unresolvedCount:number,status:string){await this.events.append({missionId,correlationId:architectureCompositionId,actorType:'SYSTEM',type,payload:{missionId,approvedSolutionId,architectureCompositionId,architectureVersion,architectureHash,findingCount,unresolvedCount,status}});}
  private toDto(r:any){return{id:r.id,missionId:r.missionId,version:r.version,approvedSolutionId:r.approvedSolutionId,approvedSolutionVersion:r.approvedSolutionVersion,solutionHash:r.solutionHash,requirementBaselineId:r.requirementBaselineId,requirementBaselineHash:r.requirementBaselineHash,scopeCoverageHash:r.scopeCoverageHash,architectureStyle:r.architectureStyle,modules:r.modulesJson,decisions:r.decisionsJson,integrations:r.integrationsJson,dataFlows:r.dataFlowsJson,securityBoundaries:r.securityBoundariesJson,requirementMappings:r.requirementMappingsJson,exactStackSelections:r.exactStackSelectionsJson,proposalResultHash:r.proposalResultHash,architectureHash:r.architectureHash,humanApprovalRequestId:r.humanApprovalRequestId,status:r.status,approvedAt:r.approvedAt};}
}
