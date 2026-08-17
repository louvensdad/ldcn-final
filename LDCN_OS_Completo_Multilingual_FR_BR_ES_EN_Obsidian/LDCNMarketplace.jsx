import { useState, useMemo } from "react";
import {
  Search, Star, Bot, Layers, FileCode, Zap, Plug,
  CheckCircle, X, Plus, Sparkles, Clock, Filter,
} from "lucide-react";

/* ─────────────────────────────────────────────
   DESIGN TOKENS
───────────────────────────────────────────── */
const T = {
  bg:           "#07080c",
  surface:      "#0d1018",
  surfaceEl:    "#13161f",
  surfaceHover: "#181b27",
  border:       "#161a26",
  borderMid:    "#1c2032",
  borderStrong: "#23293b",
  text:         "#e1e6f2",
  textSub:      "#8892a8",
  textMuted:    "#44506a",
  indigo:       "#6366f1",
  violet:       "#8b5cf6",
  cyan:         "#06b6d4",
  emerald:      "#10b981",
  amber:        "#f59e0b",
  red:          "#ef4444",
};

const PLANS = {
  free:     { label: "Grátis",    color: T.emerald, bg: "rgba(16,185,129,0.10)" },
  basic:    { label: "Basic+",    color: "#818cf8",  bg: "rgba(99,102,241,0.10)" },
  advanced: { label: "Advanced+", color: "#a78bfa",  bg: "rgba(139,92,246,0.10)" },
  pro:      { label: "Pro",       color: T.amber,    bg: "rgba(245,158,11,0.10)" },
};

/* ─────────────────────────────────────────────
   GLOBAL CSS
───────────────────────────────────────────── */
const CSS = `
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; }
  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #1d2236; border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: #252c40; }

  .mcard {
    background: ${T.surface};
    border: 1px solid ${T.border};
    border-radius: 12px;
    padding: 18px;
    cursor: pointer;
    transition: border-color 0.18s, background 0.18s, transform 0.18s, box-shadow 0.18s;
    display: flex;
    flex-direction: column;
  }
  .mcard:hover {
    background: ${T.surfaceEl};
    border-color: ${T.borderStrong};
    transform: translateY(-2px);
    box-shadow: 0 10px 36px rgba(0,0,0,0.45);
  }
  .mcard-featured {
    background: linear-gradient(135deg, #0d1122 0%, #111420 55%, #0d1130 100%);
    border: 1px solid #1d2240;
    border-radius: 14px;
    padding: 24px;
    cursor: pointer;
    transition: border-color 0.2s, box-shadow 0.2s;
    margin-bottom: 28px;
  }
  .mcard-featured:hover {
    border-color: rgba(99,102,241,0.4);
    box-shadow: 0 0 0 1px rgba(99,102,241,0.12), 0 20px 56px rgba(0,0,0,0.55);
  }

  .stab {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 9px 16px;
    border-radius: 8px;
    border: 1px solid transparent;
    background: transparent;
    color: ${T.textMuted};
    font-size: 13.5px; font-weight: 500;
    cursor: pointer; white-space: nowrap;
    transition: color 0.14s, background 0.14s, border-color 0.14s;
    font-family: inherit;
  }
  .stab:hover { background: ${T.surface}; color: ${T.textSub}; }
  .stab.active {
    background: ${T.surfaceEl};
    border-color: ${T.borderStrong};
    color: ${T.text};
  }

  .plan-chip {
    padding: 5px 12px;
    border-radius: 20px;
    border: 1px solid ${T.border};
    background: transparent;
    color: ${T.textMuted};
    font-size: 12px; font-weight: 500;
    cursor: pointer;
    transition: all 0.14s;
    font-family: inherit;
  }
  .plan-chip:hover { border-color: ${T.borderStrong}; color: ${T.textSub}; }
  .plan-chip.active {
    background: rgba(99,102,241,0.12);
    border-color: rgba(99,102,241,0.38);
    color: #818cf8;
  }

  .btn-primary {
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    padding: 9px 18px;
    background: ${T.indigo}; color: #fff;
    border: none; border-radius: 8px;
    font-size: 13px; font-weight: 600;
    cursor: pointer; transition: background 0.15s;
    font-family: inherit;
  }
  .btn-primary:hover { background: #7578f3; }

  .btn-ghost {
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    padding: 9px 16px;
    background: transparent; color: ${T.textSub};
    border: 1px solid ${T.borderMid}; border-radius: 8px;
    font-size: 13px; font-weight: 500;
    cursor: pointer; transition: border-color 0.15s, color 0.15s;
    font-family: inherit;
  }
  .btn-ghost:hover { border-color: ${T.borderStrong}; color: ${T.text}; }

  .btn-notify {
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    padding: 9px 16px; width: 100%;
    background: transparent; color: ${T.textMuted};
    border: 1px solid ${T.border}; border-radius: 8px;
    font-size: 13.5px; font-weight: 500;
    cursor: pointer; transition: border-color 0.15s, color 0.15s;
    font-family: inherit;
  }
  .btn-notify:hover { border-color: ${T.borderStrong}; color: ${T.textSub}; }

  .panel-in {
    animation: slideIn 0.22s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  }
  @keyframes slideIn {
    from { transform: translateX(32px); opacity: 0; }
    to   { transform: translateX(0);    opacity: 1; }
  }

  .search-input {
    width: 100%; padding: 9px 34px;
    background: ${T.surface};
    border: 1px solid ${T.borderMid};
    border-radius: 8px; color: ${T.text};
    font-size: 13.5px; outline: none;
    transition: border-color 0.15s;
    font-family: inherit;
  }
  .search-input::placeholder { color: ${T.textMuted}; }
  .search-input:focus { border-color: rgba(99,102,241,0.55); }
`;

