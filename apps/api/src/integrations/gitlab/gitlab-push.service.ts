import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../persistence/prisma.service';
import { WorkspaceService } from '../../generation-engine/workspace.service';
import { ProcessRunnerService } from '../../generation-engine/process-runner.service';
import { GitlabCredentialService } from './gitlab-credential.service';

const GITLAB_API = 'https://gitlab.com/api/v4';

export interface GitlabPushDto {
  missionId: string;
  status: 'PENDING' | 'PUSHED' | 'FAILED';
  repoName: string | null;
  repoUrl: string | null;
  errorCode: string | null;
  logsExcerpt: string | null;
}

/**
 * MISSÃO "GitLab real (push de verdade)" — mesmo padrão real do GithubPushService: cria o
 * projeto de verdade via API do GitLab e empurra com `git` real através do mesmo
 * ProcessRunnerService já usado para build/test/runtime. Mesmos gates reais de entrega
 * (deliveryEligible + securityPassed) — nunca envia código que não passou neles.
 */
@Injectable()
export class GitlabPushService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspace: WorkspaceService,
    private readonly runner: ProcessRunnerService,
    private readonly credentials: GitlabCredentialService
  ) {}

  async getStatus(missionId: string): Promise<GitlabPushDto | null> {
    const row = await this.prisma.gitlabPush.findUnique({ where: { missionId } });
    return row ? this.toDto(row) : null;
  }

  async push(missionId: string, repoName: string, isPrivate: boolean): Promise<GitlabPushDto> {
    const run = await this.prisma.missionGenerationRun.findUnique({ where: { missionId } });
    if (!run || run.status !== 'READY' || !run.downloadPath) throw new Error('GENERATION_NOT_READY');
    if (!run.deliveryEligible) throw new Error('DELIVERY_NOT_ELIGIBLE');
    if (!run.securityPassed) throw new Error('SECURITY_GATE_FAILED');

    const { token, username } = await this.credentials.getDecryptedToken();
    const workspacePath = this.workspace.workspacePathFor(missionId);

    await this.prisma.gitlabPush.upsert({
      where: { missionId },
      create: { id: randomUUID(), missionId, status: 'PENDING', repoName },
      update: { status: 'PENDING', repoName, errorCode: null, repoUrl: null, logsExcerpt: null },
    });

    try {
      const repoUrl = await this.createRepo(token, repoName, isPrivate);
      const logs = await this.pushWorkspace(workspacePath, token, username, repoName);
      const updated = await this.prisma.gitlabPush.update({
        where: { missionId },
        data: { status: 'PUSHED', repoUrl, logsExcerpt: this.scrubToken(logs, token) },
      });
      return this.toDto(updated);
    } catch (err) {
      const errorCode = err instanceof Error ? err.message : 'GITLAB_PUSH_FAILED';
      const updated = await this.prisma.gitlabPush.update({
        where: { missionId },
        data: { status: 'FAILED', errorCode, logsExcerpt: this.scrubToken(err instanceof Error ? err.message : '', token) },
      });
      return this.toDto(updated);
    }
  }

  private async createRepo(token: string, repoName: string, isPrivate: boolean): Promise<string> {
    let response: Response;
    try {
      response = await fetch(`${GITLAB_API}/projects`, {
        method: 'POST',
        headers: { 'PRIVATE-TOKEN': token, 'User-Agent': 'ldcn-os', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: repoName, visibility: isPrivate ? 'private' : 'public', initialize_with_readme: false }),
      });
    } catch {
      throw new Error('GITLAB_UNAVAILABLE');
    }
    if (response.status === 400) throw new Error('GITLAB_REPO_NAME_TAKEN');
    if (!response.ok) throw new Error('GITLAB_REPO_CREATE_FAILED');
    const body = (await response.json()) as { web_url?: string };
    if (!body.web_url) throw new Error('GITLAB_REPO_CREATE_FAILED');
    return body.web_url;
  }

  private async pushWorkspace(workspacePath: string, token: string, username: string, repoName: string): Promise<string> {
    const remoteUrl = `https://oauth2:${token}@gitlab.com/${username}/${repoName}.git`;
    const isRepo = await this.workspace.pathExists(`${workspacePath}/.git`);
    const steps: { command: string; args: string[] }[] = [
      ...(isRepo ? [] : [{ command: 'git', args: ['init'] }]),
      { command: 'git', args: ['add', '-A'] },
      { command: 'git', args: ['-c', 'user.email=ldcn-os@local', '-c', 'user.name=LDCN OS', 'commit', '-m', 'Geração real via LDCN OS', '--allow-empty'] },
      { command: 'git', args: ['branch', '-M', 'main'] },
      { command: 'git', args: ['remote', 'remove', 'gitlab'] }, // ignora falha se não existir ainda
      { command: 'git', args: ['remote', 'add', 'gitlab', remoteUrl] },
      { command: 'git', args: ['push', '-u', 'gitlab', 'main', '--force'] },
    ];

    let combinedLogs = '';
    for (const step of steps) {
      const result = await this.runner.runCommand(step.command, step.args, workspacePath, 60_000);
      combinedLogs += `$ ${step.command} ${step.args.filter((a) => a !== remoteUrl).join(' ')}\n${this.scrubToken(result.logsExcerpt, token)}\n\n`;
      const isRemoveRemote = step.args[0] === 'remote' && step.args[1] === 'remove';
      if (result.exitCode !== 0 && !isRemoveRemote) {
        throw new Error(`GITLAB_PUSH_COMMAND_FAILED: ${step.command} ${step.args[0]}`);
      }
    }
    return combinedLogs;
  }

  private scrubToken(text: string, token: string): string {
    return text.split(token).join('***');
  }

  private toDto(row: { missionId: string; status: string; repoName: string | null; repoUrl: string | null; errorCode: string | null; logsExcerpt: string | null }): GitlabPushDto {
    return {
      missionId: row.missionId, status: row.status as GitlabPushDto['status'],
      repoName: row.repoName, repoUrl: row.repoUrl, errorCode: row.errorCode, logsExcerpt: row.logsExcerpt,
    };
  }
}
