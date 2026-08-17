import { useState } from "react";
import { CreditCard, Globe2, UserRound } from "lucide-react";
import { T } from "../design/tokens";
import { API_BASE_URL } from "../api/config";
import { Card, Row, textStyle, badgeStyle } from "../shared/ui/AdminCard";

/**
 * "Empresa" pages — organization identity, team, and the local billing preference. Roles,
 * Security, and Audit used to live here too; they moved into Settings (Fase B) since Fase 14
 * treats them as settings sections, not standalone company pages.
 */
type AdminKind = "organization" | "members" | "billing";
const COPY: Record<AdminKind, { eyebrow: string; title: string; description: string }> = {
  organization: { eyebrow: "Empresa", title: "Organização", description: "Identidade e contexto do workspace conectado." },
  members: { eyebrow: "Empresa", title: "Equipe", description: "O backend atual usa uma chave global; gestão multiusuário ainda não está exposta." },
  billing: { eyebrow: "Plano do workspace", title: "Billing", description: "Plano local da experiência enquanto cobrança ainda não possui endpoint na API." },
};

export function WorkspaceAdminPage({ kind }: { kind: AdminKind }) {
  const copy = COPY[kind];
  const [plan, setPlan] = useState(() => localStorage.getItem("ldcn-plan") ?? "basic");
  function savePlan(value: string) { setPlan(value); localStorage.setItem("ldcn-plan", value); }

  return (
    <div style={{ padding: "28px clamp(18px, 4vw, 42px) 42px", maxWidth: 860, margin: "0 auto" }}>
      <p style={{ margin: "0 0 8px", color: T.violet, fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase" }}>{copy.eyebrow}</p>
      <h1 style={{ margin: 0, color: T.text, fontSize: 27, letterSpacing: "-0.035em" }}>{copy.title}</h1>
      <p style={{ margin: "9px 0 24px", color: T.textMuted, fontSize: 13.5 }}>{copy.description}</p>

      {kind === "organization" && (
        <Card icon={<Globe2 size={16} />} title="Workspace identity">
          <Row label="Product" value="LDCN OS" />
          <Row label="Environment" value="Local Platform API" />
          <Row label="API endpoint" value={API_BASE_URL} mono />
        </Card>
      )}
      {kind === "members" && (
        <Card icon={<UserRound size={16} />} title="Access model">
          <p style={textStyle}>Esta instalação usa uma única credencial de API compartilhada pelo workspace. Não há membros ou convites persistidos no contrato atual.</p>
          <span style={badgeStyle}>Single workspace key</span>
        </Card>
      )}
      {kind === "billing" && (
        <Card icon={<CreditCard size={16} />} title="Workspace plan">
          <p style={textStyle}>O plano abaixo é uma preferência local da interface. Nenhuma cobrança será realizada.</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
            {["free", "basic", "advanced", "pro"].map((option) => (
              <button key={option} className={`plan-chip${plan === option ? " active" : ""}`} onClick={() => savePlan(option)}>
                {option}
              </button>
            ))}
          </div>
          <p style={{ margin: "14px 0 0", color: T.textMuted, fontSize: 12 }}>
            Plano selecionado: <strong style={{ color: T.textSub }}>{plan}</strong>
          </p>
        </Card>
      )}
    </div>
  );
}