/* ─────────────────────────────────────────────
   CATEGORY CONFIG
───────────────────────────────────────────── */
const CATS = [
  { id: "agents",       label: "Agentes",     count: 24, Icon: Bot },
  { id: "stacks",       label: "Stack Packs", count: 12, Icon: Layers },
  { id: "templates",    label: "Templates",   count: 18, Icon: FileCode },
  { id: "capabilities", label: "Capacidades", count: 31, Icon: Zap },
  { id: "integrations", label: "Integrações", count: 9,  Icon: Plug },
];

/* ─────────────────────────────────────────────
   DATA
───────────────────────────────────────────── */
const AGENTS = [
  {
    id: "java-backend", name: "Java Backend Engineer",
    author: "LDCN Core", official: true, verified: true, domain: "Backend",
    stacks: ["Java", "Spring Boot", "JPA"],
    capabilities: ["REST API", "Database", "Testing", "Security", "Docs"],
    description: "Engenheiro sênior Spring Boot para backends enterprise. Cria APIs REST robustas, gerencia JPA/Hibernate, Spring Security e testes de integração completos.",
    rating: 4.9, reviews: 1247, missions: 8432,
    plan: "basic", badge: "Top Rated", featured: true,
    accent: T.amber, version: "2.3.1", updatedAt: "3 dias atrás",
  },
  {
    id: "angular-fe", name: "Angular Frontend Engineer",
    author: "LDCN Core", official: true, verified: true, domain: "Frontend",
    stacks: ["Angular", "TypeScript", "RxJS"],
    capabilities: ["UI Components", "Routing", "State Management", "Testing", "A11y"],
    description: "Especialista Angular 18 com standalone components, signals e estado reativo. Cria UIs enterprise acessíveis e com design premium.",
    rating: 4.8, reviews: 986, missions: 6241,
    plan: "basic", badge: "Editor's Pick", featured: false,
    accent: T.red, version: "2.1.0", updatedAt: "1 semana atrás",
  },
  {
    id: "flutter-mobile", name: "Flutter Mobile Engineer",
    author: "LDCN Core", official: true, verified: true, domain: "Mobile",
    stacks: ["Flutter", "Dart", "Firebase"],
    capabilities: ["iOS", "Android", "REST API", "State Management", "Testing"],
    description: "Engineer cross-platform Flutter para apps iOS e Android de produção. Riverpod, Bloc, Firebase e cobertura de testes completa.",
    rating: 4.7, reviews: 724, missions: 3190,
    plan: "advanced", badge: null, featured: false,
    accent: T.cyan, version: "1.8.4", updatedAt: "5 dias atrás",
  },
  {
    id: "python-data", name: "Python Data Engineer",
    author: "LDCN Core", official: true, verified: true, domain: "Backend",
    stacks: ["Python", "FastAPI", "SQLAlchemy"],
    capabilities: ["REST API", "Database", "Data Pipeline", "Testing", "Docs"],
    description: "Python full-stack para aplicações data-heavy. FastAPI, pandas, SQLAlchemy e pipelines de transformação e análise.",
    rating: 4.8, reviews: 567, missions: 2108,
    plan: "basic", badge: null, featured: false,
    accent: T.emerald, version: "1.5.2", updatedAt: "2 semanas atrás",
  },
  {
    id: "go-microservices", name: "Go Microservices Architect",
    author: "CloudNative Labs", official: false, verified: true, domain: "Backend",
    stacks: ["Go", "gRPC", "PostgreSQL"],
    capabilities: ["Microservices", "gRPC", "Database", "Security", "Observability"],
    description: "Especialista Go para microserviços de alta performance. gRPC, event-driven patterns, distributed tracing e deploys containerizados.",
    rating: 4.6, reviews: 312, missions: 1834,
    plan: "pro", badge: "Community", featured: false,
    accent: T.cyan, version: "1.2.0", updatedAt: "3 semanas atrás",
  },
  {
    id: "react-fe", name: "React Frontend Engineer",
    author: "WebCraft Studio", official: false, verified: true, domain: "Frontend",
    stacks: ["React", "TypeScript", "Vite"],
    capabilities: ["UI Components", "Routing", "State Management", "Testing", "Performance"],
    description: "React moderno com TypeScript e Vite. Bibliotecas de componentes, Zustand/Jotai e testes abrangentes com Vitest.",
    rating: 4.7, reviews: 891, missions: 5621,
    plan: "basic", badge: null, featured: false,
    accent: T.cyan, version: "3.0.1", updatedAt: "4 dias atrás",
  },
  {
    id: "devops", name: "DevOps & CI/CD Engineer",
    author: "LDCN Core", official: true, verified: true, domain: "Infrastructure",
    stacks: ["Docker", "GitHub Actions", "K8s"],
    capabilities: ["CI/CD", "Infrastructure", "Monitoring", "Security", "Testing"],
    description: "Pipelines CI/CD robustos, Docker e Kubernetes. GitHub Actions, monitoring integrado e security gates automáticos.",
    rating: 4.9, reviews: 445, missions: 3982,
    plan: "advanced", badge: "Reliable", featured: false,
    accent: T.violet, version: "2.0.3", updatedAt: "1 semana atrás",
  },
  {
    id: "security", name: "Security Specialist",
    author: "SecureForge", official: false, verified: true, domain: "Security",
    stacks: ["OWASP", "JWT", "OAuth2"],
    capabilities: ["Security Audit", "Auth", "Authorization", "LGPD", "Penetration Testing"],
    description: "Revisões OWASP automatizadas, flows de autenticação, modelos de permissão e validação LGPD/GDPR integrada.",
    rating: 4.8, reviews: 234, missions: 1456,
    plan: "pro", badge: null, featured: false,
    accent: T.red, version: "1.4.1", updatedAt: "2 semanas atrás",
  },
];

