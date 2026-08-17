import { Module } from '@nestjs/common';
import { PersistenceModule } from '../persistence/persistence.module';
import { AssistantModule } from '../assistant/assistant.module';
import { LedgerModule } from '../ledger/ledger.module';
import { EventsModule } from '../events/events.module';
import { RequirementKeyService } from './requirement-key.service';
import { RequirementExtractionService } from './requirement-extraction.service';
import { RequirementBaselineService } from './requirement-baseline.service';
import { ScopeCoverageService } from './scope-coverage.service';
import { RequirementsController } from './requirements.controller';

@Module({
  imports: [PersistenceModule, AssistantModule, LedgerModule, EventsModule],
  controllers: [RequirementsController],
  providers: [RequirementKeyService, RequirementExtractionService, RequirementBaselineService, ScopeCoverageService],
  exports: [RequirementKeyService, RequirementExtractionService, RequirementBaselineService, ScopeCoverageService],
})
export class RequirementsModule {}
