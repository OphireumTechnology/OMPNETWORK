/**
 * OPHIREUM NETWORK — AI Provider Reliability & Cost Governance (Phase 58)
 *
 * Enforces:
 * - Explicit response origin classification:
 *     LIVE_PROVIDER_RESPONSE | DEVELOPMENT_SIMULATION | PROVIDER_UNAVAILABLE
 * - Configurable per-agent token limits, per-tenant usage limits, daily & monthly spend caps,
 *   concurrent execution limits, and administrative emergency suspension.
 * - Supported Gemini model identifiers per official @google/genai configuration.
 */

export type AiProviderExecutionClassification =
  | 'LIVE_PROVIDER_RESPONSE'
  | 'DEVELOPMENT_SIMULATION'
  | 'PROVIDER_UNAVAILABLE';

export interface AiGovernanceLimitConfig {
  scopeKey: string;
  scopeType: 'global' | 'agent' | 'tenant';
  maxTokensPerRequest: number;
  dailySpendCapUsd: number;
  monthlySpendCapUsd: number;
  maxConcurrentExecutions: number;
  emergencySuspended: boolean;
  suspensionReason?: string;
  updatedBy?: string;
  updatedAt: string;
}

export interface AiGovernanceCheckResult {
  allowed: boolean;
  code?: 'AI_EMERGENCY_SUSPENDED' | 'AI_CONCURRENCY_EXCEEDED' | 'AI_TOKEN_LIMIT_EXCEEDED' | 'AI_BUDGET_EXCEEDED';
  reason?: string;
  effectiveLimit: AiGovernanceLimitConfig;
}

export const SUPPORTED_GEMINI_MODELS = Object.freeze({
  textPrimary: process.env.GEMINI_TEXT_MODEL || 'gemini-4-hydrogen',
  textReasoning: process.env.GEMINI_REASONING_MODEL || 'gemini-4-neon',
  liveVoice: process.env.GEMINI_LIVE_MODEL || 'gemini-3.8-live',
  transcription: process.env.GEMINI_TRANSCRIBE_MODEL || 'gemini-3.5-transcribe',
  tts: process.env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-lite-tts',
  embedding: process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-2',
});

export class AiProviderGovernanceService {
  private readonly limits = new Map<string, AiGovernanceLimitConfig>();
  private readonly dailySpendByScope = new Map<string, { day: string; usd: number }>();
  private readonly monthlySpendByScope = new Map<string, { month: string; usd: number }>();
  private activeExecutions = 0;

  constructor() {
    const now = new Date().toISOString();
    this.limits.set('global', {
      scopeKey: 'global',
      scopeType: 'global',
      maxTokensPerRequest: Number(process.env.AI_MAX_TOKENS_PER_REQUEST || 8192),
      dailySpendCapUsd: Number(process.env.AI_DAILY_SPEND_CAP_USD || 25),
      monthlySpendCapUsd: Number(process.env.AI_MONTHLY_SPEND_CAP_USD || 500),
      maxConcurrentExecutions: Number(process.env.AI_MAX_CONCURRENT_EXECUTIONS || 10),
      emergencySuspended: process.env.AI_EMERGENCY_SUSPENDED === 'true',
      suspensionReason: process.env.AI_EMERGENCY_SUSPENDED === 'true' ? 'Environment emergency kill switch active' : undefined,
      updatedAt: now,
    });
  }

  getLimit(scopeKey = 'global'): AiGovernanceLimitConfig {
    return this.limits.get(scopeKey) || this.limits.get('global')!;
  }

  listLimits(): AiGovernanceLimitConfig[] {
    return Array.from(this.limits.values());
  }

  updateLimit(
    scopeKey: string,
    patch: Partial<Omit<AiGovernanceLimitConfig, 'scopeKey' | 'updatedAt'>> & {
      scopeType?: 'global' | 'agent' | 'tenant';
    }
  ): AiGovernanceLimitConfig {
    const existing = this.limits.get(scopeKey) || {
      ...this.limits.get('global')!,
      scopeKey,
      scopeType: patch.scopeType || (scopeKey === 'global' ? 'global' : scopeKey.startsWith('A') ? 'agent' : 'tenant'),
    };

    const next: AiGovernanceLimitConfig = {
      ...existing,
      maxTokensPerRequest:
        patch.maxTokensPerRequest !== undefined
          ? Math.max(256, Math.min(128_000, Math.round(patch.maxTokensPerRequest)))
          : existing.maxTokensPerRequest,
      dailySpendCapUsd:
        patch.dailySpendCapUsd !== undefined ? Math.max(0, Number(patch.dailySpendCapUsd)) : existing.dailySpendCapUsd,
      monthlySpendCapUsd:
        patch.monthlySpendCapUsd !== undefined
          ? Math.max(0, Number(patch.monthlySpendCapUsd))
          : existing.monthlySpendCapUsd,
      maxConcurrentExecutions:
        patch.maxConcurrentExecutions !== undefined
          ? Math.max(1, Math.min(200, Math.round(patch.maxConcurrentExecutions)))
          : existing.maxConcurrentExecutions,
      emergencySuspended:
        patch.emergencySuspended !== undefined ? Boolean(patch.emergencySuspended) : existing.emergencySuspended,
      suspensionReason:
        patch.emergencySuspended === false
          ? undefined
          : patch.suspensionReason !== undefined
            ? patch.suspensionReason
            : existing.suspensionReason,
      updatedBy: patch.updatedBy || existing.updatedBy,
      updatedAt: new Date().toISOString(),
    };

    this.limits.set(scopeKey, next);
    return next;
  }

