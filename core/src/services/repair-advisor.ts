import { createHash } from 'crypto';
import { FailureSnapshot, LearningOutcome, RepairAdvisory, RepairRisk } from '../domain';
import { generateId } from '../utils/id';

export interface RepairAdvisoryInput {
  missionId: string;
  taskId: string;
  approvedSolutionId: string;
  failureCode: string;
  failureSummary: string;
  affectedStack?: string;
  failedGateKey?: string;
  historicalOutcomes?: readonly LearningOutcome[];
  failureSnapshotId?: string;
}

export interface RepairAdvisoryRepository {
  findByContextHash(contextHash: string): RepairAdvisory | undefined;
  save(advisory: RepairAdvisory): RepairAdvisory;
}

export class InMemoryRepairAdvisoryStore implements RepairAdvisoryRepository {
  private advisories = new Map<string, RepairAdvisory>();
  findByContextHash(contextHash: string): RepairAdvisory | undefined { return this.advisories.get(contextHash); }
  save(advisory: RepairAdvisory): RepairAdvisory {
    const existing = this.advisories.get(advisory.contextHash);
    if (existing) return existing;
    this.advisories.set(advisory.contextHash, advisory);
    return advisory;
  }
}

/** Recommends repair direction; it never opens a repair session or writes a patch. */
export class RepairAdvisor {
  constructor(private readonly repository: RepairAdvisoryRepository = new InMemoryRepairAdvisoryStore()) {}

  adviseSnapshot(input: { missionId: string; approvedSolutionId: string; snapshot: FailureSnapshot; historicalOutcomes?: readonly LearningOutcome[] }): RepairAdvisory {
    if (input.snapshot.missionId !== input.missionId) throw new Error('REPAIR_ADVISORY_CROSS_MISSION');
    return this.advise({ missionId: input.missionId, taskId: input.snapshot.taskId, approvedSolutionId: input.approvedSolutionId, failureCode: input.snapshot.failureCode, failureSummary: input.snapshot.summary, affectedStack: input.snapshot.affectedStack, failedGateKey: input.snapshot.failedGateKey, historicalOutcomes: input.historicalOutcomes, failureSnapshotId: input.snapshot.id });
  }

  advise(input: RepairAdvisoryInput): RepairAdvisory {
    if (!input.missionId || !input.taskId || !input.approvedSolutionId || !input.failureCode) throw new Error('REPAIR_ADVISORY_INCOMPLETE');
    const text = `${input.failureCode} ${input.failureSummary} ${input.failedGateKey ?? ''}`.toLowerCase();
    const likelyCapabilities = text.match(/security|auth|permission|jwt|oauth/) ? ['security', 'authentication']
      : text.match(/integrat|api|contract|cross.?stack/) ? ['integration', 'api-contracts']
        : text.match(/test|assert|coverage/) ? ['testing', 'quality']
          : text.match(/build|compile|type|runtime|dependency/) ? ['runtime', 'build-tooling']
            : ['debugging', 'software-engineering'];
    const likelySpecialistRole = likelyCapabilities.includes('security') ? 'SECURITY_SPECIALIST'
      : likelyCapabilities.includes('integration') ? 'INTEGRATION_ENGINEER'
        : likelyCapabilities.includes('testing') ? 'TEST_ENGINEER' : 'SENIOR_DEVELOPER';
    const risk: RepairRisk = text.match(/security|data loss|corrupt|critical/) ? 'CRITICAL'
      : text.match(/production|integration|runtime/) ? 'HIGH'
        : text.match(/test|build|compile/) ? 'MEDIUM' : 'LOW';
    const relevant = (input.historicalOutcomes ?? []).filter((outcome) => outcome.outcomeType === 'REPAIR' && outcome.features.failureCode === input.failureCode);
    const estimatedSuccess = relevant.length === 0 ? 0.5 : relevant.filter((outcome) => outcome.success).length / relevant.length;
    const contextHash = createHash('sha256').update(JSON.stringify({ missionId: input.missionId, taskId: input.taskId, approvedSolutionId: input.approvedSolutionId, failureCode: input.failureCode, failureSummary: input.failureSummary, affectedStack: input.affectedStack, failedGateKey: input.failedGateKey })).digest('hex');
    const existing = this.repository.findByContextHash(contextHash);
    if (existing) return existing;
    // Deterministic composition from the fields already computed above — no LLM involved, this
    // just stops discarding what advise() already knows (previously a fixed generic sentence).
    const historyNote = relevant.length > 0
      ? `com base em ${relevant.length} reparo(s) anterior(es) do mesmo tipo de falha (taxa de sucesso estimada: ${Math.round(estimatedSuccess * 100)}%)`
      : 'sem histórico de reparos anteriores para esse tipo de falha (taxa de sucesso estimada neutra: 50%)';
    const rationale = `Falha "${input.failureCode}"${input.affectedStack ? ` na stack ${input.affectedStack}` : ''} indica necessidade de ${likelySpecialistRole}, com foco em ${likelyCapabilities.join(' e ')}. Risco classificado como ${risk}, ${historyNote}.`;
    return this.repository.save({ id: generateId(), missionId: input.missionId, version: 1, taskId: input.taskId, failureSnapshotId: input.failureSnapshotId, approvedSolutionId: input.approvedSolutionId, failureCode: input.failureCode, likelyCapabilities, likelySpecialistRole, estimatedSuccess, risk, rationale, status: 'ADVISORY_ONLY', contextHash });
  }
}
