import { Module } from '@nestjs/common';
import { PersistenceModule } from '../persistence/persistence.module';
import { GateController } from './gate.controller';
import { GatePersistenceService } from './gate-persistence.service';

@Module({
  imports: [PersistenceModule],
  controllers: [GateController],
  providers: [GatePersistenceService],
})
export class GateModule {}
