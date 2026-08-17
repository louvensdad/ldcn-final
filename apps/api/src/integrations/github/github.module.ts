import { Module } from '@nestjs/common';
import { PersistenceModule } from '../../persistence/persistence.module';
import { WorkspaceService } from '../../generation-engine/workspace.service';
import { ProcessRunnerService } from '../../generation-engine/process-runner.service';
import { GithubCredentialService } from './github-credential.service';
import { GithubPushService } from './github-push.service';
import { GithubController, MissionGithubController } from './github.controller';

@Module({
  imports: [PersistenceModule],
  controllers: [GithubController, MissionGithubController],
  providers: [GithubCredentialService, GithubPushService, WorkspaceService, ProcessRunnerService],
})
export class GithubIntegrationModule {}
