import { Module } from '@nestjs/common';
import { PersistenceModule } from '../persistence/persistence.module';
import { EventsModule } from '../events/events.module';
import { OperationsController } from './operations.controller';
import { OperationPersistenceService } from './operation-persistence.service';

@Module({
  imports: [PersistenceModule, EventsModule],
  controllers: [OperationsController],
  providers: [OperationPersistenceService],
  exports: [OperationPersistenceService],
})
export class OperationsModule {}
