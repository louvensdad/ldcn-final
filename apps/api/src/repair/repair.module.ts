import { Module } from '@nestjs/common';
import { PersistenceModule } from '../persistence/persistence.module';
import { GeneratorModule } from '../generator/generator.module';
import { RepairController } from './repair.controller';
import { RepairPersistenceService } from './repair-persistence.service';

@Module({
  imports: [PersistenceModule, GeneratorModule],
  controllers: [RepairController],
  providers: [RepairPersistenceService],
})
export class RepairModule {}
