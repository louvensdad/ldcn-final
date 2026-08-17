import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { DiscoveryService, DiscoveryAdvancedInput, CopilotChangeDto } from './discovery.service';
import { ReviewerKey } from '../review/review-council.service';

export interface StartDiscoveryInput {
  rawUserIdea: string;
  advancedInput?: DiscoveryAdvancedInput;
}

export interface RespondDiscoveryInput {
  answer: string;
}

export interface StartFromImportInput {
  specText: string;
}

export interface DecideRequirementInput {
  decision: 'CONFIRMED' | 'REJECTED';
}

export interface ChangeRequestInput {
  reason: string;
}

export interface CopilotProposeInput {
  message: string;
}

export interface CopilotApplyInput {
  changes: (CopilotChangeDto & { accepted: boolean })[];
}

export interface ResolveFindingInput {
  resolutionNote?: string;
}

export interface DecideFindingInput {
  chosenOption: string;
}

@Controller('missions/:missionId/discovery')
export class DiscoveryController {
  constructor(private readonly discovery: DiscoveryService) {}

  @Post('start')
  start(@Param('missionId') missionId: string, @Body() body: StartDiscoveryInput) {
    return this.discovery.start(missionId, body.rawUserIdea, body.advancedInput);
  }

  @Get()
  get(@Param('missionId') missionId: string) {
    return this.discovery.get(missionId);
  }

  @Post('respond')
  respond(@Param('missionId') missionId: string, @Body() body: RespondDiscoveryInput) {
    return this.discovery.respond(missionId, body.answer);
  }

  @Post('import')
  startFromImport(@Param('missionId') missionId: string, @Body() body: StartFromImportInput) {
    return this.discovery.startFromImport(missionId, body.specText);
  }

  @Post('requirements/:requirementId/decision')
  decideRequirement(@Param('missionId') missionId: string, @Param('requirementId') requirementId: string, @Body() body: DecideRequirementInput) {
    return this.discovery.decideRequirement(missionId, requirementId, body.decision);
  }

  @Post('promptmaster')
  generatePromptMaster(@Param('missionId') missionId: string) {
    return this.discovery.generatePromptMaster(missionId);
  }

  @Post('promptmaster/approve')
  approvePromptMaster(@Param('missionId') missionId: string) {
    return this.discovery.approvePromptMaster(missionId);
  }

  @Get('promptmaster/gate')
  evaluateValidationGate(@Param('missionId') missionId: string) {
    return this.discovery.evaluateValidationGate(missionId);
  }

  @Get('promptmaster/metrics')
  getAutonomyMetrics(@Param('missionId') missionId: string) {
    return this.discovery.getAutonomyMetrics(missionId);
  }

  @Post('promptmaster/change-request')
  createChangeRequest(@Param('missionId') missionId: string, @Body() body: ChangeRequestInput) {
    return this.discovery.createChangeRequest(missionId, body.reason);
  }

  @Post('promptmaster/copilot')
  proposeCopilotChange(@Param('missionId') missionId: string, @Body() body: CopilotProposeInput) {
    return this.discovery.proposeCopilotChange(missionId, body.message);
  }

  @Post('promptmaster/copilot/apply')
  applyCopilotChanges(@Param('missionId') missionId: string, @Body() body: CopilotApplyInput) {
    return this.discovery.applyCopilotChanges(missionId, body.changes);
  }

  @Post('promptmaster/review/:reviewerKey/retry')
  retryReviewer(@Param('missionId') missionId: string, @Param('reviewerKey') reviewerKey: string) {
    return this.discovery.retryReviewer(missionId, reviewerKey as ReviewerKey);
  }

  @Post('promptmaster/findings/:findingId/resolve')
  resolveFinding(@Param('missionId') missionId: string, @Param('findingId') findingId: string, @Body() body: ResolveFindingInput) {
    return this.discovery.resolveFinding(missionId, findingId, body.resolutionNote);
  }

  @Post('promptmaster/findings/:findingId/decide')
  decideFinding(@Param('missionId') missionId: string, @Param('findingId') findingId: string, @Body() body: DecideFindingInput) {
    return this.discovery.decideFinding(missionId, findingId, body.chosenOption);
  }
}
