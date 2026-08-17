import { Controller, Get, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { GenerationEngineService } from './generation-engine.service';

/**
 * MISSÃO "Completar o fluxo pós-PromptMaster até geração e entrega real" — Fase 13/23/24: as
 * rotas reais que o botão START_EXECUTION (antes morto) e o Delivery Center (antes vazio) agora
 * chamam. Cobre só `stack.typescript.nestjs` (fatia vertical escolhida) — qualquer outro stack
 * responde TARGET_NOT_SUPPORTED de forma honesta em vez de fingir.
 */
@Controller('missions/:missionId/generation')
export class GenerationEngineController {
  constructor(private readonly engine: GenerationEngineService) {}

  @Post('start')
  start(@Param('missionId') missionId: string) {
    return this.engine.start(missionId);
  }

  @Get()
  async getStatus(@Param('missionId') missionId: string) {
    const status = await this.engine.getStatus(missionId);
    if (!status) throw new Error('MISSION_GENERATION_NOT_STARTED');
    return status;
  }

  @Get('artifacts')
  getArtifacts(@Param('missionId') missionId: string) {
    return this.engine.getArtifacts(missionId);
  }

  @Get('jobs')
  getJobs(@Param('missionId') missionId: string) {
    return this.engine.getJobs(missionId);
  }

  @Post('preview/start')
  startPreview(@Param('missionId') missionId: string) {
    return this.engine.startPreview(missionId);
  }

  @Post('preview/stop')
  async stopPreview(@Param('missionId') missionId: string) {
    await this.engine.stopPreview(missionId);
    return { stopped: true };
  }

  @Get('download')
  async download(@Param('missionId') missionId: string, @Res() res: Response) {
    const zipPath = await this.engine.getDownloadPath(missionId);
    res.download(zipPath, `${missionId}.zip`);
  }
}