const STACKS = [
  {
    id: "java-angular", name: "Java + Angular Enterprise",
    author: "LDCN Core", official: true, verified: true,
    stacks: ["Java", "Spring Boot", "Angular", "PostgreSQL"],
    capabilities: ["REST API", "Database", "UI Components", "CI/CD", "Testing"],
    agentCount: 4,
    description: "Time enterprise completo para Java + Angular. Backend Engineer, Frontend Engineer, DevOps e QA pré-configurados e prontos para produção.",
    rating: 4.9, reviews: 672, missions: 4832,
    plan: "advanced", badge: "Best Value", featured: true,
    accent: T.indigo, version: "2.0.0", updatedAt: "2 dias atrás",
  },
  {
    id: "flutter-fastapi", name: "Flutter + FastAPI Pack",
    author: "LDCN Core", official: true, verified: true,
    stacks: ["Flutter", "Python", "FastAPI", "PostgreSQL"],
    capabilities: ["Mobile", "REST API", "Database", "CI/CD"],
    agentCount: 3,
    description: "Pack mobile-first ideal para consumer apps e MVPs: Flutter Mobile Engineer + Python Backend Engineer + DevOps.",
    rating: 4.7, reviews: 341, missions: 2104,
    plan: "advanced", badge: null, featured: false,
    accent: T.emerald, version: "1.3.0", updatedAt: "1 semana atrás",
  },
  {
    id: "nextjs-saas", name: "Next.js SaaS Pack",
    author: "WebCraft Studio", official: false, verified: true,
    stacks: ["Next.js", "TypeScript", "Prisma", "Stripe"],
    capabilities: ["UI Components", "Database", "Auth", "CI/CD"],
    agentCount: 3,
    description: "Pack SaaS opinativo com Next.js App Router, Prisma ORM, Stripe billing, auth e subscription management pré-configurados.",
    rating: 4.6, reviews: 289, missions: 1743,
    plan: "basic", badge: "Trending", featured: false,
    accent: "#e2e8f0", version: "1.1.2", updatedAt: "5 dias atrás",
  },
  {
    id: "go-micro-pack", name: "Go Microservices Pack",
    author: "CloudNative Labs", official: false, verified: true,
    stacks: ["Go", "gRPC", "Redis", "PostgreSQL"],
    capabilities: ["Microservices", "gRPC", "Database", "Monitoring", "CI/CD"],
    agentCount: 4,
    description: "Pack completo para arquitetura de microserviços em Go: Architect, Backend Engineers especializados e DevOps.",
    rating: 4.5, reviews: 178, missions: 892,
    plan: "pro", badge: null, featured: false,
    accent: T.cyan, version: "1.0.3", updatedAt: "1 mês atrás",
  },
];

const TEMPLATES = [
  {
    id: "erp", name: "ERP System Template",
    author: "LDCN Core", official: true, verified: true,
    stacks: ["Java", "Spring Boot", "Angular", "PostgreSQL"],
    capabilities: ["REST API", "Database", "UI Components", "Security", "Testing"],
    modules: ["HR", "Finance", "Inventory", "Procurement"],
    description: "Template ERP modular pronto para produção. Requirements, solution aprovada e composição de time pré-definidos. Acelera o início em semanas.",
    rating: 4.9, reviews: 523, missions: 3421,
    plan: "pro", badge: "Enterprise", featured: true,
    accent: T.indigo, updatedAt: "1 semana atrás",
  },
  {
    id: "saas", name: "Multi-tenant SaaS",
    author: "LDCN Core", official: true, verified: true,
    stacks: ["Next.js", "Node.js", "PostgreSQL", "Stripe"],
    capabilities: ["Auth", "Database", "CI/CD", "Monitoring"],
    modules: ["Auth", "Billing", "Dashboard", "API"],
    description: "Template SaaS com multi-tenancy, subscription management, usage billing e analytics. O mais usado da plataforma.",
    rating: 4.8, reviews: 891, missions: 6201,
    plan: "basic", badge: "Most Used", featured: false,
    accent: T.violet, updatedAt: "3 dias atrás",
  },
  {
    id: "landing", name: "Marketing Landing Page",
    author: "WebCraft Studio", official: false, verified: true,
    stacks: ["Astro", "TailwindCSS"],
    capabilities: ["UI Components", "SEO", "Performance"],
    modules: ["Hero", "Features", "Pricing", "CTA"],
    description: "Landing page de alta conversão com seções prontas. Otimizada para SEO e Core Web Vitals. Missão concluída em minutos.",
    rating: 4.7, reviews: 1243, missions: 8934,
    plan: "free", badge: null, featured: false,
    accent: T.cyan, updatedAt: "2 semanas atrás",
  },
  {
    id: "mobile-consumer", name: "Consumer Mobile App",
    author: "MobileFirst Co", official: false, verified: true,
    stacks: ["Flutter", "Firebase", "FastAPI"],
    capabilities: ["Mobile", "Auth", "REST API", "Testing"],
    modules: ["Auth", "Feed", "Profile", "Push Notifications"],
    description: "Template mobile consumer com auth social, feed, perfil e push notifications. Cross-platform iOS e Android.",
    rating: 4.6, reviews: 334, missions: 1823,
    plan: "advanced", badge: null, featured: false,
    accent: T.amber, updatedAt: "3 semanas atrás",
  },
];

