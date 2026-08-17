import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EventLogService } from '../events/event-log.service';
import { canonicalHash } from '../generation-engine/canonical-hash';
import { PrismaService } from '../persistence/prisma.service';

type StackSelection = { stackKey: string; stackVersion: string };
type CatalogAgent = {
  definitionId: string;
  key: string;
  version: number;
  role: string;
  capabilityKeys: string[];
  canExecute: boolean;
  canReview: boolean;
  publishedAt: Date | null;
};

const rolePriority = (key: string): number => {
  if (key.endsWith('.architect')) return 10;
  if (key.endsWith('.lead')) return 20;
  if (key.endsWith('.developer')) return 30;
  if (key.endsWith('.data-specialist')) return 40;
  if (key.endsWith('.security-specialist')) return 50;
  if (key.endsWith('.test-engineer')) return 60;
  if (key.endsWith('.reviewer')) return 70;
  return 100;
};

@Injectable()
export class VirtualCompanyService {
  constructor(private readonly prisma: PrismaService, private readonly events: EventLogService) {}

  async compose(missionId: string, architectureCompositionId: string, implementationPlanId?: string) {
    if (!implementationPlanId) throw new Error('IMPLEMENTATION_PLAN_REQUIRED');
    const existing = await this.prisma.virtualCompany.findUnique({ where: { architectureCompositionId } });
    if (existing) {
      if (existing.missionId !== missionId) throw new Error('VIRTUAL_COMPANY_MISSION_MISMATCH');
      if (existing.implementationPlanId && existing.implementationPlanId !== implementationPlanId) throw new Error('VIRTUAL_COMPANY_IMPLEMENTATION_PLAN_MISMATCH');
      if (!existing.implementationPlanId) await this.prisma.virtualCompany.update({ where: { id: existing.id }, data: { implementationPlanId } });
      return this.hydrate(existing.id);
    }

    const architecture = await this.prisma.architectureComposition.findUnique({ where: { id: architectureCompositionId } });
    if (!architecture || architecture.missionId !== missionId) throw new Error('ARCHITECTURE_COMPOSITION_NOT_FOUND');
    if (architecture.status !== 'APPROVED') throw new Error('ARCHITECTURE_COMPOSITION_NOT_APPROVED');
    const implementationPlan = await this.prisma.implementationPlan.findUnique({ where: { id: implementationPlanId } });
    if (!implementationPlan || implementationPlan.missionId !== missionId || implementationPlan.architectureCompositionId !== architectureCompositionId || implementationPlan.architectureHash !== architecture.architectureHash || implementationPlan.status !== 'VALIDATED') throw new Error('IMPLEMENTATION_PLAN_NOT_VALIDATED');

    const stackSelections = architecture.exactStackSelectionsJson as unknown as StackSelection[];
    if (stackSelections.length === 0) throw new Error('VIRTUAL_COMPANY_HAS_NO_APPROVED_STACK');
    const stackKeys = [...new Set(stackSelections.map((selection) => selection.stackKey))].sort();
    const units = (await this.prisma.unitDefinition.findMany({ where: { status: 'ACTIVE' }, orderBy: { key: 'asc' } }))
      .filter((unit) => (unit.stackKeysJson as unknown as string[]).some((key) => stackKeys.includes(key)));
    const coveredStacks = new Set(units.flatMap((unit) => unit.stackKeysJson as unknown as string[]));
    const missingStacks = stackKeys.filter((key) => !coveredStacks.has(key));
    if (missingStacks.length > 0) throw new Error(`VIRTUAL_COMPANY_STACK_UNIT_NOT_FOUND:${missingStacks.join(',')}`);

    const requiredCapabilities = new Set((implementationPlan.workPackagesJson as unknown as Array<{ requiredCapabilities: string[] }>).flatMap((work) => work.requiredCapabilities));
    const securityRequired = [...requiredCapabilities].some((key) => key.startsWith('security.') || key.startsWith('architecture.security'));
    const dataRequired = [...requiredCapabilities].some((key) => key.startsWith('data.'));
    const companyId = randomUUID();
    const version = (await this.prisma.virtualCompany.aggregate({ where: { missionId }, _max: { version: true } }))._max.version ?? 0;
    const plannedTeams: Array<{ id: string; unit: typeof units[number]; agents: CatalogAgent[]; stackKeys: string[] }> = [];

    for (const unit of units) {
      const unitStacks = (unit.stackKeysJson as unknown as string[]).filter((key) => stackKeys.includes(key)).sort();
      const agents = await this.resolveMinimumTeam(unit.id, { securityRequired, dataRequired });
      this.assertExecutableAndIndependent(agents, unit.key);
      plannedTeams.push({ id: randomUUID(), unit, agents, stackKeys: unitStacks });
    }
    const coveredCapabilities = new Set(plannedTeams.flatMap((team) => team.agents.flatMap((agent) => agent.capabilityKeys)));
    const uncoveredCapabilities = [...requiredCapabilities].filter((key) => !coveredCapabilities.has(key));
    if (uncoveredCapabilities.length > 0) throw new Error(`VIRTUAL_COMPANY_CAPABILITY_UNCOVERED:${uncoveredCapabilities.join(',')}`);

    const plan = plannedTeams.map((team) => ({
      unitKey: team.unit.key,
      stackKeys: team.stackKeys,
      agents: team.agents.map((agent) => ({ key: agent.key, version: agent.version, role: agent.role })),
    }));
    const compositionHash = canonicalHash({ architectureHash: architecture.architectureHash, plan });
    const rationale = `Equipe mínima derivada da arquitetura ${architecture.version} e do plano ${implementationPlan.version}; ${stackKeys.length} stack(s) aprovada(s), ${plannedTeams.length} unidade(s), ${plan.reduce((sum, team) => sum + team.agents.length, 0)} agente(s).`;

    await this.events.append({ missionId, correlationId: companyId, actorType: 'SYSTEM', type: 'company.assembling', idempotencyKey: `virtual-company:${companyId}:assembling`, payload: { missionId, virtualCompanyId: companyId, architectureCompositionId, implementationPlanId, status: 'ASSEMBLING' } });

    await this.prisma.$transaction(async (tx) => {
      await tx.virtualCompany.updateMany({ where: { missionId, status: 'APPROVED' }, data: { status: 'SUPERSEDED' } });
      await tx.virtualCompany.create({ data: { id: companyId, missionId, version: version + 1, architectureCompositionId, architectureHash: architecture.architectureHash, approvedSolutionId: architecture.approvedSolutionId, implementationPlanId, compositionHash, rationale, status: 'APPROVED', approvedAt: new Date() } });
      for (const team of plannedTeams) {
        const teamRationale = `Unidade ${team.unit.key} convocada para ${team.stackKeys.join(', ')}.`;
        await tx.teamInstance.create({ data: { id: team.id, missionId, virtualCompanyId: companyId, unitDefinitionId: team.unit.id, name: team.unit.name, stackKeysJson: team.stackKeys as Prisma.InputJsonValue, rationale: teamRationale } });
        for (const agent of team.agents) {
          const agentRationale = this.agentRationale(agent, { securityRequired, dataRequired });
          const current = await tx.agentInstance.findUnique({ where: { missionId_agentDefinitionKey: { missionId, agentDefinitionKey: agent.key } } });
          if (current && current.agentDefinitionVersion !== agent.version) throw new Error('AGENT_INSTANCE_VERSION_CONFLICT');
          await tx.agentInstance.upsert({
            where: { missionId_agentDefinitionKey: { missionId, agentDefinitionKey: agent.key } },
            update: { virtualCompanyId: companyId, teamInstanceId: team.id, role: agent.role, compositionRationale: agentRationale },
            create: { id: randomUUID(), missionId, agentDefinitionKey: agent.key, agentDefinitionVersion: agent.version, state: 'IDLE', virtualCompanyId: companyId, teamInstanceId: team.id, role: agent.role, compositionRationale: agentRationale },
          });
          await tx.teamCompositionDecision.create({ data: { id: randomUUID(), missionId, virtualCompanyId: companyId, teamInstanceId: team.id, agentDefinitionKey: agent.key, agentDefinitionVersion: agent.version, role: agent.role, rationale: agentRationale, capabilityKeysJson: agent.capabilityKeys as Prisma.InputJsonValue, architectureEvidenceJson: [`architecture:${architecture.id}`, ...team.stackKeys.map((key) => `stack:${key}`)] as Prisma.InputJsonValue } });
        }
      }
    });

    await this.events.append({ missionId, correlationId: companyId, actorType: 'SYSTEM', type: 'company.ready', idempotencyKey: `virtual-company:${companyId}:ready`, payload: { missionId, virtualCompanyId: companyId, version: version + 1, architectureCompositionId, implementationPlanId, architectureHash: architecture.architectureHash, compositionHash, teamCount: plannedTeams.length, agentCount: plan.reduce((sum, team) => sum + team.agents.length, 0), status: 'READY' } });
    return this.hydrate(companyId);
  }

