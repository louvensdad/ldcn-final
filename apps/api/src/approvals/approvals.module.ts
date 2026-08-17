import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { PersistenceModule } from '../persistence/persistence.module';
import { ApprovalsController } from './approvals.controller';
import { HumanApprovalService } from './human-approval.service';
@Module({ imports: [PersistenceModule, EventsModule], controllers: [ApprovalsController], providers: [HumanApprovalService], exports: [HumanApprovalService] })
export class ApprovalsModule {}
