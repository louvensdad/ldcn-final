import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonFailureSnapshotStore, JsonRepairAdvisoryStore, JsonReviewGateEvaluationStore } from '../services/json-runtime-record-stores';

describe('JSON runtime record stores', () => {
  it('reloads failure, repair and gate records idempotently', () => {
    const folder = mkdtempSync(join(tmpdir(), 'ldcn-runtime-records-'));
    const failure = { id: 'f1', missionId: 'm1', version: 1, taskId: 't1', executionId: 'e1', category: 'BUILD' as const, failureCode: 'BUILD_X', summary: 'compile', evidenceRefs: [], contextHash: 'fh' };
    const advisory = { id: 'a1', missionId: 'm1', version: 1, taskId: 't1', approvedSolutionId: 's1', failureCode: 'BUILD_X', likelyCapabilities: ['runtime'], likelySpecialistRole: 'SENIOR_DEVELOPER', estimatedSuccess: 0.5, risk: 'LOW' as const, rationale: 'r', status: 'ADVISORY_ONLY' as const, contextHash: 'ah' };
    const evaluation = { id: 'g1', missionId: 'm1', version: 1, taskId: 't1', routingDecisionId: 'r1', requiredGateKeys: [], evaluatedGateKeys: [], missingGateKeys: [], failedGateKeys: [], duplicateGateKeys: [], unauthorizedReviewerAgentIds: [], unexpectedGateKeys: [], evidenceRefs: [], status: 'PASSED' as const, reason: 'ok', evidenceHash: 'gh' };
    expect(new JsonFailureSnapshotStore(join(folder, 'f.json')).save(failure)).toEqual(failure);
    expect(new JsonRepairAdvisoryStore(join(folder, 'a.json')).save(advisory)).toEqual(advisory);
    expect(new JsonReviewGateEvaluationStore(join(folder, 'g.json')).save('k', evaluation)).toEqual(evaluation);
    expect(new JsonFailureSnapshotStore(join(folder, 'f.json')).findByContextHash('fh')).toEqual(failure);
    expect(new JsonRepairAdvisoryStore(join(folder, 'a.json')).findByContextHash('ah')).toEqual(advisory);
    expect(new JsonReviewGateEvaluationStore(join(folder, 'g.json')).findByIdempotencyKey('k')).toEqual(evaluation);
  });
});
