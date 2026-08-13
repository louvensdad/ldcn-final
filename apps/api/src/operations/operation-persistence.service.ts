import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Operation } from '@prisma/client';
import { PrismaService } from '../persistence/prisma.service';

@Injectable()
export class OperationPersistenceService {
  constructor(private readonly prisma: PrismaService) {}

  async create(missionId: string, type: string, correlationId: string): Promise<Operation> {
    return this.prisma.operation.create({
      data: { id: randomUUID(), missionId, type, status: 'RUNNING', correlationId, startedAt: new Date() },
    });
  }

  async succeed(operationId: string, result: unknown): Promise<Operation> {
    return this.prisma.operation.update({
      where: { id: operationId },
      data: { status: 'SUCCEEDED', resultJson: JSON.parse(JSON.stringify(result)), completedAt: new Date() },
    });
  }

  async fail(operationId: string, errorCode: string): Promise<Operation> {
    return this.prisma.operation.update({
      where: { id: operationId },
      data: { status: 'FAILED', errorCode, completedAt: new Date() },
    });
  }

  async get(operationId: string): Promise<Operation | null> {
    return this.prisma.operation.findUnique({ where: { id: operationId } });
  }

  async latest(missionId: string): Promise<Operation | null> {
    return this.prisma.operation.findFirst({ where: { missionId }, orderBy: { createdAt: 'desc' } });
  }
}
