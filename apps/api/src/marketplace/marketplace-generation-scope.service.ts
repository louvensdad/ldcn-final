import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { GenerationReuseScope } from 'ldcn-core';
import { PrismaService } from '../persistence/prisma.service';
import { ChangeType } from './marketplace-customization.service';

/** Fase 3 do brief, na forma real que este sistema (sem camada de artifacts) pode provar: só
 * mudanças que plausivelmente exigem um papel técnico novo (integração externa, dado novo,
 * módulo funcional inteiro) forçam recompor arquitetura/equipe. COSMETIC/CONTENT/CONFIGURATION/
 * BUSINESS_RULE nunca precisam — reaproveitar é seguro (e, mesmo assim, o Generator revalida de
 * verdade antes de aceitar o reuso — ver generator.ts:generateTargeted). */
const BROAD_IMPACT_TYPES = new Set<ChangeType>(['MODULE', 'INTEGRATION', 'DATA_MODEL']);

export interface MarketplaceGenerationScopeDto {
  id: string;
  customizationPlanId: string;
  solutionId: string;
  referenceMissionId: string;
  derivedMissionId: string;
  derivedProjectId: string | null;
  changeClasses: ChangeType[];
  affectedSections: string[];
  requiresStackReselection: boolean;
  requiresArchitectureRecompute: boolean;
  requiresTeamRecompute: boolean;
  generationMode: 'TARGETED' | 'FULL';
  actualReuse: GenerationReuseScope | null;
  escalations: { stage: string; reason: string }[];
  impactScore: number;
  totalRequirements: number;
  reusedRequirements: number;
  reason: string;
  createdAt: string;
  completedAt: string | null;
}

/**
 * MISSÃO "Targeted Generation no Marketplace" — Fase 2/3/27 do brief, adaptadas à realidade
 * confirmada na auditoria (Fase 1): este sistema não gera artifacts de código, então o "impacto"
 * real e mensurável vive em duas fontes que já existem e são reais — a classificação do
 * CustomizationPlan (COSMETIC..ARCHITECTURAL, já calculada pelo Customizer AI) e a proveniência
 * real por Requirement (`origin: USER_IMPORTED` = clonado intacto da referência, `AI_REFINED` =
 * novo/alterado pela customização — já rastreado desde a missão anterior). Nunca um número
 * estimado: `impactScore` é literalmente `reusedRequirements / totalRequirements`.
 */
@Injectable()
export class MarketplaceGenerationScopeService {
  constructor(private readonly prisma: PrismaService) {}

  /** Roda depois de approvePlan() ter travado o PromptMaster derivado (LOCKED) — antes disso os
   * Requirements ainda não refletem o resultado final da customização. */
  async computeAndPersist(planId: string, derivedProjectId?: string): Promise<MarketplaceGenerationScopeDto> {
    const plan = await this.prisma.marketplaceCustomizationPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new Error('MARKETPLACE_CUSTOMIZATION_PLAN_NOT_FOUND');
    const version = await this.prisma.marketplaceSolutionVersion.findUnique({ where: { id: plan.solutionVersionId } });
    if (!version) throw new Error('MARKETPLACE_SOLUTION_VERSION_NOT_FOUND');
    const promptMaster = await this.prisma.promptMasterVersion.findFirst({ where: { missionId: plan.missionId, status: 'LOCKED' } });
    if (!promptMaster) throw new Error('MARKETPLACE_CUSTOMIZATION_PLAN_NOT_APPROVED');

    const requirements = await this.prisma.requirement.findMany({ where: { promptMasterId: promptMaster.id, status: 'CONFIRMED' } });
    const totalRequirements = requirements.length;
    const reusedRequirements = requirements.filter((r) => r.origin === 'USER_IMPORTED').length;
    const affectedSections = [...new Set(requirements.filter((r) => r.origin !== 'USER_IMPORTED').map((r) => r.section))].sort();

    const remove = plan.removeJson as unknown as { type: ChangeType }[];
    const modify = plan.modifyJson as unknown as { type: ChangeType }[];
    const add = plan.addJson as unknown as { type: ChangeType }[];
    const changeClasses = [...new Set([...remove, ...modify, ...add].map((c) => c.type))];

    // Fase 26 — impact explosion: reaproveita o mesmo sinal de complexidade que o Customizer AI já
    // calcula (nunca um segundo cálculo paralelo) para nunca fingir economia num impacto grande demais.
    const generationMode: 'TARGETED' | 'FULL' = plan.complexity === 'HIGH' ? 'FULL' : 'TARGETED';
    const requiresArchitectureRecompute = generationMode === 'FULL' || changeClasses.some((c) => BROAD_IMPACT_TYPES.has(c));
    const requiresTeamRecompute = requiresArchitectureRecompute;
    const requiresStackReselection = generationMode === 'FULL';

    const impactScore = totalRequirements > 0 ? reusedRequirements / totalRequirements : 1;
    const reason = this.buildReason({ generationMode, changeClasses, requiresArchitectureRecompute, requiresStackReselection, impactScore });

    const row = await this.prisma.marketplaceGenerationScope.upsert({
      where: { customizationPlanId: planId },
      create: {
        id: randomUUID(), customizationPlanId: planId, solutionId: plan.solutionId, solutionVersionId: plan.solutionVersionId,
        referenceMissionId: version.referenceMissionId, derivedMissionId: plan.missionId, derivedProjectId: derivedProjectId ?? null,
        changeClassesJson: changeClasses as unknown as object, affectedSectionsJson: affectedSections as unknown as object,
        requiresStackReselection, requiresArchitectureRecompute, requiresTeamRecompute, generationMode,
        impactScore, totalRequirements, reusedRequirements, reason,
      },
      update: {
        derivedProjectId: derivedProjectId ?? null,
        changeClassesJson: changeClasses as unknown as object, affectedSectionsJson: affectedSections as unknown as object,
        requiresStackReselection, requiresArchitectureRecompute, requiresTeamRecompute, generationMode,
        impactScore, totalRequirements, reusedRequirements, reason,
      },
    });
    return this.toDto(row);
  }

