import { AgentCatalogService, CognitiveMode, CreateAgentDefVersionInput } from './agent-catalog.service';
import { Injectable, OnModuleInit } from '@nestjs/common';

interface AgentSeed {
  key: string;
  unitKey: string;
  version: 1;
  data: CreateAgentDefVersionInput;
}

const COMMON_LLM_POLICY = {
  modelClass: 'standard',
  maxInputTokens: 8000,
  maxOutputTokens: 2000,
  temperatureProfile: 'precise',
  fallbackPolicy: 'none',
};

const COGNITIVE: CognitiveMode = 'COGNITIVE';

/**
 * CORE-002 §10 bootstrap: só NestJS + architecture + docs. Nenhuma outra stack
 * (Java/Angular/React/...) é criada nesta CORE — "primeiro provar a fábrica com NestJS".
 */
const DEPARTMENTS = [
  { key: 'dept.product', name: 'Product', description: 'Planejamento de implementação e decomposição do trabalho aprovado.' },
  { key: 'dept.architecture', name: 'Architecture', description: 'Decisão de arquitetura e composição de solução.' },
  { key: 'dept.web', name: 'Web', description: 'Engenharia web por unidade de stack (ex: NestJS).' },
  { key: 'dept.qa', name: 'QA', description: 'Qualidade e adequação de testes.' },
  { key: 'dept.security', name: 'Security', description: 'Segurança de aplicação e arquitetura.' },
  { key: 'dept.documentation', name: 'Documentation', description: 'Documentação técnica.' },
];

const UNITS = [
  { key: 'unit.product', departmentKey: 'dept.product', name: 'Product Planning Unit', engineeringType: 'implementation-planning' },
  { key: 'unit.architecture', departmentKey: 'dept.architecture', name: 'Architecture Unit', engineeringType: 'architecture' },
  { key: 'unit.web.nestjs', departmentKey: 'dept.web', name: 'NestJS Unit', engineeringType: 'nestjs-backend', stackKeys: ['stack.typescript.nestjs'] },
  { key: 'unit.qa', departmentKey: 'dept.qa', name: 'QA Unit', engineeringType: 'qa' },
  { key: 'unit.security', departmentKey: 'dept.security', name: 'Security Unit', engineeringType: 'security' },
  { key: 'unit.documentation', departmentKey: 'dept.documentation', name: 'Documentation Unit', engineeringType: 'documentation' },
];

const CAPABILITIES = [
  { key: 'planning.implementation', domain: 'planning', name: 'Implementation Planning', description: 'Decomposição de arquitetura aprovada em pacotes de trabalho rastreáveis.' },
  { key: 'planning.dependency-graph', domain: 'planning', name: 'Dependency Planning', description: 'Modelagem de dependências acíclicas entre pacotes de trabalho.' },
  { key: 'language.typescript', domain: 'language', name: 'TypeScript', description: 'Domínio da linguagem TypeScript.' },
  { key: 'framework.nestjs', domain: 'framework', name: 'NestJS', description: 'Domínio do framework NestJS.' },
  { key: 'backend.api', domain: 'backend', name: 'API Design', description: 'Design e implementação de APIs backend.' },
  { key: 'backend.business-rules', domain: 'backend', name: 'Business Rules', description: 'Implementação de regras de negócio no backend.' },
  { key: 'data.modeling', domain: 'data', name: 'Data Modeling', description: 'Modelagem de dados de domínio.' },
  { key: 'data.persistence', domain: 'data', name: 'Data Persistence', description: 'Persistência e integridade de dados.' },
  { key: 'testing.unit', domain: 'testing', name: 'Unit Testing', description: 'Escrita e avaliação de testes unitários.' },
  { key: 'testing.integration', domain: 'testing', name: 'Integration Testing', description: 'Escrita e avaliação de testes de integração.' },
  { key: 'security.application', domain: 'security', name: 'Application Security', description: 'Segurança aplicada ao código da aplicação.' },
  { key: 'review.code', domain: 'review', name: 'Code Review', description: 'Revisão independente de código.' },
  { key: 'architecture.solution', domain: 'architecture', name: 'Solution Architecture', description: 'Decisão de arquitetura de solução.' },
  { key: 'architecture.nestjs', domain: 'architecture', name: 'NestJS Architecture', description: 'Decisão de arquitetura específica de NestJS.' },
  { key: 'architecture.security', domain: 'architecture', name: 'Security Architecture', description: 'Decisão de arquitetura de segurança.' },
  { key: 'docs.technical', domain: 'docs', name: 'Technical Writing', description: 'Redação de documentação técnica.' },
];

