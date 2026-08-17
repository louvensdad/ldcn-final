import { Module } from '@nestjs/common';
import { PersistenceModule } from '../persistence/persistence.module';
import { GeneratorModule } from '../generator/generator.module';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { DeepSeekClient, LLM_CLIENT } from './deepseek-client';

@Module({
  imports: [PersistenceModule, GeneratorModule],
  controllers: [AssistantController],
  providers: [AssistantService, { provide: LLM_CLIENT, useClass: DeepSeekClient }],
  exports: [LLM_CLIENT],
})
export class AssistantModule {}
