/**
 * MISSÃO "Completar o fluxo pós-PromptMaster até geração e entrega real" — Fase 3/9/17: a
 * auditoria confirmou que nenhuma geração de código real existia neste sistema. Este é o escopo
 * real e deliberadamente limitado desta missão (ver relatório): UM StackPlugin real,
 * `stack.typescript.nestjs` (BACKEND) — o mesmo stack que o `TechnologySelector` real escolhe para
 * a maioria dos sistemas de gestão, e o mesmo framework que este próprio `apps/api` usa (nenhum
 * caminho paralelo inventado). Function pura e determinística — sem IA, porque nomear um recurso
 * REST a partir do texto de um Requirement já confirmado não é uma decisão de produto que precise
 * de raciocínio, é uma transformação mecânica (Fase 8 do brief: "não usar LLM para validações
 * determinísticas quando ferramenta apropriada existir").
 */

export interface ScaffolderRequirement {
  id: string;
  section: string;
  content: string;
}

export interface ScaffolderInput {
  missionId: string;
  vision: string;
  objective: string;
  requirements: ScaffolderRequirement[];
  /** @deprecated CORE-011 REWORK: mantido apenas por compatibilidade de callers. Não é teto total;
   * este scaffolder determinístico processa todos os recursos distintos na ordem de entrada. */
  maxResources?: number;
}

export interface GeneratedFileSpec {
  path: string;
  content: string;
  /** "requirement:<id>" quando derivado de um Requirement real; "scaffold" para boilerplate. */
  provenance: string;
  ownerAgent: string;
  symbols: string[];
  imports: string[];
  exports: string[];
}

export interface ScaffoldedResource {
  requirementId: string;
  originalContent: string;
  entityName: string;
  resourcePath: string;
}

export interface ScaffoldResult {
  files: GeneratedFileSpec[];
  resources: ScaffoldedResource[];
  skippedRequirementIds: string[];
}

const STOPWORD_PREFIXES = [
  /^cadastro\s+de\s+/i, /^controle\s+de\s+/i, /^gest[ãa]o\s+de\s+/i, /^gerenciamento\s+de\s+/i,
  /^registro\s+de\s+/i, /^acompanhamento\s+de\s+/i, /^visualiza[çc][ãa]o\s+de\s+/i,
];
const STOPWORDS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'com', 'para', 'o', 'a', 'os', 'as', 'um', 'uma', 'no', 'na', 'por']);

function toEntityName(content: string): string {
  let text = content.trim();
  for (const pattern of STOPWORD_PREFIXES) {
    if (pattern.test(text)) { text = text.replace(pattern, ''); break; }
  }
  const words = text.split(/[^\p{L}\p{N}]+/u).filter((w) => w && !STOPWORDS.has(w.toLowerCase()));
  const first = words[0] ?? 'Item';
  const singular = first.length > 4 && /s$/i.test(first) ? first.slice(0, -1) : first;
  return singular.charAt(0).toUpperCase() + singular.slice(1).toLowerCase();
}

function toKebabPlural(entityName: string): string {
  const kebab = entityName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  return kebab.endsWith('s') ? kebab : `${kebab}s`;
}

export function scaffoldNestjsBackend(input: ScaffolderInput): ScaffoldResult {
  const source = input.requirements.filter((r) => r.section === 'data' && r.content.trim());
  const pool = source.length > 0 ? source : input.requirements.filter((r) => r.section === 'features' && r.content.trim());

  const seen = new Set<string>();
  const resources: ScaffoldedResource[] = [];
  const skippedRequirementIds: string[] = [];
  for (const req of pool) {
    const entityName = toEntityName(req.content);
    const resourcePath = toKebabPlural(entityName);
    if (seen.has(resourcePath)) { skippedRequirementIds.push(req.id); continue; }
    seen.add(resourcePath);
    resources.push({ requirementId: req.id, originalContent: req.content, entityName, resourcePath });
  }

  const files: GeneratedFileSpec[] = [];
  for (const resource of resources) {
    files.push(...scaffoldResourceModule(resource));
  }
  files.push(...scaffoldRoot(input, resources));

  return { files, resources, skippedRequirementIds };
}

