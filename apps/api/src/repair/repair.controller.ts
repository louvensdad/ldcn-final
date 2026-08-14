import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AssessEligibilityInput, ClassifyFailureInput, RepairPersistenceService } from './repair-persistence.service';

/** Same URL convention as RoutingController (missions/:missionId/tasks/:taskId/...). */
@Controller('missions/:missionId/tasks/:taskId/repair')
export class RepairController {
  constructor(private readonly repair: RepairPersistenceService) {}

  @Post('classify')
  classify(@Param('missionId') missionId: string, @Param('taskId') taskId: string, @Body() body: ClassifyFailureInput) {
    return this.repair.classifyAndAdvise(missionId, taskId, body);
  }

  @Post('eligibility')
  eligibility(@Param('missionId') missionId: string, @Param('taskId') taskId: string, @Body() body: AssessEligibilityInput) {
    return this.repair.assessEligibility(missionId, taskId, body);
  }

  @Get()
  overview(@Param('missionId') missionId: string, @Param('taskId') taskId: string) {
    return this.repair.getOverview(missionId, taskId);
  }
}
