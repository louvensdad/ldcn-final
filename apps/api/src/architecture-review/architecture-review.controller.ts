import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ArchitectureReviewService } from './architecture-review.service';

export interface DecideArchitectureFindingInput {
  chosenOption: string;
}

/**
 * MISSÃO "Arquitetura não pode seguir automaticamente para Entrega" — as rotas reais do gate.
 * A Journey UI só pode mostrar Team/Pipeline/Entrega como alcançáveis depois de
 * `GET .../architecture-review` retornar `status: 'APPROVED'`.
 */
@Controller('missions/:missionId/architecture-review')
export class ArchitectureReviewController {
  constructor(private readonly review: ArchitectureReviewService) {}

  @Post('start')
  start(@Param('missionId') missionId: string) {
    return this.review.start(missionId);
  }

  @Get()
  getSession(@Param('missionId') missionId: string) {
    return this.review.getSession(missionId);
  }

  @Post('findings/:findingId/resolve')
  resolveFinding(@Param('missionId') missionId: string, @Param('findingId') findingId: string) {
    return this.review.resolveFinding(missionId, findingId);
  }

  @Post('findings/:findingId/decide')
  decideFinding(@Param('missionId') missionId: string, @Param('findingId') findingId: string, @Body() body: DecideArchitectureFindingInput) {
    return this.review.decideFinding(missionId, findingId, body.chosenOption);
  }
}
