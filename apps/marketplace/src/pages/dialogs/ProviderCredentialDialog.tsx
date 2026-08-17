import { useState } from "react";
import { T } from "../../design/tokens";
import { useI18n } from "../../i18n/I18nContext";
import { providerClient, type ProviderDto } from "../../api/provider.client";
import { ApiClientError, type AppError } from "../../api/client";
import { Dialog } from "../../shared/ui/Dialog";

function toAppError(err: unknown): AppError {
  return err instanceof ApiClientError ? err.appError : { category: "UNKNOWN", status: 0, code: "UNKNOWN", translationKey: "errors.unknown" };
}

export function ProviderCredentialDialog({ provider, displayName, onClosed }: { provider: string; displayName: string; onClosed: (saved: ProviderDto | undefined) => void }) {
  const { t } = useI18n();
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  async function submit() {
    if (!apiKey.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const saved = await providerClient.save(provider, apiKey.trim(), model.trim() || undefined);
      onClosed(saved);
    } catch (err) {
      setError(toAppError(err));
      setSubmitting(false);
    }
  }

  return (
    <Dialog titleId="provider-credential-dialog-title" title={t("providers.dialogTitle", { name: displayName })} onClose={() => onClosed(undefined)}>
      <label className="field-label" htmlFor="provider-api-key">
        {t("providers.apiKeyLabel")}
      </label>
      <input
        id="provider-api-key"
        className="field-input"
        type="password"
        autoFocus
        autoComplete="off"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
      />
      <p className="field-hint">{t("providers.apiKeyHint")}</p>

      <label className="field-label" htmlFor="provider-model" style={{ marginTop: 14 }}>
        {t("providers.modelLabel")}
      </label>
      <input id="provider-model" className="field-input" placeholder="deepseek-chat" value={model} onChange={(e) => setModel(e.target.value)} />
      <p className="field-hint">{t("providers.modelHint")}</p>

      {error && <p style={{ margin: "8px 0 0", fontSize: 12.5, color: T.red }}>{t(error.translationKey)}</p>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
        <button type="button" className="btn-ghost" onClick={() => onClosed(undefined)}>
          {t("common.cancel")}
        </button>
        <button type="button" className="btn-primary" disabled={!apiKey.trim() || submitting} onClick={submit}>
          {submitting ? t("common.loading") : t("providers.save")}
        </button>
      </div>
    </Dialog>
  );
}
