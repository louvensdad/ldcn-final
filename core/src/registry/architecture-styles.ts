export interface ArchitectureStyle {
  key: string;
  name: string;
  description: string;
  defaultForStacks: string[];
  modules: Array<{
    name: string;
    responsibility: string;
    exposes: string[];
    dependsOn: string[];
  }>;
  communication: string[];
  persistence?: string;
  deployment: string;
  test: string;
  build: string;
  observability: string[];
  security: string[];
  tradeoffs: string[];
  risks: string[];
}

export const ARCHITECTURE_STYLES: ArchitectureStyle[] = [
  {
    key: 'modular-monolith',
    name: 'Modular Monolith',
    description: 'Single deployable unit with strongly bounded internal modules.',
    defaultForStacks: [
      'stack.typescript.nestjs',
      'stack.java.spring-boot',
      'stack.csharp.aspnet-core',
    ],
    modules: [
      {
        name: 'api',
        responsibility: 'Expose HTTP endpoints and handle request/response',
        exposes: ['controllers', 'dto'],
        dependsOn: ['application', 'domain'],
      },
      {
        name: 'application',
        responsibility: 'Orchestrate use cases and apply policies',
        exposes: ['services', 'commands', 'queries'],
        dependsOn: ['domain'],
      },
      {
        name: 'domain',
        responsibility: 'Core business entities and rules',
        exposes: ['entities', 'value-objects', 'repositories interfaces'],
        dependsOn: [],
      },
      {
        name: 'infrastructure',
        responsibility: 'Persistence, external clients, and framework glue',
        exposes: ['repository implementations', 'clients'],
        dependsOn: ['domain'],
      },
    ],
    communication: ['HTTP REST', 'internal method calls'],
    persistence: 'Relational database (PostgreSQL)',
    deployment: 'Containerized single service',
    test: 'Unit + integration tests; contract tests for API',
    build: 'Single build artifact',
    observability: ['structured logging', 'metrics', 'health checks'],
    security: ['authentication middleware', 'input validation', 'CORS'],
    tradeoffs: [
      'Simpler deployment and transactions',
      'Harder to scale independent modules',
    ],
    risks: ['Module boundaries can degrade over time'],
  },
  {
    key: 'microservices',
    name: 'Microservices',
    description: 'Independent deployable services aligned to business capabilities.',
    defaultForStacks: ['stack.java.spring-boot', 'stack.typescript.nestjs'],
    modules: [
      {
        name: 'service-boundary',
        responsibility: 'Own a business capability end-to-end',
        exposes: ['public API', 'events'],
        dependsOn: ['other services via contracts'],
      },
    ],
    communication: ['HTTP REST', 'async events'],
    persistence: 'Per-service database',
    deployment: 'Kubernetes / container orchestration',
    test: 'Contract tests, service tests, chaos tests',
    build: 'Independent build pipelines per service',
    observability: ['distributed tracing', 'centralized logging', 'SLOs'],
    security: ['mTLS', 'OAuth2', 'rate limiting'],
    tradeoffs: [
      'Independent scalability and teams',
      'Higher operational complexity',
    ],
    risks: ['Distributed transactions and eventual consistency'],
  },
  {
    key: 'fullstack-single-runtime',
    name: 'Full-stack Single Runtime',
    description: 'Frontend and backend share the same runtime and deployment unit.',
    defaultForStacks: ['stack.typescript.nextjs'],
    modules: [
      {
        name: 'pages',
        responsibility: 'Render UI and handle client-side navigation',
        exposes: ['routes', 'components'],
        dependsOn: ['api-routes', 'data-access'],
      },
      {
        name: 'api-routes',
        responsibility: 'Server-side endpoints and server actions',
        exposes: ['HTTP handlers', 'server actions'],
        dependsOn: ['data-access'],
      },
      {
        name: 'data-access',
        responsibility: 'Database access and external API clients',
        exposes: ['queries', 'mutations'],
        dependsOn: [],
      },
    ],
    communication: ['Server Actions', 'HTTP API routes'],
    persistence: 'Database via ORM / driver',
    deployment: 'Serverless or Node.js runtime',
    test: 'Component tests, API tests, E2E tests',
    build: 'Single build with static/dynamic rendering',
    observability: ['Vercel / runtime logs', 'client errors', 'web vitals'],
    security: ['session management', 'CSRF protection', 'input validation'],
    tradeoffs: [
      'Fast time-to-market',
      'Coupling of frontend and backend deploys',
    ],
    risks: ['May need split later if backend grows'],
  },
  {
    key: 'spa-ssr-hybrid',
    name: 'SPA / SSR Hybrid',
    description: 'Frontend application with optional server-side rendering.',
    defaultForStacks: ['stack.typescript.react', 'stack.typescript.astro'],
    modules: [
      {
        name: 'ui',
        responsibility: 'Components, pages, and design system',
        exposes: ['components', 'pages'],
        dependsOn: ['state', 'services'],
      },
      {
        name: 'state',
        responsibility: 'Client state and data fetching orchestration',
        exposes: ['stores', 'hooks'],
        dependsOn: ['services'],
      },
      {
        name: 'services',
        responsibility: 'API clients and adapters',
        exposes: ['api clients', 'mappers'],
        dependsOn: [],
      },
    ],
    communication: ['HTTP REST', 'Server-side rendering'],
    persistence: 'Browser storage / external APIs',
    deployment: 'Static hosting or edge runtime',
    test: 'Unit tests, component tests, visual regression',
    build: 'Static build or server bundle',
    observability: ['client analytics', 'error tracking', 'web vitals'],
    security: ['CSP', 'secure storage', 'token handling'],
    tradeoffs: ['Great UX', 'Requires separate backend'],
    risks: ['State sync complexity'],
  },
  {
    key: 'layered-clean',
    name: 'Layered / Clean Architecture',
    description: 'Dependency direction points inward; frameworks are plugins.',
    defaultForStacks: ['stack.python.fastapi', 'stack.python.django'],
    modules: [
      {
        name: 'controllers',
        responsibility: 'Receive HTTP requests and translate to use cases',
        exposes: ['routes', 'schemas'],
        dependsOn: ['use-cases'],
      },
      {
        name: 'use-cases',
        responsibility: 'Application-specific business rules',
        exposes: ['services'],
        dependsOn: ['entities'],
      },
      {
        name: 'entities',
        responsibility: 'Enterprise-wide business rules',
        exposes: ['models'],
        dependsOn: [],
      },
      {
        name: 'interfaces',
        responsibility: 'DB, web frameworks, external services',
        exposes: ['repository impl', 'external clients'],
        dependsOn: ['entities', 'use-cases'],
      },
    ],
    communication: ['HTTP REST'],
    persistence: 'Relational or document database',
    deployment: 'Containerized service',
    test: 'Unit tests with mocked interfaces',
    build: 'Single build artifact',
    observability: ['structured logs', 'metrics'],
    security: ['dependency injection', 'validation'],
    tradeoffs: ['High testability', 'More boilerplate'],
    risks: ['Over-engineering for simple cases'],
  },
  {
    key: 'ml-pipeline',
    name: 'ML Pipeline',
    description: 'Data ingestion, training, serving, and monitoring pipeline.',
    defaultForStacks: ['stack.python.ai'],
    modules: [
      {
        name: 'data-ingestion',
        responsibility: 'Load, validate, and version datasets',
        exposes: ['datasets', 'feature store'],
        dependsOn: [],
      },
      {
        name: 'training',
        responsibility: 'Train and evaluate models',
        exposes: ['experiments', 'models'],
        dependsOn: ['data-ingestion'],
      },
      {
        name: 'serving',
        responsibility: 'Serve predictions via API',
        exposes: ['prediction endpoint'],
        dependsOn: ['training'],
      },
      {
        name: 'monitoring',
        responsibility: 'Track model drift and performance',
        exposes: ['metrics', 'alerts'],
        dependsOn: ['serving'],
      },
    ],
    communication: ['message queue', 'REST API', 'batch jobs'],
    persistence: 'Data lake / feature store / model registry',
    deployment: 'Kubernetes jobs + model serving',
    test: 'Data validation, model evaluation, integration tests',
    build: 'Multi-stage pipeline builds',
    observability: ['experiment tracking', 'data drift', 'latency'],
    security: ['data privacy controls', 'model access control'],
    tradeoffs: ['Powerful for AI', 'High operational complexity'],
    risks: ['Model drift and data leakage'],
  },
];

export function findDefaultStyle(stackKey: string): ArchitectureStyle | undefined {
  return ARCHITECTURE_STYLES.find((s) => s.defaultForStacks.includes(stackKey));
}

export function findStyleByKey(key: string): ArchitectureStyle | undefined {
  return ARCHITECTURE_STYLES.find((s) => s.key === key);
}
