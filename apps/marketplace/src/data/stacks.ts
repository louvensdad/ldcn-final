import type { StackPackListing } from "../types";
import { T } from "../design/tokens";

export const STACKS: StackPackListing[] = [
  {
    id: "java-angular",
    author: "LDCN Core",
    official: true,
    verified: true,
    stacks: ["Java", "Spring Boot", "Angular", "PostgreSQL"],
    capabilities: ["REST API", "Database", "UI Components", "CI/CD", "Testing"],
    agentCount: 4,
    rating: 4.9,
    reviewCount: 672,
    missionCount: 4832,
    plan: "advanced",
    badgeKey: "best_value",
    featured: true,
    accent: T.indigo,
    version: "2.0.0",
    updatedAt: "2d",
    localizedContent: {
      "pt-BR": {
        name: "Java + Angular Enterprise",
        description:
          "Time enterprise completo para Java + Angular. Backend Engineer, Frontend Engineer, DevOps e QA pré-configurados e prontos para produção.",
      },
      en: {
        name: "Java + Angular Enterprise",
        description:
          "Complete enterprise team for Java + Angular. Backend Engineer, Frontend Engineer, DevOps, and QA, pre-configured and production-ready.",
      },
      es: {
        name: "Java + Angular Enterprise",
        description:
          "Equipo empresarial completo para Java + Angular. Backend Engineer, Frontend Engineer, DevOps y QA preconfigurados y listos para producción.",
      },
      fr: {
        name: "Java + Angular Enterprise",
        description:
          "Équipe d'entreprise complète pour Java + Angular. Backend Engineer, Frontend Engineer, DevOps et QA préconfigurés et prêts pour la production.",
      },
    },
  },
  {
    id: "flutter-fastapi",
    author: "LDCN Core",
    official: true,
    verified: true,
    stacks: ["Flutter", "Python", "FastAPI", "PostgreSQL"],
    capabilities: ["Mobile", "REST API", "Database", "CI/CD"],
    agentCount: 3,
    rating: 4.7,
    reviewCount: 341,
    missionCount: 2104,
    plan: "advanced",
    badgeKey: null,
    featured: false,
    accent: T.emerald,
    version: "1.3.0",
    updatedAt: "1w",
    localizedContent: {
      "pt-BR": {
        name: "Flutter + FastAPI Pack",
        description:
          "Pack mobile-first ideal para consumer apps e MVPs: Flutter Mobile Engineer + Python Backend Engineer + DevOps.",
      },
      en: {
        name: "Flutter + FastAPI Pack",
        description:
          "Mobile-first pack ideal for consumer apps and MVPs: Flutter Mobile Engineer + Python Backend Engineer + DevOps.",
      },
      es: {
        name: "Flutter + FastAPI Pack",
        description:
          "Pack mobile-first ideal para apps de consumo y MVPs: Flutter Mobile Engineer + Python Backend Engineer + DevOps.",
      },
      fr: {
        name: "Flutter + FastAPI Pack",
        description:
          "Pack mobile-first idéal pour les apps grand public et les MVP : Flutter Mobile Engineer + Python Backend Engineer + DevOps.",
      },
    },
  },
  {
    id: "nextjs-saas",
    author: "WebCraft Studio",
    official: false,
    verified: true,
    stacks: ["Next.js", "TypeScript", "Prisma", "Stripe"],
    capabilities: ["UI Components", "Database", "Auth", "CI/CD"],
    agentCount: 3,
    rating: 4.6,
    reviewCount: 289,
    missionCount: 1743,
    plan: "basic",
    badgeKey: "trending",
    featured: false,
    accent: "#e2e8f0",
    version: "1.1.2",
    updatedAt: "5d",
    localizedContent: {
      "pt-BR": {
        name: "Next.js SaaS Pack",
        description:
          "Pack SaaS opinativo com Next.js App Router, Prisma ORM, Stripe billing, auth e subscription management pré-configurados.",
      },
      en: {
        name: "Next.js SaaS Pack",
        description:
          "Opinionated SaaS pack with Next.js App Router, Prisma ORM, Stripe billing, auth, and subscription management pre-configured.",
      },
      es: {
        name: "Next.js SaaS Pack",
        description:
          "Pack SaaS opinado con Next.js App Router, Prisma ORM, facturación Stripe, auth y gestión de suscripciones preconfigurados.",
      },
      fr: {
        name: "Next.js SaaS Pack",
        description:
          "Pack SaaS opinionated avec Next.js App Router, Prisma ORM, facturation Stripe, auth et gestion des abonnements préconfigurés.",
      },
    },
  },
  {
    id: "go-micro-pack",
    author: "CloudNative Labs",
    official: false,
    verified: true,
    stacks: ["Go", "gRPC", "Redis", "PostgreSQL"],
    capabilities: ["Microservices", "gRPC", "Database", "Monitoring", "CI/CD"],
    agentCount: 4,
    rating: 4.5,
    reviewCount: 178,
    missionCount: 892,
    plan: "pro",
    badgeKey: null,
    featured: false,
    accent: T.cyan,
    version: "1.0.3",
    updatedAt: "1mo",
    localizedContent: {
      "pt-BR": {
        name: "Go Microservices Pack",
        description:
          "Pack completo para arquitetura de microserviços em Go: Architect, Backend Engineers especializados e DevOps.",
      },
      en: {
        name: "Go Microservices Pack",
        description:
          "Complete pack for Go microservices architecture: Architect, specialized Backend Engineers, and DevOps.",
      },
      es: {
        name: "Go Microservices Pack",
        description:
          "Pack completo para arquitectura de microservicios en Go: Architect, Backend Engineers especializados y DevOps.",
      },
      fr: {
        name: "Go Microservices Pack",
        description:
          "Pack complet pour une architecture de microservices en Go : Architect, Backend Engineers spécialisés et DevOps.",
      },
    },
  },
];
