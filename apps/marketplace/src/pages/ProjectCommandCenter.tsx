import { useCallback, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Plus, AlertTriangle, CheckCircle2, MessageCircle, ArrowRight, Rocket } from "lucide-react";
import { T, alpha } from "../design/tokens";
import { useI18n } from "../i18n/I18nContext";
import { missionClient, type MissionSummaryDto } from "../api/mission.client";
import { projectClient } from "../api/project.client";
import { useApiResource } from "../hooks/useApiResource";
import { useCopilot } from "../shell/CopilotContext";
import { missionStatus, MISSION_STATUS_COLOR, MISSION_STATUS_LABEL_KEY } from "../shared/ui/missionStatus";
import { missionProgressPercent, currentStageKey, StageRail } from "../shared/ui/StageRail";
import { ErrorState } from "../shared/ui/ErrorState";
import { Skeleton } from "../shared/ui/Skeleton";
import { AssignMissionDialog } from "./dialogs/AssignMissionDialog";

export function ProjectCommandCenter() {
  const { projectId = "" } = useParams<{ projectId: string }>();
  const { t } = useI18n();
  const copilot = useCopilot();
  const [dialogOpen, setDialogOpen] = useState(false);

  const loader = useCallback(
    () => Promise.all([projectClient.get(projectId), missionClient.list()]).then(([project, missions]) => ({ project, missions })),
    [projectId],
  );
  const { data, loading, error, reload } = useApiResource(loader, [projectId]);

  const missions = useMemo<MissionSummaryDto[]>(() => {
    if (!data) return [];
    const ids = new Set(data.project.missionIds);
    return data.missions.filter((m) => ids.has(m.missionId));
  }, [data]);

  const active = missions.filter((m) => missionStatus(m) !== "cancelled");
  const overallProgress = active.length === 0 ? 0 : Math.round(active.reduce((sum, m) => sum + missionProgressPercent(m.generatorState), 0) / active.length);
  const blocked = missions.filter((m) => missionStatus(m) === "blocked");
  const inProgress = [...missions].filter((m) => ["active", "inProgress"].includes(missionStatus(m))).sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1));
  const nowMission = inProgress[0] ?? blocked[0] ?? missions[0];
  const allCompleted = missions.length > 0 && missions.every((m) => missionStatus(m) === "completed");

  function handleDialogClosed(assigned: boolean) {
    setDialogOpen(false);
    if (assigned) reload();
  }

  return (
    <div style={{ padding: "28px clamp(18px, 4vw, 42px) 42px", maxWidth: 980, margin: "0 auto" }}>
      <Link to="/projects" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: T.textMuted, fontSize: 12.5, textDecoration: "none", marginBottom: 14 }}>
        ← {t("projects.backToProjects")}
      </Link>

      {loading && <div style={{ display: "flex", flexDirection: "column", gap: 10 }}><Skeleton height={90} /><Skeleton height={140} /></div>}
      {!loading && error && <ErrorState error={error} onRetry={reload} />}

      {!loading && !error && data && (
        <>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 8 }}>
            <div>
              <p style={{ margin: "0 0 6px", color: T.cyan, fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase" }}>{t("projects.eyebrow")}</p>
              <h1 style={{ margin: 0, color: T.text, fontSize: 27, letterSpacing: "-0.035em" }}>{data.project.name}</h1>
            </div>
            {active.length > 0 && (
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 30, fontWeight: 800, color: T.text, letterSpacing: "-0.03em" }}>{allCompleted ? 100 : overallProgress}%</div>
                <div style={{ fontSize: 11, color: T.textMuted }}>{allCompleted ? t("projects.allCompleted") : t("projects.progressLabel")}</div>
              </div>
            )}
          </div>

          {missions.length === 0 ? (
            <div className="stat-card" style={{ marginTop: 20, textAlign: "center", padding: 32 }}>
              <p style={{ margin: "0 0 14px", color: T.textMuted, fontSize: 13.5 }}>{t("projects.noMissions")}</p>
              <button className="btn-primary" onClick={() => setDialogOpen(true)}>
                <Plus size={14} /> {t("projects.assignMission")}
              </button>
            </div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, margin: "20px 0" }}>
                <div className="stat-card">
                  <p style={{ margin: "0 0 6px", fontSize: 11, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>{t("projects.nowLabel")}</p>
                  {nowMission ? (
                    <p style={{ margin: 0, fontSize: 13.5, color: T.text, fontWeight: 600 }}>{nowMission.rawUserIdea}</p>
                  ) : (
                    <p style={{ margin: 0, fontSize: 13.5, color: T.textMuted }}>{t("projects.nowNothing")}</p>
                  )}
                </div>
                <div className="stat-card">
                  <p style={{ margin: "0 0 6px", fontSize: 11, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>{t("projects.nextActionLabel")}</p>
                  {blocked.length > 0 ? (
                    <p style={{ margin: 0, fontSize: 13.5, color: T.red, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                      <AlertTriangle size={14} /> {t("projects.nextActionBlocked", { name: blocked[0].rawUserIdea })}
                    </p>
                  ) : (
                    <p style={{ margin: 0, fontSize: 13.5, color: T.emerald, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                      <CheckCircle2 size={14} /> {t("projects.nextActionNone")}
                    </p>
                  )}
                </div>
              </div>

              <div className="stat-card" style={{ marginBottom: 20 }}>
                <p style={{ margin: "0 0 12px", fontSize: 11, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>{t("projects.journeyLabel")}</p>
                <StageRail generatorState={nowMission?.generatorState} />
              </div>

              <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
                <button className="btn-primary" onClick={copilot.open}>
                  <MessageCircle size={14} /> {t("projects.talkToLdcn")}
                </button>
                {nowMission && (
                  <Link className="btn-ghost" to={`/missions/${nowMission.missionId}`}>
                    <ArrowRight size={13} /> {t("projects.viewTechnicalDetails")}
                  </Link>
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <p style={{ margin: 0, fontSize: 11, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
                  {t("projects.missionsLabel")} · {missions.length}
                </p>
                <button className="btn-ghost" onClick={() => setDialogOpen(true)}>
                  <Plus size={13} /> {t("projects.assignMission")}
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {missions.map((m) => {
                  const status = missionStatus(m);
                  const color = MISSION_STATUS_COLOR[status];
                  return (
                    <Link key={m.missionId} to={`/missions/${m.missionId}`} className="mcard" style={{ textDecoration: "none", flexDirection: "row", alignItems: "center", gap: 12, padding: "13px 16px" }}>
                      <span style={{ width: 28, height: 28, borderRadius: 8, display: "grid", placeItems: "center", flexShrink: 0, color, background: alpha(color, 14) }}>
                        <Rocket size={13} />
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: "0 0 2px", fontSize: 13.5, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.rawUserIdea}</p>
                        <p style={{ margin: 0, fontSize: 11.5, color: T.textMuted }}>{t(`stageRail.${currentStageKey(m.generatorState)}`)}</p>
                      </div>
                      <span style={{ fontSize: 10.5, fontWeight: 600, color, background: alpha(color, 14), border: `1px solid ${alpha(color, 30)}`, padding: "2px 8px", borderRadius: 20, flexShrink: 0 }}>
                        {t(MISSION_STATUS_LABEL_KEY[status])}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {dialogOpen && <AssignMissionDialog projectId={projectId} onClosed={handleDialogClosed} />}
    </div>
  );
}
