import { useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import { T, alpha } from "../design/tokens";
import { useI18n } from "../i18n/I18nContext";
import { pipelineClient, type PipelineNodeDto } from "../api/pipeline.client";
import { useApiResource } from "../hooks/useApiResource";
import { Skeleton } from "../shared/ui/Skeleton";
import { ErrorState } from "../shared/ui/ErrorState";
import { EmptyState } from "../shared/ui/EmptyState";
import { MissionNav } from "../shared/ui/MissionNav";

const INTEGRATION_GROUP_KEY = "integration";

/** Node type sequence within a stack — GENERATION always runs before BUILD, etc. */
const TYPE_ORDER: Record<string, number> = { GENERATION: 0, BUILD: 1, TEST: 2, REVIEW: 3, GATE: 4, INTEGRATION_VALIDATION: 5, PROMOTION: 6 };

const NODE_COLOR: Record<PipelineNodeDto["state"], string> = { PENDING: T.textMuted, BLOCKED_UNSUPPORTED_RUNTIME: T.red };

export function MissionPipeline() {
  const { missionId = "" } = useParams<{ missionId: string }>();
  const { t } = useI18n();
  const loader = useCallback(() => pipelineClient.get(missionId), [missionId]);
  const { data: plan, loading, error, reload } = useApiResource(loader, [missionId]);

  const groups = useMemo(() => {
    if (!plan) return [];
    const byStack = new Map<string, PipelineNodeDto[]>();
    for (const node of plan.nodes) {
      const key = node.stackKey ?? INTEGRATION_GROUP_KEY;
      byStack.set(key, [...(byStack.get(key) ?? []), node]);
    }
    return [...byStack.entries()].map(([stackKey, nodes]) => ({
      stackKey,
      nodes: [...nodes].sort((a, b) => (TYPE_ORDER[a.type] ?? 99) - (TYPE_ORDER[b.type] ?? 99)),
    }));
  }, [plan]);

  return (
    <div style={{ padding: 24, maxWidth: 860, margin: "0 auto" }}>
      <MissionNav missionId={missionId} />

      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Skeleton height={28} width="40%" />
          <Skeleton height={16} width="90%" />
          <Skeleton height={16} width="70%" />
        </div>
      )}

      {!loading && error && <ErrorState error={error} onRetry={reload} />}

      {!loading && !error && plan && (
        <>
          <h1 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 800, color: T.text }}>{t("pipeline.title")}</h1>
          <p style={{ margin: "0 0 20px", fontSize: 12.5, color: T.textMuted }}>{plan.status}</p>

          {groups.length > 0 ? (
            groups.map((group) => (
              <div key={group.stackKey} style={{ marginBottom: 20 }}>
                <h2 style={{ margin: "0 0 10px", fontSize: 13.5, fontWeight: 700, color: T.text }}>
                  {group.stackKey === INTEGRATION_GROUP_KEY ? t("pipeline.integration") : group.stackKey}
                </h2>
                <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {group.nodes.map((node) => (
                    <li
                      key={node.key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        background: T.surface,
                        border: `1px solid ${node.state === "BLOCKED_UNSUPPORTED_RUNTIME" ? alpha(T.red, 25) : T.border}`,
                        borderRadius: 8,
                        padding: "8px 12px",
                      }}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: NODE_COLOR[node.state], flexShrink: 0 }} />
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: T.text }}>{node.type}</span>
                      {node.blockedReason && <span style={{ fontSize: 11.5, color: T.red }}>{node.blockedReason}</span>}
                    </li>
                  ))}
                </ol>
              </div>
            ))
          ) : (
            <EmptyState title={t("pipeline.empty")} />
          )}
        </>
      )}
    </div>
  );
}
