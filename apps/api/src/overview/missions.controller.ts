import { Controller, Get, Query } from '@nestjs/common';
import { OverviewService } from './overview.service';

/** F1 - Workspace: enumerate missions. Separate from OverviewController (which is scoped under /missions/:missionId/overview and has no route without an id). */
@Controller('missions')
export class MissionsController {
  constructor(private readonly overview: OverviewService) {}

  @Get()
  list(@Query('limit') limit?: string) {
    const parsed = limit ? Number(limit) : undefined;
    return this.overview.listMissions(parsed && Number.isFinite(parsed) ? parsed : undefined);
  }
}
