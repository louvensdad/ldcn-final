import { Module } from '@nestjs/common';
import { PersistenceModule } from '../persistence/persistence.module';
import { EventsModule } from '../events/events.module';
import { LlmInvocationLedgerService } from './llm-invocation-ledger.service';

@Module({
  imports: [PersistenceModule, EventsModule],
  providers: [LlmInvocationLedgerService],
  exports: [LlmInvocationLedgerService],
})
export class LedgerModule {}
