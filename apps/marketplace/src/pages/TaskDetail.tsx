import { useCallback, useState } from "react";
import { useParams } from "react-router-dom";
import { T } from "../design/tokens";
import { useI18n } from "../i18n/I18nContext";
import { taskClient } from "../api/task.client";
import { assistantClient } from "../api/assistant.client";
import { gateClient, type ReviewGateEvidenceDto, type ReviewGateEvaluationDto } from "../api/gate.client";
import { ApiClientError, type AppError } from "../api/client";
import { useApiResource } from "../hooks/useApiResource";
import { Skeleton } from "../shared/ui/Skeleton";
import { ErrorState } from "../shared/ui/ErrorState";
import { MissionNav } from "../shared/ui/MissionNav";
import { ExplainWithAi, useExplainAi } from "../shared/ui/ExplainWithAi";

function toAppError(err: unknown): AppError {
  return err instanceof ApiClientError ? err.appError : { category: "UNKNOWN", status: 0, code: "UNKNOWN", translationKey: "errors.unknown" };
}

interface GateFormRow {
  passed: boolean;
  evidenceRef: string;
}
const IDLE_GATE_ROW: GateFormRow = { passed: false, evidenceRef: "" };

const cardStyle = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 18, marginBottom: 14 };

export function TaskDetail() {
  const { missionId = "", taskId = "" } = useParams<{ missionId: string; taskId: string }>();
  const { t } = useI18n();

  const loader = useCallback(() => taskClient.getOverview(missionId, taskId), [missionId, taskId]);
  const { data, loading, error, reload } = useApiResource(loader, [missionId, taskId]);

  const [routingInFlight, setRoutingInFlight] = useState(false);
  const [routingError, setRoutingError] = useState<AppError | null>(null);
  const { state: explainState, trigger: explainRouting } = useExplainAi(() => assistantClient.explainRoutingDecision(missionId, taskId));

  const [gateForm, setGateForm] = useState<Record<string, GateFormRow>>({});
  const [gatesInFlight, setGatesInFlight] = useState(false);
  const [gatesError, setGatesError] = useState<AppError | null>(null);
  const [gateEvaluation, setGateEvaluation] = useState<ReviewGateEvaluationDto | null>(null);

  function gateFormFor(gateKey: string): GateFormRow {
    return gateForm[gateKey] ?? IDLE_GATE_ROW;
  }

  async function route() {
    if (routingInFlight) return;
    setRoutingInFlight(true);
    setRoutingError(null);
    try {
      await taskClient.route(missionId, taskId);
      reload();
    } catch (err) {
      setRoutingError(toAppError(err));
    } finally {
      setRoutingInFlight(false);
    }
  }

  async function evaluateGates(requiredGateKeys: string[]) {
    if (gatesInFlight) return;
    setGatesInFlight(true);
    setGatesError(null);
    const evidence: ReviewGateEvidenceDto[] = requiredGateKeys.map((gateKey) => {
      const row = gateFormFor(gateKey);
      return { gateKey, passed: row.passed, evidenceRefs: row.evidenceRef ? [row.evidenceRef] : [] };
    });
    try {
      const evaluation = await gateClient.evaluate(missionId, taskId, evidence);
      setGateEvaluation(evaluation);
    } catch (err) {
      setGatesError(toAppError(err));
    } finally {
      setGatesInFlight(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 860, margin: "0 auto" }}>
      <MissionNav missionId={missionId} />

      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Skeleton height={28} width="40%" />
          <Skeleton height={16} width="90%" />
        </div>
      )}

      {!loading && error && <ErrorState error={error} onRetry={reload} />}

      {!loading && !error && data && (
        <>
          <p style={{ margin: "0 0 16px", fontSize: 11.5, color: T.textMuted, fontFamily: "monospace" }}>{taskId}</p>

          {data.classification && (
            <div style={cardStyle}>
              <h2 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: T.text }}>{t("tasks.classification")}</h2>
              <p style={{ margin: "0 0 4px", fontSize: 14.5, fontWeight: 600, color: T.text }}>{data.classification.jobType}</p>
              <p style={{ margin: "0 0 8px", fontSize: 12.5, color: T.textMuted }}>
                {data.classification.complexity} · {data.classification.riskLevel}
              </p>
              {data.classification.requiredCapabilities.length > 0 && (
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: T.textSub }}>
                  {data.classification.requiredCapabilities.map((cap) => (
                    <li key={cap}>{cap}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {data.routing ? (
            <>
              <div style={cardStyle}>
                <h2 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: T.text }}>{t("tasks.routingExplanation")}</h2>
                <p style={{ margin: "0 0 6px", fontSize: 12.5, fontWeight: 600, color: T.indigo }}>{data.routing.status}</p>
                <p style={{ margin: "0 0 10px", fontSize: 13, color: T.textSub, lineHeight: 1.6 }}>{data.routing.rationale}</p>
                <ExplainWithAi state={explainState} onExplain={explainRouting} />
              </div>

              {data.routing.status === "ROUTED" ? (
                <div style={cardStyle}>
                  <h2 style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: T.text }}>{t("taskDetail.gatesTitle")}</h2>
                  {data.routing.requiredGateKeys.map((gateKey) => (
                    <div key={gateKey} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: T.textSub, flexShrink: 0 }}>
                        <input
                          type="checkbox"
                          checked={gateFormFor(gateKey).passed}
                          onChange={(e) => setGateForm((prev) => ({ ...prev, [gateKey]: { ...gateFormFor(gateKey), passed: e.target.checked } }))}
                        />
                        {gateKey}
                      </label>
                      <input
                        type="text"
                        className="field-input"
                        placeholder={t("taskDetail.gateEvidenceRef")}
                        value={gateFormFor(gateKey).evidenceRef}
                        onChange={(e) => setGateForm((prev) => ({ ...prev, [gateKey]: { ...gateFormFor(gateKey), evidenceRef: e.target.value } }))}
                      />
                    </div>
                  ))}
                  {gatesError && <ErrorState error={gatesError} onRetry={() => evaluateGates(data.routing!.requiredGateKeys)} />}
                  {gateEvaluation && (
                    <p style={{ margin: "8px 0", fontSize: 12.5, fontWeight: 600, color: gateEvaluation.status === "PASSED" ? T.emerald : T.red }}>
                      {gateEvaluation.status} — {gateEvaluation.reason}
                    </p>
                  )}
                  <button className="btn-primary" disabled={gatesInFlight} onClick={() => evaluateGates(data.routing!.requiredGateKeys)}>
                    {gatesInFlight ? t("common.loading") : t("taskDetail.evaluateGates")}
                  </button>
                </div>
              ) : (
                <p style={{ fontSize: 12.5, color: T.textMuted }}>{t("taskDetail.gatesNotReady")}</p>
              )}
            </>
          ) : (
            <div style={cardStyle}>
              {routingError && <p style={{ margin: "0 0 10px", fontSize: 12.5, color: T.red }}>{t(routingError.translationKey)}</p>}
              <button className="btn-primary" disabled={routingInFlight} onClick={route}>
                {routingInFlight ? t("common.loading") : t("tasks.route")}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
