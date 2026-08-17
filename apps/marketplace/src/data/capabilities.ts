import type { CapabilityListing } from "../types";
import { T } from "../design/tokens";

export const CAPABILITIES: CapabilityListing[] = [
  {
    id: "rest-api",
    author: "LDCN Core",
    official: true,
    verified: true,
    category: "Design",
    capabilities: ["REST API"],
    rating: 4.9,
    installCount: 18432,
    plan: "basic",
    badgeKey: "core",
    featured: true,
    accent: T.cyan,
    localizedContent: {
      "pt-BR": {
        name: "REST API Design",
        description:
          "Geração de spec OpenAPI 3.0, design patterns de endpoints e estratégias de versionamento de API integradas ao Generator.",
      },
      en: {
        name: "REST API Design",
        description:
          "Generates OpenAPI 3.0 specs, endpoint design patterns, and API versioning strategies integrated into the Generator.",
      },
      es: {
        name: "REST API Design",
        description:
          "Generación de spec OpenAPI 3.0, patrones de diseño de endpoints y estrategias de versionado de API integradas al Generator.",
      },
      fr: {
        name: "REST API Design",
        description:
          "Génération de spec OpenAPI 3.0, patterns de conception d'endpoints et stratégies de versionnage d'API intégrées au Generator.",
      },
    },
  },
  {
    id: "owasp",
    author: "SecureForge",
    official: false,
    verified: true,
    category: "Security",
    capabilities: ["Security Audit"],
    rating: 4.8,
    installCount: 9234,
    plan: "advanced",
    badgeKey: null,
    featured: false,
    accent: T.red,
    localizedContent: {
      "pt-BR": {
        name: "OWASP Security Audit",
        description:
          "Revisão automatizada OWASP Top 10 integrada na geração de código. Bloqueia artefatos com vulnerabilidades críticas.",
      },
      en: {
        name: "OWASP Security Audit",
        description:
          "Automated OWASP Top 10 review integrated into code generation. Blocks artifacts with critical vulnerabilities.",
      },
      es: {
        name: "OWASP Security Audit",
        description:
          "Revisión automatizada OWASP Top 10 integrada en la generación de código. Bloquea artefactos con vulnerabilidades críticas.",
      },
      fr: {
        name: "OWASP Security Audit",
        description:
          "Revue automatisée OWASP Top 10 intégrée à la génération de code. Bloque les artefacts présentant des vulnérabilités critiques.",
      },
    },
  },
  {
    id: "lgpd",
    author: "BrazilTech",
    official: false,
    verified: true,
    category: "Compliance",
    capabilities: ["LGPD"],
    rating: 4.7,
    installCount: 3421,
    plan: "basic",
    badgeKey: "br_market",
    featured: false,
    accent: T.emerald,
    localizedContent: {
      "pt-BR": {
        name: "LGPD Compliance",
        description:
          "Garante que código e modelos de dados estejam em conformidade com a LGPD para o mercado brasileiro. Essencial para produção no Brasil.",
      },
      en: {
        name: "LGPD Compliance",
        description:
          "Ensures code and data models comply with LGPD for the Brazilian market. Essential for production in Brazil.",
      },
      es: {
        name: "LGPD Compliance",
        description:
          "Garantiza que el código y los modelos de datos cumplan con la LGPD para el mercado brasileño. Esencial para producción en Brasil.",
      },
      fr: {
        name: "LGPD Compliance",
        description:
          "Garantit que le code et les modèles de données respectent la LGPD pour le marché brésilien. Essentiel pour la production au Brésil.",
      },
    },
  },
  {
    id: "perf-test",
    author: "SpeedLab",
    official: false,
    verified: true,
    category: "Testing",
    capabilities: ["Testing", "Performance"],
    rating: 4.5,
    installCount: 2871,
    plan: "advanced",
    badgeKey: null,
    featured: false,
    accent: T.violet,
    localizedContent: {
      "pt-BR": {
        name: "Performance Testing",
        description:
          "Testes de carga automatizados com k6 e Gatling. Gera relatórios de performance e define benchmarks por endpoint.",
      },
      en: {
        name: "Performance Testing",
        description:
          "Automated load testing with k6 and Gatling. Generates performance reports and sets per-endpoint benchmarks.",
      },
      es: {
        name: "Performance Testing",
        description:
          "Pruebas de carga automatizadas con k6 y Gatling. Genera informes de rendimiento y define benchmarks por endpoint.",
      },
      fr: {
        name: "Performance Testing",
        description:
          "Tests de charge automatisés avec k6 et Gatling. Génère des rapports de performance et définit des benchmarks par endpoint.",
      },
    },
  },
  {
    id: "seo",
    author: "WebCraft Studio",
    official: false,
    verified: true,
    category: "Marketing",
    capabilities: ["SEO", "Performance"],
    rating: 4.6,
    installCount: 5621,
    plan: "basic",
    badgeKey: null,
    featured: false,
    accent: T.amber,
    localizedContent: {
      "pt-BR": {
        name: "SEO Optimizer",
        description:
          "Meta tags, structured data, sitemap e Core Web Vitals optimization para projetos web. Integrado ao Astro e Next.js.",
      },
      en: {
        name: "SEO Optimizer",
        description:
          "Meta tags, structured data, sitemap, and Core Web Vitals optimization for web projects. Integrated with Astro and Next.js.",
      },
      es: {
        name: "SEO Optimizer",
        description:
          "Meta tags, structured data, sitemap y optimización de Core Web Vitals para proyectos web. Integrado con Astro y Next.js.",
      },
      fr: {
        name: "SEO Optimizer",
        description:
          "Meta tags, structured data, sitemap et optimisation des Core Web Vitals pour projets web. Intégré à Astro et Next.js.",
      },
    },
  },
  {
    id: "a11y",
    author: "LDCN Core",
    official: true,
    verified: true,
    category: "Compliance",
    capabilities: ["A11y", "UI Components"],
    rating: 4.8,
    installCount: 7234,
    plan: "basic",
    badgeKey: null,
    featured: false,
    accent: T.indigo,
    localizedContent: {
      "pt-BR": {
        name: "Acessibilidade WCAG AA",
        description:
          "Conformidade WCAG AA em componentes de UI: ARIA correto, contraste, navegação por teclado e labels para screen readers.",
      },
      en: {
        name: "WCAG AA Accessibility",
        description:
          "WCAG AA compliance for UI components: correct ARIA, contrast, keyboard navigation, and screen reader labels.",
      },
      es: {
        name: "Accesibilidad WCAG AA",
        description:
          "Conformidad WCAG AA en componentes de UI: ARIA correcto, contraste, navegación por teclado y etiquetas para lectores de pantalla.",
      },
      fr: {
        name: "Accessibilité WCAG AA",
        description:
          "Conformité WCAG AA pour les composants d'UI : ARIA correct, contraste, navigation au clavier et labels pour lecteurs d'écran.",
      },
    },
  },
];
