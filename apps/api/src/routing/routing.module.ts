import { Module } from '@nestjs/common';
import { PersistenceModule } from '../persistence/persistence.module';
import { RoutingController } from './routing.controller';
import { RoutingPersistenceService } from './routing-persistence.service';

@Module({
  imports: [PersistenceModule],
  controllers: [RoutingController],
  providers: [RoutingPersistenceService],
})
export class RoutingModule {}