  evaluateExecution(input: {
    agentCode?: string;
    tenantKey?: string;
    estimatedTokens?: number;
  }): AiGovernanceCheckResult {
    const globalCfg = this.getLimit('global');
    const agentCfg = input.agentCode ? this.limits.get(input.agentCode) : undefined;
    const tenantCfg = input.tenantKey ? this.limits.get(`tenant:${input.tenantKey}`) : undefined;

    for (const cfg of [globalCfg, agentCfg, tenantCfg].filter(Boolean) as AiGovernanceLimitConfig[]) {
      if (cfg.emergencySuspended) {
        return {
          allowed: false,
          code: 'AI_EMERGENCY_SUSPENDED',
          reason: cfg.suspensionReason || `AI execution suspended for scope ${cfg.scopeKey}.`,
          effectiveLimit: cfg,
        };
      }
      if (this.activeExecutions >= cfg.maxConcurrentExecutions) {
        return {
          allowed: false,
          code: 'AI_CONCURRENCY_EXCEEDED',
          reason: `Concurrent AI execution limit (${cfg.maxConcurrentExecutions}) reached for ${cfg.scopeKey}.`,
          effectiveLimit: cfg,
        };
      }
      if (input.estimatedTokens && input.estimatedTokens > cfg.maxTokensPerRequest) {
        return {
          allowed: false,
          code: 'AI_TOKEN_LIMIT_EXCEEDED',
          reason: `Estimated token usage (${input.estimatedTokens}) exceeds configured cap (${cfg.maxTokensPerRequest}) for ${cfg.scopeKey}.`,
          effectiveLimit: cfg,
        };
      }

      const today = new Date().toISOString().slice(0, 10);
      const month = today.slice(0, 7);
      const daily = this.dailySpendByScope.get(cfg.scopeKey);
      const monthly = this.monthlySpendByScope.get(cfg.scopeKey);
      const dailyUsed = daily && daily.day === today ? daily.usd : 0;
      const monthlyUsed = monthly && monthly.month === month ? monthly.usd : 0;

      if (cfg.dailySpendCapUsd > 0 && dailyUsed >= cfg.dailySpendCapUsd) {
        return {
          allowed: false,
          code: 'AI_BUDGET_EXCEEDED',
          reason: `Daily AI spending cap ($${cfg.dailySpendCapUsd.toFixed(2)}) reached for ${cfg.scopeKey}.`,
          effectiveLimit: cfg,
        };
      }
      if (cfg.monthlySpendCapUsd > 0 && monthlyUsed >= cfg.monthlySpendCapUsd) {
        return {
          allowed: false,
          code: 'AI_BUDGET_EXCEEDED',
          reason: `Monthly AI spending cap ($${cfg.monthlySpendCapUsd.toFixed(2)}) reached for ${cfg.scopeKey}.`,
          effectiveLimit: cfg,
        };
      }
    }

    return { allowed: true, effectiveLimit: agentCfg || tenantCfg || globalCfg };
  }

  beginExecution(): () => void {
    this.activeExecutions += 1;
    let released = false;
    return () => {
      if (!released) {
        released = true;
        this.activeExecutions = Math.max(0, this.activeExecutions - 1);
      }
    };
  }

  recordUsageCost(scopeKeys: string[], costUsd: number): void {
    if (!Number.isFinite(costUsd) || costUsd <= 0) return;
    const today = new Date().toISOString().slice(0, 10);
    const month = today.slice(0, 7);
    for (const key of new Set(['global', ...scopeKeys])) {
      const prevD = this.dailySpendByScope.get(key);
      this.dailySpendByScope.set(key, {
        day: today,
        usd: (prevD && prevD.day === today ? prevD.usd : 0) + costUsd,
      });
      const prevM = this.monthlySpendByScope.get(key);
      this.monthlySpendByScope.set(key, {
        month,
        usd: (prevM && prevM.month === month ? prevM.usd : 0) + costUsd,
      });
    }
  }

  getSnapshot() {
    const today = new Date().toISOString().slice(0, 10);
    const month = today.slice(0, 7);
    const gDaily = this.dailySpendByScope.get('global');
    const gMonthly = this.monthlySpendByScope.get('global');
    return {
      models: SUPPORTED_GEMINI_MODELS,
      activeExecutions: this.activeExecutions,
      globalDailySpendUsd: Number((gDaily && gDaily.day === today ? gDaily.usd : 0).toFixed(4)),
      globalMonthlySpendUsd: Number((gMonthly && gMonthly.month === month ? gMonthly.usd : 0).toFixed(4)),
      limits: this.listLimits(),
    };
  }
}

export function classifyAiExecutionOrigin(options: {
  geminiConfigured: boolean;
  liveSucceeded: boolean;
  providerFailed?: boolean;
}): AiProviderExecutionClassification {
  if (options.liveSucceeded) return 'LIVE_PROVIDER_RESPONSE';
  if (options.providerFailed || (options.geminiConfigured && !options.liveSucceeded)) {
    return 'PROVIDER_UNAVAILABLE';
  }
  return 'DEVELOPMENT_SIMULATION';
}
