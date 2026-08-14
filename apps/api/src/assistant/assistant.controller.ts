import { Body, Controller, Param, Post } from '@nestjs/common';
import { AssistantService } from './assistant.service';

export interface ExplainDecisionInput {
  decisionId: string;
}

export interface ExplainRoutingInput {
  taskId: string;
}

/** doc 43 §5 "Ask AI". Path deliberately not prefixed with /api/v1 — nothing else in apps/api is. */
@Controller('missions/:missionId/assistant')
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Post('explain-architecture')
  explainArchitecture(@Param('missionId') missionId: string, @Body() body: ExplainDecisionInput) {
    return this.assistant.explainArchitectureDecision(missionId, body.decisionId);
  }

  @Post('explain-team')
  explainTeam(@Param('missionId') missionId: string, @Body() body: ExplainDecisionInput) {
    return this.assistant.explainTeamDecision(missionId, body.decisionId);
  }

  @Post('explain-routing')
  explainRouting(@Param('missionId') missionId: string, @Body() body: ExplainRoutingInput) {
    return this.assistant.explainRoutingDecision(missionId, body.taskId);
  }
}
