import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { GeneratorService, StartMissionInput } from './generator.service';

@Controller('missions/:missionId/intelligent-generator')
export class GeneratorController {
  constructor(private readonly generator: GeneratorService) {}

  @Post('start')
  @HttpCode(202)
  start(@Param('missionId') missionId: string, @Body() body: StartMissionInput) {
    return this.generator.start(missionId, body);
  }

  @Get()
  overview(@Param('missionId') missionId: string) {
    return this.generator.getOverview(missionId);
  }

  @Get('intent')
  intent(@Param('missionId') missionId: string) {
    return this.generator.getIntent(missionId);
  }

  @Get('requirements')
  requirements(@Param('missionId') missionId: string) {
    return this.generator.getRequirements(missionId);
  }

  @Get('topology')
  topology(@Param('missionId') missionId: string) {
    return this.generator.getTopology(missionId);
  }

  @Get('solution')
  solution(@Param('missionId') missionId: string) {
    return this.generator.getSolutionProposal(missionId);
  }

  @Get('stack-candidates')
  stackCandidates(@Param('missionId') missionId: string) {
    return this.generator.getStackCandidates(missionId);
  }

  @Get('architecture-decisions')
  architectureDecisions(@Param('missionId') missionId: string) {
    return this.generator.getArchitectureDecisions(missionId);
  }

  @Get('team')
  team(@Param('missionId') missionId: string) {
    return this.generator.getTeam(missionId);
  }

  @Get('pipeline')
  pipeline(@Param('missionId') missionId: string) {
    return this.generator.getPipeline(missionId);
  }

  @Get('learning')
  learning(@Param('missionId') missionId: string) {
    return this.generator.getLearningSignals(missionId);
  }

  @Get('events')
  events(@Param('missionId') missionId: string) {
    return this.generator.getEvents(missionId);
  }
}
