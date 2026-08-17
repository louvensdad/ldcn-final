import { Module } from '@nestjs/common';
import { PersistenceModule } from '../persistence/persistence.module';
import { ReviewModule } from '../review/review.module';
import { AssistantModule } from '../assistant/assistant.module';
import { GeneratorModule } from '../generator/generator.module';
import { LedgerModule } from '../ledger/ledger.module';
import { MarketplaceSolutionService } from './marketplace-solution.service';
import { MarketplaceSolutionController } from './marketplace-solution.controller';
import { MarketplaceCustomizationService } from './marketplace-customization.service';
import { MarketplaceReviewService } from './marketplace-review.service';
import { MarketplaceSolutionRevalidationService } from './marketplace-solution-revalidation.service';
import { MarketplaceGenerationScopeService } from './marketplace-generation-scope.service';
import { MarketplaceBillingService } from './marketplace-billing.service';
import { MarketplacePurchaseService } from './marketplace-purchase.service';
import { MarketplaceCustomizationController } from './marketplace-customization.controller';
import { MarketplaceReviewController } from './marketplace-review.controller';

@Module({
  imports: [PersistenceModule, ReviewModule, AssistantModule, GeneratorModule, LedgerModule],
  controllers: [MarketplaceSolutionController, MarketplaceCustomizationController, MarketplaceReviewController],
  providers: [
    MarketplaceSolutionService, MarketplaceCustomizationService, MarketplaceReviewService,
    MarketplaceSolutionRevalidationService, MarketplaceGenerationScopeService, MarketplaceBillingService, MarketplacePurchaseService,
  ],
  exports: [
    MarketplaceSolutionService, MarketplaceCustomizationService, MarketplaceReviewService,
    MarketplaceSolutionRevalidationService, MarketplaceGenerationScopeService, MarketplaceBillingService, MarketplacePurchaseService,
  ],
})
export class MarketplaceModule {}
