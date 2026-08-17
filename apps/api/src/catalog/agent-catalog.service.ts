import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma, AgentDefinition, AgentDefVersion, CapabilityDefinition, Department, UnitDefinition } from '@prisma/client';
import { PrismaService } from '../persistence/prisma.service';

export type CognitiveMode = 'COGNITIVE' | 'ORCHESTRATION';

export interface CreateAgentDefVersionInput {
  identity: { role: string; seniority: string };
  roleMission: string;
  capabilityKeys: string[];
  knowledgeRefs?: string[];
  promptTemplateKey: string;
  promptTemplateVersion: string;
  outputSchemaKey: string;
  allowedTools?: string[];
  territory?: string[];
  memoryPolicy?: Record<string, unknown>;
  reviewPolicy?: Record<string, unknown>;
  boundaries: string[];
  llmPolicy?: { modelClass: string; maxInputTokens: number; maxOutputTokens: number; temperatureProfile: string; fallbackPolicy: string };
  canExecute?: boolean;
  canReview?: boolean;
  canApprove?: boolean;
  canDelegate?: boolean;
  cognitiveMode: CognitiveMode;
}

const FORBIDDEN_JSON_KEYS = ['apikey', 'api_key', 'secret', 'credential', 'password'];

/**
 * CORE-002: catálogo permanente da empresa virtual — Department > UnitDefinition >
 * AgentDefinition (cargo) > AgentDefVersion (versão imutável). Não conhece Mission nem
 * AgentInstance (isso é CORE-003) e nunca é chamado por AgentExecutionService ainda —
 * agentKey em AgentExecution continua resolvido pelo StackRegistry em memória
 * (core/src/registry/stack-registry.ts), propositalmente desacoplado nesta CORE.
 */
