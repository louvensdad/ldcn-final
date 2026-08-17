import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../persistence/prisma.service';
import { AgentCatalogService } from '../catalog/agent-catalog.service';
import { LlmInvocationLedgerService } from '../ledger/llm-invocation-ledger.service';
import { ContextLoaderService } from './context-loader.service';
import { PromptCompiler } from './prompt-compiler';
import { CandidateReviewContext, CompiledPromptResult, ContextBudget, PreviousStepSummary, PromptPurpose } from './types';
import { SOLUTION_PLAN_RESULT_V1_SCHEMA } from '../solution-planning/solution-plan-result';

export interface CompilePromptInput {
  missionId: string;
  jobId: string;
  agentDefinitionKey: string;
  /** Versão EXATA — nunca "current" (doc CORE-003 §29). Quem chama decide/congela a versão. */
  agentDefinitionVersion: number;
  purpose: PromptPurpose;
  agentExecutionId?: string;
  previousStepSummaries?: PreviousStepSummary[];
  budget?: ContextBudget;
  /** Se false (default), não persiste PromptSnapshot — útil para testar compilação pura. */
  persistSnapshot?: boolean;
  /** Runtime-only candidate evidence. Full source is deliberately never copied to snapshot refs. */
  candidateReviewContext?: CandidateReviewContext;
}

export interface CompilePromptOutput {
  compiled: CompiledPromptResult;
  promptSnapshotId: string | null;
}

export interface CompileSolutionPlanningInput {
  missionId: string;
  agentExecutionId: string;
  agentDefinitionKey: string;
  agentDefinitionVersion: number;
  requirementBaselineId: string;
  requirementBaselineVersion: number;
  requirementBaselineHash: string;
  scopeCoverageHash: string;
  missionSummary: string | null;
  requirementsSnapshot: object[];
  scopeCoverage: object[];
  trustedStackCatalog: object[];
  repairInstruction?: string;
}

export interface CompileSolutionPlanningOutput {
  systemText: string;
  userText: string;
  promptSnapshotId: string;
}

export interface CompileArchitectureOperationInput {
  missionId: string; agentExecutionId: string; agentDefinitionKey: string; agentDefinitionVersion: number;
  purpose: 'ARCHITECTURE_PROPOSAL' | 'ARCHITECTURE_REVIEW' | 'ARCHITECTURE_ARBITRATION' | 'IMPLEMENTATION_PLANNING' | 'REPAIR';
  outputSchemaKey: string; outputSchema: string; trustedContext: object; untrustedContext: object;
  inputVersionRefs: Record<string, unknown>; requirementRefs: string[];
}

/**
 * CORE-003 §7. Recebe AgentDefVersion (via CORE-002 AgentCatalogService) + LoadedContext (via
 * ContextLoaderService) + purpose, e produz um CompiledPromptResult auditável através do
 * PromptCompiler. NUNCA chama provider de LLM, nunca resolve API key, nunca executa o ciclo
 * cognitivo (isso é integração futura — §32/§33). Só compila.
 */
@Injectable()
export class PromptMasterService {
  private readonly compiler = new PromptCompiler();

  constructor(
    private readonly catalog: AgentCatalogService,
    private readonly contextLoader: ContextLoaderService,
    private readonly ledger: LlmInvocationLedgerService,
    private readonly prisma: PrismaService
  ) {}

