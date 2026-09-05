import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { env } from '../../config/env';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Thin OpenRouter client (plan appendix B.1). Model choice and the budget
 * floor are env-driven (`OPENROUTER_CHAT_MODEL` / `_FALLBACK` / `_MIN_BALANCE_USD`)
 * so ops can retune spend without a redeploy. Embeddings are the one call
 * that's essentially always paid (cents for a corpus this size); chat tries
 * the configured model first, falls back to a second model on failure. A
 * balance guard hard-stops all calls once the key's remaining credit drops
 * below the floor, checked against the live account rather than a local
 * running total that could drift.
 */
@Injectable()
export class OpenRouterService {
  private readonly logger = new Logger(OpenRouterService.name);
  private readonly http: AxiosInstance;
  private lastBalanceCheck = 0;
  private haltedForBudget = false;

  static readonly CHAT_MODEL = env.openRouterChatModel;
  static readonly CHAT_MODEL_FALLBACK = env.openRouterChatModelFallback;
  static readonly ROUTER_MODEL = env.openRouterRouterModel;
  static readonly EMBED_MODEL = env.openRouterEmbedModel;
  private static readonly BALANCE_CHECK_INTERVAL_MS = 60_000;

  constructor() {
    this.http = axios.create({
      baseURL: 'https://openrouter.ai/api/v1',
      headers: {
        Authorization: `Bearer ${env.openRouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://edu-visa.local',
        'X-Title': 'Edu-Visa Assistant',
      },
      timeout: 30_000,
    });
  }

  /** Refuses to spend once remaining credit drops below the floor. Cached briefly. */
  private async assertBudget(): Promise<void> {
    if (this.haltedForBudget) throw new Error('OpenRouter budget guard: halted, remaining credit below floor');
    if (!env.openRouterApiKey) throw new Error('OPENROUTER_API_KEY not configured');
    const now = Date.now();
    if (now - this.lastBalanceCheck < OpenRouterService.BALANCE_CHECK_INTERVAL_MS) return;
    this.lastBalanceCheck = now;
    try {
      const { data } = await this.http.get('/auth/key');
      const remaining = data?.data?.limit_remaining;
      if (typeof remaining === 'number' && remaining < env.openRouterMinBalanceUsd) {
        this.haltedForBudget = true;
        this.logger.warn(`Budget guard tripped: $${remaining.toFixed(2)} remaining < floor $${env.openRouterMinBalanceUsd}`);
        throw new Error('OpenRouter budget guard: remaining credit below floor');
      }
    } catch (e) {
      if (this.haltedForBudget) throw e;
      this.logger.warn(`Balance check failed (continuing): ${(e as Error).message}`);
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    await this.assertBudget();
    const { data } = await this.http.post('/embeddings', {
      model: OpenRouterService.EMBED_MODEL,
      input: texts,
    });
    return data.data.map((d: { embedding: number[] }) => d.embedding);
  }

  async chat(
    messages: ChatMessage[],
    opts: { model?: string; maxTokens?: number; temperature?: number } = {},
  ): Promise<string> {
    await this.assertBudget();
    const models = opts.model
      ? [opts.model]
      : [OpenRouterService.CHAT_MODEL, OpenRouterService.CHAT_MODEL_FALLBACK];
    let lastErr: unknown;
    for (const model of models) {
      try {
        const { data } = await this.http.post('/chat/completions', {
          model,
          messages,
          max_tokens: opts.maxTokens ?? 700,
          temperature: opts.temperature ?? 0.3,
        });
        const content = data?.choices?.[0]?.message?.content;
        if (!content) throw new Error('empty completion');
        return content;
      } catch (e) {
        const msg = axios.isAxiosError(e) ? JSON.stringify(e.response?.data ?? e.message) : String(e);
        this.logger.warn(`chat() failed on ${model}, trying next: ${msg}`);
        lastErr = e;
      }
    }
    this.logger.error(`chat() exhausted all models: ${(lastErr as Error)?.message}`);
    throw lastErr;
  }
}
