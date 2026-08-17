import { useCallback, type ReactNode } from "react";
import { Activity, BrainCircuit, CheckCircle2, RotateCcw } from "lucide-react";
import { useParams } from "react-router-dom";
import { T } from "../design/tokens";
import { generatorClient, type GeneratorEventDto, type LearningSignalsDto } from "../api/generator.client";
import { useApiResource } from "../hooks/useApiResource";
import { ErrorState } from "../shared/ui/ErrorState";
import { Skeleton } from "../shared/ui/Skeleton";
import { MissionNav } from "../shared/ui/MissionNav";

interface AiUsageData { learning: LearningSignalsDto; events: GeneratorEventDto[] }

export function MissionAiUsage() {
  const { missionId = "" } = useParams<{ missionId: string }>();
  const loader = useCallback(async (): Promise<AiUsageData> => {
    const [learning, events] = await Promise.all([generatorClient.learning(missionId), generatorClient.events(missionId)]);
    return { learning, events: [...events].sort((a, b) => b.createdAt - a.createdAt) };
  }, [missionId]);
  const { data, loading, error, reload } = useApiResource(loader, [missionId]);

  return (
    <div style={{ padding: 24, maxWidth: 860, margin: "0 auto" }}>
      <MissionNav missionId={missionId} />
      <div style={{ marginBottom: 22 }}>
        <p style={{ margin: "0 0 7px", color: T.violet, fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase" }}>Decision trace</p>
        <h1 style={{ margin: 0, color: T.text, fontSize: 22, letterSpacing: "-0.025em" }}>Uso de IA</h1>
        <p style={{ margin: "8px 0 0", color: T.textMuted, fontSize: 13 }}>Sinais de aprendizado e histórico de decisões desta missão.</p>
      </div>
      {loading && <div style={{ display: "flex", flexDirection: "column", gap: 10 }}><Skeleton height={100} /><Skeleton height={180} /></div>}
      {!loading && error && <ErrorState error={error} onRetry={reload} />}
      {!loading && !error && data && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, marginBottom: 22 }}>
            <SignalCard icon={<BrainCircuit size={16} />} label="Amostras" value={data.learning.sampleCount} accent={T.violet} />
            <SignalCard icon={<CheckCircle2 size={16} />} label="Taxa de sucesso" value={`${Math.round(data.learning.successRate * 100)}%`} accent={T.emerald} />
            <SignalCard icon={<RotateCcw size={16} />} label="Taxa de reparo" value={`${Math.round(data.learning.repairRate * 100)}%`} accent={T.amber} />
          </div>
          <section className="stat-card">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}><Activity size={15} color={T.cyan} /><h2 style={{ margin: 0, color: T.text, fontSize: 14 }}>Linha de decisões</h2></div>
            {data.events.length === 0 ? <p style={{ margin: 0, color: T.textMuted, fontSize: 13 }}>Nenhum evento registrado.</p> : (
              <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 9 }}>
                {data.events.map((event) => <li key={event.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: `1px solid ${T.border}` }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: event.eventType.includes("CHANGED") ? T.amber : T.cyan, flexShrink: 0 }} /><span style={{ color: T.text, fontSize: 12.5, fontWeight: 650 }}>{event.eventType}</span><span style={{ marginLeft: "auto", color: T.textMuted, fontSize: 11 }}>v{event.version}</span></li>)}
              </ol>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function SignalCard({ icon, label, value, accent }: { icon: ReactNode; label: string; value: string | number; accent: string }) {
  return <div className="stat-card"><div style={{ display: "flex", alignItems: "center", gap: 7, color: accent, fontSize: 11, fontWeight: 700 }}>{icon}{label}</div><p style={{ margin: "12px 0 0", color: T.text, fontSize: 25, fontWeight: 800, letterSpacing: "-0.04em" }}>{value}</p></div>;
}
