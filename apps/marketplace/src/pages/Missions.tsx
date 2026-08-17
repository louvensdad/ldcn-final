import { useCallback, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, AlertTriangle } from "lucide-react";
import { T, alpha } from "../design/tokens";
import { useI18n } from "../i18n/I18nContext";
import { missionClient, type MissionSummaryDto } from "../api/mission.client";
import { useApiResource } from "../hooks/useApiResource";
import { missionStatus, MISSION_STATUS_COLOR, MISSION_STATUS_LABEL_KEY, type MissionStatus } from "../shared/ui/missionStatus";
import { currentStageKey } from "../shared/ui/StageRail";
import { nextActionLabelKey } from "../shared/ui/nextAction";
import { Skeleton } from "../shared/ui/Skeleton";
import { ErrorState } from "../shared/ui/ErrorState";
import { EmptyState } from "../shared/ui/EmptyState";

type Filter = "all" | MissionStatus;

const FILTERS: Filter[] = ["all", "active", "blocked", "inProgress", "completed"];

export function Missions() {
  const { t, tn } = useI18n();
  const navigate = useNavigate();
  const loader = useCallback(() => missionClient.list(), []);
  const { data: missions, loading, error, reload } = useApiResource(loader, []);
  const [filter, setFilter] = useState<Filter>("all");

  const shown = useMemo(() => {
    const list = missions ?? [];
    return filter === "all" ? list : list.filter((m) => missionStatus(m) === filter);
  }, [missions, filter]);

  return (
    <div style={{ padding: 28 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: "0 0 3px", fontSize: 18, fontWeight: 700, color: T.text }}>{t("missions.title")}</h2>
          <p style={{ margin: 0, fontSize: 13, color: T.textMuted }}>{tn("missions.count", missions?.length ?? 0)}</p>
        </div>
        <button className="btn-primary" onClick={() => navigate("/wizard")}>
          <Plus size={14} /> {t("workspace.newMission")}
        </button>
      </div>

      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Skeleton height={72} />
          <Skeleton height={72} />
          <Skeleton height={72} />
        </div>
      )}

      {!loading && error && <ErrorState error={error} onRetry={reload} />}

      {!loading && !error && missions && missions.length === 0 && (
        <EmptyState
          title={t("workspace.empty.title")}
          description={t("workspace.empty.description")}
          action={
            <button className="btn-primary" onClick={() => navigate("/wizard")}>
              <Plus size={14} /> {t("workspace.newMission")}
            </button>
          }
        />
      )}

      {!loading && !error && missions && missions.length > 0 && (
        <>
          <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
            {FILTERS.map((f) => (
              <button key={f} className={`stab${filter === f ? " active" : ""}`} onClick={() => setFilter(f)}>
                {t(f === "all" ? "missions.filter.all" : MISSION_STATUS_LABEL_KEY[f])}
              </button>
            ))}
          </div>

          {shown.length === 0 ? (
            <p style={{ fontSize: 13, color: T.textMuted, padding: "24px 0" }}>{t("missions.filter.empty")}</p>
          ) : (
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "2.2fr 1fr 1fr 1fr 1fr", gap: 12, padding: "10px 16px", borderBottom: `1px solid ${T.border}` }}>
                {[t("missions.col.mission"), t("missions.col.stage"), t("missions.col.status"), t("missions.col.blockers"), t("missions.col.updated")].map((h) => (
                  <span key={h} style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {h}
                  </span>
                ))}
              </div>
              {shown.map((m: MissionSummaryDto) => {
                const status = missionStatus(m);
                return (
                  <Link
                    key={m.missionId}
                    to={`/missions/${m.missionId}`}
                    className="mission-row"
                    style={{ display: "grid", gridTemplateColumns: "2.2fr 1fr 1fr 1fr 1fr", gap: 12, padding: "13px 16px", color: "inherit" }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {m.rawUserIdea}
                      </div>
                      <div style={{ fontSize: 11.5, color: T.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t(nextActionLabelKey(m.nextAction))}</div>
                    </div>
                    <span style={{ fontSize: 12.5, color: T.textSub, alignSelf: "center" }}>{t(`stageRail.${currentStageKey(m.generatorState)}`)}</span>
                    <span style={{ alignSelf: "center" }}>
                      <span
                        style={{
                          background: `${alpha(MISSION_STATUS_COLOR[status], 9)}`, color: MISSION_STATUS_COLOR[status],
                          border: `1px solid ${alpha(MISSION_STATUS_COLOR[status], 25)}`, padding: "2px 8px", borderRadius: 5,
                          fontSize: 11, fontWeight: 600,
                        }}
                      >
                        {t(MISSION_STATUS_LABEL_KEY[status])}
                      </span>
                    </span>
                    <span style={{ alignSelf: "center", fontSize: 12.5, color: m.blockers.length > 0 ? T.red : T.textMuted, display: "flex", alignItems: "center", gap: 4 }}>
                      {m.blockers.length > 0 && <AlertTriangle size={11} />}
                      {m.blockers.length}
                    </span>
                    <span style={{ alignSelf: "center", fontSize: 12, color: T.textMuted }}>{new Date(m.updatedAt).toLocaleDateString()}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
