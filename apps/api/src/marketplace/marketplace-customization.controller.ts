import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { MarketplaceCustomizationService } from './marketplace-customization.service';
import { MarketplaceBillingService } from './marketplace-billing.service';
import { MarketplacePurchaseService } from './marketplace-purchase.service';
import { MarketplaceGenerationScopeService } from './marketplace-generation-scope.service';

export interface CreatePlanInput {
  rawBusinessDescription?: string;
  asIs?: boolean;
}

export interface PurchaseInput {
  pricingQuoteId: string;
}

@Controller('marketplace')
export class MarketplaceCustomizationController {
  constructor(
    private readonly customization: MarketplaceCustomizationService,
    private readonly billing: MarketplaceBillingService,
    private readonly purchases: MarketplacePurchaseService,
    private readonly generationScope: MarketplaceGenerationScopeService
  ) {}

  @Post('solutions/:slug/customization-plans')
  createPlan(@Param('slug') slug: string, @Body() body: CreatePlanInput) {
    return this.customization.createCustomizationPlan({ solutionSlug: slug, ...body });
  }

  @Get('customization-plans/:planId')
  getPlan(@Param('planId') planId: string) {
    return this.customization.getPlan(planId);
  }

  @Post('customization-plans/:planId/approve')
  approvePlan(@Param('planId') planId: string) {
    return this.customization.approvePlan(planId);
  }

  @Post('customization-plans/:planId/quote')
  quote(@Param('planId') planId: string) {
    return this.billing.quoteForPlan(planId);
  }

  @Get('pricing-quotes/:quoteId')
  getQuote(@Param('quoteId') quoteId: string) {
    return this.billing.getQuote(quoteId);
  }

  @Post('customization-plans/:planId/purchase')
  purchase(@Param('planId') planId: string, @Body() body: PurchaseInput) {
    return this.purchases.purchase({ customizationPlanId: planId, pricingQuoteId: body.pricingQuoteId });
  }

  @Get('purchases/:purchaseId')
  getPurchase(@Param('purchaseId') purchaseId: string) {
    return this.purchases.getPurchase(purchaseId);
  }

  /** Fase 30 do brief "Targeted Generation" — Provenance UI: de onde a mission derivada veio e o
   * que foi realmente reaproveitado (nunca um resumo inventado — o mesmo dado real persistido por
   * MarketplaceGenerationScopeService). */
  @Get('customization-plans/:planId/generation-scope')
  getGenerationScope(@Param('planId') planId: string) {
    return this.generationScope.getByPlanId(planId);
  }
}