const CAPABILITIES = [
  {
    id: "rest-api", name: "REST API Design",
    author: "LDCN Core", verified: true, category: "Design",
    capabilities: ["REST API"],
    description: "Geração de spec OpenAPI 3.0, design patterns de endpoints e estratégias de versionamento de API integradas ao Generator.",
    rating: 4.9, installs: 18432,
    plan: "basic", badge: "Core", featured: true,
    accent: T.cyan,
  },
  {
    id: "owasp", name: "OWASP Security Audit",
    author: "SecureForge", verified: true, category: "Security",
    capabilities: ["Security Audit"],
    description: "Revisão automatizada OWASP Top 10 integrada na geração de código. Bloqueia artefatos com vulnerabilidades críticas.",
    rating: 4.8, installs: 9234,
    plan: "advanced", badge: null, featured: false,
    accent: T.red,
  },
  {
    id: "lgpd", name: "LGPD Compliance",
    author: "BrazilTech", verified: true, category: "Compliance",
    capabilities: ["LGPD"],
    description: "Garante que código e modelos de dados estejam em conformidade com a LGPD para o mercado brasileiro. Essencial para produção no Brasil.",
    rating: 4.7, installs: 3421,
    plan: "basic", badge: "🇧🇷 BR Market", featured: false,
    accent: T.emerald,
  },
  {
    id: "perf-test", name: "Performance Testing",
    author: "SpeedLab", verified: true, category: "Testing",
    capabilities: ["Testing", "Performance"],
    description: "Testes de carga automatizados com k6 e Gatling. Gera relatórios de performance e define benchmarks por endpoint.",
    rating: 4.5, installs: 2871,
    plan: "advanced", badge: null, featured: false,
    accent: T.violet,
  },
  {
    id: "seo", name: "SEO Optimizer",
    author: "WebCraft Studio", verified: true, category: "Marketing",
    capabilities: ["SEO", "Performance"],
    description: "Meta tags, structured data, sitemap e Core Web Vitals optimization para projetos web. Integrado ao Astro e Next.js.",
    rating: 4.6, installs: 5621,
    plan: "basic", badge: null, featured: false,
    accent: T.amber,
  },
  {
    id: "a11y", name: "Acessibilidade WCAG AA",
    author: "LDCN Core", verified: true, category: "Compliance",
    capabilities: ["A11y", "UI Components"],
    description: "Conformidade WCAG AA em componentes de UI: ARIA correto, contraste, navegação por teclado e labels para screen readers.",
    rating: 4.8, installs: 7234,
    plan: "basic", badge: null, featured: false,
    accent: T.indigo,
  },
];

const INTEGRATIONS = [
  {
    id: "github", name: "GitHub",
    author: "LDCN Core", official: true, verified: true,
    description: "Push de artifacts diretamente para repositórios GitHub, trigger de workflows e gestão de Pull Requests pelo Mission Command Center.",
    status: "available", rating: 4.9, installs: 12043,
    plan: "basic", badge: "Official", featured: true,
    accent: "#e2e8f0",
  },
  {
    id: "gitlab", name: "GitLab",
    author: "LDCN Core", official: true, verified: true,
    description: "Integração GitLab completa: CI/CD pipeline sync, automação de merge requests e gestão de artifacts diretamente na plataforma.",
    status: "coming_soon", rating: null, installs: null,
    plan: "basic", badge: "Em breve", featured: false,
    accent: T.amber,
  },
  {
    id: "slack", name: "Slack",
    author: "LDCN Core", official: true, verified: true,
    description: "Atualizações de missão em tempo real, aprovações e alertas de bloqueio entregues diretamente no seu workspace Slack.",
    status: "coming_soon", rating: null, installs: null,
    plan: "basic", badge: "Em breve", featured: false,
    accent: "#4a154b",
  },
  {
    id: "aws", name: "AWS Deployment",
    author: "CloudNative Labs", official: false, verified: true,
    description: "Deploy automático de artifacts para AWS ECS, Lambda e S3. Suporte a múltiplos environments com rollback integrado.",
    status: "available", rating: 4.7, installs: 5234,
    plan: "advanced", badge: null, featured: false,
    accent: T.amber,
  },
  {
    id: "jira", name: "Jira",
    author: "LDCN Core", official: true, verified: true,
    description: "Sincronização de tasks com Jira issues, sprint planning integrado e rastreamento de progresso bidirecional.",
    status: "coming_soon", rating: null, installs: null,
    plan: "advanced", badge: "Em breve", featured: false,
    accent: "#0052cc",
  },
];

