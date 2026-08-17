import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { X, Sparkles, Send, AlertTriangle, Bot } from "lucide-react";
import { T, alpha } from "../design/tokens";
import { useI18n } from "../i18n/I18nContext";
import { missionClient, type MissionSummaryDto, type MissionOverviewDto } from "../api/mission.client";
import { architectureClient } from "../api/architecture.client";
import { teamClient } from "../api/team.client";
import { assistantClient } from "../api/assistant.client";
import { useExplainAiMap, ExplainWithAi } from "../shared/ui/ExplainWithAi";
import { missionStatus, MISSION_STATUS_LABEL_KEY } from "../shared/ui/missionStatus";

interface CopilotDecision {
  id: string;
  problem: string;
  selectedOption: string;
  kind: "architecture" | "team";
}

interface MissionContext {
  overview: MissionOverviewDto;
  decisions: CopilotDecision[];
}

/** A single decision: a chip until asked, then the real assistant explanation in its place. */
function DecisionRow({ missionId, decision, stateFor, trigger }: {
  missionId: string;
  decision: CopilotDecision;
  stateFor: ReturnType<typeof useExplainAiMap>["stateFor"];
  trigger: ReturnType<typeof useExplainAiMap>["trigger"];
}) {
  const state = stateFor(decision.id);
  const explainFn = () =>
    decision.kind === "architecture"
      ? assistantClient.explainArchitectureDecision(missionId, decision.id)
      : assistantClient.explainTeamDecision(missionId, decision.id);

  return (
    <div style={{ marginBottom: 10 }}>
      {state.status === "idle" ? (
        <button
          className="palette-item"
          style={{ border: `1px solid ${T.border}`, borderRadius: 10 }}
          onClick={() => trigger(decision.id, explainFn)}
        >
          <Sparkles size={13} color={T.indigo} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 12.5 }}>{decision.problem}</span>
        </button>
      ) : (
        <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 12px" }}>
          <p style={{ margin: "0 0 8px", fontSize: 12.5, fontWeight: 600, color: T.text }}>{decision.problem}</p>
          <ExplainWithAi state={state} onExplain={() => trigger(decision.id, explainFn)} />
        </div>
      )}
    </div>
  );
}

