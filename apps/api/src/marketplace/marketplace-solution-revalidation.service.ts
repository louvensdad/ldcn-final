import { Injectable } from '@nestjs/common';
import { PrismaService } from '../persistence/prisma.service';

/** Fase 16 do audit "Completar o fluxo de compra/personalização": uma solução VERIFIED pode
 * degradar depois de publicada (regras de review mudaram, policy do PromptMaster evoluiu, uma
 * dependência da stack ficou deprecated) — o status de revalidação é um sinal independente do
 * status de publicação em si. REVALIDATION_REQUIRED é setado hoje pelo único sinal real que este
 * codebase produz (Fase 15: o Review Council encontrando um BLOCKER genuíno numa compra "como
 * está"). TEMPORARILY_UNAVAILABLE é reservado para quando existir um scanner contínuo de verdade
 * (dependência com vulnerabilidade, stack deprecated) — não implementado ainda (ver relatório da
 * missão), mas o modelo já comporta sem precisar de outra migration.
 */
export type RevalidationStatus = 'OK' | 'REVALIDATION_REQUIRED' | 'TEMPORARILY_UNAVAILABLE';

@Injectable()
export class MarketplaceSolutionRevalidationService {
  constructor(private readonly prisma: PrismaService) {}

  async flagForRevalidation(solutionVersionId: string, note: string): Promise<void> {
    await this.prisma.marketplaceSolutionVersion.update({
      where: { id: solutionVersionId },
      data: { revalidationStatus: 'REVALIDATION_REQUIRED', revalidationNote: note.slice(0, 4000) },
    });
  }

  async clear(solutionVersionId: string): Promise<void> {
    await this.prisma.marketplaceSolutionVersion.update({
      where: { id: solutionVersionId },
      data: { revalidationStatus: 'OK', revalidationNote: null },
    });
  }

  async getStatus(solutionVersionId: string): Promise<{ status: RevalidationStatus; note: string | null }> {
    const row = await this.prisma.marketplaceSolutionVersion.findUnique({ where: { id: solutionVersionId } });
    if (!row) throw new Error('MARKETPLACE_SOLUTION_VERSION_NOT_FOUND');
    return { status: row.revalidationStatus as RevalidationStatus, note: row.revalidationNote };
  }
}
