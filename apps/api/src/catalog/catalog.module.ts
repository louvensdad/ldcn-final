import { Module } from '@nestjs/common';
import { PersistenceModule } from '../persistence/persistence.module';
import { AgentCatalogService } from './agent-catalog.service';
import { CatalogBootstrapService } from './catalog.seed';

@Module({
  imports: [PersistenceModule],
  providers: [AgentCatalogService, CatalogBootstrapService],
  exports: [AgentCatalogService],
})
export class CatalogModule {}
