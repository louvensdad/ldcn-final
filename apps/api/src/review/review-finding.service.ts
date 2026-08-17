import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../persistence/prisma.service';

/** Fase 20 do brief: única escala de severidade — só BLOCKER impede aprovação. */
export type ReviewFindingSeverity = 'INFO' | 'ADVISORY' | 'WARNING' | 'BLOCKER';
export type ReviewFindingStatus = 'OPEN' | 'RESOLVED' | 'DISMISSED';

export interface CreateReviewFindingInput {
  missionId: string;
  promptMasterId: string;
  reviewerKey: string;
  code: string;
  severity: ReviewFindingSeverity;
  section?: string;
  requirementIds?: string[];
  finding: string;
  recommendedResolutions?: string[];
  requiresUserDecision?: boolean;
}

export interface ReviewFindingDto {
  id: string;
  reviewerKey: string;
  code: string;
  severity: ReviewFindingSeverity;
  section: string | null;
  requirementIds: string[];
  finding: string;
  recommendedResolutions: string[];
  requiresUserDecision: boolean;
  status: ReviewFindingStatus;
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  createdAt: string;
}

/**
 * Fase 19 do brief: o contrato único que todo reviewer produz — nada de texto livre controlando o
 * pipeline. Vive fora de DiscoveryService (usado tanto pelo gate de aprovação quanto, na Fase 7,
 * por cada um dos 9 reviewer agents) para não inchar ainda mais um service já grande.
 */
@Injectable()
export class ReviewFindingService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateReviewFindingInput): Promise<ReviewFindingDto> {
    const row = await this.prisma.reviewFinding.create({
      data: {
        id: randomUUID(),
        missionId: input.missionId,
        promptMasterId: input.promptMasterId,
        reviewerKey: input.reviewerKey,
        code: input.code,
        severity: input.severity,
        section: input.section ?? null,
        requirementIdsJson: (input.requirementIds ?? []) as unknown as Prisma.InputJsonValue,
        finding: input.finding,
        recommendedResolutionsJson: (input.recommendedResolutions ?? []) as unknown as Prisma.InputJsonValue,
        requiresUserDecision: input.requiresUserDecision ?? false,
      },
    });
    return this.toDto(row);
  }

  async listForVersion(promptMasterId: string): Promise<ReviewFindingDto[]> {
    const rows = await this.prisma.reviewFinding.findMany({ where: { promptMasterId }, orderBy: { createdAt: 'asc' } });
    return rows.map((r) => this.toDto(r));
  }

  async hasUnresolvedBlockers(promptMasterId: string): Promise<boolean> {
    const count = await this.prisma.reviewFinding.count({
      where: { promptMasterId, severity: 'BLOCKER', status: 'OPEN' },
    });
    return count > 0;
  }

  async hasUnresolvedUserDecisions(promptMasterId: string): Promise<boolean> {
    const count = await this.prisma.reviewFinding.count({
      where: { promptMasterId, requiresUserDecision: true, status: 'OPEN' },
    });
    return count > 0;
  }

  async resolve(findingId: string, resolvedBy: string, resolutionNote?: string): Promise<ReviewFindingDto> {
    const row = await this.prisma.reviewFinding.update({
      where: { id: findingId },
      data: { status: 'RESOLVED', resolvedBy, resolvedAt: new Date(), resolutionNote: resolutionNote ?? null },
    });
    return this.toDto(row);
  }

  async dismiss(findingId: string, resolvedBy: string, resolutionNote?: string): Promise<ReviewFindingDto> {
    const row = await this.prisma.reviewFinding.update({
      where: { id: findingId },
      data: { status: 'DISMISSED', resolvedBy, resolvedAt: new Date(), resolutionNote: resolutionNote ?? null },
    });
    return this.toDto(row);
  }

  private toDto(row: {
    id: string; reviewerKey: string; code: string; severity: string; section: string | null;
    requirementIdsJson: unknown; finding: string; recommendedResolutionsJson: unknown;
    requiresUserDecision: boolean; status: string; resolvedBy: string | null; resolvedAt: Date | null;
    resolutionNote: string | null; createdAt: Date;
  }): ReviewFindingDto {
    return {
      id: row.id,
      reviewerKey: row.reviewerKey,
      code: row.code,
      severity: row.severity as ReviewFindingSeverity,
      section: row.section,
      requirementIds: row.requirementIdsJson as string[],
      finding: row.finding,
      recommendedResolutions: row.recommendedResolutionsJson as string[],
      requiresUserDecision: row.requiresUserDecision,
      status: row.status as ReviewFindingStatus,
      resolvedBy: row.resolvedBy,
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
      resolutionNote: row.resolutionNote,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
