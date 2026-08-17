import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ProjectPersistenceService } from './project-persistence.service';

export interface CreateProjectInput {
  name: string;
}

export interface AssignMissionInput {
  missionId: string;
}

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectPersistenceService) {}

  @Post()
  create(@Body() body: CreateProjectInput) {
    return this.projects.create(body.name);
  }

  @Get()
  list() {
    return this.projects.list();
  }

  @Get(':projectId')
  get(@Param('projectId') projectId: string) {
    return this.projects.get(projectId);
  }

  @Post(':projectId/missions')
  assignMission(@Param('projectId') projectId: string, @Body() body: AssignMissionInput) {
    return this.projects.assignMission(projectId, body.missionId);
  }

  @Delete(':projectId/missions/:missionId')
  unassignMission(@Param('projectId') projectId: string, @Param('missionId') missionId: string) {
    return this.projects.unassignMission(projectId, missionId);
  }
}