  async compile(input: CompilePromptInput): Promise<CompilePromptOutput> {
    const agentDefVersion = await this.catalog.getVersion(input.agentDefinitionKey, input.agentDefinitionVersion);
    if (!agentDefVersion) throw new Error('CATALOG_AGENT_DEF_VERSION_NOT_FOUND');
    if (!agentDefVersion.publishedAt) throw new Error('CATALOG_AGENT_DEF_VERSION_NOT_PUBLISHED');

    const promptTemplate = await this.prisma.promptTemplate.findUnique({
      where: { key_version: { key: agentDefVersion.promptTemplateKey, version: agentDefVersion.promptTemplateVersion } },
    });
    if (!promptTemplate) throw new Error('CATALOG_PROMPT_TEMPLATE_NOT_FOUND');

    const loadedContext = await this.contextLoader.load({
      missionId: input.missionId,
      jobId: input.jobId,
      agentDefinitionKey: input.agentDefinitionKey,
      agentDefinitionVersion: input.agentDefinitionVersion,
    });

    const compiled = this.compiler.compile({
      agentDefinitionKey: input.agentDefinitionKey,
      agentDefVersion,
      promptTemplate,
      loadedContext,
      purpose: input.purpose,
      previousStepSummaries: input.previousStepSummaries,
      budget: input.budget,
      candidateReviewContext: input.candidateReviewContext,
    });

    let promptSnapshotId: string | null = null;
    if (input.persistSnapshot) {
      promptSnapshotId = await this.ledger.snapshotCompiledPrompt({
        missionId: input.missionId,
        jobId: input.jobId,
        agentExecutionId: input.agentExecutionId,
        agentDefinitionKey: compiled.refs.agentDefinitionKey,
        agentDefinitionVersion: compiled.refs.agentDefinitionVersion,
        promptTemplateKey: compiled.refs.promptTemplateKey,
        promptTemplateVersion: compiled.refs.promptTemplateVersion,
        purpose: compiled.purpose,
        contextHash: compiled.contextHash,
        compiledPromptHash: compiled.compiledPromptHash,
        outputSchemaKey: compiled.outputSchemaKey,
        inputVersionRefsJson: {
          jobId: compiled.refs.jobId,
          requirementIds: compiled.refs.requirementIds,
          artifactIds: compiled.refs.artifactIds,
          ...(input.candidateReviewContext ? {
            workspaceSessionId: input.candidateReviewContext.workspaceSessionId,
            candidateFingerprint: input.candidateReviewContext.candidateFingerprint,
            manifestHash: input.candidateReviewContext.manifestHash,
            changeSetHash: input.candidateReviewContext.changeSetHash,
            candidateFiles: input.candidateReviewContext.files.map((file) => ({ path: file.path, contentHash: file.contentHash })),
          } : {}),
        },
        capabilityRefs: compiled.refs.capabilityKeys,
        knowledgeRefs: compiled.refs.knowledgeRefs,
        artifactRefs: compiled.refs.artifactIds,
        contractRefs: compiled.refs.contractRefs,
        requirementRefs: compiled.refs.requirementIds,
      });
    }

    return { compiled, promptSnapshotId };
  }

