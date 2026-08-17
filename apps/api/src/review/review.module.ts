import { Module } from '@nestjs/common';
import { PersistenceModule } from '../persistence/persistence.module';
import { AssistantModule } from '../assistant/assistant.module';
import { LedgerModule } from '../ledger/ledger.module';
import { ReviewFindingService } from './review-finding.service';
import { ReviewCouncilService } from './review-council.service';
import { PromptMasterDecisionPolicy } from './decision-policy.service';
import { PromptMasterEditingService } from './prompt-master-editing.service';

@Module({
  imports: [PersistenceModule, AssistantModule, LedgerModule],
  providers: [ReviewFindingService, ReviewCouncilService, PromptMasterDecisionPolicy, PromptMasterEditingService],
  exports: [ReviewFindingService, ReviewCouncilService, PromptMasterDecisionPolicy, PromptMasterEditingService],
})
export class ReviewModule {}
