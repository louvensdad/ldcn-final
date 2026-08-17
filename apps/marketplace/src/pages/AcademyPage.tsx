import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, CheckCircle2, Circle, Clock3, ArrowRight, Sparkles } from "lucide-react";
import { T, alpha } from "../design/tokens";
import { useCopilot } from "../shell/CopilotContext";

type ModuleAction = { kind: "route"; path: string } | { kind: "copilot" };

interface AcademyModule {
  title: string;
  description: string;
  minutes: number;
  action: ModuleAction;
}

/**
 * Redesign Fase G: 5 cards -> a real roadmap of the actual product surface. Every "Faça agora"
 * goes somewhere real (a route this app actually has, or the real Copilot) — no module points at
 * a feature that doesn't exist yet (no Preview/Deploy/Automação modules: there is no backend
 * capability behind those today). Walkthroughs/animations per module are out of scope for this
 * phase — each module has real explanation + a real action, not a rendered demo.
 */
const MODULES: AcademyModule[] = [
  { title: "Conhecendo o LDCN OS", description: "Veja como a Home responde \"o que você quer construir\" e como continuar um trabalho em andamento.", minutes: 4, action: { kind: "route", path: "/" } },
  { title: "Criando sua primeira missão", description: "Descreva uma ideia em uma frase e deixe o gerador transformar isso em uma missão real.", minutes: 6, action: { kind: "route", path: "/wizard" } },
  { title: "Conversando com o Copilot", description: "Peça para o Copilot explicar uma decisão já tomada, ou comece uma missão nova direto por ele.", minutes: 5, action: { kind: "copilot" } },
  { title: "Organizando projetos", description: "Agrupe missões relacionadas em um projeto e acompanhe o progresso geral em um só lugar.", minutes: 5, action: { kind: "route", path: "/projects" } },
  { title: "Acompanhando suas missões", description: "Filtre por status e leia a etapa atual de cada missão em linguagem simples.", minutes: 4, action: { kind: "route", path: "/missions" } },
  { title: "Decisões: o que a IA decide por você", description: "Veja quais missões precisam de você agora, e quais decisões já foram tomadas e por quê.", minutes: 6, action: { kind: "route", path: "/ai-decisions" } },
  { title: "Arquitetura e stacks técnicas", description: "Abra a aba Arquitetura de uma missão para ver as decisões técnicas com justificativa.", minutes: 7, action: { kind: "route", path: "/missions" } },
  { title: "Equipes de agentes", description: "Cada missão compõe um time de agentes especializados — veja quem foi escolhido e por quê.", minutes: 5, action: { kind: "route", path: "/agents" } },
  { title: "Acompanhando a execução", description: "No modo avançado, veja o status real de execução de cada tarefa.", minutes: 6, action: { kind: "route", path: "/executions" } },
  { title: "Uso de IA e Data Intelligence", description: "Consulte o consumo real de IA por missão.", minutes: 5, action: { kind: "route", path: "/ai-usage" } },
  { title: "Marketplace: sistemas prontos", description: "Comece de um sistema completo (clínica, SaaS, landing page) e personalize com IA em vez de começar do zero.", minutes: 7, action: { kind: "route", path: "/marketplace" } },
  { title: "Aparência, idioma e preferências", description: "Ajuste tema claro/escuro/automático e idioma da interface.", minutes: 3, action: { kind: "route", path: "/settings" } },
  { title: "Segurança da sua credencial", description: "Veja e gerencie a chave de API usada por este navegador.", minutes: 3, action: { kind: "route", path: "/settings" } },
  { title: "Organização, equipe e billing", description: "Veja a identidade do workspace e o plano local da experiência.", minutes: 4, action: { kind: "route", path: "/organization" } },
  { title: "Modo avançado", description: "Tarefas, gates, artefatos e outros detalhes técnicos ficam reunidos fora do fluxo principal.", minutes: 5, action: { kind: "route", path: "/tasks" } },
];

const STORAGE_KEY = "ldcn-academy-completed-v2";

export function AcademyPage() {
  const navigate = useNavigate();
  const copilot = useCopilot();
  const [completed, setCompleted] = useState<Set<number>>(() => {
    try {
      return new Set<number>(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"));
    } catch {
      return new Set();
    }
  });
  const progress = useMemo(() => Math.round((completed.size / MODULES.length) * 100), [completed]);

  function toggle(index: number) {
    setCompleted((current) => {
      const next = new Set(current);
      next.has(index) ? next.delete(index) : next.add(index);
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  function runAction(index: number, action: ModuleAction) {
    setCompleted((current) => {
      const next = new Set(current);
      next.add(index);
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
    if (action.kind === "route") navigate(action.path);
    else copilot.open();
  }

  return (
    <div style={{ padding: "28px clamp(18px, 4vw, 42px) 42px", maxWidth: 980, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 18, padding: 24, marginBottom: 16, border: `1px solid ${T.borderStrong}`, borderRadius: 16, background: `linear-gradient(135deg, ${T.surface}, ${T.surfaceEl})` }}>
        <span style={{ width: 44, height: 44, display: "grid", placeItems: "center", flexShrink: 0, borderRadius: 13, color: T.violet, background: alpha(T.violet, 9) }}>
          <BookOpen size={22} />
        </span>
        <div style={{ flex: 1 }}>
          <p style={{ margin: "0 0 7px", color: T.violet, fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase" }}>LDCN Academy</p>
          <h1 style={{ margin: 0, color: T.text, fontSize: 24, letterSpacing: "-0.035em" }}>Aprenda no ritmo do seu workspace</h1>
          <p style={{ margin: "9px 0 0", color: T.textMuted, fontSize: 13.5, lineHeight: 1.55 }}>Um roteiro pela plataforma real — cada módulo termina levando você para a tela de verdade.</p>
        </div>
        <strong style={{ color: T.text, fontSize: 24 }}>{progress}%</strong>
      </div>

      <div style={{ height: 5, overflow: "hidden", marginBottom: 16, borderRadius: 99, background: T.border }}>
        <div style={{ width: `${progress}%`, height: "100%", background: `linear-gradient(90deg, ${T.violet}, ${T.cyan})`, transition: "width .2s" }} />
      </div>

      <button
        className="btn-primary"
        style={{ marginBottom: 22, padding: "10px 18px", fontSize: 13.5 }}
        onClick={() => navigate("/wizard")}
      >
        <Sparkles size={15} /> Criar meu primeiro sistema guiado
      </button>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {MODULES.map((module, index) => {
          const done = completed.has(index);
          return (
            <div
              key={module.title}
              className="mcard"
              style={{ flexDirection: "row", alignItems: "center", gap: 13, cursor: "default" }}
            >
              <button
                type="button"
                onClick={() => toggle(index)}
                aria-label={done ? "Marcar como não concluído" : "Marcar como concluído"}
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: done ? T.emerald : T.textMuted, display: "flex" }}
              >
                {done ? <CheckCircle2 size={20} /> : <Circle size={20} />}
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ display: "block", fontSize: 14, color: T.text, textDecoration: done ? "line-through" : "none", opacity: done ? 0.65 : 1 }}>
                  {module.title}
                </strong>
                <span style={{ display: "block", marginTop: 5, color: T.textMuted, fontSize: 12.5 }}>{module.description}</span>
              </div>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: T.textMuted, fontSize: 11, flexShrink: 0 }}>
                <Clock3 size={12} /> {module.minutes} min
              </span>
              <button className="btn-ghost" style={{ flexShrink: 0 }} onClick={() => runAction(index, module.action)}>
                <ArrowRight size={13} /> Faça agora
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
