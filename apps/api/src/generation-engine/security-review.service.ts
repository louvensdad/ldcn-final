import { Inject, Injectable } from '@nestjs/common';
import { LLM_CLIENT, LlmClient } from '../assistant/deepseek-client';
import { LlmInvocationLedgerService } from '../ledger/llm-invocation-ledger.service';

const REVIEWER_TIMEOUT_MS = 45_000;

export type SecuritySeverity = 'INFO' | 'ADVISORY' | 'WARNING' | 'BLOCKER';

export interface SecurityReviewFinding {
  code: string;
  severity: SecuritySeverity;
  file: string;
  finding: string;
}

export interface SecurityReviewResult {
  ran: boolean;
  findings: SecurityReviewFinding[];
  errorCode: string | null;
}

export interface AgentAuthoredFile {
  targetFile: string;
  requirementText: string;
  content: string;
}

const OUTPUT_SCHEMA = `Responda SOMENTE com um objeto JSON válido, sem markdown, exatamente neste formato:
{"findings": [{"code": string, "severity": "INFO" | "ADVISORY" | "WARNING" | "BLOCKER", "file": string, "finding": string}]}
Use BLOCKER só para uma vulnerabilidade real e concreta introduzida por ESTE código específico (nunca por limitações já conhecidas do resto do projeto, como ausência de autenticação — isso já é uma limitação disclosed desta versão, não um achado novo). Se não encontrar nada real, retorne {"findings": []} — nunca invente achado para preencher.`;

const SYSTEM_PROMPT = `Você é o Security Reviewer do LDCN OS. Revise SOMENTE o código abaixo, que foi escrito por outro agente cognitivo para implementar uma regra de negócio específica (não o resto do projeto, que é scaffold determinístico já conhecido e fora do escopo desta revisão). Procure vulnerabilidades reais introduzidas por este código: injeção, cálculo com dado não validado que pode ser explorado, exposição de dado sensível, lógica insegura. ${OUTPUT_SCHEMA}`;

/**
 * MISSÃO "Security Gate real antes da entrega" — "Agente pensa com LLM." — revisa só o que um
 * agente cognitivo realmente escreveu (os Jobs IMPLEMENTED), nunca o scaffold determinístico
 * inteiro (isso geraria falso-positivo constante sobre limitações já disclosed, como ausência de
 * autenticação — ver README gerado). Uma chamada real por missão, cobrindo todos os Jobs juntos.
 */
@Injectable()
export class SecurityReviewService {
  private reviewerTimeoutMs = REVIEWER_TIMEOUT_MS;

  constructor(
    @Inject(LLM_CLIENT) private readonly llm: LlmClient,
    private readonly ledger: LlmInvocationLedgerService
  ) {}

  async reviewAgentAuthoredCode(files: AgentAuthoredFile[], missionId: string): Promise<SecurityReviewResult> {
    if (files.length === 0) return { ran: false, findings: [], errorCode: null };

    const user = files
      .map((f) => `Arquivo: ${f.targetFile}\nRegra de negócio implementada: "${f.requirementText}"\n\`\`\`typescript\n${f.content}\n\`\`\``)
      .join('\n\n---\n\n');

    const promptSnapshotId = await this.ledger.snapshotPrompt({
      missionId,
      promptType: 'security.review',
      promptVersion: 'v1',
      contextForHash: { files: files.map((f) => ({ targetFile: f.targetFile, requirementText: f.requirementText, content: f.content })) },
      system: SYSTEM_PROMPT,
      user,
      refs: { fileCount: String(files.length) },
    });
    const invocationId = await this.ledger.startInvocation({
      missionId,
      purpose: 'security.review',
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

      const parsed = this.parseJson<{ findings: SecurityReviewFinding[] }>(result.text);
      if (!parsed || !Array.isArray(parsed.findings)) return { ran: false, findings: [], errorCode: 'SECURITY_REVIEWER_MALFORMED_RESPONSE' };
      return { ran: true, findings: parsed.findings.filter((f) => f.code && f.severity && f.finding), errorCode: null };
    } catch (err) {
      const errorCode = err instanceof Error && err.message === 'SECURITY_REVIEWER_TIMEOUT' ? 'SECURITY_REVIEWER_TIMEOUT' : 'SECURITY_REVIEWER_AI_UNAVAILABLE';
      await this.ledger.failInvocation(invocationId, errorCode);
      return { ran: false, findings: [], errorCode };
    }
  }

  private completeWithTimeout(system: string, user: string): Promise<{ text: string; model: string; promptTokens: number; completionTokens: number }> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('SECURITY_REVIEWER_TIMEOUT')), this.reviewerTimeoutMs);
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