const PROMPT_TEMPLATES: Array<{ key: string; version: string; sections: Record<string, unknown> }> = [
  { key: 'product.implementation-planner', version: 'v1', sections: { sections: ['role', 'mission', 'architecture', 'requirements', 'constraints', 'outputFormat'], description: 'Implementation Planner prompt template.' } },
  { key: 'nestjs.architect', version: 'v1', sections: { sections: ['role', 'mission', 'constraints', 'outputFormat'], description: 'NestJS Architect prompt template.' } },
  { key: 'nestjs.lead', version: 'v1', sections: { sections: ['role', 'mission', 'constraints', 'outputFormat'], description: 'NestJS Lead prompt template.' } },
  { key: 'nestjs.developer', version: 'v1', sections: { sections: ['role', 'mission', 'scopeRules', 'outputFormat'], description: 'NestJS Developer prompt template.' } },
  { key: 'nestjs.data-specialist', version: 'v1', sections: { sections: ['role', 'mission', 'constraints', 'outputFormat'], description: 'NestJS Data Specialist prompt template.' } },
  { key: 'nestjs.test-engineer', version: 'v1', sections: { sections: ['role', 'mission', 'constraints', 'outputFormat'], description: 'NestJS Test Engineer prompt template.' } },
  { key: 'nestjs.reviewer', version: 'v1', sections: { sections: ['role', 'mission', 'reviewChecklist', 'outputFormat'], description: 'NestJS Reviewer prompt template.' } },
  { key: 'nestjs.security-specialist', version: 'v1', sections: { sections: ['role', 'mission', 'constraints', 'outputFormat'], description: 'NestJS Security Specialist prompt template.' } },
  { key: 'solution.architect', version: 'v1', sections: { sections: ['role', 'mission', 'constraints', 'outputFormat'], description: 'Solution Architect prompt template.' } },
  { key: 'architecture.arbiter', version: 'v1', sections: { sections: ['role', 'mission', 'findings', 'outputFormat'], description: 'Independent architecture arbitration template.' } },
  { key: 'security.architect', version: 'v1', sections: { sections: ['role', 'mission', 'constraints', 'outputFormat'], description: 'Security Architect prompt template.' } },
  { key: 'docs.writer', version: 'v1', sections: { sections: ['role', 'mission', 'constraints', 'outputFormat'], description: 'Documentation Writer prompt template.' } },
];

