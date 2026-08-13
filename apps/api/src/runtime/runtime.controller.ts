import { Controller, Get, Param, Query } from '@nestjs/common';
import { RuntimeApiController } from 'ldcn-core';
import { GeneratorService } from '../generator/generator.service';

/** Thin HTTP wrapper over core's framework-neutral RuntimeApiController (operational overview/repair/events read models). */
@Controller('missions/:missionId/operations')
export class RuntimeController {
  constructor(private readonly generator: GeneratorService) {}

  @Get()
  async getMission(@Param('missionId') missionId: string) {
    const queries = await this.generator.queries(missionId);
    return new RuntimeApiController(queries).getMission({ missionId });
  }

  @Get('tasks/:taskId')
  async getTask(@Param('missionId') missionId: string, @Param('taskId') taskId: string) {
    const queries = await this.generator.queries(missionId);
    return new RuntimeApiController(queries).getTask({ missionId, taskId });
  }

  @Get('events')
  async getEvents(@Param('missionId') missionId: string, @Query('taskId') taskId?: string) {
    const queries = await this.generator.queries(missionId);
    return new RuntimeApiController(queries).getEvents({ missionId, taskId });
  }
}
