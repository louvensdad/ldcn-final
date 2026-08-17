import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { SolutionPlanningService } from './solution-planning.service';

@Controller('missions/:missionId/solution-planning')
export class SolutionPlanningController {
  constructor(private readonly planning: SolutionPlanningService) {}

  @Post('start')
  start(@Param('missionId') missionId: string, @Body() body: { requirementBaselineId: string }) {
    return this.planning.planAndApprove(missionId, body.requirementBaselineId);
  }

  @Get('active')
  active(@Param('missionId') missionId: string) {
    return this.planning.getActive(missionId);
  }

  @Get(':approvedSolutionId')
  get(@Param('missionId') missionId: string, @Param('approvedSolutionId') approvedSolutionId: string) {
    return this.planning.getById(missionId, approvedSolutionId);
  }
}