export function Copilot({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [idea, setIdea] = useState("");
  const { stateFor, trigger } = useExplainAiMap();

  const missionId = useMemo(() => location.pathname.match(/^\/missions\/([^/]+)/)?.[1] ?? null, [location.pathname]);

  const [missionCtx, setMissionCtx] = useState<MissionContext | null>(null);
  const [missionLoading, setMissionLoading] = useState(false);
  const [recent, setRecent] = useState<MissionSummaryDto[] | null>(null);

  useEffect(() => {
    if (!open) return;
    setIdea("");
    if (missionId) {
      setMissionLoading(true);
      Promise.all([
        missionClient.getOverview(missionId),
        architectureClient.get(missionId).catch(() => null),
        teamClient.get(missionId).catch(() => null),
      ])
        .then(([overview, architecture, team]) => {
          const decisions: CopilotDecision[] = [
            ...(architecture?.proposals.flatMap((p) => p.decisions.map((d) => ({ id: d.id, problem: d.problem, selectedOption: d.selectedOption, kind: "architecture" as const }))) ?? []),
            ...(team?.decisions.map((d) => ({ id: d.id, problem: d.problem, selectedOption: d.selectedOption, kind: "team" as const })) ?? []),
          ];
          setMissionCtx({ overview, decisions });
        })
        .catch(() => setMissionCtx(null))
        .finally(() => setMissionLoading(false));
    } else {
      setMissionCtx(null);
      missionClient
        .list()
        .then((list) => setRecent(list.filter((m) => ["BLOCKED", "ACTIVE"].includes(m.generatorState ?? "") || m.blockers.length > 0).slice(0, 3)))
        .catch(() => setRecent([]));
    }
  }, [open, missionId]);

  function startWithAi() {
    if (!idea.trim()) return;
    navigate("/wizard", { state: { idea: idea.trim() } });
    onClose();
  }

  if (!open) return null;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 70 }} />
      <div
        className="panel-in"
        role="dialog"
        aria-modal="true"
        aria-label={t("copilot.title")}
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0, width: "min(420px, 100vw)",
          background: T.surfaceEl, borderLeft: `1px solid ${T.borderMid}`, zIndex: 71,
          display: "flex", flexDirection: "column", boxShadow: "0 0 60px rgba(0,0,0,0.3)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 18px", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
          <span style={{ width: 30, height: 30, borderRadius: 8, display: "grid", placeItems: "center", background: `linear-gradient(135deg, ${T.indigo}, ${T.violet})` }}>
            <Bot size={15} color="#fff" />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: T.text }}>{t("copilot.title")}</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label={t("common.cancel")}>
            <X size={16} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 18 }}>
          {!missionId && (
            <>
              <CopilotBubble>{t("copilot.greeting")}</CopilotBubble>
              {recent && recent.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <p style={{ margin: "0 0 8px", fontSize: 11, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
                    {t("copilot.needsAttention")}
                  </p>
                  {recent.map((m) => (
                    <Link key={m.missionId} to={`/missions/${m.missionId}`} onClick={onClose} className="notif-item" style={{ borderRadius: 10, border: `1px solid ${T.border}`, marginBottom: 8 }}>
                      <p style={{ margin: "0 0 3px", fontSize: 12.5, fontWeight: 600, color: T.text }}>{m.rawUserIdea}</p>
                      <p style={{ margin: 0, fontSize: 11.5, color: T.textMuted }}>{t(MISSION_STATUS_LABEL_KEY[missionStatus(m)])}</p>
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}

          {missionId && missionLoading && <CopilotBubble>{t("common.loading")}</CopilotBubble>}

          {missionId && !missionLoading && missionCtx && (
            <>
              <CopilotBubble>
                {t("copilot.missionGreeting", { idea: missionCtx.overview.intentSummary.rawUserIdea })}
              </CopilotBubble>

              {missionCtx.overview.blockers.length > 0 && (
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "10px 12px", borderRadius: 10, background: alpha(T.red, 8), border: `1px solid ${alpha(T.red, 22)}`, marginBottom: 14 }}>
                  <AlertTriangle size={14} color={T.red} style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <p style={{ margin: "0 0 4px", fontSize: 12.5, fontWeight: 700, color: T.red }}>{t("copilot.blockersTitle")}</p>
                    {missionCtx.overview.blockers.map((b) => (
                      <p key={b} style={{ margin: 0, fontSize: 12, color: T.textSub }}>{b}</p>
                    ))}
                  </div>
                </div>
              )}

              {missionCtx.decisions.length > 0 ? (
                <>
                  <p style={{ margin: "0 0 8px", fontSize: 11, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
                    {t("copilot.decisionsTitle")}
                  </p>
                  {missionCtx.decisions.map((d) => (
                    <DecisionRow key={d.id} missionId={missionId} decision={d} stateFor={stateFor} trigger={trigger} />
                  ))}
                </>
              ) : (
                <p style={{ fontSize: 12.5, color: T.textMuted }}>{t("copilot.noDecisions")}</p>
              )}
            </>
          )}
        </div>

        <div style={{ borderTop: `1px solid ${T.border}`, padding: 14, flexShrink: 0 }}>
          <p style={{ margin: "0 0 8px", fontSize: 11.5, color: T.textMuted }}>{t("copilot.inputHint")}</p>
          <div style={{ display: "flex", gap: 8 }}>
            <textarea
              className="field-input"
              style={{ flex: 1, minHeight: 44, maxHeight: 100, resize: "vertical" }}
              placeholder={t("copilot.inputPlaceholder")}
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) startWithAi();
              }}
            />
            <button className="btn-primary" style={{ alignSelf: "flex-end", padding: "10px 12px" }} onClick={startWithAi} disabled={!idea.trim()} aria-label={t("home.startWithAi")}>
              <Send size={15} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function CopilotBubble({ children }: { children: ReactNode }) {
  return (
    <div style={{ background: T.surfaceHover, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 14px", marginBottom: 14, fontSize: 13, color: T.textSub, lineHeight: 1.6 }}>
      {children}
    </div>
  );
}
