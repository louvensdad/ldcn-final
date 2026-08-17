import { useCallback, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Sparkles, AlertTriangle, CheckCircle2, XCircle, Rocket } from "lucide-react";
import { T, alpha } from "../design/tokens";
import { useI18n } from "../i18n/I18nContext";
import { missionClient, type MissionSummaryDto } from "../api/mission.client";
import { useApiResource } from "../hooks/useApiResource";
import { missionStatus, MISSION_STATUS_COLOR, type MissionStatus } from "../shared/ui/missionStatus";
import { missionProgressPercent, currentStageKey } from "../shared/ui/StageRail";
import { Skeleton } from "../shared/ui/Skeleton";
import { ErrorState } from "../shared/ui/ErrorState";
import { EmptyState } from "../shared/ui/EmptyState";

const CARD_ICON: Record<MissionStatus, typeof AlertTriangle> = {
  blocked: AlertTriangle,
  completed: CheckCircle2,
  cancelled: XCircle,
  active: Rocket,
  inProgress: Rocket,
};

function subtitleKey(status: MissionStatus): string {
  if (status === "blocked") return "home.card.blocked";
  if (status === "completed") return "home.card.completed";
  if (status === "cancelled") return "home.card.cancelled";
  return "home.card.inProgress";
}

function actionKey(status: MissionStatus): string {
  if (status === "completed") return "home.card.viewResults";
  if (status === "cancelled") return "home.card.viewDetails";
  return "home.card.continue";
}

export function Workspace() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [idea, setIdea] = useState("");
  const loader = useCallback(() => missionClient.list(), []);
  const { data: missions, loading, error, reload } = useApiResource(loader, []);

  function startWithAi() {
    navigate("/wizard", idea.trim() ? { state: { idea: idea.trim() } } : undefined);
  }

  const sorted = [...(missions ?? [])].sort((a, b) => {
    const rank: Record<MissionStatus, number> = { blocked: 0, active: 1, inProgress: 1, completed: 2, cancelled: 3 };
    const diff = rank[missionStatus(a)] - rank[missionStatus(b)];
    return diff !== 0 ? diff : (a.updatedAt > b.updatedAt ? -1 : 1);
  });

  return (
    <div style={{ padding: "28px clamp(18px, 4vw, 42px) 42px", maxWidth: 1180, margin: "0 auto" }}>
      <div
        style={{
          border: `1px solid ${T.borderStrong}`,
          borderRadius: 18,
          padding: "36px clamp(20px, 4vw, 40px)",
          marginBottom: 32,
          background: `linear-gradient(135deg, ${alpha(T.indigo, 6)} 0%, ${T.surface} 60%)`,
        }}
      >
        <p style={{ margin: "0 0 10px", color: T.indigo, fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase" }}>
          {t("home.eyebrow")}
        </p>
        <h1 style={{ margin: "0 0 10px", fontSize: 30, lineHeight: 1.15, letterSpacing: "-0.035em", fontWeight: 850, color: T.text, maxWidth: 620 }}>
          {t("home.heroTitle")}
        </h1>
        <p style={{ margin: "0 0 20px", color: T.textMuted, fontSize: 14, maxWidth: 560 }}>{t("home.heroSubtitle")}</p>

        <textarea
          className="field-input field-textarea"
          style={{ maxWidth: 640, fontSize: 14.5, minHeight: 76 }}
          placeholder={t("home.heroPlaceholder")}
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) startWithAi();
          }}
        />
        <div style={{ marginTop: 12 }}>
          <button className="btn-primary" style={{ fontSize: 14, padding: "11px 20px" }} onClick={startWithAi}>
            <Sparkles size={15} /> {t("home.startWithAi")}
          </button>
        </div>
      </div>

      {loading && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
          <Skeleton height={132} />
          <Skeleton height={132} />
          <Skeleton height={132} />
        </div>
      )}

      {!loading && error && <ErrorState error={error} onRetry={reload} />}

      {!loading && !error && sorted.length === 0 && (
        <EmptyState title={t("workspace.empty.title")} description={t("workspace.empty.description")} />
      )}

      {!loading && !error && sorted.length > 0 && (
        <>
          <p style={{ margin: "0 0 12px", fontSize: 11, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 700 }}>
            {t("home.continueWorking")}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
            {sorted.map((mission: MissionSummaryDto) => {
              const status = missionStatus(mission);
              const pct = missionProgressPercent(mission.generatorState);
              const Icon = CARD_ICON[status];
              const color = MISSION_STATUS_COLOR[status];
              return (
                <Link key={mission.missionId} to={`/missions/${mission.missionId}`} className="mcard" style={{ textDecoration: "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <span style={{ width: 28, height: 28, borderRadius: 8, display: "grid", placeItems: "center", flexShrink: 0, color, background: alpha(color, 14) }}>
                      <Icon size={14} />
                    </span>
                    <span style={{ fontSize: 11, color: T.textMuted }}>{t(`stageRail.${currentStageKey(mission.generatorState)}`)}</span>
                  </div>
                  <strong style={{ display: "block", fontSize: 14.5, fontWeight: 700, color: T.text, lineHeight: 1.35, marginBottom: 14 }}>
                    {mission.rawUserIdea}
                  </strong>
                  {status !== "cancelled" && (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                        <span style={{ fontSize: 12, color: T.textSub }}>{t(subtitleKey(status))}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{pct}%</span>
                      </div>
                      <div style={{ height: 5, background: T.surfaceEl, borderRadius: 3, overflow: "hidden", marginBottom: 14 }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3 }} />
                      </div>
                    </>
                  )}
                  {status === "cancelled" && <p style={{ fontSize: 12, color: T.textMuted, marginBottom: 14 }}>{t(subtitleKey(status))}</p>}
                  <span className="btn-ghost" style={{ display: "inline-flex", width: "fit-content" }}>
                    {t(actionKey(status))}
                  </span>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