function scaffoldResourceModule(resource: ScaffoldedResource): GeneratedFileSpec[] {
  const { entityName, resourcePath, requirementId, originalContent } = resource;
  const provenance = `requirement:${requirementId}`;
  const dir = `src/${resourcePath}`;

  const serviceContent = `import { Injectable } from '@nestjs/common';

/**
 * Requisito de origem: "${originalContent.replace(/"/g, "'")}"
 * Armazenamento em memória (sem banco real) — ver README/manifest.json para limitações desta versão.
 */
export interface ${entityName} {
  id: string;
  name: string;
  createdAt: string;
}

@Injectable()
export class ${entityName}Service {
  private readonly items = new Map<string, ${entityName}>();

  list(): ${entityName}[] {
    return [...this.items.values()];
  }

  get(id: string): ${entityName} | undefined {
    return this.items.get(id);
  }

  create(name: string): ${entityName} {
    const id = \`${resourcePath}-\${this.items.size + 1}\`;
    const item: ${entityName} = { id, name, createdAt: new Date().toISOString() };
    this.items.set(id, item);
    return item;
  }
}
`;

  const controllerContent = `import { Body, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { ${entityName}Service } from './${resourcePath}.service';

@Controller('${resourcePath}')
export class ${entityName}Controller {
  constructor(private readonly service: ${entityName}Service) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    const item = this.service.get(id);
    if (!item) throw new NotFoundException('NOT_FOUND');
    return item;
  }

  @Post()
  create(@Body() body: { name: string }) {
    if (!body?.name?.trim()) throw new NotFoundException('INVALID_INPUT');
    return this.service.create(body.name.trim());
  }
}
`;

  const moduleContent = `import { Module } from '@nestjs/common';
import { ${entityName}Controller } from './${resourcePath}.controller';
import { ${entityName}Service } from './${resourcePath}.service';

@Module({
  controllers: [${entityName}Controller],
  providers: [${entityName}Service],
})
export class ${entityName}Module {}
`;

  return [
    { path: `${dir}/${resourcePath}.service.ts`, content: serviceContent, provenance, ownerAgent: 'backend.nestjs.data-specialist', symbols: [entityName, `${entityName}Service`], imports: ['@nestjs/common'], exports: [entityName, `${entityName}Service`] },
    { path: `${dir}/${resourcePath}.controller.ts`, content: controllerContent, provenance, ownerAgent: 'backend.nestjs.developer', symbols: [`${entityName}Controller`], imports: ['@nestjs/common', `./${resourcePath}.service`], exports: [`${entityName}Controller`] },
    { path: `${dir}/${resourcePath}.module.ts`, content: moduleContent, provenance, ownerAgent: 'backend.nestjs.lead', symbols: [`${entityName}Module`], imports: ['@nestjs/common', `./${resourcePath}.controller`, `./${resourcePath}.service`], exports: [`${entityName}Module`] },
  ];
}

function scaffoldRoot(input: ScaffolderInput, resources: ScaffoldedResource[]): GeneratedFileSpec[] {
  const moduleImports = resources.map((r) => `${r.entityName}Module`);
  const appModuleContent = `import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
${resources.map((r) => `import { ${r.entityName}Module } from './${r.resourcePath}/${r.resourcePath}.module';`).join('\n')}

@Module({
  imports: [HealthModule${moduleImports.length ? ', ' + moduleImports.join(', ') : ''}],
})
export class AppModule {}
`;

  const mainContent = `import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT ?? 3100);
  await app.listen(port, '127.0.0.1');
  // eslint-disable-next-line no-console
  console.log(\`Generated backend listening on http://127.0.0.1:\${port}\`);
}
bootstrap();
`;

  const healthControllerContent = `import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok' };
  }
}
`;
  const healthModuleContent = `import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

@Module({ controllers: [HealthController] })
export class HealthModule {}
`;

  const packageJson = JSON.stringify({
    name: `generated-${input.missionId.slice(0, 8)}`,
    version: '0.0.1',
    private: true,
    scripts: {
      // tsconfig.json usa rootDir "." (src/ e test/ são pastas irmãs compiladas juntas), então a
      // saída real do tsc preserva os dois prefixos: dist/src/... e dist/test/... — nunca dist/main.js.
      build: 'tsc -p tsconfig.json',
      start: 'node dist/src/main.js',
      test: 'node --test dist/test/smoke.spec.js',
    },
    dependencies: {
      '@nestjs/common': '^10.4.15',
      '@nestjs/core': '^10.4.15',
      '@nestjs/platform-express': '^10.4.15',
      'reflect-metadata': '^0.2.2',
      rxjs: '^7.8.1',
    },
    devDependencies: {
      typescript: '^5.7.3',
      '@types/node': '^22.10.2',
    },
  }, null, 2);

  const tsconfigJson = JSON.stringify({
    compilerOptions: {
      target: 'ES2022', module: 'commonjs', lib: ['ES2022'], outDir: './dist', rootDir: '.',
      strict: true, esModuleInterop: true, skipLibCheck: true, forceConsistentCasingInFileNames: true,
      experimentalDecorators: true, emitDecoratorMetadata: true, types: ['node'], declaration: false,
    },
    include: ['src/**/*', 'test/**/*'],
    exclude: ['node_modules', 'dist'],
  }, null, 2);

  const testContent = `import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const PORT = 3101;

function waitForHealth(url: string, attempts = 30): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const tryOnce = (n: number): void => {
      fetch(url).then((res) => res.ok ? resolve() : retry(n)).catch(() => retry(n));
    };
    const retry = (n: number): void => {
      if (n <= 0) { reject(new Error('server did not become healthy')); return; }
      setTimeout(() => tryOnce(n - 1), 500);
    };
    tryOnce(attempts);
  });
}

test('generated backend starts and serves health + resources', async () => {
  const child = spawn(process.execPath, ['dist/src/main.js'], { env: { ...process.env, PORT: String(PORT) } });
  try {
    await waitForHealth(\`http://127.0.0.1:\${PORT}/health\`);
    const health = await fetch(\`http://127.0.0.1:\${PORT}/health\`);
    assert.equal(health.status, 200);
    const healthBody = await health.json() as { status: string };
    assert.equal(healthBody.status, 'ok');
${resources.map((r) => `    const ${r.resourcePath.replace(/-/g, '_')}Res = await fetch(\`http://127.0.0.1:\${PORT}/${r.resourcePath}\`);
    assert.equal(${r.resourcePath.replace(/-/g, '_')}Res.status, 200);
    assert.ok(Array.isArray(await ${r.resourcePath.replace(/-/g, '_')}Res.json()));`).join('\n')}
  } finally {
    child.kill();
  }
});
`;

  const readmeContent = `# Sistema gerado — ${input.vision || 'Projeto LDCN'}

