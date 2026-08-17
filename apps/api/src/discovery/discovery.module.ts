import { Module } from '@nestjs/common';
import { PersistenceModule } from '../persistence/persistence.module';
import { GeneratorModule } from '../generator/generator.module';
import { AssistantModule } from '../assistant/assistant.module';
import { ReviewModule } from '../review/review.module';
import { ArchitectureReviewModule } from '../architecture-review/architecture-review.module';
import { LedgerModule } from '../ledger/ledger.module';
import { DiscoveryController } from './discovery.controller';
import { DiscoveryService } from './discovery.service';

@Module({
  imports: [PersistenceModule, GeneratorModule, AssistantModule, ReviewModule, ArchitectureReviewModule, LedgerModule],
  controllers: [DiscoveryController],
  providers: [DiscoveryService],
  exports: [DiscoveryService],
})
export class DiscoveryModule {}
