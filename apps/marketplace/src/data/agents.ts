import type { AgentListing } from "../types";
import { T } from "../design/tokens";

export const AGENTS: AgentListing[] = [
  {
    id: "java-backend",
    author: "LDCN Core",
    official: true,
    verified: true,
    domain: "Backend",
    stacks: ["Java", "Spring Boot", "JPA"],
    capabilities: ["REST API", "Database", "Testing", "Security", "Docs"],
    rating: 4.9,
    reviewCount: 1247,
    missionCount: 8432,
    plan: "basic",
    badgeKey: "top_rated",
    featured: true,
    accent: T.amber,
    version: "2.3.1",
    updatedAt: "3d",
    localizedContent: {
      "pt-BR": {
        name: "Java Backend Engineer",
        description:
          "Engenheiro sênior Spring Boot para backends enterprise. Cria APIs REST robustas, gerencia JPA/Hibernate, Spring Security e testes de integração completos.",
      },
      en: {
        name: "Java Backend Engineer",
        description:
          "Senior Spring Boot engineer for enterprise backends. Builds robust REST APIs, manages JPA/Hibernate, Spring Security, and full integration test coverage.",
      },
      es: {
        name: "Java Backend Engineer",
        description:
          "Ingeniero senior de Spring Boot para backends empresariales. Crea APIs REST robustas, gestiona JPA/Hibernate, Spring Security y pruebas de integración completas.",
      },
      fr: {
        name: "Java Backend Engineer",
        description:
          "Ingénieur senior Spring Boot pour backends d'entreprise. Crée des API REST robustes, gère JPA/Hibernate, Spring Security et une couverture de tests d'intégration complète.",
      },
    },
  },
  {
    id: "angular-fe",
    author: "LDCN Core",
    official: true,
    verified: true,
    domain: "Frontend",
    stacks: ["Angular", "TypeScript", "RxJS"],
    capabilities: ["UI Components", "Routing", "State Management", "Testing", "A11y"],
    rating: 4.8,
    reviewCount: 986,
    missionCount: 6241,
    plan: "basic",
    badgeKey: "editors_pick",
    featured: false,
    accent: T.red,
    version: "2.1.0",
    updatedAt: "1w",
    localizedContent: {
      "pt-BR": {
        name: "Angular Frontend Engineer",
        description:
          "Especialista Angular 18 com standalone components, signals e estado reativo. Cria UIs enterprise acessíveis e com design premium.",
      },
      en: {
        name: "Angular Frontend Engineer",
        description:
          "Angular 18 specialist working with standalone components, signals, and reactive state. Builds accessible, premium-quality enterprise UIs.",
      },
      es: {
        name: "Angular Frontend Engineer",
        description:
          "Especialista en Angular 18 con standalone components, signals y estado reactivo. Crea interfaces empresariales accesibles y con diseño premium.",
      },
      fr: {
        name: "Angular Frontend Engineer",
        description:
          "Spécialiste Angular 18 avec composants standalone, signals et état réactif. Conçoit des interfaces d'entreprise accessibles au design premium.",
      },
    },
  },
  {
    id: "flutter-mobile",
    author: "LDCN Core",
    official: true,
    verified: true,
    domain: "Mobile",
    stacks: ["Flutter", "Dart", "Firebase"],
    capabilities: ["iOS", "Android", "REST API", "State Management", "Testing"],
    rating: 4.7,
    reviewCount: 724,
    missionCount: 3190,
    plan: "advanced",
    badgeKey: null,
    featured: false,
    accent: T.cyan,
    version: "1.8.4",
    updatedAt: "5d",
    localizedContent: {
      "pt-BR": {
        name: "Flutter Mobile Engineer",
        description:
          "Engineer cross-platform Flutter para apps iOS e Android de produção. Riverpod, Bloc, Firebase e cobertura de testes completa.",
      },
      en: {
        name: "Flutter Mobile Engineer",
        description:
          "Cross-platform Flutter engineer for production-grade iOS and Android apps. Riverpod, Bloc, Firebase, and full test coverage.",
      },
      es: {
        name: "Flutter Mobile Engineer",
        description:
          "Ingeniero Flutter multiplataforma para apps iOS y Android en producción. Riverpod, Bloc, Firebase y cobertura de pruebas completa.",
      },
      fr: {
        name: "Flutter Mobile Engineer",
        description:
          "Ingénieur Flutter multiplateforme pour applications iOS et Android en production. Riverpod, Bloc, Firebase et couverture de tests complète.",
      },
    },
  },
  {
    id: "python-data",
    author: "LDCN Core",
    official: true,
    verified: true,
    domain: "Backend",
    stacks: ["Python", "FastAPI", "SQLAlchemy"],
    capabilities: ["REST API", "Database", "Data Pipeline", "Testing", "Docs"],
    rating: 4.8,
    reviewCount: 567,
    missionCount: 2108,
    plan: "basic",
    badgeKey: null,
    featured: false,
    accent: T.emerald,
    version: "1.5.2",
    updatedAt: "2w",
    localizedContent: {
      "pt-BR": {
        name: "Python Data Engineer",
        description:
          "Python full-stack para aplicações data-heavy. FastAPI, pandas, SQLAlchemy e pipelines de transformação e análise.",
      },
      en: {
        name: "Python Data Engineer",
        description:
          "Full-stack Python for data-heavy applications. FastAPI, pandas, SQLAlchemy, and transformation/analysis pipelines.",
      },
      es: {
        name: "Python Data Engineer",
        description:
          "Python full-stack para aplicaciones intensivas en datos. FastAPI, pandas, SQLAlchemy y pipelines de transformación y análisis.",
      },
      fr: {
        name: "Python Data Engineer",
        description:
          "Python full-stack pour applications à forte intensité de données. FastAPI, pandas, SQLAlchemy et pipelines de transformation et d'analyse.",
      },
    },
  },
  {
    id: "go-microservices",
    author: "CloudNative Labs",
    official: false,
    verified: true,
    domain: "Backend",
    stacks: ["Go", "gRPC", "PostgreSQL"],
    capabilities: ["Microservices", "gRPC", "Database", "Security", "Observability"],
    rating: 4.6,
    reviewCount: 312,
    missionCount: 1834,
    plan: "pro",
    badgeKey: "community",
    featured: false,
    accent: T.cyan,
    version: "1.2.0",
    updatedAt: "3w",
    localizedContent: {
      "pt-BR": {
        name: "Go Microservices Architect",
        description:
          "Especialista Go para microserviços de alta performance. gRPC, event-driven patterns, distributed tracing e deploys containerizados.",
      },
      en: {
        name: "Go Microservices Architect",
        description:
          "Go specialist for high-performance microservices. gRPC, event-driven patterns, distributed tracing, and containerized deployments.",
      },
      es: {
        name: "Go Microservices Architect",
        description:
          "Especialista en Go para microservicios de alto rendimiento. gRPC, patrones event-driven, distributed tracing y despliegues en contenedores.",
      },
      fr: {
        name: "Go Microservices Architect",
        description:
          "Spécialiste Go pour microservices haute performance. gRPC, patterns event-driven, tracing distribué et déploiements conteneurisés.",
      },
    },
  },
  {
    id: "react-fe",
    author: "WebCraft Studio",
    official: false,
    verified: true,
    domain: "Frontend",
    stacks: ["React", "TypeScript", "Vite"],
    capabilities: ["UI Components", "Routing", "State Management", "Testing", "Performance"],
    rating: 4.7,
    reviewCount: 891,
    missionCount: 5621,
    plan: "basic",
    badgeKey: null,
    featured: false,
    accent: T.cyan,
    version: "3.0.1",
    updatedAt: "4d",
    localizedContent: {
      "pt-BR": {
        name: "React Frontend Engineer",
        description:
          "React moderno com TypeScript e Vite. Bibliotecas de componentes, Zustand/Jotai e testes abrangentes com Vitest.",
      },
      en: {
        name: "React Frontend Engineer",
        description:
          "Modern React with TypeScript and Vite. Component libraries, Zustand/Jotai, and thorough testing with Vitest.",
      },
      es: {
        name: "React Frontend Engineer",
        description:
          "React moderno con TypeScript y Vite. Bibliotecas de componentes, Zustand/Jotai y pruebas exhaustivas con Vitest.",
      },
      fr: {
        name: "React Frontend Engineer",
        description:
          "React moderne avec TypeScript et Vite. Bibliothèques de composants, Zustand/Jotai et tests approfondis avec Vitest.",
      },
    },
  },
  {
    id: "devops",
    author: "LDCN Core",
    official: true,
    verified: true,
    domain: "Infrastructure",
    stacks: ["Docker", "GitHub Actions", "K8s"],
    capabilities: ["CI/CD", "Infrastructure", "Monitoring", "Security", "Testing"],
    rating: 4.9,
    reviewCount: 445,
    missionCount: 3982,
    plan: "advanced",
    badgeKey: "reliable",
    featured: false,
    accent: T.violet,
    version: "2.0.3",
    updatedAt: "1w",
    localizedContent: {
      "pt-BR": {
        name: "DevOps & CI/CD Engineer",
        description:
          "Pipelines CI/CD robustos, Docker e Kubernetes. GitHub Actions, monitoring integrado e security gates automáticos.",
      },
      en: {
        name: "DevOps & CI/CD Engineer",
        description:
          "Robust CI/CD pipelines, Docker, and Kubernetes. GitHub Actions, built-in monitoring, and automated security gates.",
      },
      es: {
        name: "DevOps & CI/CD Engineer",
        description:
          "Pipelines CI/CD robustos, Docker y Kubernetes. GitHub Actions, monitoreo integrado y security gates automáticos.",
      },
      fr: {
        name: "DevOps & CI/CD Engineer",
        description:
          "Pipelines CI/CD robustes, Docker et Kubernetes. GitHub Actions, monitoring intégré et security gates automatiques.",
      },
    },
  },
  {
    id: "security",
    author: "SecureForge",
    official: false,
    verified: true,
    domain: "Security",
    stacks: ["OWASP", "JWT", "OAuth2"],
    capabilities: ["Security Audit", "Auth", "Authorization", "LGPD", "Penetration Testing"],
    rating: 4.8,
    reviewCount: 234,
    missionCount: 1456,
    plan: "pro",
    badgeKey: null,
    featured: false,
    accent: T.red,
    version: "1.4.1",
    updatedAt: "2w",
    localizedContent: {
      "pt-BR": {
        name: "Security Specialist",
        description:
          "Revisões OWASP automatizadas, flows de autenticação, modelos de permissão e validação LGPD/GDPR integrada.",
      },
      en: {
        name: "Security Specialist",
        description:
          "Automated OWASP reviews, authentication flows, permission models, and built-in LGPD/GDPR validation.",
      },
      es: {
        name: "Security Specialist",
        description:
          "Revisiones OWASP automatizadas, flujos de autenticación, modelos de permisos y validación LGPD/GDPR integrada.",
      },
      fr: {
        name: "Security Specialist",
        description:
          "Revues OWASP automatisées, flux d'authentification, modèles de permissions et validation LGPD/RGPD intégrée.",
      },
    },
  },
];
