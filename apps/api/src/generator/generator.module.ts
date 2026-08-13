import { Module } from '@nestjs/common';
import { PersistenceModule } from '../persistence/persistence.module';
import { GeneratorController } from './generator.controller';
import { GeneratorService } from './generator.service';

@Module({
  imports: [PersistenceModule],
  controllers: [GeneratorController],
  providers: [GeneratorService],
  exports: [GeneratorService],
})
export class GeneratorModule {}
