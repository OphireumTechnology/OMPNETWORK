import crypto from 'crypto';

export type ErrorCategory =
  | 'VALIDATION_ERROR'
  | 'AUTH_REQUIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'EXTERNAL_PROVIDER_UNAVAILABLE'
  | 'CIRCUIT_OPEN'
  | 'TIMEOUT'
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCategory;
  public readonly retryable: boolean;
  public readonly details?: Record<string, unknown>;

  constructor(opts: {
    message: string;
    statusCode: number;
    code: ErrorCategory;
    retryable?: boolean;
    details?: Record<string, unknown>;
  }) {
    super(opts.message);
    this.name = 'AppError';
    this.statusCode = opts.statusCode;
    this.code = opts.code;
    this.retryable = Boolean(opts.retryable);
    this.details = opts.details;
  }
}

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerSnapshot {
  name: string;
  state: CircuitState;
  failureCount: number;
  successCount: number;
  failureThreshold: number;
  cooldownMs: number;
  lastFailureAt: string | null;
  openedAt: string | null;
}

export class CircuitBreaker {
  public readonly name: string;
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureAt: number | null = null;
  private openedAt: number | null = null;
  private readonly failureThreshold: number;
  private readonly cooldownMs: number;

  constructor(
    name: string,
    options?: {
      failureThreshold?: number;
      cooldownMs?: number;
    }
  ) {
    this.name = name;
    this.failureThreshold = Math.max(1, options?.failureThreshold ?? 5);
    this.cooldownMs = Math.max(500, options?.cooldownMs ?? 30_000);
  }

  public getState(nowMs = Date.now()): CircuitState {
    if (this.state === 'OPEN' && this.openedAt !== null && nowMs - this.openedAt >= this.cooldownMs) {
      this.state = 'HALF_OPEN';
    }
    return this.state;
  }

  public canExecute(nowMs = Date.now()): boolean {
    const current = this.getState(nowMs);
    return current === 'CLOSED' || current === 'HALF_OPEN';
  }

  public recordSuccess(): void {
    this.failureCount = 0;
    this.successCount += 1;
    this.state = 'CLOSED';
    this.openedAt = null;
  }

  public recordFailure(nowMs = Date.now()): void {
    this.failureCount += 1;
    this.lastFailureAt = nowMs;
    if (this.state === 'HALF_OPEN' || this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.openedAt = nowMs;
    }
  }

  public async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.canExecute()) {
      throw new AppError({
        message: `Upstream provider "${this.name}" is temporarily unavailable (circuit open).`,
        statusCode: 503,
        code: 'CIRCUIT_OPEN',
        retryable: true,
      });
    }
    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (err) {
      this.recordFailure();
      throw err;
    }
  }

  public reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureAt = null;
    this.openedAt = null;
  }

  public getSnapshot(nowMs = Date.now()): CircuitBreakerSnapshot {
    return {
      name: this.name,
      state: this.getState(nowMs),
      failureCount: this.failureCount,
      successCount: this.successCount,
      failureThreshold: this.failureThreshold,
      cooldownMs: this.cooldownMs,
      lastFailureAt: this.lastFailureAt ? new Date(this.lastFailureAt).toISOString() : null,
      openedAt: this.openedAt ? new Date(this.openedAt).toISOString() : null,
    };
  }
}

export class CircuitBreakerRegistry {
  private readonly breakers = new Map<string, CircuitBreaker>();

  constructor(names: string[] = ['supabase', 'gemini', 'resend', 'calendar', 'payments']) {
    for (const name of names) {
      this.breakers.set(name, new CircuitBreaker(name));
    }
  }

  public get(name: string): CircuitBreaker {
    let breaker = this.breakers.get(name);
    if (!breaker) {
      breaker = new CircuitBreaker(name);
      this.breakers.set(name, breaker);
    }
    return breaker;
  }

  public snapshotAll(): Record<string, CircuitBreakerSnapshot> {
    const out: Record<string, CircuitBreakerSnapshot> = {};
    for (const [name, breaker] of this.breakers.entries()) {
      out[name] = breaker.getSnapshot();
    }
    return out;
  }

  public hasOpenCircuit(): boolean {
    for (const breaker of this.breakers.values()) {
      if (breaker.getState() === 'OPEN') return true;
    }
    return false;
  }
}

