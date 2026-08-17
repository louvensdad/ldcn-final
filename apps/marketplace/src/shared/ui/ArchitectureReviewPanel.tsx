import { useCallback, useState } from "react";
import { T, alpha } from "../../design/tokens";
import { useI18n } from "../../i18n/I18nContext";
import { architectureReviewClient, type ArchitectureReviewSessionDto } from "../../api/architecture-review.client";
import { useApiResource } from "../../hooks/useApiResource";
import { Skeleton } from "./Skeleton";

const FINDING_SEVERITY_COLOR: Record<string, string> = { INFO: T.textMuted, ADVISORY: T.textMuted, WARNING: T.amber, BLOCKER: T.red };
const STATUS_COLOR: Record<string, string> = { PENDING: T.indigo, APPROVED: T.emerald, REWORK_REQUIRED: T.amber, BLOCKED: T.red };

const cardStyle = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 18, marginBottom: 20 };

/**
 * MISSÃO "Arquitetura não pode seguir automaticamente para Entrega" — o painel real do gate:
 * council cognitivo (LLM) + políticas determinísticas, nunca um avanço silencioso. Vive em
 * MissionArchitecture.tsx (a página já real de arquitetura), não uma rota separada.
 */
export function ArchitectureReviewPanel({ missionId }: { missionId: string }) {
  const { t } = useI18n();
  const [starting, setStarting] = useState(false);
  const [actingOn, setActingOn] = useState<string | null>(null);

  const loader = useCallback(() => architectureReviewClient.getSession(missionId), [missionId]);
  const { data, loading, error, reload } = useApiResource(loader, [missionId]);

  const start = useCallback(async () => {
    setStarting(true);
    try {
      await architectureReviewClient.start(missionId);
    } finally {
      setStarting(false);
      reload();
    }
  }, [missionId, reload]);

  const resolve = useCallback(async (findingId: string) => {
    setActingOn(findingId);
    try {
      await architectureReviewClient.resolveFinding(missionId, findingId);
    } finally {
      setActingOn(null);
      reload();
    }
  }, [missionId, reload]);

  const decide = useCallback(async (findingId: string, option: string) => {
    setActingOn(findingId);
    try {
      await architectureReviewClient.decideFinding(missionId, findingId, option);
    } finally {
      setActingOn(null);
      reload();
    }
  }, [missionId, reload]);

  if (loading) {
    return (
      <div style={cardStyle}>
        <Skeleton height={20} width="30%" />
      </div>
    );
  }

  const notStarted = error?.code === "ARCHITECTURE_REVIEW_NOT_STARTED";

  if (notStarted) {
    return (
      <div style={cardStyle}>
        <h2 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: T.text }}>{t("architectureReview.title")}</h2>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: T.textMuted }}>{t("architectureReview.notStarted")}</p>
        <button className="btn-primary" onClick={start} disabled={starting}>
          {starting ? t("architectureReview.starting") : t("architectureReview.start")}
        </button>
      </div>
    );
  }

  if (error) {
    return (
      <div style={cardStyle}>
        <h2 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: T.text }}>{t("architectureReview.title")}</h2>
        <p style={{ fontSize: 12.5, color: T.red }}>{error.code}</p>
        <button className="btn-ghost" onClick={reload}>{t("common.retry")}</button>
      </div>
    );
  }

  if (!data) return null;
  const session: ArchitectureReviewSessionDto = data;
  const openFindings = session.findings.filter((f) => f.status === "OPEN");

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.text }}>{t("architectureReview.title")}</h2>
        <span
          style={{
            fontSize: 11.5, fontWeight: 700, padding: "4px 10px", borderRadius: 999,
            background: alpha(STATUS_COLOR[session.status] ?? T.textMuted, 12), color: STATUS_COLOR[session.status] ?? T.textMuted,
          }}
        >
          {t(`architectureReview.status.${session.status}`)}
        </span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
        {session.executions.map((e) => (
          <span
            key={e.reviewerKey}
            style={{
              fontSize: 11, fontFamily: "monospace", padding: "3px 8px", borderRadius: 6,
              background: T.surfaceHover, border: `1px solid ${T.border}`,
              color: e.status === "PASSED" ? T.textSub : e.status === "DEGRADED" ? T.amber : T.red,
            }}
          >
            {e.reviewerKey} · {e.status}
          </span>
        ))}
      </div>

      {session.findings.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {session.findings.map((f) => (
            <div
              key={f.id}
              style={{
                background: f.status === "RESOLVED" ? T.surfaceHover : alpha(FINDING_SEVERITY_COLOR[f.severity] ?? T.textMuted, 5),
                border: `1px solid ${alpha(FINDING_SEVERITY_COLOR[f.severity] ?? T.textMuted, f.status === "RESOLVED" ? 10 : 19)}`,
                borderRadius: 8, padding: "10px 14px", opacity: f.status === "RESOLVED" ? 0.6 : 1,
              }}
            >
              <p style={{ margin: "0 0 4px", fontSize: 12.5, fontWeight: 700, color: FINDING_SEVERITY_COLOR[f.severity] ?? T.text }}>
                {f.reviewerKey} · {f.code} · {f.severity}
              </p>
              <p style={{ margin: 0, fontSize: 13, color: T.textSub }}>{f.finding}</p>
              {f.status === "OPEN" && f.recommendedResolutions.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                  {f.recommendedResolutions.map((option) => (
                    <button key={option} className="btn-ghost" disabled={actingOn === f.id} onClick={() => decide(f.id, option)}>
                      {option}
                    </button>
                  ))}
                </div>
              )}
              {f.status === "OPEN" && f.recommendedResolutions.length === 0 && !f.requiresUserDecision && (
                <button className="btn-ghost" style={{ marginTop: 8 }} disabled={actingOn === f.id} onClick={() => resolve(f.id)}>
                  {t("architectureReview.markResolved")}
                </button>
              )}
              {f.status === "RESOLVED" && f.chosenOption && (
                <p style={{ margin: "6px 0 0", fontSize: 11.5, color: T.emerald }}>{t("architectureReview.resolvedWith", { option: f.chosenOption })}</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p style={{ fontSize: 12.5, color: T.textMuted }}>{t("architectureReview.noFindings")}</p>
      )}

      {openFindings.length === 0 && session.status !== "APPROVED" && (
        <button className="btn-primary" style={{ marginTop: 12 }} onClick={start} disabled={starting}>
          {starting ? t("architectureReview.starting") : t("architectureReview.retry")}
        </button>
      )}
    </div>
  );
}