const ALL_DATA = {
  agents: AGENTS, stacks: STACKS,
  templates: TEMPLATES, capabilities: CAPABILITIES,
  integrations: INTEGRATIONS,
};

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
function fmt(n) {
  if (n == null || n === 0) return "—";
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

/* ─────────────────────────────────────────────
   CAPABILITY RING SVG
   8 domain dots arranged in a circle
   Filled = capability present, empty = absent
───────────────────────────────────────────── */
const RING_DOMAINS = [
  { match: ["rest", "api", "grpc", "graphql"] },
  { match: ["database", "db", "sql", "orm", "prisma"] },
  { match: ["security", "auth", "owasp", "lgpd", "jwt"] },
  { match: ["test", "qa", "perf", "load"] },
  { match: ["ui", "component", "a11y", "seo", "css"] },
  { match: ["ci/cd", "infra", "docker", "k8s", "deploy"] },
  { match: ["mobile", "ios", "android", "flutter"] },
  { match: ["data", "pipeline", "ml", "analytics", "observability", "monitoring"] },
];

function CapabilityRing({ capabilities = [], size = 44 }) {
  const r = size / 2 - 5;
  const cx = size / 2, cy = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={T.borderMid} strokeWidth="0.5" />
      {RING_DOMAINS.map((d, i) => {
        const angle = (i / RING_DOMAINS.length) * 2 * Math.PI - Math.PI / 2;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        const active = capabilities.some(cap =>
          d.match.some(m =>
            cap.toLowerCase().includes(m) ||
            m.includes(cap.toLowerCase().split(" ")[0])
          )
        );
        return (
          <circle key={i} cx={x} cy={y}
            r={active ? 3.8 : 2.2}
            fill={active ? T.indigo : T.borderStrong}
            opacity={active ? 1 : 0.32}
          />
        );
      })}
      <circle cx={cx} cy={cy} r={4.5} fill={T.surface} stroke={T.borderStrong} strokeWidth="0.5" />
    </svg>
  );
}

/* ─────────────────────────────────────────────
   SMALL COMPONENTS
───────────────────────────────────────────── */
function PlanBadge({ plan }) {
  const p = PLANS[plan];
  if (!p) return null;
  return (
    <span style={{
      background: p.bg, color: p.color,
      border: `1px solid ${p.color}45`,
      padding: "2px 8px", borderRadius: 20,
      fontSize: 11, fontWeight: 600, letterSpacing: "0.01em",
    }}>
      {p.label}
    </span>
  );
}

function HighlightBadge({ label, accent }) {
  if (!label) return null;
  return (
    <span style={{
      background: `${accent}1a`, color: accent,
      border: `1px solid ${accent}40`,
      padding: "2px 8px", borderRadius: 5,
      fontSize: 11, fontWeight: 600,
    }}>
      {label}
    </span>
  );
}

function StarRating({ rating }) {
  if (!rating) return <span style={{ color: T.textMuted, fontSize: 12 }}>Novo</span>;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: T.amber, fontSize: 12.5, fontWeight: 700 }}>
      <Star size={11} fill={T.amber} />
      {rating.toFixed(1)}
    </span>
  );
}

function StatusBadge({ status }) {
  if (status === "coming_soon") {
    return (
      <span style={{
        background: `${T.amber}1a`, color: T.amber,
        border: `1px solid ${T.amber}40`,
        padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 600,
      }}>Em breve</span>
    );
  }
  return (
    <span style={{
      background: `${T.emerald}1a`, color: T.emerald,
      border: `1px solid ${T.emerald}40`,
      padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 600,
    }}>Disponível</span>
  );
}

