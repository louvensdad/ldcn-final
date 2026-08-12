export interface StackDefinition {
  key: string;
  name: string;
  language: string;
  deliveryTargetKinds: string[];
  strengths: string[];
  tradeoffs: string[];
  runtimeSupport: boolean;
  architectureAgentKey: string;
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
