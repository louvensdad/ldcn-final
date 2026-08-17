import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../persistence/prisma.service';
import { LLM_CLIENT, LlmClient } from '../assistant/deepseek-client';
import { LlmInvocationLedgerService } from '../ledger/llm-invocation-ledger.service';
import { EventLogService } from '../events/event-log.service';
import { RequirementKeyService } from './requirement-key.service';
import {
  DiscoveryRequirementsResultV1,
  RequirementCategory,
  validateDiscoveryRequirementsResult,
  normalizeStatement,
} from './discovery-requirements-schema';

const SYSTEM_PROMPT = `Você extrai requisitos canônicos e estruturados a partir da ideia de um usuário para um sistema de software. Nunca invente requisito que o usuário não pediu nem que você não possa justificar como decorrência direta e óbvia do pedido — quando derivar algo, marque sourceBasis como "DISCOVERY_DERIVED", nunca "USER_EXPLICIT". Só marque "USER_EXPLICIT" quando o requisito for literalmente o que o usuário pediu.

Responda SOMENTE com um objeto JSON válido, sem markdown, exatamente neste formato:
{"missionSummary": string, "requirements": [{"statement": string, "category": "FUNCTIONAL"|"NON_FUNCTIONAL"|"CONSTRAINT"|"DATA"|"INTEGRATION"|"SECURITY"|"UX"|"OPERATIONS"|"COMPLIANCE"|"OTHER", "priority": string, "sourceBasis": "USER_EXPLICIT"|"DISCOVERY_DERIVED"}], "ambiguities": [{"description": string, "affectedRequirementIndexes": number[]}], "assumptions": string[]}

Nunca trunque a lista de requirements para caber em um número redondo — inclua todos os requisitos reais que conseguir identificar, mesmo que sejam muitos.`;

const CATEGORY_TO_LEGACY_SECTION: Record<RequirementCategory, string> = {
  FUNCTIONAL: 'features',
  NON_FUNCTIONAL: 'nonFunctional',
  CONSTRAINT: 'nonFunctional',
  DATA: 'data',
  INTEGRATION: 'integrations',
  SECURITY: 'security',
  UX: 'flows',
  OPERATIONS: 'nonFunctional',
  COMPLIANCE: 'privacy',
  OTHER: 'businessRules',
};

export interface ExtractedRequirementRef {
  id: string;
  requirementKey: string;
  statement: string;
  category: RequirementCategory;
  source: 'USER_EXPLICIT' | 'DISCOVERY_EXTRACTED';
}

export interface RequirementExtractionResult {
  missionSummary: string;
  ambiguities: DiscoveryRequirementsResultV1['ambiguities'];
  assumptions: string[];
  requirements: ExtractedRequirementRef[];
  skippedDuplicateCount: number;
}

/**
 * CORE-011 §8 — evolui o DiscoveryService existente sem tocar seu código: pipeline adicional que
 * produz o contrato DiscoveryRequirementsResultV1 e o converte em Requirement rows canônicas com
 * requirementKey/category/source (§3/§5/§7). Nunca persiste chain-of-thought (§14) — só o
 * resultado estruturado final que o modelo devolveu.
 */
@Injectable()
export class RequirementExtractionService {
  constructor(
    @Inject(LLM_CLIENT) private readonly llm: LlmClient,
    private readonly prisma: PrismaService,
    private readonly ledger: LlmInvocationLedgerService,
    private readonly eventLog: EventLogService,
    private readonly requirementKeys: RequirementKeyService
  ) {}

