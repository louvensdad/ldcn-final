import { randomUUID } from 'node:crypto';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../persistence/prisma.service';
import { encryptCredential, decryptCredential, maskCredential } from '../security/credential-crypto';
import { LLM_CLIENT, LlmClient } from '../assistant/deepseek-client';

/** Fase 13: only providers the backend can actually call. "Claude, Gemini etc." stay unlisted until real. */
export const SUPPORTED_PROVIDERS = ['deepseek'] as const;
export type SupportedProvider = (typeof SUPPORTED_PROVIDERS)[number];

const DISPLAY_NAME: Record<SupportedProvider, string> = { deepseek: 'DeepSeek' };
const ENV_KEY: Record<SupportedProvider, string> = { deepseek: 'DEEPSEEK_API_KEY' };
const ENV_MODEL: Record<SupportedProvider, string> = { deepseek: 'DEEPSEEK_MODEL' };
const DEFAULT_MODEL: Record<SupportedProvider, string> = { deepseek: 'deepseek-chat' };

export interface ProviderView {
  provider: SupportedProvider;
  displayName: string;
  configured: boolean;
  source: 'workspace' | 'server' | 'none';
  keyPreview: string | null;
  model: string;
  status: 'connected' | 'failed' | 'untested' | 'unconfigured';
  lastTestedAt: Date | null;
  usage: { calls: number; totalTokens: number };
}

export interface TestResult {
  success: boolean;
  latencyMs?: number;
  model?: string;
  reason?: string;
}

function isSupported(provider: string): provider is SupportedProvider {
  return (SUPPORTED_PROVIDERS as readonly string[]).includes(provider);
}

@Injectable()
export class ProviderCredentialPersistenceService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(LLM_CLIENT) private readonly llm: LlmClient
  ) {}

  async list(): Promise<ProviderView[]> {
    return Promise.all(SUPPORTED_PROVIDERS.map((provider) => this.get(provider)));
  }

  async get(provider: string): Promise<ProviderView> {
    if (!isSupported(provider)) throw new NotFoundException('PROVIDER_NOT_SUPPORTED');
    const row = await this.prisma.providerCredential.findUnique({ where: { provider } });
    const usage = await this.usage(provider);

    if (row) {
      return {
        provider,
        displayName: DISPLAY_NAME[provider],
        configured: true,
        source: 'workspace',
        keyPreview: row.keyPreview,
        model: row.model ?? process.env[ENV_MODEL[provider]] ?? DEFAULT_MODEL[provider],
        status: row.status as ProviderView['status'],
        lastTestedAt: row.lastTestedAt,
        usage,
      };
    }

    const envKey = process.env[ENV_KEY[provider]];
    if (envKey) {
      return {
        provider,
        displayName: DISPLAY_NAME[provider],
        configured: true,
        source: 'server',
        keyPreview: maskCredential(envKey),
        model: process.env[ENV_MODEL[provider]] ?? DEFAULT_MODEL[provider],
        status: 'untested',
        lastTestedAt: null,
        usage,
      };
    }

    return {
      provider,
      displayName: DISPLAY_NAME[provider],
      configured: false,
      source: 'none',
      keyPreview: null,
      model: process.env[ENV_MODEL[provider]] ?? DEFAULT_MODEL[provider],
      status: 'unconfigured',
      lastTestedAt: null,
      usage,
    };
  }

  async save(provider: string, apiKey: string, model: string | undefined): Promise<ProviderView> {
    if (!isSupported(provider)) throw new NotFoundException('PROVIDER_NOT_SUPPORTED');
    const trimmed = apiKey.trim();
    if (!trimmed) throw new Error('API_KEY_REQUIRED');
    const existed = (await this.prisma.providerCredential.findUnique({ where: { provider } })) !== null;

    await this.prisma.providerCredential.upsert({
      where: { provider },
      create: {
        provider,
        encryptedKey: encryptCredential(trimmed),
        keyPreview: maskCredential(trimmed),
        model: model?.trim() || null,
        status: 'untested',
      },
      update: {
        encryptedKey: encryptCredential(trimmed),
        keyPreview: maskCredential(trimmed),
        model: model?.trim() || null,
        status: 'untested',
        lastTestedAt: null,
      },
    });
    await this.audit(provider, existed ? 'UPDATED' : 'ADDED', undefined);
    return this.get(provider);
  }

  async revoke(provider: string): Promise<ProviderView> {
    if (!isSupported(provider)) throw new NotFoundException('PROVIDER_NOT_SUPPORTED');
    await this.prisma.providerCredential.deleteMany({ where: { provider } });
    await this.audit(provider, 'REVOKED', undefined);
    return this.get(provider);
  }

  /**
   * Calls the real provider through the same LLM_CLIENT the assistant explain-* endpoints use —
   * DeepSeekClient itself resolves DB-first/env-fallback (see deepseek-client.ts), so this tests
   * whatever is actually active, not a copy of the logic.
   */
  async test(provider: string): Promise<TestResult> {
    if (!isSupported(provider)) throw new NotFoundException('PROVIDER_NOT_SUPPORTED');
    const view = await this.get(provider);
    if (!view.configured) {
      await this.audit(provider, 'TESTED', false);
      return { success: false, reason: 'NOT_CONFIGURED' };
    }

    const startedAt = Date.now();
    try {
      const result = await this.llm.complete({
        system: 'Responda apenas "ok".',
        user: 'Teste de conexão do LDCN OS. Responda apenas "ok".',
      });
      const latencyMs = Date.now() - startedAt;
      await this.markTested(provider, true);
      await this.audit(provider, 'TESTED', true);
      return { success: true, latencyMs, model: result.model };
    } catch {
      await this.markTested(provider, false);
      await this.audit(provider, 'TESTED', false);
      return { success: false, reason: 'CONNECTION_FAILED' };
    }
  }

  private async markTested(provider: SupportedProvider, success: boolean): Promise<void> {
    const row = await this.prisma.providerCredential.findUnique({ where: { provider } });
    if (!row) return; // server-env-only credential: nothing to persist status onto
    await this.prisma.providerCredential.update({
      where: { provider },
      data: { status: success ? 'connected' : 'failed', lastTestedAt: new Date() },
    });
  }

  private async usage(provider: SupportedProvider): Promise<{ calls: number; totalTokens: number }> {
    const events = await this.prisma.decisionEvent.findMany({
      where: { eventType: 'AI_EXPLANATION_GENERATED' },
      select: { payload: true },
      take: 10000,
    });
    let calls = 0;
    let totalTokens = 0;
    for (const event of events) {
      const payload = event.payload as { provider?: string; totalUnits?: number };
      if (payload.provider !== provider) continue;
      calls += 1;
      totalTokens += payload.totalUnits ?? 0;
    }
    return { calls, totalTokens };
  }

  private async audit(provider: string, action: 'ADDED' | 'UPDATED' | 'TESTED' | 'REVOKED', success: boolean | undefined): Promise<void> {
    await this.prisma.providerCredentialAudit.create({
      data: { id: randomUUID(), provider, action, success: success ?? null },
    });
  }
}
