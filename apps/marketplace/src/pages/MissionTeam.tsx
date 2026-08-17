import { useCallback, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { ChevronDown, ChevronRight } from "lucide-react";
import { T } from "../design/tokens";
import { useI18n } from "../i18n/I18nContext";
import { teamClient, type AgentInstanceDto } from "../api/team.client";
import { assistantClient } from "../api/assistant.client";
import { useApiResource } from "../hooks/useApiResource";
import { Skeleton } from "../shared/ui/Skeleton";
import { ErrorState } from "../shared/ui/ErrorState";
import { EmptyState } from "../shared/ui/EmptyState";
import { MissionNav } from "../shared/ui/MissionNav";
import { ExplainWithAi, useExplainAiMap } from "../shared/ui/ExplainWithAi";

const INTEGRATION_UNIT_KEY = "integration-unit";

export function MissionTeam() {
  const { missionId = "" } = useParams<{ missionId: string }>();
  const { t } = useI18n();
  const loader = useCallback(() => teamClient.get(missionId), [missionId]);
  const { data: team, loading, error, reload } = useApiResource(loader, [missionId]);
  const { stateFor, trigger } = useExplainAiMap();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const groups = useMemo(() => {
    if (!team) return [];
    const byStack = new Map<string, AgentInstanceDto[]>();
    for (const instance of team.instances) {
      const key = instance.stackKey ?? INTEGRATION_UNIT_KEY;
      byStack.set(key, [...(byStack.get(key) ?? []), instance]);
    }
    return [...byStack.entries()].map(([stackKey, instances]) => ({ stackKey, instances }));
  }, [team]);

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

      {!loading && !error && team && (
        <>
          <h1 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 800, color: T.text }}>{t("team.title")}</h1>
          <p style={{ margin: "0 0 20px", fontSize: 12.5, color: T.textMuted }}>
            {team.instances.length} {t("team.instances")} · {team.status}
          </p>

          {groups.length > 0 ? (
            groups.map((group) => (
              <div key={group.stackKey} style={{ marginBottom: 20 }}>
                <h2 style={{ margin: "0 0 8px", fontSize: 13.5, fontWeight: 700, color: T.text }}>
                  {group.stackKey === INTEGRATION_UNIT_KEY ? t("team.integrationUnit") : group.stackKey}
                </h2>
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                  {group.instances.map((instance) => {
                    const expanded = expandedId === instance.id;
                    const decisions = team.decisions.filter((decision) => decision.scope === group.stackKey);
                    return (
                      <li key={instance.id} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden" }}>
                        <button
                          type="button"
                          aria-expanded={expanded}
                          onClick={() => setExpandedId(expanded ? null : instance.id)}
                          style={{
                            width: "100%",
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "11px 14px",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            fontFamily: "inherit",
                            textAlign: "left",
                          }}
                        >
                          {expanded ? <ChevronDown size={14} color={T.textMuted} /> : <ChevronRight size={14} color={T.textMuted} />}
                          <span style={{ fontSize: 13.5, fontWeight: 600, color: T.text }}>{instance.role}</span>
                          <span style={{ fontSize: 12, color: T.textMuted, marginLeft: "auto" }}>{instance.agentKey}</span>
                        </button>
                        {expanded && (
                          <div style={{ padding: "0 14px 14px", borderTop: `1px solid ${T.border}` }}>
                            <p style={{ margin: "12px 0", fontSize: 12.5, color: T.textSub, lineHeight: 1.55 }}>{instance.reason}</p>
                            {decisions.map((decision) => (
                              <div key={decision.id} style={{ background: T.surfaceHover, borderRadius: 8, padding: "12px 14px", marginBottom: 8 }}>
                                <p style={{ margin: "0 0 4px", fontSize: 12.5, color: T.textMuted }}>{decision.problem}</p>
                                <p style={{ margin: "0 0 4px", fontSize: 13.5, fontWeight: 600, color: T.text }}>{decision.selectedOption}</p>
                                <p style={{ margin: "0 0 8px", fontSize: 12.5, color: T.textSub, lineHeight: 1.55 }}>{decision.rationale}</p>
                                <ExplainWithAi
                                  state={stateFor(decision.id)}
                                  onExplain={() => trigger(decision.id, () => assistantClient.explainTeamDecision(missionId, decision.id))}
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          ) : (
            <EmptyState title={t("team.empty")} />
          )}
        </>
      )}
    </div>
  );
}
