import { useCallback } from "react";
import { useParams } from "react-router-dom";
import { T, alpha } from "../design/tokens";
import { useI18n } from "../i18n/I18nContext";
import { architectureClient } from "../api/architecture.client";
import { assistantClient } from "../api/assistant.client";
import { useApiResource } from "../hooks/useApiResource";
import { Skeleton } from "../shared/ui/Skeleton";
import { ErrorState } from "../shared/ui/ErrorState";
import { EmptyState } from "../shared/ui/EmptyState";
import { MissionNav } from "../shared/ui/MissionNav";
import { ExplainWithAi, useExplainAiMap } from "../shared/ui/ExplainWithAi";
import { ArchitectureReviewPanel } from "../shared/ui/ArchitectureReviewPanel";

const SEVERITY_COLOR: Record<string, string> = { LOW: T.textMuted, MEDIUM: T.amber, HIGH: T.amber, CRITICAL: T.red };

export function MissionArchitecture() {
  const { missionId = "" } = useParams<{ missionId: string }>();
  const { t } = useI18n();
  const loader = useCallback(() => architectureClient.get(missionId), [missionId]);
  const { data, loading, error, reload } = useApiResource(loader, [missionId]);
  const { stateFor, trigger } = useExplainAiMap();

  return (
    <div style={{ padding: 24, maxWidth: 860, margin: "0 auto" }}>
      <MissionNav missionId={missionId} />

      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Skeleton height={28} width="40%" />
          <Skeleton height={16} width="90%" />
          <Skeleton height={16} width="70%" />
        </div>
      )}

      {!loading && error && <ErrorState error={error} onRetry={reload} />}

      {!loading && !error && data && (
        <>
          <h1 style={{ margin: "0 0 18px", fontSize: 20, fontWeight: 800, color: T.text }}>{t("architecture.title")}</h1>

          <ArchitectureReviewPanel missionId={missionId} />

          {data.conflicts.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: T.text }}>{t("architecture.conflicts")}</h2>
              {data.conflicts.map((conflict) => (
                <div key={conflict.id} style={{ background: `${alpha(T.red, 5)}`, border: `1px solid ${alpha(T.red, 19)}`, borderRadius: 8, padding: "10px 14px", marginBottom: 8 }}>
                  <p style={{ margin: "0 0 4px", fontSize: 12.5, fontWeight: 700, color: SEVERITY_COLOR[conflict.severity] ?? T.text }}>
                    {conflict.topic} · {conflict.severity}
                  </p>
                  <p style={{ margin: 0, fontSize: 13, color: T.textSub }}>{conflict.description}</p>
                  {conflict.resolution && <p style={{ margin: "4px 0 0", fontSize: 12.5, color: T.emerald }}>{conflict.resolution}</p>}
                </div>
              ))}
            </div>
          )}

          {data.proposals.length > 0 ? (
            data.proposals.map((proposal) => (
              <article key={proposal.id} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 18, marginBottom: 14 }}>
                <header style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: T.text }}>{proposal.stackKey}</h2>
                  <span style={{ fontSize: 11.5, color: T.textMuted, background: T.surfaceHover, border: `1px solid ${T.border}`, borderRadius: 5, padding: "2px 8px" }}>
                    {proposal.architectureStyle}
                  </span>
                </header>

                {proposal.modules.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <h3 style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      {t("architecture.modules")}
                    </h3>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: T.textSub }}>
                      {proposal.modules.map((module) => (
                        <li key={module.name}>
                          <strong style={{ color: T.text }}>{module.name}</strong> — {module.responsibility}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {proposal.decisions.length > 0 && (
                  <div>
                    <h3 style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      {t("architecture.decisions")}
                    </h3>
                    {proposal.decisions.map((decision) => (
                      <div key={decision.id} style={{ background: T.surfaceHover, borderRadius: 8, padding: "12px 14px", marginBottom: 8 }}>
                        <p style={{ margin: "0 0 4px", fontSize: 12.5, color: T.textMuted }}>{decision.problem}</p>
                        <p style={{ margin: "0 0 4px", fontSize: 13.5, fontWeight: 600, color: T.text }}>{decision.selectedOption}</p>
                        <p style={{ margin: "0 0 8px", fontSize: 12.5, color: T.textSub, lineHeight: 1.55 }}>{decision.rationale}</p>
                        {decision.tradeoffs.length > 0 && (
                          <ul style={{ margin: "0 0 8px", paddingLeft: 18, fontSize: 12, color: T.textMuted }}>
                            {decision.tradeoffs.map((tradeoff) => (
                              <li key={tradeoff}>{tradeoff}</li>
                            ))}
                          </ul>
                        )}
                        <p style={{ margin: "0 0 8px", fontSize: 11.5, color: T.textMuted }}>{decision.decidedBy}</p>
                        <ExplainWithAi
                          state={stateFor(decision.id)}
                          onExplain={() => trigger(decision.id, () => assistantClient.explainArchitectureDecision(missionId, decision.id))}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </article>
            ))
          ) : (
            <EmptyState title={t("architecture.empty")} />
          )}
        </>
      )}
    </div>
  );
}