${input.objective || ''}

## Limitações desta versão (honestas, nunca escondidas)

- Armazenamento em memória — dados são perdidos ao reiniciar (nenhum banco real foi provisionado).
- Sem autenticação/autorização.
- ${resources.length} recurso(s) gerado(s) a partir de todos os requisitos de recurso distintos recebidos, sem teto total silencioso. Somente duplicatas determinísticas aparecem em \`skippedRequirementIds\`.

## Recursos gerados

${resources.map((r) => `- \`${r.resourcePath}\` — de: "${r.originalContent}"`).join('\n')}

## Rodar localmente

\`\`\`
npm install
npm run build
npm start
\`\`\`

Depois: \`GET http://127.0.0.1:3100/health\`
`;

  const manifestContent = JSON.stringify({
    sourceMissionId: input.missionId,
    generatedAt: new Date().toISOString(),
    stackKey: 'stack.typescript.nestjs',
    resources: resources.map((r) => ({ requirementId: r.requirementId, entityName: r.entityName, resourcePath: r.resourcePath })),
  }, null, 2);

  const envExample = `PORT=3100\n`;
  const gitignore = `node_modules/\ndist/\n`;

  return [
    { path: 'src/app.module.ts', content: appModuleContent, provenance: 'scaffold', ownerAgent: 'backend.nestjs.lead', symbols: ['AppModule'], imports: resources.map((r) => `./${r.resourcePath}/${r.resourcePath}.module`), exports: ['AppModule'] },
    { path: 'src/main.ts', content: mainContent, provenance: 'scaffold', ownerAgent: 'backend.nestjs.lead', symbols: [], imports: ['@nestjs/core', './app.module'], exports: [] },
    { path: 'src/health/health.controller.ts', content: healthControllerContent, provenance: 'scaffold', ownerAgent: 'backend.nestjs.developer', symbols: ['HealthController'], imports: ['@nestjs/common'], exports: ['HealthController'] },
    { path: 'src/health/health.module.ts', content: healthModuleContent, provenance: 'scaffold', ownerAgent: 'backend.nestjs.lead', symbols: ['HealthModule'], imports: ['@nestjs/common', './health.controller'], exports: ['HealthModule'] },
    { path: 'test/smoke.spec.ts', content: testContent, provenance: 'scaffold', ownerAgent: 'backend.nestjs.test-engineer', symbols: [], imports: ['node:test', 'node:assert/strict', 'node:child_process'], exports: [] },
    { path: 'package.json', content: packageJson, provenance: 'scaffold', ownerAgent: 'backend.nestjs.lead', symbols: [], imports: [], exports: [] },
    { path: 'tsconfig.json', content: tsconfigJson, provenance: 'scaffold', ownerAgent: 'backend.nestjs.lead', symbols: [], imports: [], exports: [] },
    { path: 'README.md', content: readmeContent, provenance: 'scaffold', ownerAgent: 'docs.writer', symbols: [], imports: [], exports: [] },
    { path: 'manifest.json', content: manifestContent, provenance: 'scaffold', ownerAgent: 'backend.nestjs.lead', symbols: [], imports: [], exports: [] },
    { path: '.env.example', content: envExample, provenance: 'scaffold', ownerAgent: 'backend.nestjs.lead', symbols: [], imports: [], exports: [] },
    { path: '.gitignore', content: gitignore, provenance: 'scaffold', ownerAgent: 'backend.nestjs.lead', symbols: [], imports: [], exports: [] },
  ];
}
