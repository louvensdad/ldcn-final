import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../persistence/prisma.service';
import { MarketplaceCustomizationService } from './marketplace-customization.service';
import { MarketplaceGenerationScopeService } from './marketplace-generation-scope.service';

/** MISSÃO "Targeted Generation" — nunca um "gerou tudo de novo" opaco: `generationMode`/
 * `impactScore`/`reusedRequirements` são o mesmo dado real que `MarketplaceGenerationScopeService`
 * calculou e persistiu, nunca um resumo inventado só para a UI. */
export interface MarketplacePurchaseGenerationDto {
  operationId: string;
  status: string;
  generationMode: 'TARGETED' | 'FULL' | null;
  impactScore: number | null;
  reusedRequirements: number | null;
  totalRequirements: number | null;
}

export interface MarketplacePurchaseDto {
  id: string;
  solutionId: string;
  solutionVersionId: string;
  customizationPlanId: string | null;
  pricingQuoteId: string;
  derivedProjectId: string | null;
  derivedMissionId: string | null;
  status: string;
  purchasedBy: string;
  createdAt: string;
  generation: MarketplacePurchaseGenerationDto;
}

/**
 * MISSÃO "Marketplace de Sistemas Completos" seção 22/28 — clonagem real + registro de compra.
 * Nunca modifica a MarketplaceSolution original (ela nunca é escrita aqui, só lida). Sem
 * processador de pagamento real integrado neste codebase — status fica "CONFIRMED" quando o
 * usuário aprova a cotação, um estado real e persistido, não uma simulação de cobrança que não
 * aconteceu de verdade (ver relatório final).
 */
@Injectable()
export class MarketplacePurchaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customization: MarketplaceCustomizationService,
    private readonly generationScope: MarketplaceGenerationScopeService
  ) {}

  async purchase(input: { customizationPlanId: string; pricingQuoteId: string }): Promise<MarketplacePurchaseDto> {
    const plan = await this.prisma.marketplaceCustomizationPlan.findUnique({ where: { id: input.customizationPlanId } });
    if (!plan) throw new Error('MARKETPLACE_CUSTOMIZATION_PLAN_NOT_FOUND');
    if (plan.status !== 'APPROVED') throw new Error('MARKETPLACE_CUSTOMIZATION_PLAN_NOT_APPROVED');

    const quote = await this.prisma.marketplacePricingQuote.findUnique({ where: { id: input.pricingQuoteId } });
    if (!quote) throw new Error('MARKETPLACE_PRICING_QUOTE_NOT_FOUND');
    if (quote.customizationPlanId !== plan.id) throw new Error('MARKETPLACE_PRICING_QUOTE_NOT_FOUND');
    if (quote.validUntil.getTime() < Date.now()) throw new Error('MARKETPLACE_PRICING_QUOTE_EXPIRED');

    const solution = await this.prisma.marketplaceSolution.findUnique({ where: { id: plan.solutionId } });
    if (!solution) throw new Error('MARKETPLACE_SOLUTION_NOT_FOUND');

    const projectId = randomUUID();
    await this.prisma.project.create({
      data: {
        id: projectId, name: `${solution.name} — ${new Date().toLocaleDateString('pt-BR')}`,
        sourceSolutionId: plan.solutionId, sourceSolutionVersionId: plan.solutionVersionId,
      },
    });

    const purchaseId = randomUUID();
    await this.prisma.marketplacePurchase.create({
      data: {
        id: purchaseId, solutionId: plan.solutionId, solutionVersionId: plan.solutionVersionId,
        customizationPlanId: plan.id, pricingQuoteId: quote.id, derivedProjectId: projectId, derivedMissionId: plan.missionId,
        status: 'CONFIRMED', purchasedBy: 'user',
      },
    });
    await this.prisma.project.update({ where: { id: projectId }, data: { purchaseId } });

    // Fase H/24: dispara a Architecture Office de verdade — mesmo GeneratorService de qualquer
    // outra missão, nunca um caminho de geração paralelo (seção 25: sem redução de padrão).
    const generation = await this.customization.deriveProjectAndGenerate(plan.id, projectId);

    const row = await this.prisma.marketplacePurchase.findUniqueOrThrow({ where: { id: purchaseId } });
    return {
      id: row.id, solutionId: row.solutionId, solutionVersionId: row.solutionVersionId,
      customizationPlanId: row.customizationPlanId, pricingQuoteId: row.pricingQuoteId,
      derivedProjectId: row.derivedProjectId, derivedMissionId: row.derivedMissionId,
      status: row.status, purchasedBy: row.purchasedBy, createdAt: row.createdAt.toISOString(),
      generation,
    };
  }

  async getPurchase(purchaseId: string): Promise<MarketplacePurchaseDto | null> {
    const row = await this.prisma.marketplacePurchase.findUnique({ where: { id: purchaseId } });
    if (!row) return null;
    const scope = row.customizationPlanId ? await this.generationScope.getByPlanId(row.customizationPlanId) : null;
    return {
      id: row.id, solutionId: row.solutionId, solutionVersionId: row.solutionVersionId,
      customizationPlanId: row.customizationPlanId, pricingQuoteId: row.pricingQuoteId,
      derivedProjectId: row.derivedProjectId, derivedMissionId: row.derivedMissionId,
      status: row.status, purchasedBy: row.purchasedBy, createdAt: row.createdAt.toISOString(),
      generation: {
        operationId: '', status: row.status,
        generationMode: scope?.generationMode ?? null, impactScore: scope?.impactScore ?? null,
        reusedRequirements: scope?.reusedRequirements ?? null, totalRequirements: scope?.totalRequirements ?? null,
      },
    };
  }
}
