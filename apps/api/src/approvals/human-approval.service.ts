import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { EventLogService } from '../events/event-log.service';
import { canonicalHash } from '../requirements/canonical-hash';
import { PrismaService } from '../persistence/prisma.service';

export type ApprovalDecision = 'APPROVED' | 'REJECTED';

@Injectable()
export class HumanApprovalService {
  constructor(private readonly prisma: PrismaService, private readonly events: EventLogService) {}

  async requestArchitectureApproval(input: { missionId: string; architectureCompositionId: string; architectureHash: string }) {
    const existing = await this.prisma.humanApprovalRequest.findUnique({
      where: { trigger_subjectType_subjectId_subjectHash: { trigger: 'ARCHITECTURE_APPROVAL', subjectType: 'ArchitectureComposition', subjectId: input.architectureCompositionId, subjectHash: input.architectureHash } },
    });
    if (existing) return existing;
    const id = randomUUID();
    const request = await this.prisma.$transaction(async (tx) => {
      const row = await tx.humanApprovalRequest.create({ data: { id, missionId: input.missionId, trigger: 'ARCHITECTURE_APPROVAL', subjectType: 'ArchitectureComposition', subjectId: input.architectureCompositionId, subjectHash: input.architectureHash, requestedBy: 'architecture-council' } });
      await tx.architectureComposition.update({ where: { id: input.architectureCompositionId }, data: { status: 'AWAITING_HUMAN_APPROVAL', humanApprovalRequestId: id } });
      await tx.missionControl.upsert({ where: { missionId: input.missionId }, create: { missionId: input.missionId, status: 'PAUSED_HUMAN', activeArchitectureId: input.architectureCompositionId }, update: { status: 'PAUSED_HUMAN', activeArchitectureId: input.architectureCompositionId } });
      return row;
    });
    await this.events.append({ missionId: input.missionId, correlationId: id, actorType: 'SYSTEM', type: 'approval.requested', idempotencyKey: `approval:${id}:requested`, payload: { missionId: input.missionId, approvalId: id, trigger: request.trigger, subjectType: request.subjectType, subjectId: request.subjectId, subjectHash: request.subjectHash, status: request.status } });
    return request;
  }

  async list(missionId: string, status?: string) {
    return this.prisma.humanApprovalRequest.findMany({ where: { missionId, ...(status ? { status } : {}) }, orderBy: { createdAt: 'desc' } });
  }

  async requestRequirementWaiver(input: { missionId: string; requirementId: string; requestedBy: string; requestNote: string }) {
    if (!input.requestedBy?.trim() || !input.requestNote?.trim()) throw new Error('APPROVAL_REQUEST_INCOMPLETE');
    const requirement = await this.prisma.requirement.findUnique({ where: { id: input.requirementId } });
    if (!requirement || requirement.missionId !== input.missionId) throw new Error('REQUIREMENT_NOT_FOUND');
    const subjectHash = canonicalHash({ id: requirement.id, requirementKey: requirement.requirementKey, content: requirement.content, status: requirement.status });
    const existing = await this.prisma.humanApprovalRequest.findUnique({ where: { trigger_subjectType_subjectId_subjectHash: { trigger: 'REQUIREMENT_WAIVER', subjectType: 'Requirement', subjectId: requirement.id, subjectHash } } });
    if (existing) return existing;
    const id = randomUUID();
    const row = await this.prisma.humanApprovalRequest.create({ data: { id, missionId: input.missionId, trigger: 'REQUIREMENT_WAIVER', subjectType: 'Requirement', subjectId: requirement.id, subjectHash, requestedBy: input.requestedBy.trim(), requestNote: input.requestNote.trim() } });
    await this.events.append({ missionId: input.missionId, correlationId: id, actorType: 'USER', actorId: input.requestedBy.trim(), type: 'approval.requested', idempotencyKey: `approval:${id}:requested`, payload: { missionId: input.missionId, approvalId: id, trigger: row.trigger, subjectType: row.subjectType, subjectId: row.subjectId, subjectHash, status: row.status } });
    return row;
  }

