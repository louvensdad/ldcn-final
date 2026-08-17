import { Module } from '@nestjs/common';
import { AssistantModule } from '../assistant/assistant.module'; import { CatalogModule } from '../catalog/catalog.module'; import { EventsModule } from '../events/events.module'; import { LedgerModule } from '../ledger/ledger.module'; import { PersistenceModule } from '../persistence/persistence.module'; import { PromptMasterModule } from '../promptmaster/promptmaster.module'; import { RequirementsModule } from '../requirements/requirements.module';
import { ImplementationPlanningService } from './implementation-planning.service';
@Module({ imports: [PersistenceModule, AssistantModule, CatalogModule, EventsModule, LedgerModule, PromptMasterModule, RequirementsModule], providers: [ImplementationPlanningService], exports: [ImplementationPlanningService] })
export class ImplementationPlanningModule {}
