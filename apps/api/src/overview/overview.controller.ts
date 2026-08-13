import { Controller, Get, Param } from '@nestjs/common';
import { OverviewService } from './overview.service';

/** doc 42 §1: top-level path, not nested under intelligent-generator. */
@Controller('missions/:missionId/overview')
export class OverviewController {
  constructor(private readonly overview: OverviewService) {}

  @Get()
  get(@Param('missionId') missionId: string) {
    return this.overview.getOverview(missionId);
  }
}