  async recordOutcome(planId: string, actualReuse: GenerationReuseScope, escalations: { stage: string; reason: string }[]): Promise<void> {
    await this.prisma.marketplaceGenerationScope.update({
      where: { customizationPlanId: planId },
      data: { actualReuseJson: actualReuse as unknown as object, escalationsJson: escalations as unknown as object, completedAt: new Date() },
    });
  }

  async getByPlanId(planId: string): Promise<MarketplaceGenerationScopeDto | null> {
    const row = await this.prisma.marketplaceGenerationScope.findUnique({ where: { customizationPlanId: planId } });
    return row ? this.toDto(row) : null;
  }

  /** O `GenerationReuseScope` real que `generateTargeted` recebe — sempre tenta reaproveitar a
   * stack (o Generator revalida de verdade e cai pra recomputação sozinho se não se sustentar;
   * apps/api nunca precisa adivinhar isso). */
  toReuseScope(dto: Pick<MarketplaceGenerationScopeDto, 'requiresStackReselection' | 'requiresArchitectureRecompute' | 'requiresTeamRecompute'>): GenerationReuseScope {
    return {
      reuseStackSelection: !dto.requiresStackReselection,
      reuseArchitecture: !dto.requiresArchitectureRecompute,
      reuseTeam: !dto.requiresTeamRecompute,
    };
  }

  private buildReason(input: { generationMode: string; changeClasses: ChangeType[]; requiresArchitectureRecompute: boolean; requiresStackReselection: boolean; impactScore: number }): string {
    if (input.generationMode === 'FULL') {
      return `Impacto grande demais para reaproveitar com segurança (${Math.round((1 - input.impactScore) * 100)}% dos requisitos alterados) — arquitetura e equipe recompostas do zero.`;
    }
    if (input.changeClasses.length === 0) {
      return 'Nenhuma mudança classificada (compra "como está") — stack, arquitetura e equipe totalmente reaproveitadas.';
    }
    if (input.requiresArchitectureRecompute) {
      return `Mudanças de ${input.changeClasses.join(', ')} podem exigir capacidades técnicas novas — arquitetura e equipe recompostas; stack reaproveitada quando possível.`;
    }
    return `Mudanças de ${input.changeClasses.join(', ')} não afetam arquitetura nem equipe — stack, arquitetura e equipe reaproveitadas da solução de referência.`;
  }

  private toDto(row: {
    id: string; customizationPlanId: string; solutionId: string; referenceMissionId: string; derivedMissionId: string; derivedProjectId: string | null;
    changeClassesJson: unknown; affectedSectionsJson: unknown; requiresStackReselection: boolean; requiresArchitectureRecompute: boolean; requiresTeamRecompute: boolean;
    generationMode: string; actualReuseJson: unknown; escalationsJson: unknown; impactScore: number; totalRequirements: number; reusedRequirements: number;
    reason: string; createdAt: Date; completedAt: Date | null;
  }): MarketplaceGenerationScopeDto {
    return {
      id: row.id, customizationPlanId: row.customizationPlanId, solutionId: row.solutionId,
      referenceMissionId: row.referenceMissionId, derivedMissionId: row.derivedMissionId, derivedProjectId: row.derivedProjectId,
      changeClasses: row.changeClassesJson as ChangeType[], affectedSections: row.affectedSectionsJson as string[],
      requiresStackReselection: row.requiresStackReselection, requiresArchitectureRecompute: row.requiresArchitectureRecompute, requiresTeamRecompute: row.requiresTeamRecompute,
      generationMode: row.generationMode as 'TARGETED' | 'FULL',
      actualReuse: (row.actualReuseJson as GenerationReuseScope | null) ?? null,
      escalations: (row.escalationsJson as { stage: string; reason: string }[]) ?? [],
      impactScore: row.impactScore, totalRequirements: row.totalRequirements, reusedRequirements: row.reusedRequirements,
      reason: row.reason, createdAt: row.createdAt.toISOString(), completedAt: row.completedAt?.toISOString() ?? null,
    };
  }
}
