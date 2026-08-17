import { useCallback, useMemo } from "react";
import { AlertTriangle, MessageCircle, BrainCircuit, CheckCircle2, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { T, alpha } from "../design/tokens";
import { useI18n } from "../i18n/I18nContext";
import { missionClient, type MissionSummaryDto } from "../api/mission.client";
import { architectureClient, type ArchitectureCompositionDto } from "../api/architecture.client";
import { useApiResource } from "../hooks/useApiResource";
import { useCopilot } from "../shell/CopilotContext";
import { needsUserDecision, nextActionLabelKey } from "../shared/ui/nextAction";
import { ErrorState } from "../shared/ui/ErrorState";
import { EmptyState } from "../shared/ui/EmptyState";
import { Skeleton } from "../shared/ui/Skeleton";

interface DecisionsData {
  missions: MissionSummaryDto[];
  architectures: Array<{ mission: MissionSummaryDto; data: ArchitectureCompositionDto }>;
}

/**
 * Fase E redesign: "does LDCN need anything from me?" instead of a raw technical decisions feed.
 * There is no real approve/select endpoint in the backend (generate() is atomic — see
 * Wizard.tsx), so "needs you" missions link out to the mission or to Copilot rather than showing
 * fake [Usar recomendado] buttons that would not call anything real.
 */
export function DecisionsPage() {
  const { t, tn } = useI18n();
  const copilot = useCopilot();

  const loader = useCallback(async (): Promise<DecisionsData> => {
    const missions = await missionClient.list();
    const architectures = await Promise.all(missions.map(async (mission) => ({ mission, data: await architectureClient.get(mission.missionId) })));
    return { missions, architectures };
  }, []);
  const { data, loading, error, reload } = useApiResource(loader, []);

  const needsYou = useMemo(() => (data?.missions ?? []).filter(needsUserDecision), [data]);
  const decided = useMemo(
    () => data?.architectures.flatMap(({ mission, data: architecture }) => architecture.proposals.flatMap((proposal) => proposal.decisions.map((decision) => ({ mission, proposal, decision })))) ?? [],
    [data],
  );

  return (
    <div style={{ padding: "28px clamp(18px, 4vw, 42px) 42px", maxWidth: 900, margin: "0 auto" }}>
      <p style={{ margin: "0 0 8px", color: T.violet, fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase" }}>{t("decisions.eyebrow")}</p>
      <h1 style={{ margin: 0, color: T.text, fontSize: 27, letterSpacing: "-0.035em" }}>{t("decisions.title")}</h1>

      {loading && <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}><Skeleton height={90} /><Skeleton height={72} /></div>}
      {!loading && error && <ErrorState error={error} onRetry={reload} />}

      {!loading && !error && data && (
        <>
          <p style={{ margin: "9px 0 24px", color: needsYou.length > 0 ? T.text : T.textMuted, fontSize: 15, fontWeight: needsYou.length > 0 ? 700 : 400 }}>
            {needsYou.length > 0 ? tn("decisions.needsYouCount", needsYou.length) : t("decisions.allClear")}
          </p>

          {needsYou.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 }}>
              {needsYou.map((m) => (
                <div key={m.missionId} className="stat-card" style={{ borderColor: alpha(T.red, 25) }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
                    <AlertTriangle size={16} color={T.red} style={{ flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <p style={{ margin: "0 0 3px", fontSize: 14.5, fontWeight: 700, color: T.text }}>{m.rawUserIdea}</p>
                      <p style={{ margin: 0, fontSize: 12.5, color: T.textSub }}>{t(nextActionLabelKey(m.nextAction))}</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Link className="btn-ghost" to={`/missions/${m.missionId}`}>
                      <ArrowRight size={13} /> {t("decisions.viewMission")}
                    </Link>
                    <button className="btn-primary" onClick={copilot.open}>
                      <MessageCircle size={13} /> {t("decisions.talkToLdcn")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <p style={{ margin: "0 0 12px", fontSize: 11, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>{t("decisions.decidedTitle")}</p>
          {decided.length === 0 ? (
            <EmptyState title={t("decisions.decidedEmpty.title")} description={t("decisions.decidedEmpty.description")} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {decided.map(({ mission, proposal, decision }) => (
                <Link key={`${mission.missionId}-${decision.id}`} to={`/missions/${mission.missionId}/architecture`} className="mcard" style={{ textDecoration: "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <BrainCircuit size={15} color={T.violet} />
                    <span style={{ color: T.textMuted, fontSize: 11 }}>{mission.rawUserIdea}</span>
                    <span style={{ marginLeft: "auto", color: T.emerald, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                      <CheckCircle2 size={12} /> {t("decisions.decided")}
                    </span>
                  </div>
                  <strong style={{ color: T.text, fontSize: 14 }}>{decision.problem}</strong>
                  <p style={{ margin: "7px 0 0", color: T.textSub, fontSize: 12.5, lineHeight: 1.55 }}>{decision.selectedOption} · {proposal.stackKey}</p>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
