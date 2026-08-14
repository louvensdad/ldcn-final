import { Controller, Get, Param } from '@nestjs/common';
import { RoutingPersistenceService } from './routing-persistence.service';

/** F5 - Task board. Separate from RoutingController (which is scoped under .../tasks/:taskId/intelligent-routing and has no route without a taskId). */
@Controller('missions/:missionId/tasks')
export class TasksController {
  constructor(private readonly routing: RoutingPersistenceService) {}

  @Get()
  list(@Param('missionId') missionId: string) {
    return this.routing.listTasks(missionId);
  }
}
