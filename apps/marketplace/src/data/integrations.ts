import type { IntegrationListing } from "../types";
import { T } from "../design/tokens";

export const INTEGRATIONS: IntegrationListing[] = [
  {
    id: "github",
    author: "LDCN Core",
    official: true,
    verified: true,
    status: "available",
    rating: 4.9,
    installCount: 12043,
    plan: "basic",
    badgeKey: "official",
    featured: true,
    accent: "#e2e8f0",
    localizedContent: {
      "pt-BR": {
        name: "GitHub",
        description:
          "Push de artifacts diretamente para repositórios GitHub, trigger de workflows e gestão de Pull Requests pelo Mission Command Center.",
      },
      en: {
        name: "GitHub",
        description:
          "Push artifacts directly to GitHub repositories, trigger workflows, and manage Pull Requests from the Mission Command Center.",
      },
      es: {
        name: "GitHub",
        description:
          "Push de artifacts directamente a repositorios de GitHub, disparo de workflows y gestión de Pull Requests desde el Mission Command Center.",
      },
      fr: {
        name: "GitHub",
        description:
          "Push des artifacts directement vers des dépôts GitHub, déclenchement de workflows et gestion des Pull Requests depuis le Mission Command Center.",
      },
    },
  },
  {
    id: "gitlab",
    author: "LDCN Core",
    official: true,
    verified: true,
    status: "coming_soon",
    rating: null,
    installCount: undefined,
    plan: "basic",
    badgeKey: null,
    featured: false,
    accent: T.amber,
    localizedContent: {
      "pt-BR": {
        name: "GitLab",
        description:
          "Integração GitLab completa: CI/CD pipeline sync, automação de merge requests e gestão de artifacts diretamente na plataforma.",
      },
      en: {
        name: "GitLab",
        description:
          "Full GitLab integration: CI/CD pipeline sync, merge request automation, and artifact management directly on the platform.",
      },
      es: {
        name: "GitLab",
        description:
          "Integración GitLab completa: sincronización de pipelines CI/CD, automatización de merge requests y gestión de artifacts directamente en la plataforma.",
      },
      fr: {
        name: "GitLab",
        description:
          "Intégration GitLab complète : synchronisation des pipelines CI/CD, automatisation des merge requests et gestion des artifacts directement sur la plateforme.",
      },
    },
  },
  {
    id: "slack",
    author: "LDCN Core",
    official: true,
    verified: true,
    status: "coming_soon",
    rating: null,
    installCount: undefined,
    plan: "basic",
    badgeKey: null,
    featured: false,
    accent: "#4a154b",
    localizedContent: {
      "pt-BR": {
        name: "Slack",
        description:
          "Atualizações de missão em tempo real, aprovações e alertas de bloqueio entregues diretamente no seu workspace Slack.",
      },
      en: {
        name: "Slack",
        description:
          "Real-time mission updates, approvals, and blocker alerts delivered straight to your Slack workspace.",
      },
      es: {
        name: "Slack",
        description:
          "Actualizaciones de misión en tiempo real, aprobaciones y alertas de bloqueo entregadas directamente en tu workspace de Slack.",
      },
      fr: {
        name: "Slack",
        description:
          "Mises à jour de mission en temps réel, approbations et alertes de blocage livrées directement dans votre workspace Slack.",
      },
    },
  },
  {
    id: "aws",
    author: "CloudNative Labs",
    official: false,
    verified: true,
    status: "available",
    rating: 4.7,
    installCount: 5234,
    plan: "advanced",
    badgeKey: null,
    featured: false,
    accent: T.amber,
    localizedContent: {
      "pt-BR": {
        name: "AWS Deployment",
        description:
          "Deploy automático de artifacts para AWS ECS, Lambda e S3. Suporte a múltiplos environments com rollback integrado.",
      },
      en: {
        name: "AWS Deployment",
        description:
          "Automatic artifact deployment to AWS ECS, Lambda, and S3. Multi-environment support with built-in rollback.",
      },
      es: {
        name: "AWS Deployment",
        description:
          "Despliegue automático de artifacts en AWS ECS, Lambda y S3. Soporte para múltiples entornos con rollback integrado.",
      },
      fr: {
        name: "AWS Deployment",
        description:
          "Déploiement automatique des artifacts vers AWS ECS, Lambda et S3. Support multi-environnements avec rollback intégré.",
      },
    },
  },
  {
    id: "jira",
    author: "LDCN Core",
    official: true,
    verified: true,
    status: "coming_soon",
    rating: null,
    installCount: undefined,
    plan: "advanced",
    badgeKey: null,
    featured: false,
    accent: "#0052cc",
    localizedContent: {
      "pt-BR": {
        name: "Jira",
        description:
          "Sincronização de tasks com Jira issues, sprint planning integrado e rastreamento de progresso bidirecional.",
      },
      en: {
        name: "Jira",
        description:
          "Task sync with Jira issues, integrated sprint planning, and bidirectional progress tracking.",
      },
      es: {
        name: "Jira",
        description:
          "Sincronización de tasks con issues de Jira, sprint planning integrado y seguimiento de progreso bidireccional.",
      },
      fr: {
        name: "Jira",
        description:
          "Synchronisation des tâches avec les issues Jira, sprint planning intégré et suivi bidirectionnel de la progression.",
      },
    },
  },
];
