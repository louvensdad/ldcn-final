import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  SunMoon, KeyRound, Building2, SlidersHorizontal, BarChart3,
  Bell, CreditCard, Terminal, Check, Copy, LogOut, ArrowRight,
} from "lucide-react";
import { T } from "../design/tokens";
import { API_BASE_URL } from "../api/config";
import { useAuth } from "../auth/AuthContext";
import { useTheme, type ThemePreference } from "../theme/ThemeContext";
import { useEngineeringMode } from "../shell/EngineeringModeContext";
import { Card, Row, textStyle } from "../shared/ui/AdminCard";
import { ProvidersCard } from "./ProvidersCard";
import { GithubIntegrationCard } from "./GithubIntegrationCard";

/**
 * Fase 14 taxonomy. Sections with real content today (Aparência, Segurança, Workspace, Billing
 * link-out) are functional; the rest are honest placeholders — no fabricated toggles that don't
 * do anything (Fase 28). Roles/Security/Audit used to be separate top-level pages; they live here
 * now instead of duplicating a second page for the same information (Fase 10).
 */
export function Settings() {
  const { apiKey, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { enabled: engineeringModeEnabled, setEnabled: setEngineeringModeEnabled } = useEngineeringMode();
  const navigate = useNavigate();
  const [locale, setLocale] = useState(() => localStorage.getItem("ldcn-locale") ?? "pt-BR");
  const [copied, setCopied] = useState(false);

  function saveLocale(value: string) {
    setLocale(value);
    localStorage.setItem("ldcn-locale", value);
  }
  function copyKey() {
    if (!apiKey) return;
    void navigator.clipboard?.writeText(apiKey);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div style={{ padding: "28px clamp(18px, 4vw, 42px) 60px", maxWidth: 860, margin: "0 auto" }}>
      <p style={{ margin: "0 0 8px", color: T.violet, fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase" }}>Preferences</p>
      <h1 style={{ margin: 0, color: T.text, fontSize: 27, letterSpacing: "-0.035em" }}>Configurações</h1>
      <p style={{ margin: "9px 0 24px", color: T.textMuted, fontSize: 13.5 }}>Preferências desta instalação do LDCN OS.</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Card icon={<SunMoon size={16} />} title="Perfil e aparência">
          <label className="field-label" htmlFor="settings-theme">Tema</label>
          <select id="settings-theme" className="field-input" value={theme} onChange={(e) => setTheme(e.target.value as ThemePreference)}>
            <option value="system">Automático (sistema)</option>
            <option value="light">Claro</option>
            <option value="dark">Escuro</option>
          </select>
          <label className="field-label" htmlFor="settings-locale" style={{ marginTop: 14 }}>Idioma</label>
          <select id="settings-locale" className="field-input" value={locale} onChange={(e) => saveLocale(e.target.value)}>
            <option value="pt-BR">Português (Brasil)</option>
            <option value="en">English</option>
            <option value="es">Español</option>
            <option value="fr">Français</option>
          </select>
          <p style={{ margin: "10px 0 0", color: T.textMuted, fontSize: 12 }}>Preferências salvas neste navegador.</p>
        </Card>

        <Card icon={<KeyRound size={16} />} title="Segurança">
          <p style={textStyle}>A chave usada por este navegador para acessar a Platform API. Fica salva no localStorage desta instalação e nunca é enviada a nenhum outro destino.</p>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14 }}>
            <code style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", padding: "9px 11px", color: T.textSub, border: `1px solid ${T.border}`, borderRadius: 8, background: T.bg }}>
              {apiKey ? `${apiKey.slice(0, 4)}••••••••${apiKey.slice(-3)}` : "Nenhuma chave carregada"}
            </code>
            <button className="btn-ghost" onClick={copyKey} disabled={!apiKey}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
          <button className="btn-ghost" style={{ marginTop: 14, color: T.red }} onClick={() => { signOut(); navigate("/login", { replace: true }); }}>
            <LogOut size={14} /> Encerrar sessão
          </button>
        </Card>

        <ProvidersCard />

        <Card icon={<Building2 size={16} />} title="Workspace">
          <p style={textStyle}>A API está protegida por uma única credencial (<code>x-api-key</code>) compartilhada pelo workspace. Perfis e permissões por pessoa serão adicionados quando o backend expuser autenticação multiusuário.</p>
          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            <Link className="btn-ghost" to="/organization"><ArrowRight size={13} /> Organização</Link>
            <Link className="btn-ghost" to="/members"><ArrowRight size={13} /> Equipe</Link>
          </div>
        </Card>

        <Card icon={<SlidersHorizontal size={16} />} title="Geração">
          <p style={textStyle}>Políticas de auto-reparo, aprovação e valores padrão de stack ainda não são configuráveis — o gerador roda hoje com uma política fixa de máquina de estados.</p>
        </Card>

        <Card icon={<BarChart3 size={16} />} title="Data Intelligence">
          <p style={textStyle}>O uso real de IA por missão já existe (Avançado → AI Usage). Retenção de dados, upload de arquivos e preferências de privacidade ainda não são configuráveis.</p>
        </Card>

        <GithubIntegrationCard />

        <Card icon={<Bell size={16} />} title="Notificações">
          <p style={textStyle}>O feed de notificações em tempo real já existe (sino no topo, ou Avançado → Notifications). Preferências de entrega por e-mail/navegador ainda não existem.</p>
        </Card>

        <Card icon={<CreditCard size={16} />} title="Billing">
          <p style={textStyle}>Plano e consumo ficam na página da Empresa.</p>
          <Link className="btn-ghost" to="/billing" style={{ marginTop: 10, display: "inline-flex" }}><ArrowRight size={13} /> Ver Billing</Link>
        </Card>

        <Card icon={<Terminal size={16} />} title="Avançado">
          <p style={textStyle}>
            <strong style={{ color: T.text }}>Modo avançado (Engineering Mode).</strong> Mostra Tarefas, Execuções, Artefatos, Revisões, Gates,
            Uso de IA, Agentes, Perfis de acesso, Segurança e Auditoria no menu principal. Desligado, essas telas continuam funcionando
            normalmente — só ficam fora do menu do dia a dia.
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button className={`plan-chip${!engineeringModeEnabled ? " active" : ""}`} onClick={() => setEngineeringModeEnabled(false)}>
              Desligado
            </button>
            <button className={`plan-chip${engineeringModeEnabled ? " active" : ""}`} onClick={() => setEngineeringModeEnabled(true)}>
              Ligado
            </button>
          </div>
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
            <Row label="API endpoint" value={API_BASE_URL} mono />
            <Row label="Frontend" value="ldcn-os-web" mono />
            <p style={{ ...textStyle, marginTop: 14 }}>Trilha de auditoria: o histórico de decisões de cada missão está disponível dentro da própria missão. Exportar/importar preferências locais ainda não existe.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
