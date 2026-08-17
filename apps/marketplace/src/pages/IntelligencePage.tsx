import { useCallback, useMemo } from "react";
import { Bot, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { T, alpha } from "../design/tokens";
import { missionClient, type MissionSummaryDto } from "../api/mission.client";
import { teamClient, type AgentTeamDto } from "../api/team.client";
import { useApiResource } from "../hooks/useApiResource";
import { ErrorState } from "../shared/ui/ErrorState";
import { EmptyState } from "../shared/ui/EmptyState";
import { Skeleton } from "../shared/ui/Skeleton";

/** "Decisions" moved to pages/DecisionsPage.tsx (Fase E) — this now only covers Agents (Avançado → AI Workforce). */
interface IntelligenceData {
  missions: MissionSummaryDto[];
  teams: Array<{ mission: MissionSummaryDto; data: AgentTeamDto }>;
}

export function IntelligencePage() {
  const loader = useCallback(async (): Promise<IntelligenceData> => {
    const missions = await missionClient.list();
    const teams = await Promise.all(missions.map(async (mission) => ({ mission, data: await teamClient.get(mission.missionId) })));
    return { missions, teams };
  }, []);
  const { data, loading, error, reload } = useApiResource(loader, []);
  const agents = useMemo(() => data?.teams.flatMap(({ mission, data: team }) => team.instances.map((agent) => ({ mission, team, agent }))) ?? [], [data]);

  return (
    <div style={{ padding: "28px clamp(18px, 4vw, 42px) 42px", maxWidth: 1120, margin: "0 auto" }}>
      <p style={{ margin: "0 0 8px", color: T.violet, fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase" }}>Intelligence</p>
      <h1 style={{ margin: 0, color: T.text, fontSize: 27, letterSpacing: "-0.035em" }}>Agents</h1>
      <p style={{ margin: "9px 0 24px", color: T.textMuted, fontSize: 13.5 }}>Especialistas selecionados pelo gerador para cada missão.</p>
      {loading && <div style={{ display: "flex", flexDirection: "column", gap: 10 }}><Skeleton height={90} /><Skeleton height={72} /><Skeleton height={72} /></div>}
      {!loading && error && <ErrorState error={error} onRetry={reload} />}
      {!loading && !error && data && <AgentFeed items={agents} />}
    </div>
  );
}

function AgentFeed({ items }: { items: Array<{ mission: MissionSummaryDto; team: AgentTeamDto; agent: AgentTeamDto["instances"][number] }> }) {
  if (!items.length) return <EmptyState title="Nenhum agente composto" description="Os agentes aparecerão quando uma missão concluir a composição do time." />;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10 }}>
      {items.map(({ mission, team, agent }) => (
        <Link key={`${mission.missionId}-${agent.id}`} to={`/missions/${mission.missionId}/team`} className="mcard" style={{ textDecoration: "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 13 }}>
            <span style={{ width: 30, height: 30, display: "grid", placeItems: "center", borderRadius: 9, color: T.cyan, background: alpha(T.cyan, 8) }}>
              <Bot size={15} />
            </span>
            <span style={{ color: T.textMuted, fontSize: 11 }}>{agent.agentKey}</span>
            <span style={{ marginLeft: "auto", color: T.emerald, fontSize: 11, fontWeight: 700 }}>{team.status}</span>
          </div>
          <strong style={{ color: T.text, fontSize: 14 }}>{agent.role}</strong>
          <p style={{ margin: "7px 0 0", color: T.textSub, fontSize: 12.5, lineHeight: 1.55 }}>{agent.reason}</p>
          <span style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 13, color: T.textMuted, fontSize: 11 }}>
            <Users size={12} /> {mission.rawUserIdea}
          </span>
        </Link>
      ))}
    </div>
  );
}
