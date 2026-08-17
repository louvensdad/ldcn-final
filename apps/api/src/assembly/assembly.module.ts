import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module'; import { ImplementationPlanningModule } from '../implementation-planning/implementation-planning.module'; import { PersistenceModule } from '../persistence/persistence.module'; import { VirtualCompanyModule } from '../virtual-company/virtual-company.module';
import { AssemblyController } from './assembly.controller'; import { AssemblyService } from './assembly.service'; import { MissionJobService } from './mission-job.service';
@Module({ imports: [PersistenceModule, EventsModule, ImplementationPlanningModule, VirtualCompanyModule], controllers: [AssemblyController], providers: [AssemblyService, MissionJobService], exports: [AssemblyService] })
export class AssemblyModule {}