  async getActive(missionId: string) {
    const company = await this.prisma.virtualCompany.findFirst({ where: { missionId, status: 'APPROVED' }, orderBy: { version: 'desc' } });
    return company ? this.hydrate(company.id) : null;
  }

  private async resolveMinimumTeam(unitDefinitionId: string, needs: { securityRequired: boolean; dataRequired: boolean }): Promise<CatalogAgent[]> {
    const definitions = await this.prisma.agentDefinition.findMany({ where: { unitDefinitionId, status: 'ACTIVE' }, orderBy: { key: 'asc' } });
    const agents: CatalogAgent[] = [];
    for (const definition of definitions) {
      if (definition.currentVersion < 1) continue;
      const version = await this.prisma.agentDefVersion.findUnique({ where: { agentDefinitionId_version: { agentDefinitionId: definition.id, version: definition.currentVersion } } });
      if (!version?.publishedAt) continue;
      const key = definition.key;
      if (key.endsWith('.data-specialist') && !needs.dataRequired) continue;
      if (key.endsWith('.security-specialist') && !needs.securityRequired) continue;
      const coreRole = key.endsWith('.architect') || key.endsWith('.lead') || key.endsWith('.developer') || key.endsWith('.test-engineer') || key.endsWith('.reviewer');
      if (!coreRole && !key.endsWith('.data-specialist') && !key.endsWith('.security-specialist')) continue;
      agents.push({ definitionId: definition.id, key, version: version.version, role: (version.identityJson as { role?: string }).role ?? key, capabilityKeys: version.capabilityKeysJson as unknown as string[], canExecute: version.canExecute, canReview: version.canReview, publishedAt: version.publishedAt });
    }
    return agents.sort((a, b) => rolePriority(a.key) - rolePriority(b.key) || a.key.localeCompare(b.key));
  }

