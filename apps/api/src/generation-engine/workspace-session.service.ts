import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma, WorkspaceSession } from '@prisma/client';
import { PrismaService } from '../persistence/prisma.service';
import { WorkspaceCandidateChange, WorkspaceService } from './workspace.service';

@Injectable()
export class WorkspaceSessionService {
  constructor(private readonly prisma: PrismaService, private readonly workspace: WorkspaceService) {}

  async createOrReuse(input: {
    missionId: string;
    generationJobId: string;
    agentExecutionId?: string;
    changeSetHash: string;
    scopeHash: string;
    inspectionHash: string;
    repositoryFingerprint: string;
    forceNew?: boolean;
  }): Promise<{ session: WorkspaceSession; reused: boolean }> {
    const currentBaseline = await this.workspace.fingerprintCanonical(input.missionId);
    const existing = input.forceNew ? null : await this.prisma.workspaceSession.findFirst({
      where: {
        generationJobId: input.generationJobId,
        changeSetHash: input.changeSetHash,
        baselineFingerprint: currentBaseline,
        status: 'VALIDATED',
      },
      orderBy: { completedAt: 'desc' },
    });
    if (existing && await this.workspace.pathExists(existing.rootRef)) return { session: existing, reused: true };

    const id = randomUUID();
    const isolated = await this.workspace.createIsolatedSession(input.missionId, id);
    let session: WorkspaceSession;
    try {
      session = await this.prisma.workspaceSession.create({
        data: {
          id,
          missionId: input.missionId,
          generationJobId: input.generationJobId,
          agentExecutionId: input.agentExecutionId ?? null,
          status: 'CREATED',
          rootRef: isolated.rootRef,
          changeSetHash: input.changeSetHash,
          scopeHash: input.scopeHash,
          inspectionHash: input.inspectionHash,
          repositoryFingerprint: input.repositoryFingerprint,
          baselineFingerprint: isolated.baselineFingerprint,
        },
      });
    } catch (error) {
      await this.workspace.discardSession(isolated.rootRef);
      throw error;
    }
    return { session, reused: false };
  }

  async materialize(session: WorkspaceSession, changes: WorkspaceCandidateChange[]): Promise<WorkspaceSession> {
    if (session.status !== 'CREATED') throw new Error('WORKSPACE_SESSION_STATE_INVALID');
    const manifest = await this.workspace.applyCandidateChangeSet(session.rootRef, changes);
    await this.prisma.workspaceCandidateManifest.create({
      data: {
        id: randomUUID(),
        workspaceSessionId: session.id,
        missionId: session.missionId,
        generationJobId: session.generationJobId,
        changeSetHash: session.changeSetHash,
        filesJson: manifest.files as unknown as Prisma.InputJsonValue,
        manifestHash: manifest.manifestHash,
      },
    });
    return this.prisma.workspaceSession.update({
      where: { id: session.id },
      data: {
        status: 'MATERIALIZED',
        candidateFingerprint: manifest.candidateFingerprint,
        manifestHash: manifest.manifestHash,
        lastHeartbeatAt: new Date(),
      },
    });
  }

  async transition(id: string, status: string, completed = false): Promise<WorkspaceSession> {
    return this.prisma.workspaceSession.update({
      where: { id },
      data: { status, lastHeartbeatAt: new Date(), completedAt: completed ? new Date() : undefined },
    });
  }

  async discard(session: WorkspaceSession): Promise<void> {
    await this.workspace.discardSession(session.rootRef);
    await this.prisma.workspaceSession.update({ where: { id: session.id }, data: { discardedAt: new Date() } });
  }

  async detectStaleWorkspaceSessions(staleAfterMs = 10 * 60_000): Promise<WorkspaceSession[]> {
    return this.prisma.workspaceSession.findMany({
      where: {
        status: { in: ['BUILDING', 'TESTING'] },
        lastHeartbeatAt: { lt: new Date(Date.now() - staleAfterMs) },
      },
      orderBy: { lastHeartbeatAt: 'asc' },
    });
  }
}
