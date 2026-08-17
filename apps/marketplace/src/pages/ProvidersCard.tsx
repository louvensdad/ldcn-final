import { useCallback, useEffect, useState } from "react";
import { Bot, CheckCircle2, XCircle } from "lucide-react";
import { T, alpha } from "../design/tokens";
import { useI18n } from "../i18n/I18nContext";
import { providerClient, type ProviderDto, type TestResultDto } from "../api/provider.client";
import { ApiClientError, type AppError } from "../api/client";
import { Card, Row, textStyle } from "../shared/ui/AdminCard";
import { ProviderCredentialDialog } from "./dialogs/ProviderCredentialDialog";

function toAppError(err: unknown): AppError {
  return err instanceof ApiClientError ? err.appError : { category: "UNKNOWN", status: 0, code: "UNKNOWN", translationKey: "errors.unknown" };
}

const STATUS_COLOR: Record<ProviderDto["status"], string> = {
  connected: T.emerald,
  failed: T.red,
  untested: T.amber,
  unconfigured: T.textMuted,
};

/** Fase 13: only the providers the backend can actually call show up — see providerClient. */
export function ProvidersCard() {
  const { t } = useI18n();
  const [providers, setProviders] = useState<ProviderDto[] | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [dialogProvider, setDialogProvider] = useState<{ id: string; name: string } | null>(null);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResultDto>>({});
  const [revoking, setRevoking] = useState<string | null>(null);

  const load = useCallback(() => {
    providerClient.list().then(setProviders).catch((err) => setError(toAppError(err)));
  }, []);
  useEffect(load, [load]);

  async function handleTest(provider: string) {
    setTestingProvider(provider);
    try {
      const result = await providerClient.test(provider);
      setTestResults((prev) => ({ ...prev, [provider]: result }));
      load();
    } finally {
      setTestingProvider(null);
    }
  }

  async function handleRevoke(provider: string) {
    setRevoking(provider);
    try {
      await providerClient.revoke(provider);
      setTestResults((prev) => { const next = { ...prev }; delete next[provider]; return next; });
      load();
    } finally {
      setRevoking(null);
    }
  }

  function handleDialogClosed(saved: ProviderDto | undefined) {
    setDialogProvider(null);
    if (saved) load();
  }

  return (
    <Card icon={<Bot size={16} />} title={t("providers.cardTitle")}>
      {!providers && !error && <p style={textStyle}>{t("common.loading")}</p>}
      {error && <p style={{ ...textStyle, color: T.red }}>{t(error.translationKey)}</p>}
      {providers?.map((p, i) => {
        const result = testResults[p.provider];
        return (
          <div key={p.provider} style={{ paddingTop: i > 0 ? 16 : 0, marginTop: i > 0 ? 16 : 0, borderTop: i > 0 ? `1px solid ${T.border}` : undefined }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <strong style={{ fontSize: 13.5, color: T.text }}>{p.displayName}</strong>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: STATUS_COLOR[p.status], background: alpha(STATUS_COLOR[p.status], 14), border: `1px solid ${alpha(STATUS_COLOR[p.status], 30)}`, padding: "2px 8px", borderRadius: 20 }}>
                {t(`providers.status.${p.status}`)}
              </span>
            </div>
            <Row label={t("providers.keyLabel")} value={p.keyPreview ?? t("providers.notConfigured")} mono />
            <Row label={t("providers.modelLabel")} value={p.model} mono />
            <Row label={t("providers.sourceLabel")} value={t(`providers.source.${p.source}`)} />
            <Row label={t("providers.usageLabel")} value={t("providers.usageValue", { calls: p.usage.calls, tokens: p.usage.totalTokens })} />
            {p.lastTestedAt && <Row label={t("providers.lastTestedLabel")} value={new Date(p.lastTestedAt).toLocaleString()} />}

            {result && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, fontSize: 12.5, color: result.success ? T.emerald : T.red }}>
                {result.success ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                {result.success ? t("providers.testSuccess", { model: result.model ?? p.model, latency: result.latencyMs ?? 0 }) : t("providers.testFailure")}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <button className="btn-ghost" onClick={() => setDialogProvider({ id: p.provider, name: p.displayName })}>
                {p.source === "workspace" ? t("providers.changeKey") : t("providers.addKey")}
              </button>
              <button className="btn-ghost" disabled={!p.configured || testingProvider === p.provider} onClick={() => handleTest(p.provider)}>
                {testingProvider === p.provider ? t("providers.testing") : t("providers.testConnection")}
              </button>
              {p.source === "workspace" && (
                <button className="btn-ghost" style={{ color: T.red }} disabled={revoking === p.provider} onClick={() => handleRevoke(p.provider)}>
                  {revoking === p.provider ? t("common.loading") : t("providers.revoke")}
                </button>
              )}
            </div>
          </div>
        );
      })}

      <p style={{ ...textStyle, marginTop: 16 }}>{t("providers.otherProvidersNote")}</p>

      {dialogProvider && <ProviderCredentialDialog provider={dialogProvider.id} displayName={dialogProvider.name} onClosed={handleDialogClosed} />}
    </Card>
  );
}
