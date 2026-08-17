import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApprovalDecision, HumanApprovalService } from './human-approval.service';

@Controller('missions/:missionId/approvals')
export class ApprovalsController {
  constructor(private readonly approvals: HumanApprovalService) {}
  @Get() list(@Param('missionId') missionId: string, @Query('status') status?: string) { return this.approvals.list(missionId, status); }
  @Post('request') request(@Param('missionId') missionId: string, @Body() body: { trigger: 'REQUIREMENT_WAIVER'; subjectId: string; requestedBy: string; requestNote: string }) {
    if (body.trigger !== 'REQUIREMENT_WAIVER') throw new Error('APPROVAL_TRIGGER_NOT_REQUESTABLE');
    return this.approvals.requestRequirementWaiver({ missionId, requirementId: body.subjectId, requestedBy: body.requestedBy, requestNote: body.requestNote });
  }
  @Post(':approvalId/decide') decide(@Param('missionId') missionId: string, @Param('approvalId') approvalId: string, @Body() body: { decision: ApprovalDecision; decidedBy: string; rationale: string }) { return this.approvals.decide(missionId, approvalId, body); }
}
