import { Module } from '@nestjs/common';
import { PersistenceModule } from '../persistence/persistence.module';
import { AssistantModule } from '../assistant/assistant.module';
import { ArchitectureReviewController } from './architecture-review.controller';
import { ArchitectureReviewService } from './architecture-review.service';
import { EventsModule } from '../events/events.module';
import { LedgerModule } from '../ledger/ledger.module';

@Module({
  imports: [PersistenceModule, AssistantModule, EventsModule, LedgerModule],
  controllers: [ArchitectureReviewController],
  providers: [ArchitectureReviewService],
  exports: [ArchitectureReviewService],
})
export class ArchitectureReviewModule {}