  /** Mission-level PromptMaster path for CORE-012. It deliberately does not fabricate a
   * GenerationJob: AgentExecution/PromptSnapshot already support nullable job references. */
  async compileSolutionPlanning(input: CompileSolutionPlanningInput): Promise<CompileSolutionPlanningOutput> {
    const agent = await this.catalog.getVersion(input.agentDefinitionKey, input.agentDefinitionVersion);
    if (!agent) throw new Error('CATALOG_AGENT_DEF_VERSION_NOT_FOUND');
    if (!agent.publishedAt) throw new Error('CATALOG_AGENT_DEF_VERSION_NOT_PUBLISHED');
    const template = await this.prisma.promptTemplate.findUnique({
      where: { key_version: { key: agent.promptTemplateKey, version: agent.promptTemplateVersion } },
    });
    if (!template) throw new Error('CATALOG_PROMPT_TEMPLATE_NOT_FOUND');

    const systemText = [
      `IDENTITY: ${agent.roleMission}`,
      `BOUNDARIES: ${JSON.stringify(agent.boundariesJson)}`,
      `TRUSTED_PLATFORM_CONTEXT stack catalog: ${JSON.stringify(input.trustedStackCatalog)}`,
      SOLUTION_PLAN_RESULT_V1_SCHEMA,
      input.repairInstruction ? `SCHEMA REPAIR: ${input.repairInstruction}` : '',
    ].filter(Boolean).join('\n\n');
    const projectContext = {
      missionSummary: input.missionSummary,
      requirementBaseline: {
        id: input.requirementBaselineId,
        version: input.requirementBaselineVersion,
        hash: input.requirementBaselineHash,
        requirementsSnapshot: input.requirementsSnapshot,
      },
      scopeCoverageHash: input.scopeCoverageHash,
      scopeCoverage: input.scopeCoverage,
    };
    const userText = `UNTRUSTED_PROJECT_CONTEXT\n${JSON.stringify(projectContext)}\nEND_UNTRUSTED_PROJECT_CONTEXT`;
    const hash = (value: string) => createHash('sha256').update(value).digest('hex');
    const promptSnapshotId = await this.ledger.snapshotCompiledPrompt({
      missionId: input.missionId,
      agentExecutionId: input.agentExecutionId,
      agentDefinitionKey: input.agentDefinitionKey,
      agentDefinitionVersion: input.agentDefinitionVersion,
      promptTemplateKey: agent.promptTemplateKey,
      promptTemplateVersion: agent.promptTemplateVersion,
      purpose: input.repairInstruction ? 'REPAIR' : 'SOLUTION_PLANNING',
      contextHash: hash(JSON.stringify(projectContext)),
      compiledPromptHash: hash(`${systemText}\n---\n${userText}`),
      outputSchemaKey: 'SolutionPlanResultV1',
      inputVersionRefsJson: {
        requirementBaselineId: input.requirementBaselineId,
        requirementBaselineVersion: input.requirementBaselineVersion,
        requirementBaselineHash: input.requirementBaselineHash,
        scopeCoverageHash: input.scopeCoverageHash,
      },
      capabilityRefs: agent.capabilityKeysJson as string[],
      knowledgeRefs: agent.knowledgeRefsJson as string[],
      requirementRefs: input.requirementsSnapshot.map((item) => (item as { requirementId?: string }).requirementId).filter((id): id is string => !!id),
    });
    return { systemText, userText, promptSnapshotId };
  }

  async compileArchitectureOperation(input: CompileArchitectureOperationInput): Promise<CompileSolutionPlanningOutput> {
    const agent = await this.catalog.getVersion(input.agentDefinitionKey, input.agentDefinitionVersion);
    if (!agent || !agent.publishedAt) throw new Error('CATALOG_AGENT_DEF_VERSION_NOT_FOUND');
    const template = await this.prisma.promptTemplate.findUnique({ where: { key_version: { key: agent.promptTemplateKey, version: agent.promptTemplateVersion } } });
    if (!template) throw new Error('CATALOG_PROMPT_TEMPLATE_NOT_FOUND');
    const systemText = [`IDENTITY: ${agent.roleMission}`, `BOUNDARIES: ${JSON.stringify(agent.boundariesJson)}`, `TRUSTED_PLATFORM_CONTEXT: ${JSON.stringify(input.trustedContext)}`, input.outputSchema].join('\n\n');
    const userText = `UNTRUSTED_PROJECT_CONTEXT\n${JSON.stringify(input.untrustedContext)}\nEND_UNTRUSTED_PROJECT_CONTEXT`;
    const hash = (value: string) => createHash('sha256').update(value).digest('hex');
    const promptSnapshotId = await this.ledger.snapshotCompiledPrompt({
      missionId: input.missionId, agentExecutionId: input.agentExecutionId,
      agentDefinitionKey: input.agentDefinitionKey, agentDefinitionVersion: input.agentDefinitionVersion,
      promptTemplateKey: agent.promptTemplateKey, promptTemplateVersion: agent.promptTemplateVersion,
      purpose: input.purpose, contextHash: hash(JSON.stringify({ trusted: input.trustedContext, untrusted: input.untrustedContext })),
      compiledPromptHash: hash(`${systemText}\n---\n${userText}`), outputSchemaKey: input.outputSchemaKey,
      inputVersionRefsJson: input.inputVersionRefs, capabilityRefs: agent.capabilityKeysJson as string[],
      knowledgeRefs: agent.knowledgeRefsJson as string[], requirementRefs: input.requirementRefs,
    });
    return { systemText, userText, promptSnapshotId };
  }
}
