import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { MissionPersistenceService } from './mission-persistence.service';

@Module({
  providers: [PrismaService, MissionPersistenceService],
  exports: [PrismaService, MissionPersistenceService],
})
export class PersistenceModule {}
