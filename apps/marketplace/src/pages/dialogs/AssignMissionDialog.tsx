import { useEffect, useState } from "react";
import { T } from "../../design/tokens";
import { useI18n } from "../../i18n/I18nContext";
import { missionClient, type MissionSummaryDto } from "../../api/mission.client";
import { projectClient } from "../../api/project.client";
import { ApiClientError, type AppError } from "../../api/client";
import { Dialog } from "../../shared/ui/Dialog";
import { EmptyState } from "../../shared/ui/EmptyState";
import { Skeleton } from "../../shared/ui/Skeleton";

function toAppError(err: unknown): AppError {
  return err instanceof ApiClientError ? err.appError : { category: "UNKNOWN", status: 0, code: "UNKNOWN", translationKey: "errors.unknown" };
}

/** Missions not yet linked to *any* project — a mission belongs to at most one. */
export function AssignMissionDialog({ projectId, onClosed }: { projectId: string; onClosed: (assigned: boolean) => void }) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState<MissionSummaryDto[]>([]);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [error, setError] = useState<AppError | null>(null);

  useEffect(() => {
    Promise.all([missionClient.list(), projectClient.list()])
      .then(([missions, projects]) => {
        const assigned = new Set(projects.flatMap((p) => p.missionIds));
        setAvailable(missions.filter((m) => !assigned.has(m.missionId)));
      })
      .catch((err) => setError(toAppError(err)))
      .finally(() => setLoading(false));
  }, []);

  async function assign(missionId: string) {
    setAssigningId(missionId);
    try {
      await projectClient.assignMission(projectId, missionId);
      onClosed(true);
    } catch (err) {
      setError(toAppError(err));
      setAssigningId(null);
    }
  }

  return (
    <Dialog titleId="assign-mission-dialog-title" title={t("projects.assignMission")} onClose={() => onClosed(false)}>
      {loading && <div style={{ display: "flex", flexDirection: "column", gap: 8 }}><Skeleton height={40} /><Skeleton height={40} /></div>}
      {!loading && error && <p style={{ fontSize: 12.5, color: T.red }}>{t(error.translationKey)}</p>}
      {!loading && !error && available.length === 0 && (
        <EmptyState title={t("projects.noAvailableMissions.title")} description={t("projects.noAvailableMissions.description")} />
      )}
      {!loading && !error && available.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 320, overflowY: "auto" }}>
          {available.map((m) => (
            <button
              key={m.missionId}
              type="button"
              className="palette-item"
              style={{ border: `1px solid ${T.border}`, borderRadius: 8 }}
              disabled={assigningId !== null}
              onClick={() => assign(m.missionId)}
            >
              <span style={{ fontSize: 13 }}>{assigningId === m.missionId ? t("common.loading") : m.rawUserIdea}</span>
            </button>
          ))}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
        <button type="button" className="btn-ghost" onClick={() => onClosed(false)}>
          {t("common.cancel")}
        </button>
      </div>
    </Dialog>
  );
}
