import { Module } from '@nestjs/common';
import { PersistenceModule } from '../persistence/persistence.module';
import { EventBusService } from './event-bus.service';
import { EventLogService } from './event-log.service';
import { EventsController } from './events.controller';

@Module({
  imports: [PersistenceModule],
  controllers: [EventsController],
  providers: [EventBusService, EventLogService],
  exports: [EventBusService, EventLogService],
})
export class EventsModule {}
