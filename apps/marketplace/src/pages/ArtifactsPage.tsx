import { useCallback, useMemo } from "react";
import { Archive, CheckCircle2, CircleDashed, GitBranch } from "lucide-react";
import { Link } from "react-router-dom";
import { T, alpha } from "../design/tokens";
import { missionClient } from "../api/mission.client";
import { pipelineClient } from "../api/pipeline.client";
import { useApiResource } from "../hooks/useApiResource";
import { ErrorState } from "../shared/ui/ErrorState";
import { EmptyState } from "../shared/ui/EmptyState";
import { Skeleton } from "../shared/ui/Skeleton";

export function ArtifactsPage() {
  const loader = useCallback(async () => {
    const missions = await missionClient.list();
    return Promise.all(missions.map(async (mission) => ({ mission, plan: await pipelineClient.get(mission.missionId) })));
  }, []);
  const { data, loading, error, reload } = useApiResource(loader, []);
  const nodes = useMemo(() => data?.flatMap(({ mission, plan }) => plan.nodes.map((node) => ({ mission, plan, node }))) ?? [], [data]);

  return (
    <div style={{ padding: "28px clamp(18px, 4vw, 42px) 42px", maxWidth: 1120, margin: "0 auto" }}>
      <p style={{ margin: "0 0 8px", color: T.cyan, fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase" }}>Delivery surface</p>
      <h1 style={{ margin: 0, color: T.text, fontSize: 27, letterSpacing: "-0.035em" }}>Artifacts</h1>
      <p style={{ margin: "9px 0 24px", color: T.textMuted, fontSize: 13.5 }}>Nós de geração e validação planejados pelos pipelines das missões.</p>
      {loading && <div style={{ display: "flex", flexDirection: "column", gap: 10 }}><Skeleton height={78} /><Skeleton height={78} /><Skeleton height={78} /></div>}
      {!loading && error && <ErrorState error={error} onRetry={reload} />}
      {!loading && !error && !nodes.length && <EmptyState title="Nenhum artifact planejado" description="Os artifacts aparecerão quando uma missão compuser seu pipeline." />}
      {!loading && !error && nodes.length > 0 && <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{nodes.map(({ mission, node }) => { const blocked = node.state === "BLOCKED_UNSUPPORTED_RUNTIME"; return <Link key={`${mission.missionId}-${node.key}`} to={`/missions/${mission.missionId}/pipeline`} className="mcard" style={{ textDecoration: "none", flexDirection: "row", alignItems: "center", gap: 12, padding: "14px 16px" }}><span style={{ width: 32, height: 32, display: "grid", placeItems: "center", flexShrink: 0, borderRadius: 9, color: blocked ? T.red : T.cyan, background: blocked ? `${alpha(T.red, 8)}` : `${alpha(T.cyan, 8)}` }}><Archive size={16} /></span><span style={{ flex: 1, minWidth: 0 }}><strong style={{ display: "block", color: T.text, fontSize: 13.5 }}>{node.type}</strong><small style={{ display: "block", marginTop: 4, color: T.textMuted }}>{mission.rawUserIdea} · {node.stackKey ?? "integration"}</small></span><span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: blocked ? T.red : T.emerald, fontSize: 11, fontWeight: 700 }}>{blocked ? <CircleDashed size={13} /> : <CheckCircle2 size={13} />}{node.state}</span><GitBranch size={14} color={T.textMuted} /></Link>; })}</div>}
      {data && data.length > 0 && <p style={{ margin: "18px 0 0", color: T.textMuted, fontSize: 11.5 }}>Fonte: {data.length} pipeline(s) · read model de pipeline v{data[0].plan.version}</p>}
    </div>
  );
}