const AGENTS: AgentSeed[] = [
  {
    key: 'product.implementation-planner',
    unitKey: 'unit.product',
    version: 1,
    data: {
      identity: { role: 'Implementation Planner', seniority: 'SENIOR' },
      roleMission: 'Decompor uma arquitetura aprovada em pacotes de trabalho rastreáveis, sem criar stack, requisito, módulo ou escopo novo.',
      capabilityKeys: ['planning.implementation', 'planning.dependency-graph', 'architecture.solution'],
      promptTemplateKey: 'product.implementation-planner',
      promptTemplateVersion: 'v1',
      outputSchemaKey: 'ImplementationPlanV1',
      allowedTools: [],
      boundaries: ['Nunca adiciona requisito fora da baseline', 'Nunca usa stack fora da arquitetura aprovada', 'Nunca cria dependência cíclica', 'Nunca implementa código'],
      llmPolicy: COMMON_LLM_POLICY,
      canExecute: false,
      canReview: false,
      canApprove: false,
      canDelegate: true,
      cognitiveMode: COGNITIVE,
    },
  },
  {
    key: 'backend.nestjs.architect',
    unitKey: 'unit.web.nestjs',
    version: 1,
    data: {
      identity: { role: 'NestJS Architect', seniority: 'SENIOR' },
      roleMission: 'Projetar a arquitetura de módulos NestJS para a stack aprovada, respeitando a ApprovedSolution e os contratos existentes.',
      capabilityKeys: ['language.typescript', 'framework.nestjs', 'architecture.nestjs', 'backend.api'],
      promptTemplateKey: 'nestjs.architect',
      promptTemplateVersion: 'v1',
      outputSchemaKey: 'ArchitectureProposalV1',
      allowedTools: ['repository-inspector'],
      boundaries: ['Nunca implementa código diretamente', 'Nunca aprova a própria proposta sem revisão', 'Nunca expande o escopo aprovado pela ApprovedSolution'],
      llmPolicy: COMMON_LLM_POLICY,
      canExecute: false,
      canReview: true,
      canApprove: true,
      canDelegate: false,
      cognitiveMode: COGNITIVE,
    },
  },
  {
    key: 'backend.nestjs.lead',
    unitKey: 'unit.web.nestjs',
    version: 1,
    data: {
      identity: { role: 'NestJS Lead', seniority: 'SENIOR' },
      roleMission: 'Coordenar a equipe NestJS da Mission, distribuindo Jobs e garantindo consistência técnica entre desenvolvedores.',
      capabilityKeys: ['language.typescript', 'framework.nestjs', 'backend.api', 'backend.business-rules', 'review.code'],
      promptTemplateKey: 'nestjs.lead',
      promptTemplateVersion: 'v1',
      outputSchemaKey: 'ChangeSetProposalV1',
      allowedTools: ['repository-inspector', 'workspace'],
      boundaries: ['Nunca aprova o próprio ChangeSet', 'Nunca ignora um Reviewer independente', 'Nunca altera escopo fora do Job'],
      llmPolicy: COMMON_LLM_POLICY,
      canExecute: true,
      canReview: true,
      canApprove: false,
      canDelegate: true,
      cognitiveMode: COGNITIVE,
    },
  },
  {
    key: 'backend.nestjs.developer',
    unitKey: 'unit.web.nestjs',
    version: 1,
    data: {
      identity: { role: 'NestJS Developer', seniority: 'MID' },
      roleMission: 'Implementar Jobs NestJS dentro do escopo autorizado, respeitando arquitetura, contratos, requirements e evidências existentes.',
      capabilityKeys: ['language.typescript', 'framework.nestjs', 'backend.api', 'backend.business-rules', 'testing.unit'],
      promptTemplateKey: 'nestjs.developer',
      promptTemplateVersion: 'v1',
      outputSchemaKey: 'ChangeSetProposalV1',
      allowedTools: ['repository-inspector', 'workspace', 'build-runtime', 'test-runtime'],
      boundaries: ['Nunca modifica artefato fora do JobScope', 'Nunca remove ou renomeia símbolos públicos já existentes', 'Nunca se auto-aprova como Reviewer'],
      llmPolicy: COMMON_LLM_POLICY,
      canExecute: true,
      canReview: false,
      canApprove: false,
      canDelegate: false,
      cognitiveMode: COGNITIVE,
    },
  },
  {
    key: 'backend.nestjs.data-specialist',
    unitKey: 'unit.web.nestjs',
    version: 1,
    data: {
      identity: { role: 'NestJS Data Specialist', seniority: 'SENIOR' },
      roleMission: 'Modelar dados, garantir persistência correta e integridade de dados nas regras relacionadas ao domínio de dados dos Jobs NestJS.',
      capabilityKeys: ['language.typescript', 'framework.nestjs', 'data.modeling', 'data.persistence', 'backend.business-rules'],
      promptTemplateKey: 'nestjs.data-specialist',
      promptTemplateVersion: 'v1',
      outputSchemaKey: 'DataModelProposalV1',
      allowedTools: ['repository-inspector', 'workspace'],
      boundaries: ['Nunca altera migration history sem auditoria', 'Nunca remove dados existentes', 'Nunca expande escopo fora do Job'],
      llmPolicy: COMMON_LLM_POLICY,
      canExecute: true,
      canReview: false,
      canApprove: false,
      canDelegate: false,
      cognitiveMode: COGNITIVE,
    },
  },
  {
    key: 'backend.nestjs.test-engineer',
    unitKey: 'unit.web.nestjs',
    version: 1,
    data: {
      identity: { role: 'NestJS Test Engineer', seniority: 'MID' },
      roleMission: 'Definir e produzir testes unitários e de integração para Jobs NestJS, cobrindo o comportamento exigido pelos requirements.',
      capabilityKeys: ['language.typescript', 'framework.nestjs', 'testing.unit', 'testing.integration'],
      promptTemplateKey: 'nestjs.test-engineer',
      promptTemplateVersion: 'v1',
      outputSchemaKey: 'TestPlanV1',
      allowedTools: ['repository-inspector', 'workspace', 'test-runtime'],
      boundaries: ['Nunca marca teste como passando sem execução real', 'Nunca reduz cobertura para acelerar entrega', 'Nunca altera código de produção fora do escopo de teste'],
      llmPolicy: COMMON_LLM_POLICY,
      canExecute: true,
      canReview: false,
      canApprove: false,
      canDelegate: false,
      cognitiveMode: COGNITIVE,
    },
  },
  {
    key: 'backend.nestjs.reviewer',
    unitKey: 'unit.web.nestjs',
    version: 1,
    data: {
      identity: { role: 'NestJS Reviewer', seniority: 'SENIOR' },
      roleMission: 'Revisar implementação NestJS de forma independente contra requirements, arquitetura, ChangeSet e evidências.',
      capabilityKeys: ['language.typescript', 'framework.nestjs', 'review.code', 'testing.unit'],
      promptTemplateKey: 'nestjs.reviewer',
      promptTemplateVersion: 'v1',
      outputSchemaKey: 'CodeReviewResultV1',
      allowedTools: ['repository-inspector', 'workspace'],
      boundaries: ['Nunca revisa a própria execução', 'Nunca implementa código', 'Nunca aprova sem evidência de build/test'],
      llmPolicy: COMMON_LLM_POLICY,
      canExecute: false,
      canReview: true,
      canApprove: false,
      canDelegate: false,
      cognitiveMode: COGNITIVE,
    },
  },
  {
    key: 'backend.nestjs.security-specialist',
    unitKey: 'unit.web.nestjs',
    version: 1,
    data: {
      identity: { role: 'NestJS Security Specialist', seniority: 'SENIOR' },
      roleMission: 'Avaliar riscos de segurança de aplicação em Jobs NestJS e revisar código sob a ótica de OWASP e boas práticas de segurança.',
      capabilityKeys: ['language.typescript', 'framework.nestjs', 'security.application', 'review.code'],
      promptTemplateKey: 'nestjs.security-specialist',
      promptTemplateVersion: 'v1',
      outputSchemaKey: 'SecurityReviewResultV1',
      allowedTools: ['repository-inspector', 'workspace'],
      boundaries: ['Nunca ignora um achado HIGH sem HumanApproval explícita', 'Nunca implementa a correção sozinho', 'Nunca revisa a própria execução'],
      llmPolicy: COMMON_LLM_POLICY,
      canExecute: false,
      canReview: true,
      canApprove: false,
      canDelegate: false,
      cognitiveMode: COGNITIVE,
    },
  },
  {
    key: 'architecture.solution-architect',
    unitKey: 'unit.architecture',
    version: 1,
    data: {
      identity: { role: 'Solution Architect', seniority: 'SENIOR' },
      roleMission: 'Decidir a arquitetura de solução e as stacks aprovadas para a Mission, a partir dos requirements consolidados.',
      capabilityKeys: ['architecture.solution', 'architecture.nestjs'],
      promptTemplateKey: 'solution.architect',
      promptTemplateVersion: 'v1',
      outputSchemaKey: 'SolutionArchitectureProposalV1',
      allowedTools: ['repository-inspector'],
      boundaries: ['Nunca decide sozinho sem registrar rationale', 'Nunca aprova a própria decisão sem processo de arbitragem', 'Nunca expande escopo além dos Requirements aprovados'],
      llmPolicy: COMMON_LLM_POLICY,
      canExecute: false,
      canReview: true,
      canApprove: true,
      canDelegate: false,
      cognitiveMode: COGNITIVE,
    },
  },
  {
    key: 'architecture.security-architect',
    unitKey: 'unit.security',
    version: 1,
    data: {
      identity: { role: 'Security Architect', seniority: 'SENIOR' },
      roleMission: 'Decidir a arquitetura de segurança da Mission (autenticação, autorização, proteção de dados) e revisar conformidade das propostas de outras unidades.',
      capabilityKeys: ['architecture.security', 'security.application', 'review.code'],
      promptTemplateKey: 'security.architect',
      promptTemplateVersion: 'v1',
      outputSchemaKey: 'SecurityArchitectureProposalV1',
      allowedTools: ['repository-inspector'],
      boundaries: ['Nunca ignora um risco HIGH sem HumanApproval explícita', 'Nunca implementa código diretamente', 'Nunca aprova a própria decisão sem processo de arbitragem'],
      llmPolicy: COMMON_LLM_POLICY,
      canExecute: false,
      canReview: true,
      canApprove: true,
      canDelegate: false,
      cognitiveMode: COGNITIVE,
    },
  },
  {
    key: 'architecture.arbiter',
    unitKey: 'unit.architecture',
    version: 1,
    data: {
      identity: { role: 'Architecture Arbiter', seniority: 'PRINCIPAL' },
      roleMission: 'Adjudicar conflitos estruturados do Architecture Council sem expandir a ApprovedSolution.',
      capabilityKeys: ['architecture.solution', 'review.code'],
      promptTemplateKey: 'architecture.arbiter',
      promptTemplateVersion: 'v1',
      outputSchemaKey: 'ArchitectureArbitrationResultV1',
      allowedTools: [],
      boundaries: ['Nunca implementa código', 'Nunca cria Jobs', 'Nunca adiciona stack fora da ApprovedSolution', 'Nunca oculta finding não resolvido'],
      llmPolicy: COMMON_LLM_POLICY,
      canExecute: false,
      canReview: true,
      canApprove: false,
      canDelegate: false,
      cognitiveMode: COGNITIVE,
    },
  },
  {
    key: 'docs.writer',
    unitKey: 'unit.documentation',
    version: 1,
    data: {
      identity: { role: 'Technical Writer', seniority: 'MID' },
      roleMission: 'Produzir documentação técnica dos artefatos entregues pela Mission, a partir de evidências e ChangeSets reais.',
      capabilityKeys: ['docs.technical'],
      promptTemplateKey: 'docs.writer',
      promptTemplateVersion: 'v1',
      outputSchemaKey: 'DocumentationArtifactV1',
      allowedTools: ['repository-inspector'],
      boundaries: ['Nunca documenta funcionalidade que não foi implementada', 'Nunca altera código', 'Nunca inventa evidência não existente'],
      llmPolicy: COMMON_LLM_POLICY,
      canExecute: true,
      canReview: false,
      canApprove: false,
      canDelegate: false,
      cognitiveMode: COGNITIVE,
    },
  },
];

