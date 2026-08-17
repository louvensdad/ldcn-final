import { Injectable } from '@nestjs/common';
import { PrismaService } from '../persistence/prisma.service';
import { decryptCredential } from '../security/credential-crypto';

export interface LlmCompletionRequest {
  system: string;
  user: string;
  /** Discovery needs strict JSON turns; explain-* callers omit this and get free-text as before. */
  responseFormat?: 'json_object';
}

export interface LlmCompletionResult {
  text: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
}

/** Injection token — swappable for a fake in tests, real calls stay out of the automated suite (cost real money). */
export interface LlmClient {
  complete(input: LlmCompletionRequest): Promise<LlmCompletionResult>;
}

export const LLM_CLIENT = 'LLM_CLIENT';

interface DeepSeekChatResponse {
  model: string;
  choices: { message: { content: string } }[];
  usage: { prompt_tokens: number; completion_tokens: number };
}

/**
 * DeepSeek's Chat Completions API is OpenAI-compatible — same request/response shape, different
 * base URL. Fase 13: the credential is resolved fresh on every call — a workspace-saved key
 * (Configurações → IA e Providers) always wins over the server's DEEPSEEK_API_KEY, so revoking or
 * replacing it from the UI takes effect immediately with no restart.
 */
@Injectable()
export class DeepSeekClient implements LlmClient {
  private readonly baseUrl = 'https://api.deepseek.com';

  constructor(private readonly prisma: PrismaService) {}

  private async resolveCredential(): Promise<{ apiKey: string; model: string } | null> {
    const row = await this.prisma.providerCredential.findUnique({ where: { provider: 'deepseek' } });
    if (row) return { apiKey: decryptCredential(row.encryptedKey), model: row.model ?? process.env.DEEPSEEK_MODEL ?? 'deepseek-chat' };
    const envKey = process.env.DEEPSEEK_API_KEY;
    if (envKey) return { apiKey: envKey, model: process.env.DEEPSEEK_MODEL ?? 'deepseek-chat' };
    return null;
  }

  async complete(input: LlmCompletionRequest): Promise<LlmCompletionResult> {
    const credential = await this.resolveCredential();
    if (!credential) throw new Error('AI_EXPLANATION_UNAVAILABLE');
    const { apiKey, model } = credential;

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: input.system },
            { role: 'user', content: input.user },
          ],
          temperature: 0.3,
          ...(input.responseFormat ? { response_format: { type: input.responseFormat } } : {}),
        }),
        // 90s: JSON-mode callers with large contexts (e.g. Marketplace Customizer, which sends the
        // full reference-requirements list) routinely exceed the 15s that free-text explain-* calls need,
        // and real DeepSeek latency for this payload size varies widely (observed 15-65s in testing).
        signal: AbortSignal.timeout(90000),
      });
    } catch (e) {
      if (process.env.MKT_DEBUG) console.error('DEEPSEEK_FETCH_ERROR', e);
      throw new Error('AI_EXPLANATION_UNAVAILABLE');
    }

    if (!response.ok) {
      if (process.env.MKT_DEBUG) console.error('DEEPSEEK_HTTP_ERROR', response.status, await response.text().catch(() => ''));
      throw new Error('AI_EXPLANATION_UNAVAILABLE');
    }

    let parsed: DeepSeekChatResponse;
    try {
      parsed = (await response.json()) as DeepSeekChatResponse;
    } catch (e) {
      if (process.env.MKT_DEBUG) console.error('DEEPSEEK_JSON_PARSE_ERROR', e);
      throw new Error('AI_EXPLANATION_UNAVAILABLE');
    }

    const text = parsed.choices?.[0]?.message?.content;
    if (!text) throw new Error('AI_EXPLANATION_UNAVAILABLE');

    return {
      text,
      model: parsed.model ?? model,
      promptTokens: parsed.usage?.prompt_tokens ?? 0,
      completionTokens: parsed.usage?.completion_tokens ?? 0,
    };
  }
}
