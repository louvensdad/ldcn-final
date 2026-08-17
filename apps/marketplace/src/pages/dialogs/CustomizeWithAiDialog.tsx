import { useState } from "react";
import { T } from "../../design/tokens";
import { useI18n } from "../../i18n/I18nContext";
import { generatorClient } from "../../api/generator.client";
import { ApiClientError, type AppError } from "../../api/client";
import { Dialog } from "../../shared/ui/Dialog";
import type { AnyListing, Locale } from "../../types";
import { localize } from "../../utils/format";

function toAppError(err: unknown): AppError {
  return err instanceof ApiClientError ? err.appError : { category: "UNKNOWN", status: 0, code: "UNKNOWN", translationKey: "errors.unknown" };
}

/**
 * Redesign Fase F: turns a marketplace system into a real mission. There is no backend capacity
 * to compute a structured "what changes" impact preview (no clone/derive API — see Fase 12 in the
 * brief), so this skips straight from the customization prompt to a real generatorClient.start()
 * call seeded with the template's own description, exactly like Wizard.tsx's real atomic flow.
 * Never shows a fake diff it can't actually back up.
 */
export function CustomizeWithAiDialog({ item, locale, onClosed }: { item: AnyListing; locale: Locale; onClosed: (missionId: string | undefined) => void }) {
  const { t } = useI18n();
  const content = localize(item, locale);
  const [customization, setCustomization] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    const missionId = crypto.randomUUID();
    const rawUserIdea = customization.trim()
      ? `${content.name}: ${content.description}\n\n${t("marketplace.customize.promptPrefix")}: ${customization.trim()}`
      : `${content.name}: ${content.description}`;
    try {
      await generatorClient.start(missionId, { rawUserIdea, technologyPreferences: item.stacks });
      onClosed(missionId);
    } catch (err) {
      setError(toAppError(err));
      setSubmitting(false);
    }
  }

  return (
    <Dialog titleId="customize-dialog-title" title={t("marketplace.customize.title", { name: content.name })} onClose={() => onClosed(undefined)}>
      <p style={{ margin: "0 0 12px", fontSize: 12.5, color: T.textMuted, lineHeight: 1.6 }}>{t("marketplace.customize.hint")}</p>
      <label className="field-label" htmlFor="customization">
        {t("marketplace.customize.label")}
      </label>
      <textarea
        id="customization"
        className="field-input field-textarea"
        autoFocus
        placeholder={t("marketplace.customize.placeholder")}
        value={customization}
        onChange={(e) => setCustomization(e.target.value)}
        rows={4}
      />
      {error && <p style={{ margin: "8px 0 0", fontSize: 12.5, color: T.red }}>{t(error.translationKey)}</p>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
        <button type="button" className="btn-ghost" onClick={() => onClosed(undefined)}>
          {t("common.cancel")}
        </button>
        <button type="button" className="btn-primary" disabled={submitting} onClick={submit}>
          {submitting ? t("common.loading") : t("marketplace.customize.submit")}
        </button>
      </div>
    </Dialog>
  );
}