  async extractAndPersist(missionId: string, rawUserIdea: string): Promise<RequirementExtractionResult> {
    if (!missionId?.trim()) throw new Error('INVALID_DISCOVERY_INPUT');
    if (!rawUserIdea?.trim()) throw new Error('INVALID_DISCOVERY_INPUT');

    const user = `Ideia do usuário:\n"${rawUserIdea.trim()}"`;
    let completion;
    try {
      completion = await this.ledger.recordLlmCall(
        {
          missionId,
          purpose: 'requirements.extraction',
          phase: 'CONTEXT_ANALYSIS',
          promptType: 'requirements-extraction',
          promptVersion: 'v1',
          contextForHash: { rawUserIdea: rawUserIdea.trim() },
          system: SYSTEM_PROMPT,
          user,
          refs: { missionId },
        },
        () => this.llm.complete({ system: SYSTEM_PROMPT, user, responseFormat: 'json_object' })
      );
    } catch {
      throw new Error('REQUIREMENTS_EXTRACTION_AI_UNAVAILABLE');
    }

    let raw: unknown;
    try {
      const cleaned = completion.text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '');
      raw = JSON.parse(cleaned);
    } catch {
      throw new Error('REQUIREMENTS_EXTRACTION_MALFORMED');
    }
    const parsed = validateDiscoveryRequirementsResult(raw);
    if (!parsed) throw new Error('REQUIREMENTS_EXTRACTION_MALFORMED');

    return this.persist(missionId, parsed);
  }

  /** Exposto separadamente do LLM call para permitir ingestão de um resultado já estruturado
   * (ex.: fixture de teste, import) sem depender de uma chamada real ao modelo. */
  async persist(missionId: string, parsed: DiscoveryRequirementsResultV1): Promise<RequirementExtractionResult> {
    // §10 — dedup textual normalizada contra o que já existe na Mission (nunca semantic search).
    const existing = await this.prisma.requirement.findMany({ where: { missionId }, select: { content: true } });
    const existingNormalized = new Set(existing.map((r) => normalizeStatement(r.content)));

    const toCreate: { statement: string; category: RequirementCategory; priority?: string; source: 'USER_EXPLICIT' | 'DISCOVERY_EXTRACTED' }[] = [];
    const seenInBatch = new Set<string>();
    let skippedDuplicateCount = 0;
    for (const item of parsed.requirements) {
      const norm = normalizeStatement(item.statement);
      if (existingNormalized.has(norm) || seenInBatch.has(norm)) {
        skippedDuplicateCount++;
        continue;
      }
      seenInBatch.add(norm);
      toCreate.push({
        statement: item.statement,
        category: item.category,
        priority: item.priority,
        source: item.sourceBasis === 'USER_EXPLICIT' ? 'USER_EXPLICIT' : 'DISCOVERY_EXTRACTED',
      });
    }

    const keys = await this.requirementKeys.allocateKeys(missionId, toCreate.length);
    const rows = toCreate.map((item, i) => ({
      id: randomUUID(),
      missionId,
      promptMasterId: null,
      section: CATEGORY_TO_LEGACY_SECTION[item.category],
      content: item.statement,
      origin: (item.source === 'USER_EXPLICIT' ? 'USER' : 'AI_SUGGESTED') as 'USER' | 'AI_SUGGESTED',
      confidence: null,
      status: 'SUGGESTED' as const,
      createdBy: 'requirement-extraction',
      requirementKey: keys[i],
      category: item.category,
      source: item.source,
      priority: item.priority ?? null,
    }));

    if (rows.length > 0) {
      // §K/§L/§M — sem truncamento: createMany insere TODAS as linhas de uma vez, nunca um
      // slice(0, N) antes de persistir.
      await this.prisma.requirement.createMany({ data: rows });
    }

    await this.eventLog.append({
      missionId,
      correlationId: randomUUID(),
      actorType: 'SYSTEM',
      type: 'mission.discovery_completed',
      payload: { missionId, requirementCount: rows.length, skippedDuplicateCount, ambiguityCount: parsed.ambiguities.length },
    });

    return {
      missionSummary: parsed.missionSummary,
      ambiguities: parsed.ambiguities,
      assumptions: parsed.assumptions,
      skippedDuplicateCount,
      requirements: rows.map((r) => ({ id: r.id, requirementKey: r.requirementKey, statement: r.content, category: r.category as RequirementCategory, source: r.source })),
    };
  }
}
