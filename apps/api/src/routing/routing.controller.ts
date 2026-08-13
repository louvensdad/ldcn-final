import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ClassifyInput, RoutingPersistenceService, SwitchTeamInput } from './routing-persistence.service';

/**
 * Adapts doc 23's `/tasks/:id/intelligent-routing/*` paths to include missionId explicitly:
 * every core call (classify/route/switch-team) requires both ids, and nothing in this system
 * is queryable by taskId alone without already knowing its mission.
 */
@Controller('missions/:missionId/tasks/:taskId/intelligent-routing')
export class RoutingController {
  constructor(private readonly routing: RoutingPersistenceService) {}

  @Post('classify')
  classify(@Param('missionId') missionId: string, @Param('taskId') taskId: string, @Body() body: ClassifyInput) {
    return this.routing.classify(missionId, taskId, body);
  }

  @Post('route')
  route(@Param('missionId') missionId: string, @Param('taskId') taskId: string) {
    return this.routing.route(missionId, taskId);
  }

  @Post('switch-team')
  switchTeam(@Param('missionId') missionId: string, @Param('taskId') taskId: string, @Body() body: SwitchTeamInput) {
    return this.routing.switchTeam(missionId, taskId, body);
  }

  @Get()
  overview(@Param('missionId') missionId: string, @Param('taskId') taskId: string) {
    return this.routing.getOverview(missionId, taskId);
  }

  @Get('handoffs')
  handoffs(@Param('missionId') missionId: string, @Param('taskId') taskId: string) {
    return this.routing.getHandoffs(missionId, taskId);
  }
}
