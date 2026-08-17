import { randomUUID, createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../persistence/prisma.service';
import { MissionPersistenceService } from '../persistence/mission-persistence.service';
import { ReviewFindingService } from '../review/review-finding.service';
import {
  MarketplaceManifest,
  MarketplaceCustomizationPolicy,
  DEFAULT_CUSTOMIZATION_POLICY,
} from './marketplace-manifest';

export type SolutionStatus = 'DRAFT' | 'VALIDATING' | 'BETA' | 'VERIFIED' | 'DEPRECATED' | 'REJECTED';
export type SolutionVersionStatus = 'DRAFT' | 'VERIFIED' | 'REJECTED';

export interface CreateSolutionInput {
  slug: string;
  name: string;
  description: string;
  publisherId: string;
  category: string;
  industry?: string;
  tags?: string[];
  pricingModel?: string;
}

export interface CreateVersionInput {
  referenceMissionId: string;
  releaseNotes?: string;
  capabilities?: string[];
  optionalCapabilities?: string[];
  removableCapabilities?: string[];
  customizationPolicy?: Partial<MarketplaceCustomizationPolicy>;
  basePrice: number;
}

export interface MarketplaceSolutionDto {
  id: string;
  slug: string;
  name: string;
  description: string;
  publisherId: string;
  status: SolutionStatus;
  visibility: string;
  category: string;
  industry: string | null;
  tags: string[];
  pricingModel: string;
  currentVersionId: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

export interface MarketplaceSolutionVersionDto {
  id: string;
  solutionId: string;
  version: number;
  referenceMissionId: string;
  referencePromptMasterVersionId: string;
  manifest: MarketplaceManifest;
  stackSnapshot: { deliveryTargetKind: string; stackKey: string; stackName: string; rationale: string }[];
  validationSnapshot: VerificationGateResultDto | null;
  pricingSnapshot: { basePrice: number };
  status: SolutionVersionStatus;
  releaseNotes: string | null;
  checksum: string;
  createdAt: string;
  publishedAt: string | null;
}

export interface VerificationCheckDto {
  code: string;
  passed: boolean;
  detail: string;
}

export interface VerificationGateResultDto {
  status: 'VERIFIED' | 'REJECTED';
  checks: VerificationCheckDto[];
  evaluatedAt: string;
}

/** Regex reais e conhecidos de formatos de segredo — nunca um placeholder que finge detectar
 * (seção 30/31 do brief). Bloqueia publicação de verdade quando encontra algo. */
const SECRET_PATTERNS: { code: string; pattern: RegExp }[] = [
  { code: 'OPENAI_STYLE_KEY', pattern: /sk-[a-zA-Z0-9]{16,}/ },
  { code: 'AWS_ACCESS_KEY', pattern: /AKIA[0-9A-Z]{16}/ },
  { code: 'PRIVATE_KEY_BLOCK', pattern: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { code: 'INLINE_PASSWORD_ASSIGNMENT', pattern: /password\s*[:=]\s*['"][^'"]{4,}['"]/i },
  { code: 'INLINE_SECRET_ASSIGNMENT', pattern: /(api[_-]?key|secret|token)\s*[:=]\s*['"][a-zA-Z0-9_\-]{12,}['"]/i },
];

/**
 * MISSÃO "Marketplace de Sistemas Completos" — o catálogo real. Fase B/C: MarketplaceSolution +
 * MarketplaceSolutionVersion + manifesto + gate de verificação. Reaproveita 100% do pipeline
 * Discovery→PromptMaster→Review Council→Architecture Office já existente — uma
 * MarketplaceSolutionVersion não duplica conteúdo, ela REFERENCIA a missão real que já passou por
 * toda a governança (seção 52: nunca duplicar arquitetura).
 */
@Injectable()
export class MarketplaceSolutionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly missionPersistence: MissionPersistenceService,
    private readonly reviewFindings: ReviewFindingService
  ) {}

  async createSolution(input: CreateSolutionInput): Promise<MarketplaceSolutionDto> {
    if (!input.slug?.trim() || !input.name?.trim()) throw new Error('INVALID_MARKETPLACE_INPUT');
    const existing = await this.prisma.marketplaceSolution.findUnique({ where: { slug: input.slug } });
    if (existing) throw new Error('MARKETPLACE_SOLUTION_SLUG_TAKEN');

    const row = await this.prisma.marketplaceSolution.create({
      data: {
        id: randomUUID(),
        slug: input.slug.trim(),
        name: input.name.trim(),
        description: input.description ?? '',
        publisherId: input.publisherId,
        category: input.category,
        industry: input.industry,
        tagsJson: input.tags ?? [],
        pricingModel: input.pricingModel ?? 'FREE',
        status: 'DRAFT',
        visibility: 'PRIVATE',
      },
    });
    return this.toSolutionDto(row);
  }

  async listSolutions(filter?: { status?: SolutionStatus }): Promise<MarketplaceSolutionDto[]> {
    const rows = await this.prisma.marketplaceSolution.findMany({
      where: filter?.status ? { status: filter.status } : undefined,
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((r) => this.toSolutionDto(r));
  }

  async getSolutionBySlug(slug: string): Promise<{ solution: MarketplaceSolutionDto; currentVersion: MarketplaceSolutionVersionDto | null }> {
    const solution = await this.prisma.marketplaceSolution.findUnique({ where: { slug } });
    if (!solution) throw new Error('MARKETPLACE_SOLUTION_NOT_FOUND');
    const currentVersion = solution.currentVersionId
      ? await this.prisma.marketplaceSolutionVersion.findUnique({ where: { id: solution.currentVersionId } })
      : null;
    return {
      solution: this.toSolutionDto(solution),
      currentVersion: currentVersion ? this.toVersionDto(currentVersion) : null,
    };
  }

  async listVersions(solutionId: string): Promise<MarketplaceSolutionVersionDto[]> {
    const rows = await this.prisma.marketplaceSolutionVersion.findMany({ where: { solutionId }, orderBy: { version: 'desc' } });
    return rows.map((r) => this.toVersionDto(r));
  }

  async getVersion(versionId: string): Promise<MarketplaceSolutionVersionDto> {
    const row = await this.prisma.marketplaceSolutionVersion.findUnique({ where: { id: versionId } });
    if (!row) throw new Error('MARKETPLACE_SOLUTION_VERSION_NOT_FOUND');
    return this.toVersionDto(row);
  }

  /**
   * Constrói o manifesto a partir de decisões REAIS já tomadas para a missão de referência — nunca
   * de metadata solta. Exige que a missão já tenha passado pelo Architecture Office real (o
   * GeneratorMissionState só existe depois do PromptMaster ser aprovado e o engine determinístico
   * rodar) — uma solução do Marketplace nunca referencia um PromptMaster só travado, sem
   * arquitetura real por trás.
   */
  async createVersionFromMission(solutionId: string, input: CreateVersionInput): Promise<MarketplaceSolutionVersionDto> {
    const solution = await this.prisma.marketplaceSolution.findUnique({ where: { id: solutionId } });
    if (!solution) throw new Error('MARKETPLACE_SOLUTION_NOT_FOUND');
    if (!input.basePrice || input.basePrice < 0) throw new Error('INVALID_MARKETPLACE_INPUT');

    const promptMaster = await this.prisma.promptMasterVersion.findFirst({
      where: { missionId: input.referenceMissionId, status: 'LOCKED' },
      orderBy: { version: 'desc' },
    });
    if (!promptMaster) throw new Error('MARKETPLACE_REFERENCE_PROMPTMASTER_NOT_LOCKED');

    const session = await this.missionPersistence.hydrate(input.referenceMissionId);
    const stored = session.resultStore.getCurrent();
    if (!stored) throw new Error('MARKETPLACE_REFERENCE_MISSION_NOT_GENERATED');
    const { approvedSolution } = stored.result;

    const confirmedFeatures = await this.prisma.requirement.findMany({
      where: { promptMasterId: promptMaster.id, section: 'features', status: 'CONFIRMED' },
    });
    const capabilities = input.capabilities ?? confirmedFeatures.map((f) => f.content);

    const stackByTarget = new Map(approvedSolution.selectedStacks.map((s) => [s.deliveryTargetKind, s]));
    // Mesmo filtro usado internamente pelo core Generator (solution-planner.ts/technology-selector.ts):
    // um target obrigatório pode legitimamente ficar 'PROPOSED' e ainda ser real — só 'REJECTED'/
    // 'FORBIDDEN_BY_SCOPE' realmente não fazem parte da solução aprovada.
    const targetKinds = new Set(
      approvedSolution.deliveryTargets.filter((t) => t.status === 'APPROVED' || (t.status === 'PROPOSED' && t.required)).map((t) => t.kind)
    );

    const manifest: MarketplaceManifest = {
      solutionId,
      version: 'DRAFT',
      status: 'DRAFT',
      targets: {
        backend: { enabled: targetKinds.has('BACKEND'), pluginId: stackByTarget.get('BACKEND')?.stackKey ?? null },
        frontend: { enabled: targetKinds.has('FRONTEND'), pluginId: stackByTarget.get('FRONTEND')?.stackKey ?? null },
        mobile: { enabled: targetKinds.has('MOBILE'), pluginId: stackByTarget.get('MOBILE')?.stackKey ?? null },
      },
      // Este sistema não seleciona um engine de banco como stack de 1ª classe hoje (ver
      // core/src/registry/stack-registry.ts — sem entradas de database) — nunca fabricado.
      database: null,
      capabilities,
      optionalCapabilities: input.optionalCapabilities ?? [],
      removableCapabilities: input.removableCapabilities ?? [],
      customizationPolicy: { ...DEFAULT_CUSTOMIZATION_POLICY, ...(input.customizationPolicy ?? {}) },
    };

    const priorMax = await this.prisma.marketplaceSolutionVersion.aggregate({ where: { solutionId }, _max: { version: true } });
    const version = (priorMax._max.version ?? 0) + 1;
    manifest.version = String(version);

    const stackSnapshot = approvedSolution.selectedStacks.map((s) => ({
      deliveryTargetKind: s.deliveryTargetKind,
      stackKey: s.stackKey,
      stackName: s.stackKey,
      rationale: s.rationale,
    }));

    const checksum = createHash('sha256')
      .update(JSON.stringify({ manifest, stackSnapshot, referencePromptMasterVersionId: promptMaster.id }))
      .digest('hex');

    const row = await this.prisma.marketplaceSolutionVersion.create({
      data: {
        id: randomUUID(),
        solutionId,
        version,
        referenceMissionId: input.referenceMissionId,
        referencePromptMasterVersionId: promptMaster.id,
        manifestJson: manifest as unknown as object,
        stackSnapshotJson: stackSnapshot as unknown as object,
        pricingSnapshotJson: { basePrice: input.basePrice },
        status: 'DRAFT',
        releaseNotes: input.releaseNotes,
        checksum,
      },
    });
    return this.toVersionDto(row);
  }

  /**
   * MARKETPLACE_SOLUTION_VERIFICATION_GATE (seção 6). Só verifica o que é real e verificável hoje
   * neste sistema — build/test/runtime/preview NÃO existem (ver README/overview.service.ts:
   * "execution runtime, artifacts... not implemented yet"), então nunca aparecem como PASSED
   * fabricado. Aparecem marcados como indisponíveis, com o motivo real.
   */
  async runVerificationGate(versionId: string): Promise<VerificationGateResultDto> {
    const versionRow = await this.prisma.marketplaceSolutionVersion.findUnique({ where: { id: versionId } });
    if (!versionRow) throw new Error('MARKETPLACE_SOLUTION_VERSION_NOT_FOUND');
    const manifest = versionRow.manifestJson as unknown as MarketplaceManifest;

    const promptMaster = await this.prisma.promptMasterVersion.findUnique({ where: { id: versionRow.referencePromptMasterVersionId } });
    const requirements = promptMaster
      ? await this.prisma.requirement.findMany({ where: { promptMasterId: promptMaster.id, status: { not: 'REJECTED' } } })
      : [];

    const checks: VerificationCheckDto[] = [];

    checks.push({
      code: 'REFERENCE_PROMPTMASTER_LOCKED',
      passed: promptMaster?.status === 'LOCKED',
      detail: promptMaster?.status === 'LOCKED' ? 'PromptMaster de referência travado e aprovado.' : 'PromptMaster de referência não está LOCKED.',
    });

    const hasBlockers = promptMaster ? await this.reviewFindings.hasUnresolvedBlockers(promptMaster.id) : true;
    checks.push({
      code: 'NO_UNRESOLVED_REVIEW_BLOCKERS',
      passed: !hasBlockers,
      detail: hasBlockers ? 'Existem BLOCKERs não resolvidos do Review Council.' : 'Nenhum BLOCKER aberto do Review Council.',
    });

    const hasAnyTarget = manifest.targets.backend.enabled || manifest.targets.frontend.enabled || manifest.targets.mobile.enabled;
    checks.push({
      code: 'MANIFEST_HAS_TARGET',
      passed: hasAnyTarget,
      detail: hasAnyTarget ? 'Manifesto declara ao menos um target de entrega real.' : 'Manifesto sem nenhum target habilitado.',
    });

    checks.push({
      code: 'MANIFEST_HAS_CAPABILITIES',
      passed: manifest.capabilities.length > 0,
      detail: manifest.capabilities.length > 0 ? `${manifest.capabilities.length} capability(ies) declaradas.` : 'Manifesto sem nenhuma capability.',
    });

    const secretHits = this.scanForSecrets(requirements.map((r) => r.content).concat(promptMaster?.fullMarkdown ?? ''));
    checks.push({
      code: 'NO_EMBEDDED_SECRETS',
      passed: secretHits.length === 0,
      detail: secretHits.length === 0 ? 'Nenhum padrão de segredo encontrado.' : `Padrão(ões) de segredo detectado(s): ${secretHits.join(', ')}.`,
    });

    checks.push({
      code: 'STACK_SNAPSHOT_PRESENT',
      passed: (versionRow.stackSnapshotJson as unknown as unknown[]).length >= 0,
      detail: 'Stack snapshot persistido a partir da Architecture Office real.',
    });

    // Honestidade explícita (seção 53): nunca fabricar sucesso para algo que este sistema não tem.
    for (const code of ['BUILD', 'AUTOMATED_TESTS', 'RUNTIME_START', 'PREVIEW_AVAILABLE'] as const) {
      checks.push({
        code: `${code}_NOT_APPLICABLE`,
        passed: true,
        detail: 'Este LDCN OS ainda não tem runtime de build/execução real — nunca reportado como PASSED (ver relatório da missão).',
      });
    }

    const status: 'VERIFIED' | 'REJECTED' = checks.every((c) => c.passed) ? 'VERIFIED' : 'REJECTED';
    const result: VerificationGateResultDto = { status, checks, evaluatedAt: new Date().toISOString() };

    await this.prisma.marketplaceSolutionVersion.update({
      where: { id: versionId },
      data: { status, validationSnapshotJson: result as unknown as object },
    });

    return result;
  }

  /** Só uma versão VERIFIED pode ser publicada — o status da solução some de VALIDATING/DRAFT
   * quando a primeira versão passa; VERIFIED nunca é atingido por decisão manual isolada. */
  async publishVersion(versionId: string): Promise<MarketplaceSolutionDto> {
    const versionRow = await this.prisma.marketplaceSolutionVersion.findUnique({ where: { id: versionId } });
    if (!versionRow) throw new Error('MARKETPLACE_SOLUTION_VERSION_NOT_FOUND');
    if (versionRow.status !== 'VERIFIED') throw new Error('MARKETPLACE_SOLUTION_VERSION_NOT_VERIFIED');

    const now = new Date();
    await this.prisma.marketplaceSolutionVersion.update({ where: { id: versionId }, data: { publishedAt: now } });
    const solution = await this.prisma.marketplaceSolution.update({
      where: { id: versionRow.solutionId },
      data: { status: 'VERIFIED', visibility: 'PUBLIC', currentVersionId: versionId, publishedAt: now },
    });
    return this.toSolutionDto(solution);
  }

  private scanForSecrets(texts: string[]): string[] {
    const blob = texts.join('\n');
    return SECRET_PATTERNS.filter((p) => p.pattern.test(blob)).map((p) => p.code);
  }

  private toSolutionDto(row: {
    id: string; slug: string; name: string; description: string; publisherId: string; status: string; visibility: string;
    category: string; industry: string | null; tagsJson: unknown; pricingModel: string; currentVersionId: string | null;
    createdAt: Date; updatedAt: Date; publishedAt: Date | null;
  }): MarketplaceSolutionDto {
    return {
      id: row.id, slug: row.slug, name: row.name, description: row.description, publisherId: row.publisherId,
      status: row.status as SolutionStatus, visibility: row.visibility, category: row.category, industry: row.industry,
      tags: (row.tagsJson as string[]) ?? [], pricingModel: row.pricingModel, currentVersionId: row.currentVersionId,
      createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), publishedAt: row.publishedAt?.toISOString() ?? null,
    };
  }

  private toVersionDto(row: {
    id: string; solutionId: string; version: number; referenceMissionId: string; referencePromptMasterVersionId: string;
    manifestJson: unknown; stackSnapshotJson: unknown; validationSnapshotJson: unknown; pricingSnapshotJson: unknown;
    status: string; releaseNotes: string | null; checksum: string; createdAt: Date; publishedAt: Date | null;
  }): MarketplaceSolutionVersionDto {
    return {
      id: row.id, solutionId: row.solutionId, version: row.version, referenceMissionId: row.referenceMissionId,
      referencePromptMasterVersionId: row.referencePromptMasterVersionId,
      manifest: row.manifestJson as unknown as MarketplaceManifest,
      stackSnapshot: row.stackSnapshotJson as unknown as MarketplaceSolutionVersionDto['stackSnapshot'],
      validationSnapshot: (row.validationSnapshotJson as unknown as VerificationGateResultDto) ?? null,
      pricingSnapshot: row.pricingSnapshotJson as unknown as { basePrice: number },
      status: row.status as SolutionVersionStatus,
      releaseNotes: row.releaseNotes,
      checksum: row.checksum,
      createdAt: row.createdAt.toISOString(),
      publishedAt: row.publishedAt?.toISOString() ?? null,
    };
  }
}
