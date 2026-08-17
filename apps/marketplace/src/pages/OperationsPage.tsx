import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Activity, AlertTriangle, CheckCircle2, Clock3, ListChecks, Play } from "lucide-react";
import { T, alpha } from "../design/tokens";
import { missionClient, type MissionSummaryDto } from "../api/mission.client";
import { runtimeClient, type RuntimeOperationalResponseDto } from "../api/runtime.client";
import { generatorClient, type GeneratorEventDto } from "../api/generator.client";
import { useApiResource } from "../hooks/useApiResource";
import { ErrorState } from "../shared/ui/ErrorState";
import { Skeleton } from "../shared/ui/Skeleton";
import { API_BASE_URL } from "../api/config";
import { getStoredApiKey } from "../auth/AuthContext";
import { EmptyState } from "../shared/ui/EmptyState";

type PageKind = "tasks" | "executions" | "gates" | "reviews" | "notifications" | "ai-usage";
interface AggregateData { missions: MissionSummaryDto[]; operations: Array<{ mission: MissionSummaryDto; data: RuntimeOperationalResponseDto }>; events: Array<{ mission: MissionSummaryDto; events: GeneratorEventDto[] }> }

const COPY: Record<PageKind, { eyebrow: string; title: string; description: string }> = {
  tasks: { eyebrow: "Operations", title: "Tasks", description: "Tarefas operacionais agregadas a partir das missões do workspace." },
  executions: { eyebrow: "Runtime", title: "Executions", description: "Acompanhe execução, falhas e próximas ações do runtime." },
  gates: { eyebrow: "Quality", title: "Gates", description: "Visão dos gates e pendências de revisão por missão." },
  reviews: { eyebrow: "Quality", title: "Reviews", description: "Itens que precisam de revisão antes de avançar." },
  notifications: { eyebrow: "Signal feed", title: "Notifications", description: "Eventos recentes do gerador e do runtime, ordenados por missão." },
  "ai-usage": { eyebrow: "Decision trace", title: "AI Usage", description: "Atividade do Intelligent Generator consolidada no workspace." },
};

export function OperationsPage({ kind }: { kind: PageKind }) {
  const loader = useCallback(async (): Promise<AggregateData> => {
    const missions = await missionClient.list();
    const [operations, events] = await Promise.all([
      Promise.all(missions.map(async (mission) => ({ mission, data: await runtimeClient.getMission(mission.missionId) }))),
      Promise.all(missions.map(async (mission) => ({ mission, events: await generatorClient.events(mission.missionId) }))),
    ]);
    return { missions, operations, events };
  }, []);
  const { data, loading, error, reload } = useApiResource(loader, []);
  const copy = COPY[kind];

  const stats = useMemo(() => {
    if (!data) return { first: 0, second: 0, third: 0 };
    const all = data.operations.flatMap((item) => item.data.runtimeTasks);
    if (kind === "tasks") return { first: all.length, second: all.filter((task) => task.executionStatus === "FAILED").length, third: all.filter((task) => task.nextAction !== "NONE").length };
    if (kind === "executions") return { first: all.length, second: all.filter((task) => task.executionStatus === "COMPLETED").length, third: all.filter((task) => task.executionStatus === "FAILED").length };
    if (kind === "gates" || kind === "reviews") return { first: all.filter((task) => task.lastGateStatus).length, second: all.filter((task) => task.lastGateStatus === "PASSED").length, third: all.filter((task) => task.lastGateStatus !== "PASSED").length };
    return { first: data.events.reduce((sum, item) => sum + item.events.length, 0), second: data.missions.length, third: data.operations.reduce((sum, item) => sum + item.data.overview.failedTaskCount, 0) };
  }, [data, kind]);

  return (
    <div style={{ padding: "28px clamp(18px, 4vw, 42px) 42px", maxWidth: 1120, margin: "0 auto" }}>
      <p style={{ margin: "0 0 8px", color: T.cyan, fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase" }}>{copy.eyebrow}</p>
      <h1 style={{ margin: 0, color: T.text, fontSize: 27, letterSpacing: "-0.035em" }}>{copy.title}</h1>
      <p style={{ margin: "9px 0 24px", color: T.textMuted, fontSize: 13.5 }}>{copy.description}</p>
      {loading && <div style={{ display: "flex", flexDirection: "column", gap: 10 }}><Skeleton height={92} /><Skeleton height={72} /><Skeleton height={72} /></div>}
      {!loading && error && <ErrorState error={error} onRetry={reload} />}
      {!loading && !error && data && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, marginBottom: 24 }}>
            <Metric icon={<ListChecks size={15} />} label={kind === "notifications" ? "Eventos" : "Itens"} value={stats.first} accent={T.indigo} />
            <Metric icon={<CheckCircle2 size={15} />} label={kind === "executions" ? "Concluídas" : "Missões"} value={stats.second} accent={T.emerald} />
            <Metric icon={<AlertTriangle size={15} />} label={kind === "ai-usage" ? "Falhas" : "Atenção"} value={stats.third} accent={stats.third ? T.amber : T.emerald} />
          </div>
          {kind === "notifications" ? <LiveEventFeed events={data.events} /> : kind === "ai-usage" ? <EventFeed events={data.events} /> : <OperationsFeed kind={kind} operations={data.operations} />}
        </>
      )}
    </div>
  );
}

