import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { EventLogService } from '../events/event-log.service';
import { ImplementationPlanningService } from '../implementation-planning/implementation-planning.service';
import { PrismaService } from '../persistence/prisma.service';
import { VirtualCompanyService } from '../virtual-company/virtual-company.service';
import { MissionJobService } from './mission-job.service';

@Injectable()
export class AssemblyService {
  private readonly active = new Set<string>();
  constructor(private readonly prisma: PrismaService, private readonly planning: ImplementationPlanningService, private readonly companies: VirtualCompanyService, private readonly jobs: MissionJobService, private readonly events: EventLogService) {}

  async start(missionId: string, architectureCompositionId: string) {
    const architecture = await this.prisma.architectureComposition.findUnique({ where: { id: architectureCompositionId } });
    if (!architecture || architecture.missionId !== missionId) throw new Error('ARCHITECTURE_COMPOSITION_NOT_FOUND');
    if (architecture.status !== 'APPROVED' || !architecture.humanApprovalRequestId) throw new Error('ARCHITECTURE_HUMAN_APPROVAL_REQUIRED');
    const approval = await this.prisma.humanApprovalRequest.findUnique({ where: { id: architecture.humanApprovalRequestId } });
    if (!approval || approval.status !== 'APPROVED' || approval.subjectHash !== architecture.architectureHash) throw new Error('ARCHITECTURE_HUMAN_APPROVAL_REQUIRED');
    let assembly = await this.prisma.missionAssembly.findUnique({ where: { architectureCompositionId } });
    if (assembly?.status === 'READY') return this.hydrate(assembly.id);
    if (this.active.has(architectureCompositionId)) throw new Error('MISSION_ASSEMBLY_IN_PROGRESS');
    this.active.add(architectureCompositionId);
    try {
      if (!assembly) assembly = await this.prisma.missionAssembly.create({ data: { id: randomUUID(), missionId, architectureCompositionId, status: 'PLANNING' } });
      else assembly = await this.prisma.missionAssembly.update({ where: { id: assembly.id }, data: { status: assembly.implementationPlanId ? 'COMPOSING' : 'PLANNING', errorCode: null } });
      await this.prisma.missionControl.upsert({ where: { missionId }, create: { missionId, status: 'TEAM_ASSEMBLY', activeArchitectureId: architectureCompositionId, activeAssemblyId: assembly.id }, update: { status: 'TEAM_ASSEMBLY', activeArchitectureId: architectureCompositionId, activeAssemblyId: assembly.id } });
      await this.events.append({ missionId, correlationId: assembly.id, actorType: 'SYSTEM', type: 'mission.assembly_started', idempotencyKey: `assembly:${assembly.id}:started`, payload: { missionId, assemblyId: assembly.id, architectureCompositionId, architectureHash: architecture.architectureHash, status: 'RUNNING' } });
      const plan = await this.planning.plan(missionId, architectureCompositionId);
      assembly = await this.prisma.missionAssembly.update({ where: { id: assembly.id }, data: { implementationPlanId: plan.id, status: 'COMPOSING' } });
      const company = await this.companies.compose(missionId, architectureCompositionId, plan.id);
      assembly = await this.prisma.missionAssembly.update({ where: { id: assembly.id }, data: { virtualCompanyId: company.id, status: 'PLANNING_JOBS' } });
      const jobs = await this.jobs.createFromPlan(missionId, plan.id);
      const completedAt = new Date();
      assembly = await this.prisma.missionAssembly.update({ where: { id: assembly.id }, data: { status: 'READY', completedAt } });
      await this.prisma.missionControl.update({ where: { missionId }, data: { status: 'PLANNING', activeImplementationPlanId: plan.id, activeVirtualCompanyId: company.id, activeAssemblyId: assembly.id } });
      await this.events.append({ missionId, correlationId: assembly.id, actorType: 'SYSTEM', type: 'mission.assembly_ready', idempotencyKey: `assembly:${assembly.id}:ready`, payload: { missionId, assemblyId: assembly.id, architectureCompositionId, implementationPlanId: plan.id, virtualCompanyId: company.id, jobCount: jobs.length, status: 'READY' } });
      return this.hydrate(assembly.id);
    } catch (error) {
      const errorCode = error instanceof Error ? error.message.slice(0, 160) : 'MISSION_ASSEMBLY_FAILED';
      if (assembly) await this.prisma.missionAssembly.update({ where: { id: assembly.id }, data: { status: 'FAILED', errorCode } });
      await this.events.append({ missionId, correlationId: assembly?.id ?? architectureCompositionId, actorType: 'SYSTEM', type: 'mission.assembly_failed', payload: { missionId, assemblyId: assembly?.id ?? null, architectureCompositionId, errorCode, status: 'FAILED' } });
      throw error;
    } finally { this.active.delete(architectureCompositionId); }
  }

  async getActive(missionId: string) { const row = await this.prisma.missionAssembly.findFirst({ where: { missionId }, orderBy: { startedAt: 'desc' } }); return row ? this.hydrate(row.id) : null; }
  private async hydrate(id: string) { const assembly = await this.prisma.missionAssembly.findUniqueOrThrow({ where: { id } }); const [plan, company, jobs] = await Promise.all([assembly.implementationPlanId ? this.prisma.implementationPlan.findUnique({ where: { id: assembly.implementationPlanId } }) : null, assembly.virtualCompanyId ? this.prisma.virtualCompany.findUnique({ where: { id: assembly.virtualCompanyId } }) : null, assembly.implementationPlanId ? this.prisma.missionJob.findMany({ where: { implementationPlanId: assembly.implementationPlanId }, orderBy: { jobKey: 'asc' } }) : []]); return { ...assembly, implementationPlan: plan, virtualCompany: company, jobs }; }
}
