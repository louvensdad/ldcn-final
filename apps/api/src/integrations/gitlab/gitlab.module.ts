import { Module } from '@nestjs/common';
import { PersistenceModule } from '../../persistence/persistence.module';
import { WorkspaceService } from '../../generation-engine/workspace.service';
import { ProcessRunnerService } from '../../generation-engine/process-runner.service';
import { GitlabCredentialService } from './gitlab-credential.service';
import { GitlabPushService } from './gitlab-push.service';
import { GitlabController, MissionGitlabController } from './gitlab.controller';

@Module({
  imports: [PersistenceModule],
  controllers: [GitlabController, MissionGitlabController],
  providers: [GitlabCredentialService, GitlabPushService, WorkspaceService, ProcessRunnerService],
})
export class GitlabIntegrationModule {}
