import { useCallback, useState } from "react";
import { FolderOpen, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { T, alpha } from "../design/tokens";
import { useI18n } from "../i18n/I18nContext";
import { projectClient, type ProjectDto } from "../api/project.client";
import { useApiResource } from "../hooks/useApiResource";
import { ErrorState } from "../shared/ui/ErrorState";
import { Skeleton } from "../shared/ui/Skeleton";
import { EmptyState } from "../shared/ui/EmptyState";
import { NewProjectDialog } from "./dialogs/NewProjectDialog";

export function ProjectsPage() {
  const { t, tn } = useI18n();
  const [dialogOpen, setDialogOpen] = useState(false);
  const loader = useCallback(() => projectClient.list(), []);
  const { data: projects, loading, error, reload } = useApiResource(loader, []);

  function handleClosed(created: ProjectDto | undefined) {
    setDialogOpen(false);
    if (created) reload();
  }

  return (
    <div style={{ padding: "28px clamp(18px, 4vw, 42px) 42px", maxWidth: 1120, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <div>
          <p style={{ margin: "0 0 8px", color: T.cyan, fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase" }}>{t("projects.eyebrow")}</p>
          <h1 style={{ margin: 0, color: T.text, fontSize: 27, letterSpacing: "-0.035em" }}>{t("projects.title")}</h1>
          <p style={{ margin: "9px 0 0", color: T.textMuted, fontSize: 13.5 }}>{t("projects.subtitle")}</p>
        </div>
        <button className="btn-primary" onClick={() => setDialogOpen(true)}>
          <Plus size={14} /> {t("projects.newProject")}
        </button>
      </div>

      {loading && <div style={{ display: "flex", flexDirection: "column", gap: 10 }}><Skeleton height={110} /><Skeleton height={110} /></div>}
      {!loading && error && <ErrorState error={error} onRetry={reload} />}
      {!loading && !error && projects && projects.length === 0 && (
        <EmptyState
          title={t("projects.empty.title")}
          description={t("projects.empty.description")}
          action={
            <button className="btn-primary" onClick={() => setDialogOpen(true)}>
              <Plus size={14} /> {t("projects.newProject")}
            </button>
          }
        />
      )}
      {!loading && !error && projects && projects.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
          {projects.map((project) => (
            <Link key={project.id} to={`/projects/${project.id}`} className="mcard" style={{ textDecoration: "none", minHeight: 130 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 13 }}>
                <span style={{ width: 30, height: 30, display: "grid", placeItems: "center", borderRadius: 9, color: T.cyan, background: alpha(T.cyan, 8) }}>
                  <FolderOpen size={15} />
                </span>
                <span style={{ marginLeft: "auto", color: T.textMuted, fontSize: 11.5 }}>{tn("projects.missionCount", project.missionIds.length)}</span>
              </div>
              <strong style={{ color: T.text, fontSize: 15, lineHeight: 1.4 }}>{project.name}</strong>
            </Link>
          ))}
        </div>
      )}

      {dialogOpen && <NewProjectDialog onClosed={handleClosed} />}
    </div>
  );
}
