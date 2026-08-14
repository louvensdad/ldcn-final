export interface LlmCompletionRequest {
  system: string;
  user: string;
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

/** DeepSeek's Chat Completions API is OpenAI-compatible — same request/response shape, different base URL. */
export class DeepSeekClient implements LlmClient {
  private readonly baseUrl = 'https://api.deepseek.com';

  async complete(input: LlmCompletionRequest): Promise<LlmCompletionResult> {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error('AI_EXPLANATION_UNAVAILABLE');
    const model = process.env.DEEPSEEK_MODEL ?? 'deepseek-chat';

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
        }),
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw new Error('AI_EXPLANATION_UNAVAILABLE');
    }

    if (!response.ok) throw new Error('AI_EXPLANATION_UNAVAILABLE');

    let parsed: DeepSeekChatResponse;
    try {
      parsed = (await response.json()) as DeepSeekChatResponse;
    } catch {
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