export async function withTimeout<T>(
  operation: Promise<T> | (() => Promise<T>),
  timeoutMs: number,
  label = 'operation'
): Promise<T> {
  const safeTimeout = Math.max(50, Math.min(120_000, timeoutMs));
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new AppError({
          message: `${label} timed out after ${safeTimeout}ms.`,
          statusCode: 504,
          code: 'TIMEOUT',
          retryable: true,
        })
      );
    }, safeTimeout);
    timer.unref?.();
  });

  try {
    const promise = typeof operation === 'function' ? operation() : operation;
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function retryWithJitter<T>(
  fn: (attempt: number) => Promise<T>,
  options?: {
    maxAttempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    shouldRetry?: (error: unknown, attempt: number) => boolean;
  }
): Promise<T> {
  const maxAttempts = Math.max(1, Math.min(6, options?.maxAttempts ?? 3));
  const baseDelayMs = Math.max(10, options?.baseDelayMs ?? 150);
  const maxDelayMs = Math.max(baseDelayMs, options?.maxDelayMs ?? 3000);
  const shouldRetry =
    options?.shouldRetry ??
    ((err: unknown) => {
      if (err instanceof AppError) {
        return err.retryable && err.code !== 'CIRCUIT_OPEN';
      }
      return true;
    });

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      if (attempt >= maxAttempts || !shouldRetry(err, attempt)) {
        throw err;
      }
      const expDelay = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt - 1));
      const jitter = crypto.randomInt(0, Math.max(1, Math.floor(expDelay * 0.4)));
      await new Promise((resolve) => setTimeout(resolve, expDelay + jitter));
    }
  }
  throw lastError;
}

export interface RuntimeLifecycleState {
  isDraining: boolean;
  inFlightRequests: number;
  maxConcurrentRequests: number;
  markDraining: () => void;
  beginRequest: () => boolean;
  endRequest: () => void;
}

export function createRuntimeLifecycleState(maxConcurrentRequests = 400): RuntimeLifecycleState {
  const state: RuntimeLifecycleState = {
    isDraining: false,
    inFlightRequests: 0,
    maxConcurrentRequests: Math.max(10, maxConcurrentRequests),
    markDraining() {
      state.isDraining = true;
    },
    beginRequest() {
      if (state.isDraining || state.inFlightRequests >= state.maxConcurrentRequests) {
        return false;
      }
      state.inFlightRequests += 1;
      return true;
    },
    endRequest() {
      state.inFlightRequests = Math.max(0, state.inFlightRequests - 1);
    },
  };
  return state;
}

function luhnCheck(digits: string): boolean {
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let n = Number(digits[i]);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

export interface SensitiveRedactionResult {
  redactedText: string;
  findingsCount: number;
  categories: string[];
}

/**
 * Redacts credentials, API keys, JWT/Bearer tokens, PEM private keys, CVVs,
 * and payment card numbers before writing AI conversation memory, knowledge records, or logs.
 */
export function redactSensitiveText(input: string): SensitiveRedactionResult {
  if (!input) {
    return { redactedText: '', findingsCount: 0, categories: [] };
  }
  let text = input;
  let findingsCount = 0;
  const categories = new Set<string>();

  const applyPattern = (regex: RegExp, replacement: string, category: string) => {
    text = text.replace(regex, () => {
      findingsCount += 1;
      categories.add(category);
      return replacement;
    });
  };

  // Private PEM blocks
  applyPattern(
    /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/g,
    '[REDACTED_PRIVATE_KEY]',
    'private_key'
  );

  // JWT tokens
  applyPattern(
    /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
    '[REDACTED_JWT]',
    'jwt_token'
  );

  // Bearer tokens
  applyPattern(/\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED_TOKEN]', 'bearer_token');

  // Known API keys & secrets
  applyPattern(/\bAIza[0-9A-Za-z\-_]{20,}\b/g, '[REDACTED_API_KEY]', 'api_key');
  applyPattern(/\b(?:sk|pk)_(?:live|test)_[0-9A-Za-z]{12,}\b/g, '[REDACTED_API_KEY]', 'api_key');
  applyPattern(/\b(?:xnd_development|xnd_production)_[0-9A-Za-z_]{10,}\b/g, '[REDACTED_API_KEY]', 'api_key');
  applyPattern(/\bwhsec_[0-9A-Za-z+/=]{12,}\b/g, '[REDACTED_WEBHOOK_SECRET]', 'webhook_secret');
  applyPattern(/\bre_[0-9A-Za-z_]{16,}\b/g, '[REDACTED_API_KEY]', 'api_key');
  applyPattern(/\bgh[pousr]_[0-9A-Za-z]{20,}\b/g, '[REDACTED_TOKEN]', 'api_key');

  // Password / secret / OTP assignments
  applyPattern(
    /\b(password|passwd|pwd|passcode|client_secret|service_role_key|api_key|webhook_secret)\s*[:=]\s*[^\s,;'"`]{4,}/gi,
    '$1=[REDACTED_SECRET]',
    'credential'
  );

  // CVV / CVC disclosures
  applyPattern(/\b(cvv|cvc|security\s+code)\s*(?:is|:|=)?\s*\d{3,4}\b/gi, '$1 [REDACTED_CVV]', 'payment_cvv');

  // Payment card PANs (13-19 digits, optional spaces/hyphens, verified with Luhn check)
  text = text.replace(/\b(?:\d[ -]?){13,19}\b/g, (match) => {
    const digits = match.replace(/[^\d]/g, '');
    if (digits.length >= 13 && digits.length <= 19 && luhnCheck(digits)) {
      findingsCount += 1;
      categories.add('payment_card');
      return `[REDACTED_CARD_****${digits.slice(-4)}]`;
    }
    return match;
  });

  return {
    redactedText: text,
    findingsCount,
    categories: Array.from(categories),
  };
}
