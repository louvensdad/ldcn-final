import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { GeneratorModule } from './generator/generator.module';
import { RuntimeModule } from './runtime/runtime.module';
import { RoutingModule } from './routing/routing.module';
import { OperationsModule } from './operations/operations.module';
import { OverviewModule } from './overview/overview.module';
import { RepairModule } from './repair/repair.module';
import { AssistantModule } from './assistant/assistant.module';
import { GateModule } from './gates/gate.module';
import { ProjectsModule } from './projects/projects.module';
import { ProvidersModule } from './providers/providers.module';
import { DiscoveryModule } from './discovery/discovery.module';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { GenerationEngineModule } from './generation-engine/generation-engine.module';
import { ArchitectureReviewModule } from './architecture-review/architecture-review.module';
import { GithubIntegrationModule } from './integrations/github/github.module';
import { GitlabIntegrationModule } from './integrations/gitlab/gitlab.module';
import { CatalogModule } from './catalog/catalog.module';
import { PromptMasterModule } from './promptmaster/promptmaster.module';
import { RequirementsModule } from './requirements/requirements.module';
import { SolutionPlanningModule } from './solution-planning/solution-planning.module';
import { ArchitecturePlanningModule } from './architecture-planning/architecture-planning.module';
import { VirtualCompanyModule } from './virtual-company/virtual-company.module';
import { ApprovalsModule } from './approvals/approvals.module';
import { AssemblyModule } from './assembly/assembly.module';
import { MissionRoutingModule } from './mission-routing/mission-routing.module';
import { HealthController } from './health/health.controller';
import { ApiKeyGuard } from './security/api-key.guard';
import { DomainErrorFilter } from './security/domain-error.filter';

@Module({
  imports: [GeneratorModule, RuntimeModule, RoutingModule, OperationsModule, OverviewModule, RepairModule, AssistantModule, GateModule, ProjectsModule, ProvidersModule, DiscoveryModule, MarketplaceModule, GenerationEngineModule, ArchitectureReviewModule, GithubIntegrationModule, GitlabIntegrationModule, CatalogModule, PromptMasterModule, RequirementsModule, SolutionPlanningModule, ArchitecturePlanningModule, VirtualCompanyModule, ApprovalsModule, AssemblyModule, MissionRoutingModule],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ApiKeyGuard },
    { provide: APP_FILTER, useClass: DomainErrorFilter },
  ],
})
export class AppModule {}
