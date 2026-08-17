import { useCallback, useEffect, useState } from "react";
import { Plug } from "lucide-react";
import { T, alpha } from "../design/tokens";
import { githubClient, type GithubCredentialDto } from "../api/github.client";
import { gitlabClient, type GitlabCredentialDto } from "../api/gitlab.client";
import { ApiClientError, type AppError } from "../api/client";
import { Card, Row, textStyle } from "../shared/ui/AdminCard";

function toAppError(err: unknown): AppError {
  return err instanceof ApiClientError ? err.appError : { category: "UNKNOWN", status: 0, code: "UNKNOWN", translationKey: "errors.unknown" };
}

function StatusBadge({ configured }: { configured: boolean }) {
  return (
    <span
      style={{
        fontSize: 10.5, fontWeight: 700, marginLeft: 6, padding: "2px 8px", borderRadius: 20,
        color: configured ? T.emerald : T.textMuted,
        background: alpha(configured ? T.emerald : T.textMuted, 14),
        border: `1px solid ${alpha(configured ? T.emerald : T.textMuted, 30)}`,
      }}
    >
      {configured ? "Conectado" : "Não configurado"}
    </span>
  );
}

/**
 * MISSÃO "GitHub real (push de verdade)" + "GitLab real (push de verdade)" — substitui o
 * placeholder "nenhuma integração implementada" por dois fluxos reais: token validado contra a
 * API real de cada provedor antes de ser salvo (criptografado em repouso), nunca exibido de volta
 * em texto puro.
 */
export function GithubIntegrationCard() {
  return (
    <Card icon={<Plug size={16} />} title="Integrações">
      <GithubSection />
      <div style={{ marginTop: 20, paddingTop: 20, borderTop: `1px solid ${T.border}` }}>
        <GitlabSection />
      </div>
      <p style={{ ...textStyle, marginTop: 16 }}>Provedores de deploy (Docker, AWS, Vercel...) ainda não estão implementados.</p>
    </Card>
  );
}

function GithubSection() {
  const [credential, setCredential] = useState<GithubCredentialDto | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);

  const load = useCallback(() => {
    githubClient.getCredential().then(setCredential).catch((err) => setError(toAppError(err)));
  }, []);
  useEffect(load, [load]);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      await githubClient.saveCredential(tokenInput);
      setTokenInput("");
      load();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "UNKNOWN");
    } finally {
      setSaving(false);
    }
  }

  async function handleRevoke() {
    setRevoking(true);
    try {
      await githubClient.revokeCredential();
      load();
    } finally {
      setRevoking(false);
    }
  }

  return (
    <div>
      <div style={{ marginBottom: credential?.configured ? 0 : 4 }}>
        <strong style={{ fontSize: 13.5, color: T.text }}>GitHub</strong>
        {credential && <StatusBadge configured={credential.configured} />}
      </div>

      {error && <p style={{ ...textStyle, color: T.red }}>{error.translationKey}</p>}

      {credential?.configured ? (
        <>
          <Row label="Conta" value={`@${credential.githubLogin}`} mono />
          <Row label="Token" value={credential.tokenPreview ?? ""} mono />
          <button className="btn-ghost" style={{ marginTop: 12, color: T.red }} disabled={revoking} onClick={handleRevoke}>
            {revoking ? "Removendo..." : "Desconectar"}
          </button>
        </>
      ) : (
        <>
          <p style={textStyle}>
            Conecte um Personal Access Token do GitHub (escopo <code>repo</code>) para enviar projetos gerados direto para um repositório
            real. O token é validado contra a API do GitHub antes de ser salvo, e fica criptografado em repouso — nunca exibido de volta em
            texto puro.
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <input
              type="password"
              className="field-input"
              style={{ flex: 1, minWidth: 220 }}
              placeholder="ghp_..."
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
            />
            <button className="btn-primary" disabled={saving || !tokenInput.trim()} onClick={handleSave}>
              {saving ? "Validando..." : "Conectar"}
            </button>
          </div>
          {saveError && <p style={{ ...textStyle, color: T.red, marginTop: 8 }}>{saveError}</p>}
        </>
      )}
    </div>
  );
}

function GitlabSection() {
  const [credential, setCredential] = useState<GitlabCredentialDto | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);

  const load = useCallback(() => {
    gitlabClient.getCredential().then(setCredential).catch((err) => setError(toAppError(err)));
  }, []);
  useEffect(load, [load]);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      await gitlabClient.saveCredential(tokenInput);
      setTokenInput("");
      load();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "UNKNOWN");
    } finally {
      setSaving(false);
    }
  }

  async function handleRevoke() {
    setRevoking(true);
    try {
      await gitlabClient.revokeCredential();
      load();
    } finally {
      setRevoking(false);
    }
  }

  return (
    <div>
      <div style={{ marginBottom: credential?.configured ? 0 : 4 }}>
        <strong style={{ fontSize: 13.5, color: T.text }}>GitLab</strong>
        {credential && <StatusBadge configured={credential.configured} />}
      </div>

      {error && <p style={{ ...textStyle, color: T.red }}>{error.translationKey}</p>}

      {credential?.configured ? (
        <>
          <Row label="Conta" value={`@${credential.gitlabUsername}`} mono />
          <Row label="Token" value={credential.tokenPreview ?? ""} mono />
          <button className="btn-ghost" style={{ marginTop: 12, color: T.red }} disabled={revoking} onClick={handleRevoke}>
            {revoking ? "Removendo..." : "Desconectar"}
          </button>
        </>
      ) : (
        <>
          <p style={textStyle}>
            Conecte um Personal Access Token do GitLab (escopo <code>api</code>) para enviar projetos gerados direto para um repositório
            real (gitlab.com). O token é validado contra a API do GitLab antes de ser salvo, e fica criptografado em repouso — nunca
            exibido de volta em texto puro.
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <input
              type="password"
              className="field-input"
              style={{ flex: 1, minWidth: 220 }}
              placeholder="glpat-..."
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
            />
            <button className="btn-primary" disabled={saving || !tokenInput.trim()} onClick={handleSave}>
              {saving ? "Validando..." : "Conectar"}
            </button>
          </div>
          {saveError && <p style={{ ...textStyle, color: T.red, marginTop: 8 }}>{saveError}</p>}
        </>
      )}
    </div>
  );
}
