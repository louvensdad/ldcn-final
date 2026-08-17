import { Module } from '@nestjs/common';
import { AssistantModule } from '../assistant/assistant.module';
import { CatalogModule } from '../catalog/catalog.module';
import { EventsModule } from '../events/events.module';
import { LedgerModule } from '../ledger/ledger.module';
import { PersistenceModule } from '../persistence/persistence.module';
import { PromptMasterModule } from '../promptmaster/promptmaster.module';
import { RequirementsModule } from '../requirements/requirements.module';
import { SolutionPlanningController } from './solution-planning.controller';
import { SolutionPlanningService } from './solution-planning.service';
import { StackCatalogService } from './stack-catalog.service';

@Module({
  imports: [PersistenceModule, AssistantModule, CatalogModule, PromptMasterModule, LedgerModule, EventsModule, RequirementsModule],
  controllers: [SolutionPlanningController],
  providers: [SolutionPlanningService, StackCatalogService],
  exports: [SolutionPlanningService, StackCatalogService],
})
export class SolutionPlanningModule {}
