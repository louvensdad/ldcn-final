import { useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowUpRight, ShieldCheck, Wrench } from "lucide-react";
import { T, alpha } from "../design/tokens";
import { taskClient } from "../api/task.client";
import { useApiResource } from "../hooks/useApiResource";
import { ErrorState } from "../shared/ui/ErrorState";
import { EmptyState } from "../shared/ui/EmptyState";
import { Skeleton } from "../shared/ui/Skeleton";
import { MissionNav } from "../shared/ui/MissionNav";

type OperationKind = "gates" | "repair";

export function MissionTaskOperations({ kind }: { kind: OperationKind }) {
  const { missionId = "" } = useParams<{ missionId: string }>();
  const loader = useCallback(() => taskClient.list(missionId), [missionId]);
  const { data: tasks, loading, error, reload } = useApiResource(loader, [missionId]);
  const isRepair = kind === "repair";
  const Icon = isRepair ? Wrench : ShieldCheck;

  return (
    <div style={{ padding: 24, maxWidth: 860, margin: "0 auto" }}>
      <MissionNav missionId={missionId} />
      <div style={{ marginBottom: 20 }}>
        <p style={{ margin: "0 0 7px", color: isRepair ? T.amber : T.emerald, fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase" }}>
          {isRepair ? "Recovery lane" : "Quality lane"}
        </p>
        <h1 style={{ margin: 0, color: T.text, fontSize: 22, letterSpacing: "-0.025em" }}>{isRepair ? "Reparo" : "Gates"}</h1>
        <p style={{ margin: "8px 0 0", color: T.textMuted, fontSize: 13 }}>
          {isRepair ? "Selecione uma tarefa para consultar falhas, aconselhamento e elegibilidade de reparo." : "Selecione uma tarefa para avaliar evidências e gates de revisão."}
        </p>
      </div>

      {loading && <div style={{ display: "flex", flexDirection: "column", gap: 8 }}><Skeleton height={64} /><Skeleton height={64} /></div>}
      {!loading && error && <ErrorState error={error} onRetry={reload} />}
      {!loading && !error && tasks && tasks.length === 0 && <EmptyState title="Nenhuma tarefa disponível" description="Crie uma tarefa para abrir este fluxo operacional." />}
      {!loading && !error && tasks && tasks.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {tasks.map((task) => (
            <Link key={task.taskId} to={`/missions/${missionId}/tasks/${task.taskId}`} className="mcard" style={{ textDecoration: "none", flexDirection: "row", alignItems: "center", gap: 12, padding: "14px 16px" }}>
              <span style={{ width: 32, height: 32, display: "grid", placeItems: "center", borderRadius: 9, flexShrink: 0, color: isRepair ? T.amber : T.emerald, background: isRepair ? `${alpha(T.amber, 8)}` : `${alpha(T.emerald, 8)}` }}><Icon size={16} /></span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <strong style={{ display: "block", color: T.text, fontSize: 13.5 }}>{task.classification.jobType}</strong>
                <small style={{ display: "block", marginTop: 4, color: T.textMuted }}>{task.classification.complexity} · {task.classification.riskLevel} · {task.routingStatus ?? "NOT_ROUTED"}</small>
              </span>
              <ArrowUpRight size={15} color={T.textMuted} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
