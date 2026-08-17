import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../persistence/prisma.service';
import { ComplexityClass, ChangeType } from './marketplace-customization.service';

export interface PricingQuoteDto {
  id: string;
  customizationPlanId: string | null;
  solutionId: string;
  solutionVersionId: string;
  basePrice: number;
  customizationPrice: number;
  integrationPrice: number;
  estimatedAiCost: number;
  discount: number;
  total: number;
  currency: string;
  calculationVersion: string;
  validUntil: string;
  createdAt: string;
}

const COMPLEXITY_MULTIPLIER: Record<ComplexityClass, number> = { LOW: 0, MEDIUM: 0.2, HIGH: 0.5 };
/** Preço fixo por integração externa nova, em centavos — nunca decidido pelo LLM (seção 26). */
const INTEGRATION_UNIT_PRICE_CENTS = 5000;
const QUOTE_VALIDITY_HOURS = 24;

/**
 * MISSÃO "Marketplace de Sistemas Completos" seção 26/27 — Billing Engine determinístico. A IA
 * (Customizer AI) só classifica complexidade; este serviço nunca chama LLM, nunca inventa valor —
 * cada campo do preço vem de uma regra fixa e auditável.
 */
@Injectable()
export class MarketplaceBillingService {
  constructor(private readonly prisma: PrismaService) {}

  async quoteForPlan(planId: string): Promise<PricingQuoteDto> {
    const plan = await this.prisma.marketplaceCustomizationPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new Error('MARKETPLACE_CUSTOMIZATION_PLAN_NOT_FOUND');
    // Fase 17/22 do audit "Completar o fluxo de compra/personalização": nunca cotar (nem, por
    // extensão, comprar) enquanto o Review Council ainda tiver algo pendente — só depois de
    // approvePlan() ter travado o PromptMaster de verdade o preço deste plano é definitivo.
    if (plan.status !== 'APPROVED') throw new Error('MARKETPLACE_CUSTOMIZATION_PLAN_NOT_APPROVED');
    const version = await this.prisma.marketplaceSolutionVersion.findUnique({ where: { id: plan.solutionVersionId } });
    if (!version) throw new Error('MARKETPLACE_SOLUTION_VERSION_NOT_FOUND');
    const pricing = version.pricingSnapshotJson as unknown as { basePrice: number };

    const addItems = plan.addJson as unknown as { type: ChangeType }[];
    const integrationCount = addItems.filter((c) => c.type === 'INTEGRATION').length;

    const customizationPrice = Math.round(pricing.basePrice * COMPLEXITY_MULTIPLIER[plan.complexity as ComplexityClass]);
    const integrationPrice = integrationCount * INTEGRATION_UNIT_PRICE_CENTS;
    const estimatedAiCost = 0; // este sistema não tem um modelo de custo-por-token cobrável hoje — nunca fabricado.
    const discount = 0;
    const total = pricing.basePrice + customizationPrice + integrationPrice + estimatedAiCost - discount;

    const validUntil = new Date(Date.now() + QUOTE_VALIDITY_HOURS * 60 * 60 * 1000);
    const row = await this.prisma.marketplacePricingQuote.create({
      data: {
        id: randomUUID(), customizationPlanId: planId, solutionId: plan.solutionId, solutionVersionId: plan.solutionVersionId,
        basePrice: pricing.basePrice, customizationPrice, integrationPrice, estimatedAiCost, discount, total,
        currency: 'BRL', calculationVersion: 'v1', validUntil,
      },
    });
    return this.toDto(row);
  }

  async getQuote(quoteId: string): Promise<PricingQuoteDto> {
    const row = await this.prisma.marketplacePricingQuote.findUnique({ where: { id: quoteId } });
    if (!row) throw new Error('MARKETPLACE_PRICING_QUOTE_NOT_FOUND');
    return this.toDto(row);
  }

  private toDto(row: {
    id: string; customizationPlanId: string | null; solutionId: string; solutionVersionId: string; basePrice: number;
    customizationPrice: number; integrationPrice: number; estimatedAiCost: number; discount: number; total: number;
    currency: string; calculationVersion: string; validUntil: Date; createdAt: Date;
  }): PricingQuoteDto {
    return {
      id: row.id, customizationPlanId: row.customizationPlanId, solutionId: row.solutionId, solutionVersionId: row.solutionVersionId,
      basePrice: row.basePrice, customizationPrice: row.customizationPrice, integrationPrice: row.integrationPrice,
      estimatedAiCost: row.estimatedAiCost, discount: row.discount, total: row.total, currency: row.currency,
      calculationVersion: row.calculationVersion, validUntil: row.validUntil.toISOString(), createdAt: row.createdAt.toISOString(),
    };
  }
}
