import { createHash } from 'crypto';
import { ApprovedSolution, HandoffPackage, HandoffType, JobClassification, TeamSwitchDecision } from '../domain';
import { generateId } from '../utils/id';
import { HandoffValidator } from './handoff-validator';

export interface TeamSwitchInput {
  missionId: string;
  taskId: string;
  sourceTeamKey: string;
  targetTeamKey: string;
  handoffType: HandoffType;
  classification: JobClassification;
  approvedSolution: ApprovedSolution;
  contractRefs: string[];
  artifactRefs?: string[];
  evidenceRefs?: string[];
  decisions?: string[];
  constraints?: string[];
  unresolvedDependencies?: string[];
  acceptanceCriteria?: string[];
}

/** Resolves ownership changes and transports structured facts only. */
export class TeamSwitchResolver {
  private decisions = new Map<string, TeamSwitchDecision>();
  private handoffValidator = new HandoffValidator();

  resolve(input: TeamSwitchInput): TeamSwitchDecision {
    this.assertMission(input);
    const key = `${input.missionId}:${input.taskId}:${input.sourceTeamKey}:${input.targetTeamKey}`;
    const previous = this.decisions.get(key);
    if (previous) {
      if (previous.handoff.contextHash === this.contextHash(input)) return previous;
      throw new Error('TEAM_SWITCH_CONTEXT_STALE');
    }

    const allowed = this.allowedTeams(input.approvedSolution);
    if (!allowed.has(input.targetTeamKey) || !allowed.has(input.sourceTeamKey)) {
      return this.persist(input, 'BLOCKED_SCOPE', 'A equipe de origem ou destino nÃ£o pertence Ã  Mission autorizada.', input.targetTeamKey, key);
    }

    const sourceStack = this.stackFromTeam(input.sourceTeamKey);
    const targetStack = this.stackFromTeam(input.targetTeamKey);
    const crossStack = sourceStack !== targetStack && sourceStack !== 'integration-unit' && targetStack !== 'integration-unit';
    const integrationRequired = crossStack && this.hasMultipleStacks(input.approvedSolution);
    const effectiveTarget = integrationRequired ? 'integration-unit' : input.targetTeamKey;
    const effectiveType = integrationRequired ? 'STACK_TO_INTEGRATION' : input.handoffType;
    const reason = input.sourceTeamKey === effectiveTarget
      ? 'O ownership permanece na mesma equipe; nenhum switch Ã© necessÃ¡rio.'
      : integrationRequired
        ? 'A troca cruza stacks aprovadas; Integration Unit Ã© obrigatÃ³ria antes da equipe de destino.'
        : `Handoff explÃ­cito de ${input.sourceTeamKey} para ${effectiveTarget}.`;
    return this.persist(input, input.sourceTeamKey === effectiveTarget ? 'NO_SWITCH' : 'SWITCH_REQUIRED', reason, effectiveTarget, key, effectiveType);
  }

  get(missionId: string, taskId: string, sourceTeamKey: string, targetTeamKey: string): TeamSwitchDecision | undefined {
    return this.decisions.get(`${missionId}:${taskId}:${sourceTeamKey}:${targetTeamKey}`);
  }

  private persist(input: TeamSwitchInput, status: 'SWITCH_REQUIRED' | 'NO_SWITCH' | 'BLOCKED_SCOPE', reason: string, targetTeam: string, key: string, type: HandoffType = input.handoffType): TeamSwitchDecision {
    const id = generateId();
    const artifacts = input.artifactRefs ?? [];
    const evidence = input.evidenceRefs ?? [];
    const contracts = input.contractRefs;
    const contextHash = this.contextHash(input);
    const handoff: HandoffPackage = {
      id: generateId(), missionId: input.missionId, version: 1, taskId: input.taskId,
      fromTeam: input.sourceTeamKey, toTeam: targetTeam, contractRefs: contracts,
      artifactRefs: artifacts, evidenceRefs: evidence, decisions: input.decisions ?? [],
      constraints: input.constraints ?? [], unresolvedDependencies: input.unresolvedDependencies ?? [],
      acceptanceCriteria: input.acceptanceCriteria ?? [], contextHash,
    };
    this.handoffValidator.validate(handoff, input.missionId);
    const decision: TeamSwitchDecision = {
      id, missionId: input.missionId, version: 1, sourceTaskId: input.taskId,
      sourceTeamKey: input.sourceTeamKey, targetTeamKey: targetTeam, reason, handoffType: type,
      requiredContracts: contracts, requiredArtifacts: artifacts, requiredEvidence: evidence,
      contextSnapshotId: generateId(), status, handoff,
    };
    this.decisions.set(key, decision);
    return decision;
  }

  private assertMission(input: TeamSwitchInput): void {
    if (input.approvedSolution.status !== 'ACTIVE') throw new Error('Team switch requires an ACTIVE ApprovedSolution');
    if (input.missionId !== input.approvedSolution.missionId || input.missionId !== input.classification.missionId) throw new Error('Team switch entities belong to different missions');
    if (input.contractRefs.length === 0) throw new Error('Handoff requires at least one contract reference');
  }

  private contextHash(input: TeamSwitchInput): string {
    return createHash('sha256').update(JSON.stringify({ contracts: input.contractRefs, artifacts: input.artifactRefs ?? [], evidence: input.evidenceRefs ?? [], constraints: input.constraints ?? [] })).digest('hex');
  }

  private allowedTeams(solution: ApprovedSolution): Set<string> {
    return new Set([...solution.selectedStacks.map((s) => s.stackKey), ...(this.hasMultipleStacks(solution) ? ['integration-unit'] : [])]);
  }
  private hasMultipleStacks(solution: ApprovedSolution): boolean { return new Set(solution.selectedStacks.map((s) => s.stackKey)).size > 1; }
  private stackFromTeam(team: string): string { return team === 'integration-unit' ? team : team; }
}
