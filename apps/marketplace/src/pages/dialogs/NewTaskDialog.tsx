import { useState } from "react";
import { T } from "../../design/tokens";
import { useI18n } from "../../i18n/I18nContext";
import { taskClient } from "../../api/task.client";
import { ApiClientError, type AppError } from "../../api/client";
import { Dialog } from "../../shared/ui/Dialog";

function toAppError(err: unknown): AppError {
  return err instanceof ApiClientError ? err.appError : { category: "UNKNOWN", status: 0, code: "UNKNOWN", translationKey: "errors.unknown" };
}

export function NewTaskDialog({ missionId, onClosed }: { missionId: string; onClosed: (taskId: string | undefined) => void }) {
  const { t } = useI18n();
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  async function submit() {
    if (!description.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    const taskId = crypto.randomUUID();
    try {
      await taskClient.classify(missionId, taskId, description);
      onClosed(taskId);
    } catch (err) {
      setError(toAppError(err));
      setSubmitting(false);
    }
  }

  return (
    <Dialog titleId="new-task-dialog-title" title={t("tasks.newTask")} onClose={() => onClosed(undefined)}>
      <label className="field-label" htmlFor="task-description">
        {t("tasks.descriptionLabel")}
      </label>
      <textarea
        id="task-description"
        className="field-input field-textarea"
        rows={3}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      {error && <p style={{ margin: "8px 0 0", fontSize: 12.5, color: T.red }}>{t(error.translationKey)}</p>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
        <button type="button" className="btn-ghost" onClick={() => onClosed(undefined)}>
          {t("common.cancel")}
        </button>
        <button type="button" className="btn-primary" disabled={!description.trim() || submitting} onClick={submit}>
          {t("tasks.classify")}
        </button>
      </div>
    </Dialog>
  );
}
