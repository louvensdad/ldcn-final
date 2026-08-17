import { Controller, Get, Param, Post } from '@nestjs/common';
import { MissionJobRouterService } from './mission-job-router.service';
@Controller('missions/:missionId/jobs')
export class MissionJobRoutingController {
  constructor(private readonly router: MissionJobRouterService) {}
  @Post('route-ready') routeReady(@Param('missionId') missionId: string) { return this.router.routeReady(missionId); }
  @Post(':jobId/route') route(@Param('missionId') missionId: string, @Param('jobId') jobId: string) { return this.router.route(missionId, jobId); }
  @Get(':jobId/routing') get(@Param('missionId') missionId: string, @Param('jobId') jobId: string) { return this.router.get(missionId, jobId); }
}
