import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EventLogService } from '../events/event-log.service';
import { canonicalHash } from '../generation-engine/canonical-hash';
import { PrismaService } from '../persistence/prisma.service';

type Candidate = {
  id: string; key: string; version: number; teamInstanceId: string | null; capabilities: string[];
  canExecute: boolean; canReview: boolean;
};

@Injectable()
export class MissionJobRouterService {
  constructor(private readonly prisma: PrismaService, private readonly events: EventLogService) {}

  async route(missionId: string, missionJobId: string) {
    const existing = await this.prisma.missionJobRouting.findUnique({ where: { missionJobId } });
    const job = await this.prisma.missionJob.findUnique({ where: { id: missionJobId } });
    if (!job || job.missionId !== missionId) throw new Error('MISSION_JOB_NOT_FOUND');
    if (existing) {
      if (existing.missionId !== missionId) throw new Error('MISSION_JOB_ROUTING_MISSION_MISMATCH');
    }
    if (!existing && job.status !== 'READY') throw new Error('MISSION_JOB_NOT_READY');
    const plan = await this.prisma.implementationPlan.findUnique({ where: { id: job.implementationPlanId } });
    if (!plan || plan.missionId !== missionId || plan.status !== 'VALIDATED') throw new Error('IMPLEMENTATION_PLAN_NOT_VALIDATED');
    const company = await this.prisma.virtualCompany.findFirst({ where: { missionId, implementationPlanId: plan.id, status: 'APPROVED' }, orderBy: { version: 'desc' } });
    if (!company) throw new Error('VIRTUAL_COMPANY_NOT_READY');
    const architecture = await this.prisma.architectureComposition.findUnique({ where: { id: plan.architectureCompositionId } });
    if (!architecture || architecture.architectureHash !== plan.architectureHash || company.architectureHash !== architecture.architectureHash) throw new Error('MISSION_JOB_ROUTING_INPUT_DRIFT');
    const module = (architecture.modulesJson as unknown as Array<{ key: string; stackRefs?: Array<{ stackKey: string }> }>).find((item) => item.key === job.moduleKey);
    if (!module) throw new Error('MISSION_JOB_ROUTING_INPUT_DRIFT');
    const moduleStacks = new Set((module.stackRefs ?? []).map((ref) => ref.stackKey));
    const teams = await this.prisma.teamInstance.findMany({ where: { virtualCompanyId: company.id } });
    const eligibleTeamIds = new Set(teams.filter((team) => moduleStacks.size === 0 || (team.stackKeysJson as string[]).some((stack) => moduleStacks.has(stack))).map((team) => team.id));
    const instances = await this.prisma.agentInstance.findMany({ where: { virtualCompanyId: company.id } });
    const decisions = await this.prisma.teamCompositionDecision.findMany({ where: { virtualCompanyId: company.id } });
    const decisionByKey = new Map(decisions.map((decision) => [decision.agentDefinitionKey, decision]));
    const candidates: Candidate[] = [];
    for (const instance of instances.filter((item) => item.teamInstanceId && eligibleTeamIds.has(item.teamInstanceId))) {
      const definition = await this.prisma.agentDefinition.findUnique({ where: { key: instance.agentDefinitionKey } });
      const version = definition ? await this.prisma.agentDefVersion.findUnique({ where: { agentDefinitionId_version: { agentDefinitionId: definition.id, version: instance.agentDefinitionVersion } } }) : null;
      if (!version?.publishedAt) throw new Error('MISSION_JOB_ROUTING_AGENT_VERSION_INVALID');
      const decision = decisionByKey.get(instance.agentDefinitionKey);
      if (!decision || decision.agentDefinitionVersion !== instance.agentDefinitionVersion) throw new Error('MISSION_JOB_ROUTING_INPUT_DRIFT');
      candidates.push({ id: instance.id, key: instance.agentDefinitionKey, version: instance.agentDefinitionVersion, teamInstanceId: instance.teamInstanceId, capabilities: decision.capabilityKeysJson as string[], canExecute: version.canExecute, canReview: version.canReview });
    }
    const required = [...new Set(job.requiredCapabilitiesJson as string[])].sort();
    const executor = candidates.filter((candidate) => candidate.canExecute && !candidate.key.endsWith('.test-engineer')).sort((a, b) => this.coverageGain(b, required) - this.coverageGain(a, required) || this.executorPriority(a) - this.executorPriority(b) || a.key.localeCompare(b.key))[0];
    const reviewer = candidates.filter((candidate) => candidate.canReview && !candidate.canExecute && candidate.id !== executor?.id).sort((a, b) => this.reviewerPriority(a) - this.reviewerPriority(b) || a.key.localeCompare(b.key))[0];
    const selected: Candidate[] = executor ? [executor] : [];
    const covered = new Set(executor?.capabilities.filter((capability) => required.includes(capability)) ?? []);
    const specialistPool = candidates.filter((candidate) => candidate.canExecute && candidate.id !== executor?.id);
    while (required.some((capability) => !covered.has(capability))) {
      const best = specialistPool.filter((candidate) => !selected.some((item) => item.id === candidate.id)).map((candidate) => ({ candidate, gain: candidate.capabilities.filter((capability) => required.includes(capability) && !covered.has(capability)).length })).filter((item) => item.gain > 0).sort((a, b) => b.gain - a.gain || a.candidate.key.localeCompare(b.candidate.key))[0];
      if (!best) break;
      selected.push(best.candidate); best.candidate.capabilities.filter((capability) => required.includes(capability)).forEach((capability) => covered.add(capability));
    }
    const missing = required.filter((capability) => !covered.has(capability));
    const status = !executor ? 'BLOCKED_NO_EXECUTOR' : missing.length ? 'BLOCKED_CAPABILITY_GAP' : !reviewer ? 'BLOCKED_NO_REVIEWER' : 'ROUTED';
    const selectedIds = status === 'ROUTED' && reviewer ? [...selected.map((item) => item.id), reviewer.id] : [];
    const contextHash = canonicalHash({ missionJobId: job.id, implementationPlanId: plan.id, planHash: plan.planHash, virtualCompanyId: company.id, compositionHash: company.compositionHash, job: { moduleKey: job.moduleKey, requiredCapabilities: required, complexity: job.complexity, risk: job.risk }, candidates: candidates.map((candidate) => ({ id: candidate.id, key: candidate.key, version: candidate.version, capabilities: candidate.capabilities })).sort((a, b) => a.id.localeCompare(b.id)) });
    if (existing) {
      if (existing.contextHash !== contextHash) throw new Error('MISSION_JOB_ROUTING_STALE');
      return this.toDto(existing);
    }
    const rationale = status === 'ROUTED' ? 'Equipe mínima capaz selecionada com reviewer independente.' : status === 'BLOCKED_NO_EXECUTOR' ? 'Nenhum executor elegível na unidade da stack aprovada.' : status === 'BLOCKED_NO_REVIEWER' ? 'Nenhum reviewer independente elegível na unidade da stack aprovada.' : `Capabilities sem cobertura: ${missing.join(', ')}.`;
    const id = randomUUID();
    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.missionJobRouting.create({ data: { id, missionId, missionJobId, implementationPlanId: plan.id, virtualCompanyId: company.id, contextHash, status, executorAgentInstanceId: status === 'ROUTED' ? executor?.id : null, reviewerAgentInstanceId: status === 'ROUTED' ? reviewer?.id : null, selectedAgentIdsJson: selectedIds as Prisma.InputJsonValue, requiredCapabilitiesJson: required as Prisma.InputJsonValue, capabilityCoverageJson: [...covered].sort() as Prisma.InputJsonValue, missingCapabilitiesJson: missing as Prisma.InputJsonValue, rationale } });
      await tx.missionJob.update({ where: { id: missionJobId }, data: { status: status === 'ROUTED' ? 'ROUTED' : 'BLOCKED' } });
      return created;
    });
    await this.events.append({ missionId, correlationId: id, actorType: 'SYSTEM', type: status === 'ROUTED' ? 'job.routed' : 'job.routing_blocked', idempotencyKey: `mission-job-routing:${id}`, payload: { missionId, jobId: missionJobId, routingId: id, implementationPlanId: plan.id, virtualCompanyId: company.id, executorAgentInstanceId: row.executorAgentInstanceId, reviewerAgentInstanceId: row.reviewerAgentInstanceId, selectedAgentCount: selectedIds.length, missingCapabilityCount: missing.length, status } });
    return this.toDto(row);
  }

  async routeReady(missionId: string) { const jobs = await this.prisma.missionJob.findMany({ where: { missionId, status: 'READY' }, orderBy: { jobKey: 'asc' } }); const results = []; for (const job of jobs) results.push(await this.route(missionId, job.id)); return results; }
  async get(missionId: string, missionJobId: string) { const row = await this.prisma.missionJobRouting.findUnique({ where: { missionJobId } }); if (!row || row.missionId !== missionId) return null; return this.toDto(row); }
  private executorPriority(candidate: Candidate) { if (candidate.key.endsWith('.developer')) return 0; if (candidate.key.endsWith('.lead')) return 1; if (candidate.key.endsWith('.data-specialist')) return 2; return 5; }
  private coverageGain(candidate: Candidate, required: string[]) { return candidate.capabilities.filter((capability) => required.includes(capability)).length; }
  private reviewerPriority(candidate: Candidate) { if (candidate.key.endsWith('.reviewer')) return 0; if (candidate.key.endsWith('.security-specialist')) return 1; return 5; }
  private toDto(row: any) { return { ...row, selectedAgentIds: row.selectedAgentIdsJson, requiredCapabilities: row.requiredCapabilitiesJson, capabilityCoverage: row.capabilityCoverageJson, missingCapabilities: row.missingCapabilitiesJson }; }
}