function Metric({ icon, label, value, accent }: { icon: ReactNode; label: string; value: number; accent: string }) {
  return <div className="stat-card"><div style={{ display: "flex", alignItems: "center", gap: 7, color: accent, fontSize: 11, fontWeight: 700 }}>{icon}{label}</div><p style={{ margin: "12px 0 0", color: T.text, fontSize: 26, fontWeight: 800 }}>{value}</p></div>;
}

function OperationsFeed({ kind, operations }: { kind: PageKind; operations: AggregateData["operations"] }) {
  const rows = operations.flatMap(({ mission, data }) => data.runtimeTasks.filter((task) => kind === "tasks" || kind === "executions" || task.lastGateStatus).map((task) => ({ mission, task })));
  if (rows.length === 0) return <EmptyState title="Nenhum item operacional" description="Ainda não há dados desse tipo nas missões atuais." />;
  return <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{rows.map(({ mission, task }) => <Link key={`${mission.missionId}-${task.taskId}`} to={`/missions/${mission.missionId}/tasks/${task.taskId}`} className="mcard" style={{ textDecoration: "none", flexDirection: "row", alignItems: "center", gap: 12, padding: "13px 16px" }}><span style={{ color: task.executionStatus === "FAILED" ? T.red : T.indigo }}><Play size={15} /></span><span style={{ flex: 1, minWidth: 0 }}><strong style={{ display: "block", color: T.text, fontSize: 13 }}>{task.taskId}</strong><small style={{ color: T.textMuted }}>{mission.rawUserIdea} · {task.executionStatus}</small></span><span style={{ color: task.lastGateStatus === "PASSED" ? T.emerald : T.textMuted, fontSize: 11 }}>{task.lastGateStatus ?? task.nextAction}</span></Link>)}</div>;
}

function EventFeed({ events }: { events: AggregateData["events"] }) {
  const rows = events.flatMap(({ mission, events: missionEvents }) => missionEvents.map((event) => ({ mission, event }))).sort((a, b) => b.event.createdAt - a.event.createdAt);
  if (rows.length === 0) return <EmptyState title="Nenhum evento registrado" description="A atividade aparecerá aqui quando o gerador processar a missão." />;
  return <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{rows.slice(0, 40).map(({ mission, event }) => <div key={`${mission.missionId}-${event.id}`} className="stat-card" style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px" }}><span style={{ color: event.eventType.includes("FAILED") ? T.red : T.cyan }}><Activity size={15} /></span><span style={{ flex: 1 }}><strong style={{ display: "block", color: T.text, fontSize: 12.5 }}>{event.eventType}</strong><small style={{ color: T.textMuted }}>{mission.rawUserIdea}</small></span><span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: T.textMuted, fontSize: 11 }}><Clock3 size={12} /> v{event.version}</span></div>)}</div>;
}

function LiveEventFeed({ events }: { events: AggregateData["events"] }) {
  const [liveEvents, setLiveEvents] = useState<Array<{ id: string; eventType: string; missionId?: string }>>([]);
  useEffect(() => {
    const key = getStoredApiKey();
    if (!key || typeof EventSource === "undefined") return;
    const source = new EventSource(`${API_BASE_URL}/stream?apiKey=${encodeURIComponent(key)}`);
    source.onmessage = (message) => {
      try {
        const payload = JSON.parse(message.data) as { id?: string; eventType?: string; missionId?: string; type?: string };
        setLiveEvents((current) => [{ id: payload.id ?? `${Date.now()}`, eventType: payload.eventType ?? payload.type ?? "EVENT", missionId: payload.missionId }, ...current].slice(0, 8));
      } catch {
        // Ignore malformed server events while preserving the persisted feed.
      }
    };
    return () => source.close();
  }, []);
  const missionEvents = events.flatMap(({ mission, events: missionEvents }) => missionEvents.map((event) => ({ mission, event }))).sort((a, b) => b.event.createdAt - a.event.createdAt);
  return <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{liveEvents.length > 0 && <div className="stat-card" style={{ borderColor: `${alpha(T.cyan, 33)}`, background: `${alpha(T.cyan, 4)}` }}><div style={{ display: "flex", alignItems: "center", gap: 8, color: T.cyan, fontSize: 12, fontWeight: 700 }}><Activity size={14} /> Atualizações ao vivo</div>{liveEvents.map((event) => <p key={event.id} style={{ margin: "9px 0 0", color: T.textSub, fontSize: 12.5 }}>{event.eventType}{event.missionId ? ` · ${event.missionId.slice(0, 8)}` : ""}</p>)}</div>}{missionEvents.length === 0 ? <EmptyState title="Nenhum evento registrado" description="A atividade aparecerá aqui quando o gerador processar uma missão." /> : missionEvents.slice(0, 40).map(({ mission, event }) => <div key={`${mission.missionId}-${event.id}`} className="stat-card" style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px" }}><span style={{ color: event.eventType.includes("FAILED") ? T.red : T.cyan }}><Activity size={15} /></span><span style={{ flex: 1 }}><strong style={{ display: "block", color: T.text, fontSize: 12.5 }}>{event.eventType}</strong><small style={{ color: T.textMuted }}>{mission.rawUserIdea}</small></span><span style={{ color: T.textMuted, fontSize: 11 }}>v{event.version}</span></div>)}</div>;
}
