import { useState } from "react";
import { T } from "../../design/tokens";
import { useI18n } from "../../i18n/I18nContext";
import { projectClient, type ProjectDto } from "../../api/project.client";
import { ApiClientError, type AppError } from "../../api/client";
import { Dialog } from "../../shared/ui/Dialog";

function toAppError(err: unknown): AppError {
  return err instanceof ApiClientError ? err.appError : { category: "UNKNOWN", status: 0, code: "UNKNOWN", translationKey: "errors.unknown" };
}

export function NewProjectDialog({ onClosed }: { onClosed: (project: ProjectDto | undefined) => void }) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  async function submit() {
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const project = await projectClient.create(name.trim());
      onClosed(project);
    } catch (err) {
      setError(toAppError(err));
      setSubmitting(false);
    }
  }

  return (
    <Dialog titleId="new-project-dialog-title" title={t("projects.newProject")} onClose={() => onClosed(undefined)}>
      <label className="field-label" htmlFor="project-name">
        {t("projects.nameLabel")}
      </label>
      <input
        id="project-name"
        className="field-input"
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />
      {error && <p style={{ margin: "8px 0 0", fontSize: 12.5, color: T.red }}>{t(error.translationKey)}</p>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
        <button type="button" className="btn-ghost" onClick={() => onClosed(undefined)}>
          {t("common.cancel")}
        </button>
        <button type="button" className="btn-primary" disabled={!name.trim() || submitting} onClick={submit}>
          {t("projects.create")}
        </button>
      </div>
    </Dialog>
  );
}
