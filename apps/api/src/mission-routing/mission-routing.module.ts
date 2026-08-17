import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module'; import { PersistenceModule } from '../persistence/persistence.module';
import { MissionJobRoutingController } from './mission-job-routing.controller'; import { MissionJobRouterService } from './mission-job-router.service';
@Module({ imports: [PersistenceModule, EventsModule], controllers: [MissionJobRoutingController], providers: [MissionJobRouterService], exports: [MissionJobRouterService] })
export class MissionRoutingModule {}
