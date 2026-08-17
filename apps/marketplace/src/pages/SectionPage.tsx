import { Link, useLocation } from "react-router-dom";
import { ArrowRight, Boxes, Construction } from "lucide-react";
import { T, alpha } from "../design/tokens";
import { useI18n } from "../i18n/I18nContext";
import { pageLabelKeyFor } from "../shell/navConfig";

export function SectionPage() {
  const { pathname } = useLocation();
  const { t } = useI18n();
  const labelKey = pageLabelKeyFor(pathname);
  const title = labelKey ? t(labelKey) : "Área";

  return (
    <div style={{ minHeight: "100%", display: "grid", placeItems: "center", padding: 28 }}>
      <div style={{ width: "min(520px, 100%)", padding: 28, border: `1px solid ${T.border}`, borderRadius: 16, background: T.surface, textAlign: "center" }}>
        <span style={{ width: 46, height: 46, display: "grid", placeItems: "center", margin: "0 auto 16px", borderRadius: 13, color: T.indigo, background: `${alpha(T.indigo, 9)}` }}><Boxes size={22} /></span>
        <h1 style={{ margin: "0 0 8px", color: T.text, fontSize: 20 }}>{title}</h1>
        <p style={{ margin: "0 auto 20px", maxWidth: 390, color: T.textMuted, fontSize: 13.5, lineHeight: 1.6 }}>
          Esta área está preparada no shell. Para manter os dados confiáveis, ela aguarda um read model próprio da Platform API antes de exibir conteúdo.
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
          <Link className="btn-primary" to="/"><ArrowRight size={14} /> Ir para o workspace</Link>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", color: T.textMuted, fontSize: 12 }}><Construction size={13} /> conectado por contrato</span>
        </div>
      </div>
    </div>
  );
}
