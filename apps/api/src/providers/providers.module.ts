import { Module } from '@nestjs/common';
import { PersistenceModule } from '../persistence/persistence.module';
import { AssistantModule } from '../assistant/assistant.module';
import { ProvidersController } from './providers.controller';
import { ProviderCredentialPersistenceService } from './provider-credential-persistence.service';

@Module({
  imports: [PersistenceModule, AssistantModule],
  controllers: [ProvidersController],
  providers: [ProviderCredentialPersistenceService],
})
export class ProvidersModule {}
