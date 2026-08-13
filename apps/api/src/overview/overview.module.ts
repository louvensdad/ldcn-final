import { Module } from '@nestjs/common';
import { PersistenceModule } from '../persistence/persistence.module';
import { OperationsModule } from '../operations/operations.module';
import { OverviewController } from './overview.controller';
import { OverviewService } from './overview.service';

@Module({
  imports: [PersistenceModule, OperationsModule],
  controllers: [OverviewController],
  providers: [OverviewService],
})
export class OverviewModule {}
