import { useState, type FormEvent } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { T } from "../design/tokens";
import { useI18n } from "../i18n/I18nContext";
import { useAuth } from "../auth/AuthContext";
import { API_BASE_URL } from "../api/config";

export function Login() {
  const { t } = useI18n();
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [apiKey, setApiKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = (location.state as { from?: string } | null)?.from ?? "/";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const key = apiKey.trim();
    if (!key || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/missions`, { headers: { "x-api-key": key } });
      if (!response.ok) throw new Error(response.status === 401 ? "A chave da API não foi aceita." : "Não foi possível conectar à Platform API.");
      signIn(key);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível validar a chave.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: T.bg,
        color: T.text,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: 360,
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 14,
          padding: 32,
        }}
      >
        <h1 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 800 }}>LDCN OS</h1>
        <p style={{ margin: "0 0 24px", fontSize: 13, color: T.textMuted }}>{t("login.title")}</p>

        <label className="field-label" htmlFor="apiKey">
          {t("login.apiKeyLabel")}
        </label>
        <input
          id="apiKey"
          className="field-input"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          autoFocus
        />
        <p className="field-hint">{t("login.apiKeyHint")}</p>

        {error && <p role="alert" style={{ margin: "12px 0 0", color: T.red, fontSize: 12.5, lineHeight: 1.5 }}>{error}</p>}

        <button type="submit" className="btn-primary" disabled={submitting || !apiKey.trim()} style={{ width: "100%", marginTop: 20, padding: "10px 16px" }}>
          {submitting ? "Validando…" : t("login.submit")}
        </button>
      </form>
    </div>
  );
}
