/**
 * Agent role catalog for a stack, following the naming conventions from
 * "07 - Stack Registry e Team Catalog". Roles without a clear equivalent for
 * a given stack are left undefined and TeamComposer skips them instead of
 * fabricating an agent key that isn't in the catalog.
 */
export interface StackAgentCatalog {
  leadAgentKey: string;
  seniorDeveloperAgentKey: string;
  developerAgentKey: string;
  reviewerAgentKey: string;
  testEngineerAgentKey: string;
  frameworkSpecialistAgentKey?: string;
  dataSpecialistAgentKey?: string;
  securitySpecialistAgentKey?: string;
  runtimeSpecialistAgentKey?: string;
  performanceSpecialistAgentKey?: string;
}

export interface StackDefinition {
  key: string;
  name: string;
  language: string;
  deliveryTargetKinds: string[];
  strengths: string[];
  tradeoffs: string[];
  runtimeSupport: boolean;
  architectureAgentKey: string;
  agentCatalog: StackAgentCatalog;
}

export class StackRegistry {
  private stacks: Map<string, StackDefinition> = new Map();

  constructor() {
    this.register({
      key: 'stack.typescript.nestjs',
      name: 'NestJS',
      language: 'TypeScript',
      deliveryTargetKinds: ['BACKEND'],
      strengths: ['enterprise-grade', 'modular', 'testable', 'ecosystem'],
      tradeoffs: ['ceremony', 'learning curve'],
      runtimeSupport: true,
      architectureAgentKey: 'architecture.nestjs.architect',
      agentCatalog: {
        leadAgentKey: 'backend.nestjs.lead',
        seniorDeveloperAgentKey: 'backend.nestjs.senior-developer',
        developerAgentKey: 'backend.nestjs.developer',
        reviewerAgentKey: 'backend.nestjs.reviewer',
        testEngineerAgentKey: 'backend.nestjs.test-engineer',
        frameworkSpecialistAgentKey: 'backend.nestjs.specialist',
        dataSpecialistAgentKey: 'backend.nestjs.data-specialist',
        securitySpecialistAgentKey: 'backend.nestjs.security-specialist',
        runtimeSpecialistAgentKey: 'backend.nestjs.runtime-specialist',
        performanceSpecialistAgentKey: 'backend.nestjs.performance-specialist',
      },
    });

    this.register({
      key: 'stack.typescript.nextjs',
      name: 'Next.js',
      language: 'TypeScript',
      deliveryTargetKinds: ['FRONTEND', 'BACKEND'],
      strengths: ['full-stack', 'SSR/SSG', 'ecosystem'],
      tradeoffs: ['Vercel coupling', 'complexity for simple apps'],
      runtimeSupport: true,
      architectureAgentKey: 'architecture.nextjs.architect',
      agentCatalog: {
        leadAgentKey: 'fullstack.nextjs.lead',
        seniorDeveloperAgentKey: 'fullstack.nextjs.senior-developer',
        developerAgentKey: 'fullstack.nextjs.developer',
        reviewerAgentKey: 'fullstack.nextjs.reviewer',
        testEngineerAgentKey: 'fullstack.nextjs.test-engineer',
        frameworkSpecialistAgentKey: 'fullstack.nextjs.specialist',
        dataSpecialistAgentKey: 'fullstack.nextjs.data-specialist',
        securitySpecialistAgentKey: 'fullstack.nextjs.security-specialist',
        runtimeSpecialistAgentKey: 'fullstack.nextjs.runtime-specialist',
        performanceSpecialistAgentKey: 'fullstack.nextjs.performance-specialist',
      },
    });

    this.register({
      key: 'stack.typescript.react',
      name: 'React',
      language: 'TypeScript',
      deliveryTargetKinds: ['FRONTEND'],
      strengths: ['component model', 'ecosystem'],
      tradeoffs: ['needs backend separately'],
      runtimeSupport: true,
      architectureAgentKey: 'architecture.react.architect',
      agentCatalog: {
        leadAgentKey: 'frontend.react.lead',
        seniorDeveloperAgentKey: 'frontend.react.senior-developer',
        developerAgentKey: 'frontend.react.developer',
        reviewerAgentKey: 'frontend.react.reviewer',
        testEngineerAgentKey: 'frontend.react.test-engineer',
        frameworkSpecialistAgentKey: 'frontend.react.specialist',
        securitySpecialistAgentKey: 'frontend.react.security-specialist',
        runtimeSpecialistAgentKey: 'frontend.react.runtime-specialist',
        performanceSpecialistAgentKey: 'frontend.react.performance-specialist',
        // No data-specialist in the React catalog (doc 07) — frontend does not own persistence.
      },
    });

    this.register({
      key: 'stack.python.fastapi',
      name: 'FastAPI',
      language: 'Python',
      deliveryTargetKinds: ['BACKEND'],
      strengths: ['fast', 'async', 'great for AI/ML integration'],
      tradeoffs: ['smaller enterprise ecosystem than Java'],
      runtimeSupport: true,
      architectureAgentKey: 'architecture.fastapi.architect',
      agentCatalog: {
        leadAgentKey: 'backend.fastapi.lead',
        seniorDeveloperAgentKey: 'backend.fastapi.senior-developer',
        developerAgentKey: 'backend.fastapi.developer',
        reviewerAgentKey: 'backend.fastapi.reviewer',
        testEngineerAgentKey: 'backend.fastapi.test-engineer',
        frameworkSpecialistAgentKey: 'backend.fastapi.specialist',
        dataSpecialistAgentKey: 'backend.fastapi.data-specialist',
        securitySpecialistAgentKey: 'backend.fastapi.security-specialist',
        runtimeSpecialistAgentKey: 'backend.fastapi.runtime-specialist',
        performanceSpecialistAgentKey: 'backend.fastapi.performance-specialist',
      },
    });

    this.register({
      key: 'stack.python.ai',
      name: 'Python AI Stack',
      language: 'Python',
      deliveryTargetKinds: ['AI'],
      strengths: ['PyTorch', 'Hugging Face', 'data tools'],
      tradeoffs: ['ops complexity'],
      runtimeSupport: true,
      architectureAgentKey: 'architecture.ai-python.architect',
      agentCatalog: {
        leadAgentKey: 'ai.python.lead',
        seniorDeveloperAgentKey: 'ai.python.senior-engineer',
        developerAgentKey: 'ai.python.engineer',
        reviewerAgentKey: 'ai.python.reviewer',
        testEngineerAgentKey: 'ai.python.test-engineer',
        frameworkSpecialistAgentKey: 'ai.python.ml-specialist',
        dataSpecialistAgentKey: 'ai.python.data-engineering-specialist',
        securitySpecialistAgentKey: 'ai.python.security-specialist',
        runtimeSpecialistAgentKey: 'ai.python.runtime-specialist',
        // No performance-specialist in the Python AI catalog (doc 07); model
        // performance is covered by ai.python.model-evaluation-specialist,
        // which isn't wired to a generic composer slot yet.
      },
    });

    this.register({
      key: 'stack.java.spring-boot',
      name: 'Spring Boot',
      language: 'Java',
      deliveryTargetKinds: ['BACKEND'],
      strengths: ['mature', 'enterprise', 'ecosystem'],
      tradeoffs: ['memory footprint', 'boilerplate'],
      runtimeSupport: true,
      architectureAgentKey: 'architecture.java.architect',
      agentCatalog: {
        leadAgentKey: 'backend.java.lead',
        seniorDeveloperAgentKey: 'backend.java.senior-developer',
        developerAgentKey: 'backend.java.developer',
        reviewerAgentKey: 'backend.java.reviewer',
        testEngineerAgentKey: 'backend.java.test-engineer',
        frameworkSpecialistAgentKey: 'backend.java.spring-specialist',
        dataSpecialistAgentKey: 'backend.java.data-specialist',
        securitySpecialistAgentKey: 'backend.java.security-specialist',
        runtimeSpecialistAgentKey: 'backend.java.runtime-specialist',
        performanceSpecialistAgentKey: 'backend.java.performance-specialist',
      },
    });

    this.register({
      key: 'stack.dart.flutter',
      name: 'Flutter',
      language: 'Dart',
      deliveryTargetKinds: ['MOBILE'],
      strengths: ['cross-platform', 'native performance', 'single codebase'],
      tradeoffs: ['Dart ecosystem', 'platform-specific edge cases'],
      runtimeSupport: true,
      architectureAgentKey: 'architecture.flutter.architect',
      agentCatalog: {
        leadAgentKey: 'mobile.flutter.lead',
        seniorDeveloperAgentKey: 'mobile.flutter.senior-developer',
        developerAgentKey: 'mobile.flutter.developer',
        reviewerAgentKey: 'mobile.flutter.reviewer',
        testEngineerAgentKey: 'mobile.flutter.test-engineer',
        frameworkSpecialistAgentKey: 'mobile.flutter.specialist',
        securitySpecialistAgentKey: 'mobile.flutter.security-specialist',
        runtimeSpecialistAgentKey: 'mobile.flutter.runtime-specialist',
      },
    });
  }

  register(stack: StackDefinition): void {
    this.stacks.set(stack.key, stack);
  }

  findByDeliveryTarget(kind: string): StackDefinition[] {
    return Array.from(this.stacks.values()).filter((s) =>
      s.deliveryTargetKinds.includes(kind)
    );
  }

  get(key: string): StackDefinition | undefined {
    return this.stacks.get(key);
  }

  list(): StackDefinition[] {
    return Array.from(this.stacks.values());
  }
}