  private assertExecutableAndIndependent(agents: CatalogAgent[], unitKey: string) {
    if (!agents.some((agent) => agent.canExecute)) throw new Error(`VIRTUAL_COMPANY_EXECUTOR_NOT_FOUND:${unitKey}`);
    const reviewers = agents.filter((agent) => agent.canReview && !agent.canExecute);
    if (reviewers.length === 0) throw new Error(`VIRTUAL_COMPANY_INDEPENDENT_REVIEWER_NOT_FOUND:${unitKey}`);
    if (new Set(agents.map((agent) => agent.key)).size !== agents.length) throw new Error('VIRTUAL_COMPANY_DUPLICATE_AGENT');
  }

  private agentRationale(agent: CatalogAgent, needs: { securityRequired: boolean; dataRequired: boolean }): string {
    if (agent.key.endsWith('.security-specialist')) return 'Convocado porque a arquitetura aprovada contém boundary de segurança.';
    if (agent.key.endsWith('.data-specialist')) return 'Convocado porque a arquitetura aprovada contém trabalho explícito de persistência ou modelagem de dados.';
    if (agent.key.endsWith('.reviewer')) return 'Reviewer independente do executor, obrigatório para promoção por evidência.';
    if (agent.key.endsWith('.test-engineer')) return 'Testes e adequação são gates obrigatórios para todo Job.';
    if (agent.key.endsWith('.architect')) return 'Mantém a execução alinhada à arquitetura aprovada.';
    if (agent.key.endsWith('.lead')) return 'Coordena Jobs da unidade sem ampliar o escopo aprovado.';
    return 'Executor mínimo da stack aprovada.';
  }

  private async hydrate(id: string) {
    const company = await this.prisma.virtualCompany.findUniqueOrThrow({ where: { id } });
    const teams = await this.prisma.teamInstance.findMany({ where: { virtualCompanyId: id }, orderBy: { name: 'asc' } });
    const agents = await this.prisma.agentInstance.findMany({ where: { virtualCompanyId: id }, orderBy: { agentDefinitionKey: 'asc' } });
    const decisions = await this.prisma.teamCompositionDecision.findMany({ where: { virtualCompanyId: id }, orderBy: { agentDefinitionKey: 'asc' } });
    return { ...company, teams: teams.map((team) => ({ ...team, agents: agents.filter((agent) => agent.teamInstanceId === team.id), decisions: decisions.filter((decision) => decision.teamInstanceId === team.id) })) };
  }
}
