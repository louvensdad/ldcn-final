import { useCallback, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { T, alpha } from "../design/tokens";
import { useI18n } from "../i18n/I18nContext";
import { missionClient } from "../api/mission.client";
import { discoveryClient } from "../api/discovery.client";
import { useApiResource } from "../hooks/useApiResource";
import { Skeleton } from "../shared/ui/Skeleton";
import { ErrorState } from "../shared/ui/ErrorState";
import { StageRail } from "../shared/ui/StageRail";
import { MissionNav } from "../shared/ui/MissionNav";
import { MissionOverviewCards } from "../shared/ui/MissionOverviewCards";
import { JourneyStepper } from "../shared/ui/JourneyStepper";
import { needsUserDecision, nextActionLabelKey } from "../shared/ui/nextAction";
import { generationClient } from "../api/generation.client";
import { useCopilot } from "../shell/CopilotContext";
import { MissionDiscovery } from "./MissionDiscovery";

/**
 * Which experience a mission gets is entirely driven by real server state, not a client guess:
 * while there's a DiscoveryConversation that hasn't been handed off yet, this renders the
 * conversational Discovery→Escopo→PromptMaster flow (MissionDiscovery). Only after PromptMaster
 * approval — once the deterministic engine has actually run — does the classic technical overview
 * appear. No mission is ever silently dropped on a page with nothing to do (mission bug report,
 * Fase 15/16).
 */
export function MissionDetail() {
  const { missionId = "" } = useParams<{ missionId: string }>();

  const discoveryLoader = useCallback(() => discoveryClient.get(missionId), [missionId]);
  const { data: discovery, loading: discoveryLoading, error: discoveryError, reload: reloadDiscovery } = useApiResource(discoveryLoader, [missionId]);

  if (discoveryLoading) {
    return (
      <div style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Skeleton height={28} width="40%" />
          <Skeleton height={16} width="90%" />
          <Skeleton height={16} width="70%" />
        </div>
      </div>
    );
  }

  if (discoveryError) {
    return (
      <div style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
        <ErrorState error={discoveryError} onRetry={reloadDiscovery} />
      </div>
    );
  }

  const inDiscovery = discovery && discovery.status !== "HANDED_OFF";

  if (inDiscovery) {
    return (
      <div style={{ padding: 24, maxWidth: 1020, margin: "0 auto" }}>
        <Link to="/" style={{ display: "inline-block", marginBottom: 16, fontSize: 13, color: T.textSub, textDecoration: "none" }}>
          <BackLabel />
        </Link>
        <header style={{ marginBottom: 22 }}>
          <p style={{ margin: "0 0 4px", fontSize: 11.5, color: T.textMuted, fontFamily: "monospace" }}>{missionId}</p>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: T.text }}>{discovery.rawUserIdea}</h1>
        </header>
        <MissionDiscovery discovery={discovery} onAdvance={reloadDiscovery} />
      </div>
    );
  }

  return <ClassicMissionOverview missionId={missionId} />;
}

function BackLabel() {
  const { t } = useI18n();
  return <>← {t("missionDetail.backToWorkspace")}</>;
}

function ClassicMissionOverview({ missionId }: { missionId: string }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const copilot = useCopilot();
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const loader = useCallback(() => missionClient.getOverview(missionId), [missionId]);
  const { data: overview, loading, error, reload } = useApiResource(loader, [missionId]);

  const startGeneration = useCallback(async () => {
    setStarting(true);
    setStartError(null);
    try {
      await generationClient.start(missionId);
      navigate(`/missions/${missionId}/execution`);
    } catch (err) {
      setStartError(err instanceof Error ? err.message : "UNKNOWN");
    } finally {
      setStarting(false);
    }
  }, [missionId, navigate]);

  if (loading) {
    return (
      <div style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Skeleton height={28} width="40%" />
          <Skeleton height={16} width="90%" />
          <Skeleton height={16} width="70%" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
        <ErrorState error={error} onRetry={reload} />
        <button className="btn-ghost" onClick={() => navigate("/")}>
          {t("missionDetail.backToWorkspace")}
        </button>
      </div>
    );
  }

  if (!overview) return null;

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
      <Link to="/" style={{ display: "inline-block", marginBottom: 16, fontSize: 13, color: T.textSub, textDecoration: "none" }}>
        ← {t("missionDetail.backToWorkspace")}
      </Link>
      <MissionNav missionId={missionId} />

      <header style={{ marginBottom: 18 }}>
        <p style={{ margin: "0 0 4px", fontSize: 11.5, color: T.textMuted, fontFamily: "monospace" }}>{overview.missionId}</p>
        <h1 style={{ margin: "0 0 14px", fontSize: 20, fontWeight: 800, color: T.text }}>{overview.intentSummary.rawUserIdea}</h1>
        <StageRail generatorState={overview.generatorState} />
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 200px", gap: 32, alignItems: "start" }}>
        <div>
          {overview.nextAction === "START_EXECUTION" && (
            <div
              style={{
                marginBottom: 20, padding: "12px 16px", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
                background: alpha(T.indigo, 6), border: `1px solid ${alpha(T.indigo, 20)}`,
              }}
            >
              <span style={{ fontSize: 13, color: T.textSub }}>{t("missionDetail.readyToGenerate")}</span>
              <button className="btn-primary" onClick={startGeneration} disabled={starting}>
                {starting ? t("execution.generation.starting") : t("missionDetail.startGeneration")}
              </button>
            </div>
          )}

          {startError && (
            <div
              style={{
                marginBottom: 20, padding: "12px 16px", borderRadius: 10,
                background: alpha(T.red, 6), border: `1px solid ${alpha(T.red, 19)}`,
              }}
            >
              <span style={{ fontSize: 13, color: T.textSub }}>
                {startError === "ARCHITECTURE_REVIEW_NOT_APPROVED" ? t("execution.generation.needsArchitectureApproval") : startError}
              </span>
            </div>
          )}

          {needsUserDecision(overview) && (
            <div
              style={{
                marginBottom: 20, padding: "12px 16px", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
                background: alpha(T.amber, 6), border: `1px solid ${alpha(T.amber, 20)}`,
              }}
            >
              <span style={{ fontSize: 13, color: T.textSub }}>{t(nextActionLabelKey(overview.nextAction))}</span>
              <button className="btn-ghost" onClick={() => copilot.open()}>
                {t("copilot.title")}
              </button>
            </div>
          )}

          {overview.blockers.length > 0 && (
            <div
              style={{
                marginBottom: 20,
                padding: "12px 16px",
                borderRadius: 10,
                background: `${alpha(T.red, 6)}`,
                border: `1px solid ${alpha(T.red, 19)}`,
              }}
            >
              <h2 style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 700, color: T.red, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {t("missionDetail.blockers")}
              </h2>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: T.textSub }}>
                {overview.blockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            </div>
          )}

          <MissionOverviewCards overview={overview} />
        </div>

        <div style={{ position: "sticky", top: 24 }}>
          <p style={{ margin: "0 0 14px", fontSize: 11, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 700 }}>
            {t("journey.title")}
          </p>
          <JourneyStepper generatorState={overview.generatorState} architectureReviewStatus={overview.architectureReviewStatus} />
        </div>
      </div>
    </div>
  );
}
