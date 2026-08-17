import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../persistence/prisma.service';
import { EventLogService } from '../events/event-log.service';
import { canonicalHash } from './canonical-hash';

export interface RequirementBaselineRef {
  requirementId: string;
  requirementKey: string;
}

export interface RequirementBaselineSnapshot extends RequirementBaselineRef {
  category: string | null;
  statement: string;
  source: string | null;
  sourceRef: string | null;
  priority: string | null;
  status: string;
}

export interface RequirementBaselineDto {
  id: string;
  missionId: string;
  version: number;
  status: 'DRAFT' | 'FINALIZED';
  baselineHash: string;
  requirementRefs: RequirementBaselineRef[];
  requirementsSnapshot: RequirementBaselineSnapshot[];
  createdAt: Date;
  finalizedAt: Date | null;
}

/**
 * CORE-011 §11-13 — congela o conjunto de Requirements que segue para Scope Coverage e depois
 * Solution Planning (CORE-012). Espelha o padrão já existente de lock/supersede do
 * PromptMasterVersion (DiscoveryService.lockPromptMaster/createChangeRequest) sem tocar naquele
 * código: uma vez FINALIZED, a linha nunca é alterada — uma mudança de escopo depois disso cria
 * `version + 1`, e v1 permanece intacta e consultável (§12/§32/§33/§Y).
 */
@Injectable()
export class RequirementBaselineService {
  constructor(private readonly prisma: PrismaService, private readonly eventLog: EventLogService) {}

  /** Snapshot do conjunto ATIVO de Requirements da Mission (nunca REJECTED/SUPERSEDED, nunca
   * linhas sem requirementKey — proveniência pré-CORE-011). Sem filtro numérico algum: TODAS as
   * linhas elegíveis entram (§K/§L/§M — nenhum truncamento silencioso). */
  async createBaseline(missionId: string): Promise<RequirementBaselineDto> {
    if (!missionId?.trim()) throw new Error('INVALID_REQUIREMENT_INPUT');

    const requirements = await this.prisma.requirement.findMany({
      where: { missionId, requirementKey: { not: null }, status: { notIn: ['REJECTED', 'SUPERSEDED'] } },
      orderBy: { requirementKey: 'asc' },
    });
    if (requirements.length === 0) throw new Error('REQUIREMENT_BASELINE_EMPTY');

    const lastVersion = await this.prisma.requirementBaseline.findFirst({ where: { missionId }, orderBy: { version: 'desc' } });
    const version = (lastVersion?.version ?? 0) + 1;

    const snapshot: RequirementBaselineSnapshot[] = requirements.map((r) => ({
      requirementId: r.id,
      requirementKey: r.requirementKey!,
      category: r.category,
      statement: r.content,
      source: r.source,
      sourceRef: r.sourceRef,
      priority: r.priority,
      status: r.status,
    }));
    const refs: RequirementBaselineRef[] = snapshot.map(({ requirementId, requirementKey }) => ({ requirementId, requirementKey }));
    const baselineHash = this.computeHash(snapshot);

    const id = randomUUID();
    const row = await this.prisma.requirementBaseline.create({
      data: { id, missionId, version, requirementRefsJson: refs as unknown as object, requirementsSnapshotJson: snapshot as unknown as object, baselineHash, status: 'DRAFT' },
    });

    await this.eventLog.append({
      missionId,
      correlationId: randomUUID(),
      actorType: 'SYSTEM',
      type: 'mission.requirements_baseline_created',
      payload: { missionId, baselineId: id, baselineVersion: version, baselineHash, requirementCount: refs.length },
    });

    return this.toDto(row);
  }

  /** Idempotente (§39): finalizar uma baseline já FINALIZED é um no-op que retorna o estado
   * atual — nunca duplica o evento nem incrementa nada. */
  async finalizeBaseline(missionId: string, baselineId: string): Promise<RequirementBaselineDto> {
    const row = await this.requireBaseline(missionId, baselineId);
    if (row.status === 'FINALIZED') return this.toDto(row);

    const finalizedAt = new Date();
    const updated = await this.prisma.requirementBaseline.update({
      where: { id: baselineId },
      data: { status: 'FINALIZED', finalizedAt },
    });

    await this.eventLog.append({
      missionId,
      correlationId: randomUUID(),
      actorType: 'SYSTEM',
      type: 'mission.requirements_baseline_finalized',
      payload: { missionId, baselineId, baselineVersion: updated.version, baselineHash: updated.baselineHash },
    });

    return this.toDto(updated);
  }

  async getBaseline(missionId: string, baselineId: string): Promise<RequirementBaselineDto> {
    const row = await this.requireBaseline(missionId, baselineId);
    return this.toDto(row);
  }

  async getLatestBaseline(missionId: string): Promise<RequirementBaselineDto | null> {
    const row = await this.prisma.requirementBaseline.findFirst({ where: { missionId }, orderBy: { version: 'desc' } });
    if (!row) return null;
    return this.toDto(row);
  }

  private computeHash(items: RequirementBaselineSnapshot[]): string {
    const sorted = [...items].sort((a, b) => a.requirementKey.localeCompare(b.requirementKey));
    return canonicalHash(sorted);
  }

  private async requireBaseline(missionId: string, baselineId: string) {
    const row = await this.prisma.requirementBaseline.findUnique({ where: { id: baselineId } });
    if (!row || row.missionId !== missionId) throw new Error('REQUIREMENT_BASELINE_NOT_FOUND');
    return row;
  }

  private toDto(row: { id: string; missionId: string; version: number; status: string; baselineHash: string; requirementRefsJson: unknown; requirementsSnapshotJson: unknown; createdAt: Date; finalizedAt: Date | null }): RequirementBaselineDto {
    const refs = row.requirementRefsJson as RequirementBaselineRef[];
    const snapshot = row.requirementsSnapshotJson as RequirementBaselineSnapshot[];
    return {
      id: row.id,
      missionId: row.missionId,
      version: row.version,
      status: row.status as 'DRAFT' | 'FINALIZED',
      baselineHash: row.baselineHash,
      requirementRefs: refs,
      requirementsSnapshot: snapshot,
      createdAt: row.createdAt,
      finalizedAt: row.finalizedAt,
    };
  }
}
