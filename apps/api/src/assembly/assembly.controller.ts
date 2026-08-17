import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AssemblyService } from './assembly.service';
@Controller('missions/:missionId/assembly')
export class AssemblyController {
  constructor(private readonly assembly: AssemblyService) {}
  @Post('start') start(@Param('missionId') missionId: string, @Body() body: { architectureCompositionId: string }) { return this.assembly.start(missionId, body.architectureCompositionId); }
  @Get('active') active(@Param('missionId') missionId: string) { return this.assembly.getActive(missionId); }
}
