import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { EvaluateGatesInput, GatePersistenceService } from './gate-persistence.service';

/** Same URL convention as RoutingController/RepairController (missions/:missionId/tasks/:taskId/...). */
@Controller('missions/:missionId/tasks/:taskId/gates')
export class GateController {
  constructor(private readonly gates: GatePersistenceService) {}

  @Post('evaluate')
  evaluate(@Param('missionId') missionId: string, @Param('taskId') taskId: string, @Body() body: EvaluateGatesInput) {
    return this.gates.evaluate(missionId, taskId, body);
  }

  @Get()
  overview(@Param('missionId') missionId: string, @Param('taskId') taskId: string) {
    return this.gates.getOverview(missionId, taskId);
  }
}
