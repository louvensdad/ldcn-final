import { useCallback, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { T } from "../design/tokens";
import { useI18n } from "../i18n/I18nContext";
import { taskClient } from "../api/task.client";
import { useApiResource } from "../hooks/useApiResource";
import { Skeleton } from "../shared/ui/Skeleton";
import { ErrorState } from "../shared/ui/ErrorState";
import { EmptyState } from "../shared/ui/EmptyState";
import { MissionNav } from "../shared/ui/MissionNav";
import { NewTaskDialog } from "./dialogs/NewTaskDialog";

export function MissionTasks() {
  const { missionId = "" } = useParams<{ missionId: string }>();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);

  const loader = useCallback(() => taskClient.list(missionId), [missionId]);
  const { data: tasks, loading, error, reload } = useApiResource(loader, [missionId]);

  function handleDialogClosed(taskId: string | undefined) {
    setDialogOpen(false);
    if (taskId) navigate(`/missions/${missionId}/tasks/${taskId}`);
    else reload();
  }

  return (
    <div style={{ padding: 24, maxWidth: 860, margin: "0 auto" }}>
      <MissionNav missionId={missionId} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: T.text }}>{t("tasks.title")}</h1>
        <button className="btn-primary" onClick={() => setDialogOpen(true)}>
          <Plus size={14} /> {t("tasks.newTask")}
        </button>
      </div>

      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Skeleton height={56} />
          <Skeleton height={56} />
          <Skeleton height={56} />
        </div>
      )}

      {!loading && error && <ErrorState error={error} onRetry={reload} />}

      {!loading && !error && tasks && tasks.length === 0 && <EmptyState title={t("tasks.empty")} />}

      {!loading && !error && tasks && tasks.length > 0 && (
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
          {tasks.map((task) => (
            <li key={task.taskId}>
              <Link
                to={`/missions/${missionId}/tasks/${task.taskId}`}
                className="mcard"
                style={{ textDecoration: "none", flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: "14px 16px" }}
              >
                <div>
                  <p style={{ margin: "0 0 4px", fontSize: 13.5, fontWeight: 700, color: T.text }}>{task.classification.jobType}</p>
                  <p style={{ margin: 0, fontSize: 12, color: T.textMuted }}>
                    {task.classification.complexity} · {task.classification.riskLevel}
                  </p>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: T.textSub,
                    background: T.surfaceHover,
                    border: `1px solid ${T.border}`,
                    padding: "3px 9px",
                    borderRadius: 20,
                  }}
                >
                  {task.routingStatus ?? t("tasks.notRouted")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {dialogOpen && <NewTaskDialog missionId={missionId} onClosed={handleDialogClosed} />}
    </div>
  );
}
