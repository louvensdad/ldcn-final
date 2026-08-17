import { Injectable } from '@nestjs/common';
import { PrismaService } from '../persistence/prisma.service';

/**
 * CORE-011 §3/§4 — aloca requirementKey (REQ-001, REQ-002...) estável e nunca reciclado, mesmo
 * quando o Requirement correspondente é depois superseded/rejeitado. Um contador monotônico por
 * Mission (RequirementKeySequence) é a fonte de verdade — nunca `Requirement.count()` (que
 * decresceria/repetiria se uma linha fosse removida, o que o modelo de dados evita por design mas
 * não deveria ser uma dependência implícita mesmo assim).
 */
@Injectable()
export class RequirementKeyService {
  constructor(private readonly prisma: PrismaService) {}

  /** Aloca `count` chaves consecutivas de uma vez (uso: ingestão em lote do Discovery) —
   * nunca aloca uma a uma em loop, o que abriria uma janela de corrida entre chamadas. */
  async allocateKeys(missionId: string, count: number): Promise<string[]> {
    if (count <= 0) return [];
    const start = await this.reserve(missionId, count);
    const keys: string[] = [];
    for (let i = 0; i < count; i++) keys.push(formatKey(start + i));
    return keys;
  }

  async allocateKey(missionId: string): Promise<string> {
    const [key] = await this.allocateKeys(missionId, 1);
    return key;
  }

  private async reserve(missionId: string, count: number): Promise<number> {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const existing = await tx.requirementKeySequence.findUnique({ where: { missionId } });
          if (!existing) {
            await tx.requirementKeySequence.create({ data: { missionId, nextValue: 1 + count } });
            return 1;
          }
          await tx.requirementKeySequence.update({ where: { missionId }, data: { nextValue: existing.nextValue + count } });
          return existing.nextValue;
        });
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (code === 'P2002' && attempt < 4) continue; // concorrência na primeira criação — retry
        throw error;
      }
    }
    throw new Error('REQUIREMENT_KEY_ALLOCATION_FAILED');
  }
}

function formatKey(n: number): string {
  return `REQ-${String(n).padStart(3, '0')}`;
}
