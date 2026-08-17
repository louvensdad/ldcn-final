import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { PersistenceModule } from '../persistence/persistence.module';
import { VirtualCompanyController } from './virtual-company.controller';
import { VirtualCompanyService } from './virtual-company.service';

@Module({
  imports: [PersistenceModule, EventsModule],
  controllers: [VirtualCompanyController],
  providers: [VirtualCompanyService],
  exports: [VirtualCompanyService],
})
export class VirtualCompanyModule {}