function TagRow({ items, color, bg, border }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
      {items.map(s => (
        <span key={s} style={{
          background: bg || T.surfaceHover,
          border: `1px solid ${border || T.border}`,
          color: color || T.textMuted,
          padding: "2px 8px", borderRadius: 5, fontSize: 11.5, fontWeight: 500,
        }}>{s}</span>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────
   FEATURED CARD
───────────────────────────────────────────── */
function FeaturedCard({ item, type, onClick }) {
  const isInt = type === "integrations";
  const count = item.missions || item.installs;
  const countLabel = item.missions ? "missões" : "instalações";

  return (
    <div className="mcard-featured" onClick={() => onClick(item)}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 20 }}>
        {/* Left content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Top badges */}
          <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginBottom: 14 }}>
            <span style={{
              background: "rgba(99,102,241,0.18)", color: "#818cf8",
              border: "1px solid rgba(99,102,241,0.3)",
              padding: "2px 9px", borderRadius: 5, fontSize: 11, fontWeight: 700,
            }}>⭐ Destaque</span>
            {item.badge && <HighlightBadge label={item.badge} accent={item.accent || T.indigo} />}
            <PlanBadge plan={item.plan} />
            {item.official && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: T.indigo, fontSize: 12 }}>
                <CheckCircle size={11} /> LDCN Core
              </span>
            )}
          </div>

          {/* Title */}
          <h2 style={{ margin: "0 0 4px", fontSize: 21, fontWeight: 800, color: T.text, lineHeight: 1.2 }}>
            {item.name}
          </h2>
          <p style={{ margin: "0 0 14px", fontSize: 13, color: T.textMuted }}>
            {item.author}
            {item.domain && ` · ${item.domain}`}
            {item.agentCount && ` · ${item.agentCount} agentes`}
            {item.version && ` · v${item.version}`}
          </p>

          {/* Tags */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 14 }}>
            {(item.stacks || []).map(s => (
              <span key={s} style={{ background: T.surfaceHover, border: `1px solid ${T.borderStrong}`, color: T.textSub, padding: "3px 9px", borderRadius: 5, fontSize: 12, fontWeight: 500 }}>{s}</span>
            ))}
            {(item.capabilities || item.modules || []).map(c => (
              <span key={c} style={{ background: `${T.indigo}14`, border: `1px solid ${T.indigo}28`, color: "#818cf8", padding: "3px 9px", borderRadius: 5, fontSize: 12 }}>{c}</span>
            ))}
          </div>

          {/* Description */}
          <p style={{ margin: "0 0 18px", fontSize: 13.5, color: T.textSub, lineHeight: 1.65, maxWidth: 580 }}>
            {item.description}
          </p>

          {/* Footer stats + actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <StarRating rating={item.rating} />
            <span style={{ color: T.textMuted, fontSize: 12 }}>{fmt(item.reviews)} avaliações</span>
            <span style={{ color: T.textMuted, fontSize: 12 }}>{fmt(count)} {countLabel}</span>
            {isInt && item.status && <StatusBadge status={item.status} />}
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <button className="btn-ghost" onClick={e => { e.stopPropagation(); onClick(item); }}>Ver detalhes</button>
              {(!isInt || item.status !== "coming_soon")
                ? <button className="btn-primary" onClick={e => e.stopPropagation()}><Plus size={14} /> Adicionar</button>
                : <button className="btn-notify" style={{ width: "auto", padding: "9px 16px" }} onClick={e => e.stopPropagation()}><Clock size={13} /> Notificar</button>
              }
            </div>
          </div>
        </div>

        {/* Right — decorative ring */}
        <div style={{ opacity: 0.65, paddingTop: 4, flexShrink: 0 }}>
          <CapabilityRing capabilities={item.capabilities || item.stacks || []} size={88} />
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   ITEM CARD (grid)
───────────────────────────────────────────── */
function ItemCard({ item, type, onClick }) {
  const isInt = type === "integrations";
  const isCap = type === "capabilities";
  const count = item.missions || item.installs;
  const countLabel = item.missions ? "missões" : "installs";
  const tags = (item.stacks || item.modules || []).slice(0, 3);

  return (
    <div className="mcard" onClick={() => onClick(item)}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Badges */}
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 7, minHeight: 20 }}>
            {item.badge && <HighlightBadge label={item.badge} accent={item.accent || T.indigo} />}
            {isInt && item.status && <StatusBadge status={item.status} />}
            {isCap && item.category && (
              <span style={{ color: T.textMuted, fontSize: 11, alignSelf: "center" }}>{item.category}</span>
            )}
          </div>
          {/* Name */}
          <h3 style={{ margin: "0 0 4px", fontSize: 14.5, fontWeight: 700, color: T.text, lineHeight: 1.25 }}>
            {item.name}
          </h3>
          {/* Author */}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 12, color: T.textMuted }}>{item.author}</span>
            {item.verified && (
              <CheckCircle size={10} color={item.official ? T.indigo : T.textMuted} />
            )}
          </div>
        </div>

        {/* Ring or icon */}
        {!isInt && !isCap
          ? <CapabilityRing capabilities={item.capabilities || item.stacks || []} size={46} />
          : (
            <div style={{
              width: 38, height: 38, borderRadius: 9, flexShrink: 0,
              background: item.accent ? `${item.accent}18` : T.surfaceEl,
              border: `1px solid ${item.accent ? `${item.accent}30` : T.border}`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {isInt
                ? <Plug size={15} color={item.accent || T.indigo} />
                : <Zap size={15} color={item.accent || T.indigo} />
              }
            </div>
          )
        }
      </div>

      {/* Stack / module tags */}
      {tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
          {tags.map(s => (
            <span key={s} style={{
              background: T.surfaceHover, border: `1px solid ${T.border}`,
              color: T.textMuted, padding: "2px 7px", borderRadius: 4, fontSize: 11,
            }}>{s}</span>
          ))}
          {item.agentCount && (
            <span style={{
              background: `${T.indigo}12`, border: `1px solid ${T.indigo}22`,
              color: "#818cf8", padding: "2px 7px", borderRadius: 4, fontSize: 11,
            }}>{item.agentCount} agentes</span>
          )}
        </div>
      )}

      {/* Description */}
      <p style={{
        margin: "0 0 12px", fontSize: 12.5, color: T.textSub, lineHeight: 1.55,
        overflow: "hidden", display: "-webkit-box",
        WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
        flex: 1,
      }}>
        {item.description}
      </p>

      {/* Footer */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderTop: `1px solid ${T.border}`, paddingTop: 10, marginTop: "auto",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <StarRating rating={item.rating} />
          {count && (
            <span style={{ color: T.textMuted, fontSize: 11 }}>{fmt(count)} {countLabel}</span>
          )}
        </div>
        <PlanBadge plan={item.plan} />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   DETAIL PANEL (right drawer)
───────────────────────────────────────────── */
function DetailPanel({ item, type, onClose }) {
  const isInt = type === "integrations";
  const count = item.missions || item.installs;
  const countLabel = item.missions ? "Missões" : "Instalações";

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 40 }}
      />
      {/* Panel */}
      <div
        className="panel-in"
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0, width: 372,
          background: T.surfaceEl,
          borderLeft: `1px solid ${T.borderMid}`,
          zIndex: 50, overflowY: "auto",
          display: "flex", flexDirection: "column",
        }}
      >
        {/* Header */}
        <div style={{ padding: "18px 20px", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                {item.badge && <HighlightBadge label={item.badge} accent={item.accent || T.indigo} />}
                <PlanBadge plan={item.plan} />
                {isInt && item.status && <StatusBadge status={item.status} />}
              </div>
              <h2 style={{ margin: "0 0 5px", fontSize: 17, fontWeight: 700, color: T.text, lineHeight: 1.2 }}>
                {item.name}
              </h2>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ fontSize: 12.5, color: T.textMuted }}>{item.author}</span>
                {item.verified && <CheckCircle size={11} color={item.official ? T.indigo : T.textMuted} />}
                {item.version && <span style={{ color: T.textMuted, fontSize: 12 }}>· v{item.version}</span>}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{ background: "none", border: "none", color: T.textMuted, cursor: "pointer", padding: 4, lineHeight: 1 }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Capability ring + tags */}
        {(item.capabilities || []).length > 0 && (
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "flex-start", gap: 14 }}>
            <CapabilityRing capabilities={item.capabilities} size={64} />
            <div>
              <p style={{ margin: "0 0 7px", fontSize: 10.5, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600 }}>Capacidades</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {item.capabilities.map(c => (
                  <span key={c} style={{
                    background: `${T.indigo}12`, border: `1px solid ${T.indigo}26`,
                    color: "#818cf8", padding: "2px 7px", borderRadius: 4, fontSize: 11.5,
                  }}>{c}</span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Stats row */}
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", gap: 20, flexWrap: "wrap" }}>
          {item.rating && (
            <div>
              <p style={{ margin: "0 0 3px", fontSize: 10.5, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Avaliação</p>
              <StarRating rating={item.rating} />
            </div>
          )}
          {item.reviews && (
            <div>
              <p style={{ margin: "0 0 3px", fontSize: 10.5, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Reviews</p>
              <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: T.text }}>{fmt(item.reviews)}</p>
            </div>
          )}
          {count && (
            <div>
              <p style={{ margin: "0 0 3px", fontSize: 10.5, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{countLabel}</p>
              <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: T.text }}>{fmt(count)}</p>
            </div>
          )}
          {item.updatedAt && (
            <div>
              <p style={{ margin: "0 0 3px", fontSize: 10.5, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Atualizado</p>
              <p style={{ margin: 0, fontSize: 12.5, color: T.textSub }}>{item.updatedAt}</p>
            </div>
          )}
        </div>

        {/* Description */}
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}` }}>
          <p style={{ margin: "0 0 8px", fontSize: 10.5, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600 }}>Descrição</p>
          <p style={{ margin: 0, fontSize: 13.5, color: T.textSub, lineHeight: 1.7 }}>{item.description}</p>
        </div>

        {/* Stacks */}
        {(item.stacks || item.modules || []).length > 0 && (
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}` }}>
            <p style={{ margin: "0 0 8px", fontSize: 10.5, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600 }}>
              {item.modules ? "Módulos incluídos" : "Stacks compatíveis"}
            </p>
            <TagRow items={item.stacks || item.modules} color={T.textSub} bg={T.surfaceHover} border={T.borderStrong} />
          </div>
        )}

        {/* Agent count for stack packs */}
        {item.agentCount && (
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.border}` }}>
            <p style={{ margin: "0 0 5px", fontSize: 10.5, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600 }}>Composição</p>
            <p style={{ margin: 0, fontSize: 13.5, color: T.text, fontWeight: 600 }}>
              {item.agentCount} agentes especializados incluídos
            </p>
          </div>
        )}

        {/* Plan requirement */}
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.border}` }}>
          <p style={{ margin: "0 0 7px", fontSize: 10.5, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600 }}>Plano necessário</p>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <PlanBadge plan={item.plan} />
            <span style={{ fontSize: 12.5, color: T.textSub }}>
              {item.plan === "free"
                ? "Disponível em todos os planos"
                : `Requer plano ${PLANS[item.plan]?.label} ou superior`}
            </span>
          </div>
        </div>

        {/* CTA */}
        <div style={{ padding: "16px 20px", marginTop: "auto" }}>
          {(!isInt || item.status !== "coming_soon") ? (
            <button className="btn-primary" style={{ width: "100%", padding: "11px 16px", fontSize: 14 }}>
              <Plus size={16} /> Adicionar ao Workspace
            </button>
          ) : (
            <button className="btn-notify">
              <Clock size={14} /> Notificar quando disponível
            </button>
          )}
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────
   EMPTY STATE
