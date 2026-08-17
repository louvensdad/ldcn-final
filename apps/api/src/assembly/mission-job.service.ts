import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EventLogService } from '../events/event-log.service';
import { canonicalHash } from '../generation-engine/canonical-hash';
import { ImplementationWorkPackageV1 } from '../implementation-planning/implementation-plan.contracts';
import { PrismaService } from '../persistence/prisma.service';

@Injectable()
export class MissionJobService {
  constructor(private readonly prisma: PrismaService, private readonly events: EventLogService) {}
  async createFromPlan(missionId: string, implementationPlanId: string) {
    const plan = await this.prisma.implementationPlan.findUnique({ where: { id: implementationPlanId } });
    if (!plan || plan.missionId !== missionId || plan.status !== 'VALIDATED') throw new Error('IMPLEMENTATION_PLAN_NOT_VALIDATED');
    const existing = await this.prisma.missionJob.findMany({ where: { implementationPlanId }, orderBy: { jobKey: 'asc' } });
    const workPackages = plan.workPackagesJson as unknown as ImplementationWorkPackageV1[];
    if (existing.length === workPackages.length && existing.length > 0) return existing;
    if (existing.length > 0) throw new Error('MISSION_JOB_PLAN_DRIFT');
    const created = await this.prisma.$transaction(async (tx) => {
      const rows = [];
      for (const work of workPackages) {
        const id = randomUUID();
        const status = work.dependsOn.length === 0 ? 'READY' : 'PLANNED';
        const job = await tx.missionJob.create({ data: { id, missionId, implementationPlanId, jobKey: work.key, title: work.title, moduleKey: work.moduleKey, objective: work.objective, requirementKeysJson: work.requirementKeys as Prisma.InputJsonValue, requiredCapabilitiesJson: work.requiredCapabilities as Prisma.InputJsonValue, dependencyKeysJson: work.dependsOn as Prisma.InputJsonValue, complexity: work.complexity, risk: work.risk, status } });
        const scope = { allowedPaths: work.allowedPaths, allowedModules: work.allowedModules, allowedSymbols: [], forbiddenPaths: [], requiredContracts: [], acceptanceCriteria: work.acceptanceCriteria };
        await tx.jobScope.create({ data: { id: randomUUID(), missionId, generationJobId: null, missionJobId: id, version: 1, allowedPathsJson: scope.allowedPaths as Prisma.InputJsonValue, allowedModulesJson: scope.allowedModules as Prisma.InputJsonValue, allowedSymbolsJson: scope.allowedSymbols as Prisma.InputJsonValue, forbiddenPathsJson: scope.forbiddenPaths as Prisma.InputJsonValue, requiredContractsJson: scope.requiredContracts as Prisma.InputJsonValue, acceptanceCriteriaJson: scope.acceptanceCriteria as Prisma.InputJsonValue, scopeHash: canonicalHash(scope) } });
        rows.push(job);
      }
      return rows;
    });
    for (const job of created) await this.events.append({ missionId, correlationId: job.id, actorType: 'SYSTEM', type: 'job.planned', idempotencyKey: `mission-job:${job.id}:planned`, payload: { missionId, jobId: job.id, implementationPlanId, jobKey: job.jobKey, moduleKey: job.moduleKey, complexity: job.complexity, risk: job.risk, dependencyCount: (job.dependencyKeysJson as string[]).length, status: job.status } });
    return created;
  }
}