  async decide(missionId: string, approvalId: string, input: { decision: ApprovalDecision; decidedBy: string; rationale: string }) {
    if (!['APPROVED', 'REJECTED'].includes(input.decision)) throw new Error('APPROVAL_INVALID_DECISION');
    if (!input.decidedBy?.trim() || !input.rationale?.trim()) throw new Error('APPROVAL_DECISION_INCOMPLETE');
    const current = await this.prisma.humanApprovalRequest.findUnique({ where: { id: approvalId } });
    if (!current || current.missionId !== missionId) throw new Error('APPROVAL_NOT_FOUND');
    if (current.status !== 'PENDING') {
      if (current.status === input.decision && current.decidedBy === input.decidedBy.trim() && current.rationale === input.rationale.trim()) return current;
      throw new Error('APPROVAL_ALREADY_DECIDED');
    }
    const decidedAt = new Date();
    const decided = await this.prisma.$transaction(async (tx) => {
      if (current.trigger === 'ARCHITECTURE_APPROVAL') {
        const architecture = await tx.architectureComposition.findUnique({ where: { id: current.subjectId } });
        if (!architecture || architecture.missionId !== missionId || architecture.architectureHash !== current.subjectHash || architecture.humanApprovalRequestId !== approvalId) throw new Error('APPROVAL_SUBJECT_DRIFT');
        if (architecture.status !== 'AWAITING_HUMAN_APPROVAL') throw new Error('APPROVAL_SUBJECT_NOT_PENDING');
        if (input.decision === 'APPROVED') await tx.architectureComposition.updateMany({ where: { missionId, status: 'APPROVED', id: { not: architecture.id } }, data: { status: 'SUPERSEDED' } });
        await tx.architectureComposition.update({ where: { id: architecture.id }, data: { status: input.decision, approvedAt: input.decision === 'APPROVED' ? decidedAt : null } });
        await tx.missionControl.upsert({ where: { missionId }, create: { missionId, status: input.decision === 'APPROVED' ? 'PLANNING' : 'PAUSED_HUMAN', activeArchitectureId: architecture.id }, update: { status: input.decision === 'APPROVED' ? 'PLANNING' : 'PAUSED_HUMAN', activeArchitectureId: architecture.id } });
      } else if (current.trigger === 'REQUIREMENT_WAIVER') {
        const requirement = await tx.requirement.findUnique({ where: { id: current.subjectId } });
        if (!requirement || requirement.missionId !== missionId || canonicalHash({ id: requirement.id, requirementKey: requirement.requirementKey, content: requirement.content, status: requirement.status }) !== current.subjectHash) throw new Error('APPROVAL_SUBJECT_DRIFT');
      }
      return tx.humanApprovalRequest.update({ where: { id: approvalId }, data: { status: input.decision, decidedBy: input.decidedBy.trim(), rationale: input.rationale.trim(), decidedAt } });
    });
    await this.events.append({ missionId, correlationId: approvalId, actorType: 'USER', actorId: input.decidedBy.trim(), type: 'approval.decided', idempotencyKey: `approval:${approvalId}:decided`, payload: { missionId, approvalId, trigger: decided.trigger, subjectType: decided.subjectType, subjectId: decided.subjectId, subjectHash: decided.subjectHash, decision: decided.status } });
    return decided;
  }

  async assertApprovedReference(input: { missionId: string; approvalId: string; trigger: string; subjectId: string }) {
    const row = await this.prisma.humanApprovalRequest.findUnique({ where: { id: input.approvalId } });
    if (!row || row.missionId !== input.missionId || row.trigger !== input.trigger || row.subjectId !== input.subjectId || row.status !== 'APPROVED') throw new Error('APPROVAL_REFERENCE_INVALID');
    return row;
  }
}