@Injectable()
export class AgentCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------
  // Department / UnitDefinition / CapabilityDefinition — catálogo simples,
  // sem versionamento (só AgentDefVersion e PromptTemplate são versionados).
  // ---------------------------------------------------------------------

  async upsertDepartment(input: { key: string; name: string; description: string }): Promise<Department> {
    return this.prisma.department.upsert({
      where: { key: input.key },
      update: { name: input.name, description: input.description },
      create: { id: randomUUID(), key: input.key, name: input.name, description: input.description },
    });
  }

  async upsertUnit(input: { key: string; departmentKey: string; name: string; engineeringType: string; stackKeys?: string[] }): Promise<UnitDefinition> {
    const department = await this.prisma.department.findUnique({ where: { key: input.departmentKey } });
    if (!department) throw new Error('CATALOG_DEPARTMENT_NOT_FOUND');

    return this.prisma.unitDefinition.upsert({
      where: { key: input.key },
      update: { name: input.name, engineeringType: input.engineeringType, stackKeysJson: (input.stackKeys ?? []) as Prisma.InputJsonValue },
      create: {
        id: randomUUID(),
        key: input.key,
        departmentId: department.id,
        name: input.name,
        engineeringType: input.engineeringType,
        stackKeysJson: (input.stackKeys ?? []) as Prisma.InputJsonValue,
      },
    });
  }

  async upsertCapability(input: { key: string; domain: string; name: string; description: string }): Promise<CapabilityDefinition> {
    return this.prisma.capabilityDefinition.upsert({
      where: { key: input.key },
      update: { domain: input.domain, name: input.name, description: input.description },
      create: { id: randomUUID(), key: input.key, domain: input.domain, name: input.name, description: input.description },
    });
  }

  async upsertPromptTemplate(input: { key: string; version: string; sections: Record<string, unknown>; publish?: boolean }): Promise<void> {
    this.assertNoCredentials(input.sections, `PromptTemplate ${input.key}@${input.version}`);
    const existing = await this.prisma.promptTemplate.findUnique({ where: { key_version: { key: input.key, version: input.version } } });
    if (existing) {
      if (existing.publishedAt) return; // published templates are immutable — no-op on re-seed.
      await this.prisma.promptTemplate.update({
        where: { id: existing.id },
        data: { sectionsJson: input.sections as Prisma.InputJsonValue, publishedAt: input.publish ? new Date() : null },
      });
      return;
    }
    await this.prisma.promptTemplate.create({
      data: {
        id: randomUUID(),
        key: input.key,
        version: input.version,
        sectionsJson: input.sections as Prisma.InputJsonValue,
        publishedAt: input.publish ? new Date() : null,
      },
    });
  }

  // ---------------------------------------------------------------------
  // AgentDefinition (cargo) + AgentDefVersion (versão imutável)
  // ---------------------------------------------------------------------

  /** Idempotente: cria o cargo somente se ainda não existir; nunca duplica. */
  async ensureDefinition(input: { key: string; unitKey: string }): Promise<AgentDefinition> {
    const existing = await this.prisma.agentDefinition.findUnique({ where: { key: input.key } });
    if (existing) return existing;

    const unit = await this.prisma.unitDefinition.findUnique({ where: { key: input.unitKey } });
    if (!unit) throw new Error('CATALOG_UNIT_NOT_FOUND');

    return this.prisma.agentDefinition.create({
      data: { id: randomUUID(), key: input.key, unitDefinitionId: unit.id },
    });
  }

  /**
   * Cria uma nova versão (draft, não publicada) para o cargo. Idempotente por
   * (agentDefinitionId, version): se a versão já existir, retorna a existente
   * em vez de duplicar — re-executar um seed nunca produz uma segunda linha.
   */
  async createVersion(agentDefinitionKey: string, version: number, input: CreateAgentDefVersionInput): Promise<AgentDefVersion> {
    const definition = await this.prisma.agentDefinition.findUnique({ where: { key: agentDefinitionKey } });
    if (!definition) throw new Error('CATALOG_AGENT_DEFINITION_NOT_FOUND');

    const existing = await this.prisma.agentDefVersion.findUnique({
      where: { agentDefinitionId_version: { agentDefinitionId: definition.id, version } },
    });
    if (existing) return existing;

    this.assertNoCredentials(input, `AgentDefVersion ${agentDefinitionKey}@v${version}`);

    return this.prisma.agentDefVersion.create({
      data: {
        id: randomUUID(),
        agentDefinitionId: definition.id,
        version,
        identityJson: input.identity as Prisma.InputJsonValue,
        roleMission: input.roleMission,
        capabilityKeysJson: input.capabilityKeys as Prisma.InputJsonValue,
        knowledgeRefsJson: (input.knowledgeRefs ?? []) as Prisma.InputJsonValue,
        promptTemplateKey: input.promptTemplateKey,
        promptTemplateVersion: input.promptTemplateVersion,
        outputSchemaKey: input.outputSchemaKey,
        allowedToolsJson: (input.allowedTools ?? []) as Prisma.InputJsonValue,
        territoryJson: (input.territory ?? []) as Prisma.InputJsonValue,
        memoryPolicyJson: (input.memoryPolicy ?? {}) as Prisma.InputJsonValue,
        reviewPolicyJson: (input.reviewPolicy ?? {}) as Prisma.InputJsonValue,
        boundariesJson: input.boundaries as Prisma.InputJsonValue,
        llmPolicyJson: (input.llmPolicy ?? null) as Prisma.InputJsonValue | undefined,
        canExecute: input.canExecute ?? false,
        canReview: input.canReview ?? false,
        canApprove: input.canApprove ?? false,
        canDelegate: input.canDelegate ?? false,
        cognitiveMode: input.cognitiveMode,
      },
    });
  }

  /**
   * Publica uma versão draft: exige identity/mission/capabilities/prompt/output/boundaries
   * quando cognitiveMode=COGNITIVE (doc CORE-002 §11), e então marca publishedAt + promove
   * AgentDefinition.currentVersion. A partir daqui a versão é IMUTÁVEL — updateVersion rejeita.
   */
  async publishVersion(agentDefinitionKey: string, version: number): Promise<AgentDefVersion> {
    const definition = await this.prisma.agentDefinition.findUnique({ where: { key: agentDefinitionKey } });
    if (!definition) throw new Error('CATALOG_AGENT_DEFINITION_NOT_FOUND');

    const draft = await this.prisma.agentDefVersion.findUnique({
      where: { agentDefinitionId_version: { agentDefinitionId: definition.id, version } },
    });
    if (!draft) throw new Error('CATALOG_AGENT_DEF_VERSION_NOT_FOUND');
    if (draft.publishedAt) return draft; // already published — idempotent no-op.

    if (draft.cognitiveMode === 'COGNITIVE') this.assertPublishableCognitive(draft);

    const published = await this.prisma.agentDefVersion.update({
      where: { id: draft.id },
      data: { publishedAt: new Date() },
    });

    if (version > definition.currentVersion) {
      await this.prisma.agentDefinition.update({ where: { id: definition.id }, data: { currentVersion: version } });
    }

    return published;
  }

  /**
   * Único ponto de mutação de uma AgentDefVersion pré-publicação (correção de draft).
   * Rejeita com CATALOG_AGENT_DEF_VERSION_IMMUTABLE se a versão já foi publicada —
   * enforcement de imutabilidade em application policy (doc CORE-002 §6).
   */
  async updateDraftVersion(agentDefinitionKey: string, version: number, patch: Partial<CreateAgentDefVersionInput>): Promise<AgentDefVersion> {
    const definition = await this.prisma.agentDefinition.findUnique({ where: { key: agentDefinitionKey } });
    if (!definition) throw new Error('CATALOG_AGENT_DEFINITION_NOT_FOUND');

    const current = await this.prisma.agentDefVersion.findUnique({
      where: { agentDefinitionId_version: { agentDefinitionId: definition.id, version } },
    });
    if (!current) throw new Error('CATALOG_AGENT_DEF_VERSION_NOT_FOUND');
    if (current.publishedAt) throw new Error('CATALOG_AGENT_DEF_VERSION_IMMUTABLE');

    if (patch.roleMission || patch.boundaries) this.assertNoCredentials(patch, `AgentDefVersion ${agentDefinitionKey}@v${version}`);

    return this.prisma.agentDefVersion.update({
      where: { id: current.id },
      data: {
        ...(patch.roleMission !== undefined ? { roleMission: patch.roleMission } : {}),
        ...(patch.boundaries !== undefined ? { boundariesJson: patch.boundaries as Prisma.InputJsonValue } : {}),
        ...(patch.capabilityKeys !== undefined ? { capabilityKeysJson: patch.capabilityKeys as Prisma.InputJsonValue } : {}),
      },
    });
  }

  // ---------------------------------------------------------------------
  // Resolução — leitura por chave/versão exata
  // ---------------------------------------------------------------------

  async getDefinition(key: string): Promise<AgentDefinition | null> {
    return this.prisma.agentDefinition.findUnique({ where: { key } });
  }

  async getVersion(key: string, version: number): Promise<AgentDefVersion | null> {
    const definition = await this.prisma.agentDefinition.findUnique({ where: { key } });
    if (!definition) return null;
    return this.prisma.agentDefVersion.findUnique({
      where: { agentDefinitionId_version: { agentDefinitionId: definition.id, version } },
    });
  }

  async getCurrentVersion(key: string): Promise<AgentDefVersion | null> {
    const definition = await this.prisma.agentDefinition.findUnique({ where: { key } });
    if (!definition || definition.currentVersion === 0) return null;
    return this.getVersion(key, definition.currentVersion);
  }

  async listByUnit(unitKey: string): Promise<AgentDefinition[]> {
    const unit = await this.prisma.unitDefinition.findUnique({ where: { key: unitKey } });
    if (!unit) return [];
    return this.prisma.agentDefinition.findMany({ where: { unitDefinitionId: unit.id }, orderBy: { key: 'asc' } });
  }

  async resolveCapabilities(key: string, version: number): Promise<CapabilityDefinition[]> {
    const agentVersion = await this.getVersion(key, version);
    if (!agentVersion) return [];
    const capabilityKeys = agentVersion.capabilityKeysJson as unknown as string[];
    if (capabilityKeys.length === 0) return [];
    return this.prisma.capabilityDefinition.findMany({ where: { key: { in: capabilityKeys } } });
  }

  // ---------------------------------------------------------------------
  // Guards
  // ---------------------------------------------------------------------

  private assertPublishableCognitive(draft: AgentDefVersion): void {
    const identity = draft.identityJson as unknown as { role?: string; seniority?: string } | null;
    const capabilityKeys = draft.capabilityKeysJson as unknown as string[];
    const boundaries = draft.boundariesJson as unknown as string[];

    if (!identity?.role) throw new Error('CATALOG_PUBLISH_REQUIRES_IDENTITY');
    if (!draft.roleMission) throw new Error('CATALOG_PUBLISH_REQUIRES_ROLE_MISSION');
    if (!capabilityKeys || capabilityKeys.length === 0) throw new Error('CATALOG_PUBLISH_REQUIRES_CAPABILITY');
    if (!draft.promptTemplateKey || !draft.promptTemplateVersion) throw new Error('CATALOG_PUBLISH_REQUIRES_PROMPT_TEMPLATE');
    if (!draft.outputSchemaKey) throw new Error('CATALOG_PUBLISH_REQUIRES_OUTPUT_CONTRACT');
    if (!boundaries || boundaries.length === 0) throw new Error('CATALOG_PUBLISH_REQUIRES_BOUNDARIES');
  }

  private assertNoCredentials(value: unknown, label: string): void {
    const text = JSON.stringify(value).toLowerCase();
    for (const forbidden of FORBIDDEN_JSON_KEYS) {
      if (text.includes(forbidden)) throw new Error(`CATALOG_CREDENTIAL_NOT_ALLOWED: ${label} contains forbidden key "${forbidden}"`);
    }
  }
}