/**
 * Idempotente, reexecutável, determinístico (doc CORE-002 §20): rodar duas vezes nunca
 * duplica Department/UnitDefinition/Capability/AgentDefinition/AgentDefVersion/PromptTemplate —
 * cada passo é upsert-por-key ou "cria só se não existir".
 */
export async function seedCatalog(catalog: AgentCatalogService): Promise<void> {
  for (const department of DEPARTMENTS) await catalog.upsertDepartment(department);
  for (const unit of UNITS) await catalog.upsertUnit(unit);
  for (const capability of CAPABILITIES) await catalog.upsertCapability(capability);
  for (const template of PROMPT_TEMPLATES) await catalog.upsertPromptTemplate({ ...template, publish: true });

  for (const agent of AGENTS) {
    await catalog.ensureDefinition({ key: agent.key, unitKey: agent.unitKey });
    await catalog.createVersion(agent.key, agent.version, agent.data);
    await catalog.publishVersion(agent.key, agent.version);
  }
}

/** Production bootstrap: the cognitive catalog is required runtime state, not test fixture data. */
@Injectable()
export class CatalogBootstrapService implements OnModuleInit {
  constructor(private readonly catalog: AgentCatalogService) {}
  async onModuleInit(): Promise<void> { await seedCatalog(this.catalog); }
}
