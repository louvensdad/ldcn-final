import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { PrismaService } from '../persistence/prisma.service';
import { RequirementExtractionService } from './requirement-extraction.service';
import { RequirementBaselineService } from './requirement-baseline.service';
import { ScopeCoverageService, ScopeDecision } from './scope-coverage.service';

export interface ExtractRequirementsInput {
  rawUserIdea?: string;
}

export interface SetScopeDecisionInput {
  requirementId: string;
  decision: ScopeDecision;
  reason?: string;
  decisionSource: string;
  approvalRef?: string;
}

/** CORE-011 — camada API mínima sobre o domínio novo (Requirement Baseline + Scope Coverage).
 * Nunca gera Job/Solution/Architecture (§26/§42) — só prova que o conjunto de Requirements está
 * pronto para o CORE-012 consumir. */
@Controller('missions/:missionId/requirements')
export class RequirementsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly extraction: RequirementExtractionService,
    private readonly baselines: RequirementBaselineService,
    private readonly scopeCoverage: ScopeCoverageService
  ) {}

  @Post('extract')
  async extract(@Param('missionId') missionId: string, @Body() body: ExtractRequirementsInput) {
    let rawUserIdea = body.rawUserIdea;
    if (!rawUserIdea?.trim()) {
      const conversation = await this.prisma.discoveryConversation.findUnique({ where: { missionId } });
      rawUserIdea = conversation?.rawUserIdea;
    }
    if (!rawUserIdea?.trim()) throw new Error('INVALID_DISCOVERY_INPUT');
    return this.extraction.extractAndPersist(missionId, rawUserIdea);
  }

  @Post('baseline')
  createBaseline(@Param('missionId') missionId: string) {
    return this.baselines.createBaseline(missionId);
  }

  @Get('baseline/latest')
  getLatestBaseline(@Param('missionId') missionId: string) {
    return this.baselines.getLatestBaseline(missionId);
  }

  @Get('baseline/:baselineId')
  getBaseline(@Param('missionId') missionId: string, @Param('baselineId') baselineId: string) {
    return this.baselines.getBaseline(missionId, baselineId);
  }

  @Post('baseline/:baselineId/finalize')
  finalizeBaseline(@Param('missionId') missionId: string, @Param('baselineId') baselineId: string) {
    return this.baselines.finalizeBaseline(missionId, baselineId);
  }

  @Post('baseline/:baselineId/decisions')
  setDecision(@Param('missionId') missionId: string, @Param('baselineId') baselineId: string, @Body() body: SetScopeDecisionInput) {
    return this.scopeCoverage.setDecision({ missionId, requirementBaselineId: baselineId, ...body });
  }

  @Get('baseline/:baselineId/coverage')
  getCoverage(@Param('missionId') missionId: string, @Param('baselineId') baselineId: string) {
    return this.scopeCoverage.getCoverage(missionId, baselineId);
  }

  @Post('baseline/:baselineId/finalize-coverage')
  finalizeCoverage(@Param('missionId') missionId: string, @Param('baselineId') baselineId: string) {
    return this.scopeCoverage.finalizeCoverage(missionId, baselineId);
  }

  @Get('baseline/:baselineId/readiness')
  getReadiness(@Param('missionId') missionId: string, @Param('baselineId') baselineId: string) {
    return this.scopeCoverage.assertReadyForSolutionPlanning(missionId, baselineId);
  }
}
