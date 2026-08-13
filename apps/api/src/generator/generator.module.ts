import { Module } from '@nestjs/common';
import { PersistenceModule } from '../persistence/persistence.module';
import { OperationsModule } from '../operations/operations.module';
import { EventsModule } from '../events/events.module';
import { GeneratorController } from './generator.controller';
import { GeneratorService } from './generator.service';

@Module({
  imports: [PersistenceModule, OperationsModule, EventsModule],
  controllers: [GeneratorController],
  providers: [GeneratorService],
  exports: [GeneratorService],
})
export class GeneratorModule {}
