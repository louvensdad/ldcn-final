import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ArchitecturePlanningService } from './architecture-planning.service';
@Controller('missions/:missionId/architecture')
export class ArchitecturePlanningController {
  constructor(private readonly planning: ArchitecturePlanningService) {}
  @Post('start') start(@Param('missionId') missionId:string,@Body() body:{approvedSolutionId:string}){return this.planning.start(missionId,body.approvedSolutionId);}
  @Get('active') active(@Param('missionId') missionId:string){return this.planning.getActive(missionId);}
}
