import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { MarketplaceReviewService } from './marketplace-review.service';
import { ReviewerKey } from '../review/review-council.service';

export interface ResolveMarketplaceFindingInput {
  resolutionNote?: string;
}

export interface DecideMarketplaceFindingInput {
  chosenOption: string;
}

export interface DelegateMarketplaceFindingInput {
  instruction?: string;
}

/**
 * MISSÃO "Completar o fluxo de compra/personalização do Marketplace" — Fase 8: rotas próprias do
 * Marketplace (nunca o controller do Discovery copiado), reaproveitando MarketplaceReviewService
 * (que por sua vez reaproveita ReviewFindingService/ReviewCouncilService/PromptMasterEditingService
 * — o mesmo motor real). Escopadas por customization-plan, não por missionId de conversa.
 */
@Controller('marketplace/customization-plans/:planId')
export class MarketplaceReviewController {
  constructor(private readonly review: MarketplaceReviewService) {}

  @Get('review')
  getSession(@Param('planId') planId: string) {
    return this.review.getSession(planId);
  }

  @Get('findings')
  getFindings(@Param('planId') planId: string) {
    return this.review.getSession(planId).then((s) => s.findings);
  }

  @Post('findings/:findingId/resolve')
  resolveFinding(@Param('planId') planId: string, @Param('findingId') findingId: string, @Body() body: ResolveMarketplaceFindingInput) {
    return this.review.resolveFinding(planId, findingId, body.resolutionNote);
  }

  @Post('findings/:findingId/decide')
  decideFinding(@Param('planId') planId: string, @Param('findingId') findingId: string, @Body() body: DecideMarketplaceFindingInput) {
    return this.review.decideFinding(planId, findingId, body.chosenOption);
  }

  @Post('findings/:findingId/delegate-to-ai')
  delegateToAi(@Param('planId') planId: string, @Param('findingId') findingId: string, @Body() body: DelegateMarketplaceFindingInput) {
    return this.review.delegateToAi(planId, findingId, body.instruction);
  }

  @Post('review/:reviewerKey/retry')
  retryReviewer(@Param('planId') planId: string, @Param('reviewerKey') reviewerKey: string) {
    return this.review.retryReviewer(planId, reviewerKey as ReviewerKey);
  }

  @Post('review/resume')
  resumeReview(@Param('planId') planId: string) {
    return this.review.runCycle(planId);
  }
}