───────────────────────────────────────────── */
function EmptyState({ query }) {
  return (
    <div style={{ textAlign: "center", padding: "64px 24px", color: T.textMuted }}>
      <Search size={36} style={{ marginBottom: 14, opacity: 0.3 }} />
      <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 600, color: T.textSub }}>
        Nenhum resultado{query ? ` para "${query}"` : ""}
      </p>
      <p style={{ margin: 0, fontSize: 13, color: T.textMuted }}>
        Tente outros termos ou remova os filtros ativos
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────── */
export default function LDCNMarketplace() {
  const [cat, setCat]           = useState("agents");
  const [query, setQuery]       = useState("");
  const [planFilter, setPlan]   = useState("all");
  const [selected, setSelected] = useState(null);

  const items = ALL_DATA[cat] || [];

  const filtered = useMemo(() => items.filter(item => {
    const q = query.toLowerCase();
    const matchQ = !q
      || item.name.toLowerCase().includes(q)
      || item.description?.toLowerCase().includes(q)
      || item.author.toLowerCase().includes(q)
      || (item.stacks || []).some(s => s.toLowerCase().includes(q))
      || (item.capabilities || []).some(c => c.toLowerCase().includes(q))
      || (item.modules || []).some(m => m.toLowerCase().includes(q));
    const matchPlan = planFilter === "all" || item.plan === planFilter;
    return matchQ && matchPlan;
  }), [items, query, planFilter]);

  const featuredItem = filtered.find(i => i.featured);
  const rest = filtered.filter(i => !i.featured);

  function switchCat(id) {
    setCat(id);
    setQuery("");
    setPlan("all");
    setSelected(null);
  }

  return (
    <div style={{
      background: T.bg, minHeight: "100%",
      color: T.text,
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
      fontSize: 14,
    }}>
      <style>{CSS}</style>

      {/* ── TOPBAR ── */}
      <div style={{
        borderBottom: `1px solid ${T.border}`,
        padding: "14px 24px",
        display: "flex", alignItems: "center", gap: 16,
        position: "sticky", top: 0, zIndex: 30,
        background: `${T.bg}f2`, backdropFilter: "blur(14px)",
      }}>
        {/* Title */}
        <div style={{ flexShrink: 0 }}>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: T.text, letterSpacing: "-0.01em" }}>
            Marketplace
          </h1>
          <p style={{ margin: "2px 0 0", fontSize: 11.5, color: T.textMuted }}>
            Agentes, packs e extensões para suas missões
          </p>
        </div>

        {/* Search */}
        <div style={{ position: "relative", flex: 1, maxWidth: 460, marginLeft: "auto" }}>
          <Search size={14} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: T.textMuted, pointerEvents: "none" }} />
          <input
            className="search-input"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar agentes, stacks, templates..."
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: T.textMuted, cursor: "pointer", padding: 2, lineHeight: 1 }}
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Publish CTA */}
        <button className="btn-primary" style={{ flexShrink: 0, fontSize: 13 }}>
          <Sparkles size={13} /> Publicar
        </button>
      </div>

      {/* ── CATEGORY TABS ── */}
      <div style={{
        borderBottom: `1px solid ${T.border}`,
        padding: "0 20px",
        display: "flex", gap: 2,
        overflowX: "auto",
      }}>
        {CATS.map(c => (
          <button
            key={c.id}
            className={`stab${cat === c.id ? " active" : ""}`}
            onClick={() => switchCat(c.id)}
          >
            <c.Icon size={13.5} />
            {c.label}
            <span style={{
              background: T.borderMid, color: T.textMuted,
              fontSize: 10, fontWeight: 700,
              padding: "1px 6px", borderRadius: 10,
            }}>
              {c.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── FILTER BAR ── */}
      <div style={{
        padding: "11px 24px",
        borderBottom: `1px solid ${T.border}`,
        display: "flex", alignItems: "center", gap: 8,
        overflowX: "auto",
      }}>
        <Filter size={13} color={T.textMuted} style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: T.textMuted, flexShrink: 0, marginRight: 2 }}>Plano:</span>
        {[
          { id: "all",      label: "Todos" },
          { id: "free",     label: "Grátis" },
          { id: "basic",    label: "Basic+" },
          { id: "advanced", label: "Advanced+" },
          { id: "pro",      label: "Pro" },
        ].map(p => (
          <button
            key={p.id}
            className={`plan-chip${planFilter === p.id ? " active" : ""}`}
            onClick={() => setPlan(p.id)}
          >
            {p.label}
          </button>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 12, color: T.textMuted, flexShrink: 0, whiteSpace: "nowrap" }}>
          {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── CONTENT ── */}
      <div style={{ padding: 24 }}>
        {filtered.length === 0 ? (
          <EmptyState query={query} />
        ) : (
          <>
            {/* Featured */}
            {featuredItem && (
              <>
                <p style={{
                  margin: "0 0 12px",
                  fontSize: 10.5, color: T.textMuted,
                  textTransform: "uppercase", letterSpacing: "0.09em", fontWeight: 700,
                }}>
                  Em destaque
                </p>
                <FeaturedCard item={featuredItem} type={cat} onClick={setSelected} />
              </>
            )}

            {/* Grid */}
            {rest.length > 0 && (
              <>
                <p style={{
                  margin: "0 0 14px",
                  fontSize: 10.5, color: T.textMuted,
                  textTransform: "uppercase", letterSpacing: "0.09em", fontWeight: 700,
                }}>
                  {featuredItem ? "Todos" : "Resultados"} · {rest.length}
                </p>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(252px, 1fr))",
                  gap: 12,
                }}>
                  {rest.map(item => (
                    <ItemCard key={item.id} item={item} type={cat} onClick={setSelected} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* ── DETAIL PANEL ── */}
      {selected && (
        <DetailPanel item={selected} type={cat} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
