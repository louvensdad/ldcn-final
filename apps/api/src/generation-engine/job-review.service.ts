import { Inject, Injectable } from '@nestjs/common';
import { LLM_CLIENT, LlmClient } from '../assistant/deepseek-client';
import { PlannedJob } from './job-planner';
import { LlmInvocationLedgerService } from '../ledger/llm-invocation-ledger.service';

/** SLICE C1: contexto mínimo para ligar a chamada do reviewer ao ledger. */
export interface JobReviewContext {
  missionId: string;
  agentExecutionId?: string;
}

const REVIEWER_TIMEOUT_MS = 45_000;

export interface JobReviewResult {
  /** null = reviewer não rodou de verdade (falha de infraestrutura) — nunca confundido com uma
   * aprovação real. Um Job já validado estruturalmente nunca é reprovado só porque o reviewer
   * ficou indisponível (fail-open com disclosure, mesmo espírito do Security Gate). */
  approved: boolean | null;
  finding: string | null;
  ran: boolean;
  errorCode: string | null;
}

const OUTPUT_SCHEMA = `Responda SOMENTE com um objeto JSON válido, sem markdown, exatamente neste formato:
{"approved": boolean, "finding": string | null}
"approved": true se o método implementa corretamente a regra de negócio descrita (lógica certa, casos óbvios cobertos com razoabilidade). false só para um erro real e concreto de lógica — nunca por estilo, nomenclatura ou preferência.
"finding": obrigatório quando approved=false, explicando o erro real encontrado; null quando approved=true.`;

const SYSTEM_PROMPT = `Você é o Independent Reviewer do LDCN OS — um segundo agente cognitivo, nunca o mesmo que implementou o código, revisando SÓ a corretude da lógica de negócio (não segurança, não estilo). Você recebe a regra de negócio original e o método que outro agente escreveu para implementá-la. Sua única pergunta: esse código faz o que a regra pede, com uma lógica correta? ${OUTPUT_SCHEMA}`;

/**
 * MISSÃO "Independent Reviewer agent por Job" — o passo real que faltava no ciclo ANALYZE→PLAN→
 * PROPOSE→IMPLEMENT→Build/Test→Evidence→Independent Review→Gate: antes de um Job IMPLEMENTED ser
 * aceito como final, um SEGUNDO agente cognitivo real (papel diferente do que implementou) revisa
 * se a lógica realmente faz o que a regra de negócio pede — nunca o mesmo agente validando o
 * próprio trabalho.
 */
@Injectable()
export class JobReviewService {
  private reviewerTimeoutMs = REVIEWER_TIMEOUT_MS;

  constructor(
    @Inject(LLM_CLIENT) private readonly llm: LlmClient,
    private readonly ledger: LlmInvocationLedgerService
  ) {}

  async review(job: PlannedJob, implementedContent: string, ctx: JobReviewContext): Promise<JobReviewResult> {
    const user = `Regra de negócio: "${job.requirementText}"\n\nArquivo implementado (${job.targetFile}):\n\`\`\`typescript\n${implementedContent}\n\`\`\``;

    const promptSnapshotId = await this.ledger.snapshotPrompt({
      missionId: ctx.missionId,
      agentExecutionId: ctx.agentExecutionId,
      promptType: 'job.review',
      promptVersion: 'v1',
      contextForHash: { requirementText: job.requirementText, targetFile: job.targetFile, implementedContent },
      system: SYSTEM_PROMPT,
      user,
      refs: { requirementId: job.requirementId, targetFile: job.targetFile },
    });
    const invocationId = await this.ledger.startInvocation({
      missionId: ctx.missionId,
      agentExecutionId: ctx.agentExecutionId,
      purpose: 'job.review',
      promptSnapshotId,
    });

    try {
      const result = await this.completeWithTimeout(SYSTEM_PROMPT, user);
      await this.ledger.completeInvocation(invocationId, {
        provider: 'deepseek',
        model: result.model,
        inputTokens: result.promptTokens,
        outputTokens: result.completionTokens,
      });

      const parsed = this.parseJson<{ approved: boolean; finding: string | null }>(result.text);
      if (!parsed || typeof parsed.approved !== 'boolean') {
        return { approved: null, finding: null, ran: false, errorCode: 'REVIEWER_MALFORMED_RESPONSE' };
      }
      return { approved: parsed.approved, finding: parsed.finding ?? null, ran: true, errorCode: null };
    } catch (err) {
      const errorCode = err instanceof Error && err.message === 'REVIEWER_TIMEOUT' ? 'REVIEWER_TIMEOUT' : 'REVIEWER_AI_UNAVAILABLE';
      await this.ledger.failInvocation(invocationId, errorCode);
      return { approved: null, finding: null, ran: false, errorCode };
    }
  }

  private completeWithTimeout(system: string, user: string): Promise<{ text: string; model: string; promptTokens: number; completionTokens: number }> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('REVIEWER_TIMEOUT')), this.reviewerTimeoutMs);
      this.llm.complete({ system, user, responseFormat: 'json_object' }).then(
        (result) => { clearTimeout(timer); resolve(result); },
        (err) => { clearTimeout(timer); reject(err); }
      );
    });
  }

  private parseJson<T>(text: string): T | null {
    try {
      const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '');
      return JSON.parse(cleaned) as T;
    } catch {
      return null;
    }
  }
}
