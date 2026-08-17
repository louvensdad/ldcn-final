import { Module } from '@nestjs/common';
import { PersistenceModule } from '../persistence/persistence.module';
import { CatalogModule } from '../catalog/catalog.module';
import { LedgerModule } from '../ledger/ledger.module';
import { ContextLoaderService } from './context-loader.service';
import { PromptMasterService } from './prompt-master.service';

@Module({
  imports: [PersistenceModule, CatalogModule, LedgerModule],
  providers: [ContextLoaderService, PromptMasterService],
  exports: [ContextLoaderService, PromptMasterService],
})
export class PromptMasterModule {}
