import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Hammer, BarChart3, Zap, Compass, Sparkles, ArrowLeft } from "lucide-react";
import { T } from "../design/tokens";
import { markOnboardingSeen } from "../auth/onboarding";

type Intent = "build" | "analyze" | "automate";

const INTENTS: { id: Intent; icon: typeof Hammer; title: string; description: string; placeholder: string }[] = [
  {
    id: "build",
    icon: Hammer,
    title: "Construir um software",
    description: "Um sistema, um app, um site — descreva e o LDCN gera a missão.",
    placeholder: "Quero um sistema para administrar uma clínica...",
  },
  {
    id: "analyze",
    icon: BarChart3,
    title: "Analisar dados",
    description: "Entenda o que uma planilha ou um relatório está te dizendo.",
    placeholder: "Tenho uma planilha de vendas e quero entender onde estou perdendo dinheiro...",
  },
  {
    id: "automate",
    icon: Zap,
    title: "Automatizar um processo",
    description: "Tire uma tarefa repetitiva das suas mãos.",
    placeholder: "Quero automatizar meu atendimento no WhatsApp...",
  },
];

/**
 * Fase I: primeiro login nunca cai num dashboard vazio. As 3 primeiras opções levam ao mesmo
 * gerador real (o backend não distingue "construir" de "analisar" de "automatizar" — é tudo
 * rawUserIdea para o mesmo generate() atômico), só muda o convite e o placeholder. "Explorar" vai
 * direto para a Home real, sem fingir um tour guiado que não existe.
 */
export function Onboarding() {
  const navigate = useNavigate();
  const [intent, setIntent] = useState<Intent | null>(null);
  const [idea, setIdea] = useState("");
  const selected = INTENTS.find((i) => i.id === intent) ?? null;

  function explore() {
    markOnboardingSeen();
    navigate("/", { replace: true });
  }

  function continueWithIdea() {
    markOnboardingSeen();
    navigate("/wizard", { replace: true, state: idea.trim() ? { idea: idea.trim() } : undefined });
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
        padding: 24,
      }}
    >
      <div style={{ width: "min(640px, 100%)" }}>
        {!selected ? (
          <>
            <p style={{ margin: "0 0 8px", color: T.violet, fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", textAlign: "center" }}>
              LDCN OS
            </p>
            <h1 style={{ margin: "0 0 8px", fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", textAlign: "center" }}>Bem-vindo ao LDCN OS</h1>
            <p style={{ margin: "0 0 32px", fontSize: 14.5, color: T.textMuted, textAlign: "center" }}>O que você quer fazer?</p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
              {INTENTS.map((option) => (
                <button
                  key={option.id}
                  className="mcard"
                  style={{ textAlign: "left", cursor: "pointer", border: `1px solid ${T.borderStrong}` }}
                  onClick={() => setIntent(option.id)}
                >
                  <option.icon size={22} color={T.indigo} style={{ marginBottom: 10 }} />
                  <strong style={{ display: "block", fontSize: 14.5, color: T.text, marginBottom: 5 }}>{option.title}</strong>
                  <span style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.5 }}>{option.description}</span>
                </button>
              ))}
              <button className="mcard" style={{ textAlign: "left", cursor: "pointer", border: `1px solid ${T.border}` }} onClick={explore}>
                <Compass size={22} color={T.textMuted} style={{ marginBottom: 10 }} />
                <strong style={{ display: "block", fontSize: 14.5, color: T.text, marginBottom: 5 }}>Explorar a plataforma</strong>
                <span style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.5 }}>Ver a Home e decidir depois.</span>
              </button>
            </div>
          </>
        ) : (
          <div>
            <button
              onClick={() => setIntent(null)}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: T.textMuted, fontSize: 12.5, cursor: "pointer", padding: 0, marginBottom: 20, fontFamily: "inherit" }}
            >
              <ArrowLeft size={13} /> Voltar
            </button>
            <h1 style={{ margin: "0 0 8px", fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em" }}>Conte sua ideia.</h1>
            <p style={{ margin: "0 0 20px", fontSize: 14, color: T.textMuted }}>Mesmo uma frase é suficiente.</p>
            <textarea
              autoFocus
              className="field-input field-textarea"
              style={{ fontSize: 14.5, minHeight: 100, marginBottom: 16 }}
              placeholder={selected.placeholder}
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
            />
            <button className="btn-primary" style={{ width: "100%", padding: "12px 16px", fontSize: 14.5 }} onClick={continueWithIdea}>
              <Sparkles size={15} /> Continuar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
