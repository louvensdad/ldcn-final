import { Module } from '@nestjs/common';
import { PersistenceModule } from '../persistence/persistence.module';
import { AssistantModule } from '../assistant/assistant.module';
import { GenerationEngineController } from './generation-engine.controller';
import { GenerationEngineService } from './generation-engine.service';
import { WorkspaceService } from './workspace.service';
import { ProcessRunnerService } from './process-runner.service';
import { SecurityScannerService } from './security-scanner.service';
import { SecurityReviewService } from './security-review.service';
import { JobReviewService } from './job-review.service';
import { JobScopeService } from './job-scope.service';
import { RepositoryInspector } from './repository-inspector';
import { DuplicateValidationService } from './duplicate-validation.service';
import { WorkspaceSessionService } from './workspace-session.service';
import { CandidateBuildRunner } from './candidate-build-runner';
import { CandidateTestRunner } from './candidate-test-runner';
import { WorkspaceValidationService } from './workspace-validation.service';
import { ReviewOrchestrator } from './review-orchestrator.service';
import { EventsModule } from '../events/events.module';
import { LedgerModule } from '../ledger/ledger.module';
import { CatalogModule } from '../catalog/catalog.module';
import { PromptMasterModule } from '../promptmaster/promptmaster.module';
import { AgentRuntimeModule } from '../agent-runtime/agent-runtime.module';

@Module({
  imports: [PersistenceModule, AssistantModule, EventsModule, LedgerModule, CatalogModule, PromptMasterModule, AgentRuntimeModule],
  controllers: [GenerationEngineController],
  providers: [GenerationEngineService, WorkspaceService, ProcessRunnerService, SecurityScannerService, SecurityReviewService, JobReviewService, JobScopeService, RepositoryInspector, DuplicateValidationService, WorkspaceSessionService, CandidateBuildRunner, CandidateTestRunner, WorkspaceValidationService, ReviewOrchestrator],
})
export class GenerationEngineModule {}
