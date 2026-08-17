import { Module } from '@nestjs/common';
import { PersistenceModule } from '../persistence/persistence.module';
import { ProjectsController } from './projects.controller';
import { ProjectPersistenceService } from './project-persistence.service';

@Module({
  imports: [PersistenceModule],
  controllers: [ProjectsController],
  providers: [ProjectPersistenceService],
})
export class ProjectsModule {}
