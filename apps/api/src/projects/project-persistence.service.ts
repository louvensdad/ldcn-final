import { randomUUID } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../persistence/prisma.service';

export interface ProjectDto {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  missionIds: string[];
}

/**
 * Redesign Fase D: Project is a lightweight grouping the Platform API owns directly — it never
 * touches core/'s event-sourced mission state (see infra/prisma/schema.prisma comment on
 * Project/ProjectMission). Plain Prisma CRUD, no idempotency/versioning needed.
 */
@Injectable()
export class ProjectPersistenceService {
  constructor(private readonly prisma: PrismaService) {}

  async create(name: string): Promise<ProjectDto> {
    const project = await this.prisma.project.create({ data: { id: randomUUID(), name } });
    return { ...project, missionIds: [] };
  }

  async list(): Promise<ProjectDto[]> {
    const [projects, links] = await Promise.all([
      this.prisma.project.findMany({ orderBy: { updatedAt: 'desc' } }),
      this.prisma.projectMission.findMany(),
    ]);
    const byProject = new Map<string, string[]>();
    for (const link of links) byProject.set(link.projectId, [...(byProject.get(link.projectId) ?? []), link.missionId]);
    return projects.map((project) => ({ ...project, missionIds: byProject.get(project.id) ?? [] }));
  }

  async get(projectId: string): Promise<ProjectDto> {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('PROJECT_NOT_FOUND');
    const links = await this.prisma.projectMission.findMany({ where: { projectId } });
    return { ...project, missionIds: links.map((link) => link.missionId) };
  }

  /** A mission belongs to at most one project — assigning to a new one silently moves it. */
  async assignMission(projectId: string, missionId: string): Promise<ProjectDto> {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('PROJECT_NOT_FOUND');
    await this.prisma.projectMission.upsert({
      where: { missionId },
      create: { missionId, projectId },
      update: { projectId },
    });
    await this.prisma.project.update({ where: { id: projectId }, data: {} });
    return this.get(projectId);
  }

  async unassignMission(projectId: string, missionId: string): Promise<void> {
    await this.prisma.projectMission.deleteMany({ where: { missionId, projectId } });
  }
}
