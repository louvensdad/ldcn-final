import { Module } from '@nestjs/common';
import { PersistenceModule } from '../persistence/persistence.module';
import { CatalogModule } from '../catalog/catalog.module';
import { PromptMasterModule } from '../promptmaster/promptmaster.module';
import { LedgerModule } from '../ledger/ledger.module';
import { AssistantModule } from '../assistant/assistant.module';
import { EventsModule } from '../events/events.module';
import { AgentExecutionService } from '../generation-engine/agent-execution.service';
import { AgentRuntimeService } from './agent-runtime.service';

@Module({
  imports: [PersistenceModule, CatalogModule, PromptMasterModule, LedgerModule, AssistantModule, EventsModule],
  providers: [AgentExecutionService, AgentRuntimeService],
  exports: [AgentRuntimeService, AgentExecutionService],
})
export class AgentRuntimeModule {}
