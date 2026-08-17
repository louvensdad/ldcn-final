import type { TemplateListing } from "../types";
import { T } from "../design/tokens";

export const TEMPLATES: TemplateListing[] = [
  {
    id: "erp",
    author: "LDCN Core",
    official: true,
    verified: true,
    stacks: ["Java", "Spring Boot", "Angular", "PostgreSQL"],
    capabilities: ["REST API", "Database", "UI Components", "Security", "Testing"],
    modules: ["HR", "Finance", "Inventory", "Procurement"],
    rating: 4.9,
    reviewCount: 523,
    missionCount: 3421,
    plan: "pro",
    badgeKey: "enterprise",
    featured: true,
    accent: T.indigo,
    updatedAt: "1w",
    localizedContent: {
      "pt-BR": {
        name: "ERP System Template",
        description:
          "Template ERP modular pronto para produção. Requirements, solution aprovada e composição de time pré-definidos. Acelera o início em semanas.",
      },
      en: {
        name: "ERP System Template",
        description:
          "Production-ready modular ERP template. Requirements, approved solution, and team composition pre-defined. Cuts weeks off the start.",
      },
      es: {
        name: "ERP System Template",
        description:
          "Plantilla ERP modular lista para producción. Requisitos, solución aprobada y composición de equipo predefinidos. Acelera el inicio en semanas.",
      },
      fr: {
        name: "ERP System Template",
        description:
          "Modèle ERP modulaire prêt pour la production. Requirements, solution approuvée et composition d'équipe prédéfinies. Fait gagner des semaines au démarrage.",
      },
    },
  },
  {
    id: "saas",
    author: "LDCN Core",
    official: true,
    verified: true,
    stacks: ["Next.js", "Node.js", "PostgreSQL", "Stripe"],
    capabilities: ["Auth", "Database", "CI/CD", "Monitoring"],
    modules: ["Auth", "Billing", "Dashboard", "API"],
    rating: 4.8,
    reviewCount: 891,
    missionCount: 6201,
    plan: "basic",
    badgeKey: "most_used",
    featured: false,
    accent: T.violet,
    updatedAt: "3d",
    localizedContent: {
      "pt-BR": {
        name: "Multi-tenant SaaS",
        description:
          "Template SaaS com multi-tenancy, subscription management, usage billing e analytics. O mais usado da plataforma.",
      },
      en: {
        name: "Multi-tenant SaaS",
        description:
          "SaaS template with multi-tenancy, subscription management, usage billing, and analytics. The platform's most used template.",
      },
      es: {
        name: "Multi-tenant SaaS",
        description:
          "Plantilla SaaS con multi-tenancy, gestión de suscripciones, facturación por uso y analítica. La más usada de la plataforma.",
      },
      fr: {
        name: "Multi-tenant SaaS",
        description:
          "Modèle SaaS avec multi-tenancy, gestion des abonnements, facturation à l'usage et analytics. Le plus utilisé de la plateforme.",
      },
    },
  },
  {
    id: "landing",
    author: "WebCraft Studio",
    official: false,
    verified: true,
    stacks: ["Astro", "TailwindCSS"],
    capabilities: ["UI Components", "SEO", "Performance"],
    modules: ["Hero", "Features", "Pricing", "CTA"],
    rating: 4.7,
    reviewCount: 1243,
    missionCount: 8934,
    plan: "free",
    badgeKey: null,
    featured: false,
    accent: T.cyan,
    updatedAt: "2w",
    localizedContent: {
      "pt-BR": {
        name: "Marketing Landing Page",
        description:
          "Landing page de alta conversão com seções prontas. Otimizada para SEO e Core Web Vitals. Missão concluída em minutos.",
      },
      en: {
        name: "Marketing Landing Page",
        description:
          "High-conversion landing page with ready-made sections. Optimized for SEO and Core Web Vitals. Mission completed in minutes.",
      },
      es: {
        name: "Marketing Landing Page",
        description:
          "Landing page de alta conversión con secciones listas. Optimizada para SEO y Core Web Vitals. Misión completada en minutos.",
      },
      fr: {
        name: "Marketing Landing Page",
        description:
          "Landing page à fort taux de conversion avec sections prêtes à l'emploi. Optimisée pour le SEO et les Core Web Vitals. Mission terminée en quelques minutes.",
      },
    },
  },
  {
    id: "mobile-consumer",
    author: "MobileFirst Co",
    official: false,
    verified: true,
    stacks: ["Flutter", "Firebase", "FastAPI"],
    capabilities: ["Mobile", "Auth", "REST API", "Testing"],
    modules: ["Auth", "Feed", "Profile", "Push Notifications"],
    rating: 4.6,
    reviewCount: 334,
    missionCount: 1823,
    plan: "advanced",
    badgeKey: null,
    featured: false,
    accent: T.amber,
    updatedAt: "3w",
    localizedContent: {
      "pt-BR": {
        name: "Consumer Mobile App",
        description:
          "Template mobile consumer com auth social, feed, perfil e push notifications. Cross-platform iOS e Android.",
      },
      en: {
        name: "Consumer Mobile App",
        description:
          "Consumer mobile template with social auth, feed, profile, and push notifications. Cross-platform iOS and Android.",
      },
      es: {
        name: "Consumer Mobile App",
        description:
          "Plantilla mobile de consumo con auth social, feed, perfil y notificaciones push. Multiplataforma iOS y Android.",
      },
      fr: {
        name: "Consumer Mobile App",
        description:
          "Modèle mobile grand public avec authentification sociale, fil d'actualité, profil et notifications push. Multiplateforme iOS et Android.",
      },
    },
  },
];
