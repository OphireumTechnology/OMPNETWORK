import crypto from 'crypto';
import * as OTPAuth from 'otpauth';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Request, Response, NextFunction } from 'express';
import { DatabaseRepository, AdminRole, AdminUserRecord } from './db/types';
import { logStructured } from './logger';

export type AdminPermission =
  | 'dashboard.read'
  | 'analytics.read'
  | 'analytics.export'
  | 'customers.read'
  | 'customers.write'
  | 'staff.manage'
  | 'catalog.write'
  | 'inquiries.read'
  | 'inquiries.write'
  | 'appointments.read'
  | 'appointments.write'
  | 'orders.read'
  | 'orders.write'
  | 'payments.read'
  | 'payments.refund'
  | 'invoices.write'
  | 'subscriptions.write'
  | 'credits.write'
  | 'promotions.write'
  | 'projects.read'
  | 'projects.write'
  | 'support.read'
  | 'support.write'
  | 'ai.read'
  | 'ai.execute'
  | 'ai.approve'
  | 'ai.knowledge.write'
  | 'communications.write'
  | 'security.read'
  | 'audit.read'
  | 'config.write';

const ALL_PERMISSIONS: AdminPermission[] = [
  'dashboard.read',
  'analytics.read',
  'analytics.export',
  'customers.read',
  'customers.write',
  'staff.manage',
  'catalog.write',
  'inquiries.read',
  'inquiries.write',
  'appointments.read',
  'appointments.write',
  'orders.read',
  'orders.write',
  'payments.read',
  'payments.refund',
  'invoices.write',
  'subscriptions.write',
  'credits.write',
  'promotions.write',
  'projects.read',
  'projects.write',
  'support.read',
  'support.write',
  'ai.read',
  'ai.execute',
  'ai.approve',
  'ai.knowledge.write',
  'communications.write',
  'security.read',
  'audit.read',
  'config.write',
];

export const ROLE_PERMISSIONS: Record<AdminRole, ReadonlySet<AdminPermission>> = {
  super_admin: new Set(ALL_PERMISSIONS),
  admin: new Set(ALL_PERMISSIONS.filter((p) => p !== 'staff.manage')),
  operations_manager: new Set<AdminPermission>([
    'dashboard.read',
    'analytics.read',
    'analytics.export',
    'customers.read',
    'customers.write',
    'inquiries.read',
    'inquiries.write',
    'appointments.read',
    'appointments.write',
    'orders.read',
    'orders.write',
    'projects.read',
    'projects.write',
    'support.read',
    'support.write',
    'ai.read',
    'ai.execute',
    'ai.approve',
    'communications.write',
  ]),
  finance_officer: new Set<AdminPermission>([
    'dashboard.read',
    'analytics.read',
    'analytics.export',
    'customers.read',
    'orders.read',
    'payments.read',
    'payments.refund',
    'invoices.write',
    'subscriptions.write',
    'credits.write',
    'promotions.write',
    'audit.read',
  ]),
  sales_officer: new Set<AdminPermission>([
    'dashboard.read',
    'analytics.read',
    'customers.read',
    'customers.write',
    'inquiries.read',
    'inquiries.write',
    'appointments.read',
    'appointments.write',
    'orders.read',
    'promotions.write',
    'ai.read',
    'ai.execute',
  ]),
  project_manager: new Set<AdminPermission>([
    'dashboard.read',
    'customers.read',
    'orders.read',
    'projects.read',
    'projects.write',
    'support.read',
    'support.write',
    'ai.read',
    'ai.execute',
  ]),
  developer: new Set<AdminPermission>([
    'dashboard.read',
    'projects.read',
    'projects.write',
    'ai.read',
    'ai.execute',
    'ai.knowledge.write',
    'security.read',
  ]),
  support_officer: new Set<AdminPermission>([
    'dashboard.read',
    'customers.read',
    'orders.read',
    'appointments.read',
    'appointments.write',
    'support.read',
    'support.write',
    'ai.read',
    'ai.execute',
    'communications.write',
  ]),
  auditor: new Set<AdminPermission>([
    'dashboard.read',
    'analytics.read',
    'analytics.export',
    'customers.read',
    'inquiries.read',
    'appointments.read',
    'orders.read',
    'payments.read',
    'projects.read',
    'support.read',
    'ai.read',
    'security.read',
    'audit.read',
  ]),
};

export function hasAdminPermission(role: AdminRole, permission: AdminPermission): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

// ---------------------------------------------------------------------------
// Established Library RFC 6238 TOTP MFA (otpauth) + AES-256-GCM Secret Storage
// ---------------------------------------------------------------------------
const TOTP_PERIOD_SECONDS = 30;
const TOTP_DIGITS = 6;
const TOTP_DRIFT_WINDOW = 1; // +/- 30s clock skew

export function generateTotpSecret(byteLength = 20): string {
  const secret = new OTPAuth.Secret({ size: byteLength });
  return secret.base32;
}

function buildTotpInstance(secretBase32: string, accountEmail = 'user@ophireummultimedia.com', issuer = 'OPHIREUM NETWORK'): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer,
    label: accountEmail,
    algorithm: 'SHA1',
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD_SECONDS,
    secret: OTPAuth.Secret.fromBase32(secretBase32.toUpperCase().replace(/[^A-Z2-7]/g, '')),
  });
}

export function generateTotpCode(secret: string, timestampMs = Date.now(), stepSeconds = TOTP_PERIOD_SECONDS): string {
  const totp = new OTPAuth.TOTP({
    algorithm: 'SHA1',
    digits: TOTP_DIGITS,
    period: stepSeconds,
    secret: OTPAuth.Secret.fromBase32(secret.toUpperCase().replace(/[^A-Z2-7]/g, '')),
  });
  return totp.generate({ timestamp: timestampMs });
}

/**
 * Timing-safe RFC 6238 TOTP verification returning the matched time-step counter
 * so callers can strictly reject replays within the same 30-second step.
 */
export function verifyTotpCodeWithStep(
  secret: string,
  code: string,
  timestampMs = Date.now(),
  windowSteps = TOTP_DRIFT_WINDOW
): { valid: boolean; matchedStep?: number } {
  const normalized = code.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(normalized)) return { valid: false };

  const currentStep = Math.floor(timestampMs / 1000 / TOTP_PERIOD_SECONDS);
  const providedBuf = Buffer.from(normalized, 'utf8');
  let matchedStep: number | undefined;

  for (let delta = -windowSteps; delta <= windowSteps; delta += 1) {
    const candidateStep = currentStep + delta;
    const candidate = generateTotpCode(secret, candidateStep * TOTP_PERIOD_SECONDS * 1000);
    const candidateBuf = Buffer.from(candidate, 'utf8');
    if (
      providedBuf.length === candidateBuf.length &&
      crypto.timingSafeEqual(providedBuf, candidateBuf)
    ) {
      matchedStep = candidateStep;
    }
  }

  return matchedStep !== undefined ? { valid: true, matchedStep } : { valid: false };
}

export function verifyTotpCode(
  secret: string,
  code: string,
  timestampMs = Date.now(),
  windowSteps = TOTP_DRIFT_WINDOW
): boolean {
  return verifyTotpCodeWithStep(secret, code, timestampMs, windowSteps).valid;
}

export function buildTotpOtpAuthUri(accountEmail: string, secret: string, issuer = 'OPHIREUM NETWORK'): string {
  return buildTotpInstance(secret, accountEmail, issuer).toString();
}

function deriveAesKey(rawKeyMaterial: string, saltPrefix = 'ophireum-mfa-v1'): Buffer {
  return crypto.createHash('sha256').update(`${saltPrefix}:${rawKeyMaterial}`, 'utf8').digest();
}

export function computeMfaKeyId(rawKeyMaterial: string): string {
  return crypto.createHash('sha256').update(`kid:${rawKeyMaterial}`, 'utf8').digest('hex').slice(0, 8);
}

export function encryptMfaSecret(plainSecret: string, keyMaterial: string): string {
  const kid = computeMfaKeyId(keyMaterial);
  const key = deriveAesKey(keyMaterial, 'ophireum-mfa-v2');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plainSecret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v2:${kid}:${iv.toString('base64url')}:${tag.toString('base64url')}:${encrypted.toString('base64url')}`;
}

function decryptWithKey(
  ivB64: string,
  tagB64: string,
  dataB64: string,
  keyMaterial: string,
  saltPrefix: string
): string {
  const key = deriveAesKey(keyMaterial, saltPrefix);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64url')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

export function decryptMfaSecret(
  storedSecret: string,
  keyMaterial: string,
  previousKeyMaterials: string[] = []
): string {
  const candidates = [keyMaterial, ...previousKeyMaterials.filter(Boolean)];

  if (storedSecret.startsWith('enc:v2:')) {
    const parts = storedSecret.split(':');
    if (parts.length !== 6) {
      throw new Error('Malformed encrypted v2 MFA secret.');
    }
    const [, , , ivB64, tagB64, dataB64] = parts;
    for (const candidate of candidates) {
      try {
        return decryptWithKey(ivB64, tagB64, dataB64, candidate, 'ophireum-mfa-v2');
      } catch {
        // Try next key in rotation ring
      }
    }
    throw new Error('Unable to decrypt v2 MFA secret with active or previous keys.');
  }

  if (storedSecret.startsWith('enc:v1:')) {
    const parts = storedSecret.split(':');
    if (parts.length !== 5) {
      throw new Error('Malformed encrypted MFA secret.');
    }
    const [, , ivB64, tagB64, dataB64] = parts;
    for (const candidate of candidates) {
      try {
        return decryptWithKey(ivB64, tagB64, dataB64, candidate, 'ophireum-mfa-v1');
      } catch {
        // Try next key in rotation ring
      }
    }
    throw new Error('Unable to decrypt v1 MFA secret with active or previous keys.');
  }

  return storedSecret;
}

export function generateRecoveryCodes(count = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const raw = crypto.randomBytes(5).toString('hex').toUpperCase();
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5, 10)}`);
  }
  return codes;
}

export function hashRecoveryCode(code: string): string {
  return crypto
    .createHash('sha256')
    .update(`ophireum-recovery:${code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')}`, 'utf8')
    .digest('hex');
}

// ---------------------------------------------------------------------------
// Cookie & CSRF Helpers
// ---------------------------------------------------------------------------
export const ADMIN_SESSION_COOKIE = 'opm_admin_session';

export function buildAdminSessionCookieHeader(token: string, maxAgeSeconds: number): string {
  const isProd = process.env.NODE_ENV === 'production';
  const parts = [
    `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`,
  ];
  if (isProd) {
    // Cross-origin GitHub Pages -> Railway API requires SameSite=None; Secure; Partitioned
    parts.push('SameSite=None', 'Secure', 'Partitioned');
  } else {
    parts.push('SameSite=Lax');
  }
  return parts.join('; ');
}

export function isAdminCookieCsrfSafe(req: Request, allowedOrigins: string[]): boolean {
  const method = req.method.toUpperCase();
  if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
    return true;
  }
  const xrw = String(req.headers['x-requested-with'] || '').trim();
  if (xrw === 'XMLHttpRequest' || xrw === 'fetch') {
    return true;
  }
  const rawOrigin = String(req.headers.origin || '').trim();
  const rawReferer = String(req.headers.referer || '').trim();
  let candidateOrigin = rawOrigin.replace(/\/$/, '');
  if (!candidateOrigin && rawReferer) {
    try {
      candidateOrigin = new URL(rawReferer).origin.replace(/\/$/, '');
    } catch {
      candidateOrigin = '';
    }
  }
  if (!candidateOrigin) return false;
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').trim();
  if (host && (candidateOrigin === `https://${host}` || candidateOrigin === `http://${host}`)) {
    return true;
  }
  return allowedOrigins.includes(candidateOrigin);
}

export interface AuthenticatedAdminRequest extends Request {
  adminUser?: AdminUserRecord;
  adminSessionJti?: string;
  adminAuthSource?: 'bearer' | 'cookie';
  adminMfaVerified?: boolean;
  correlationId?: string;
}

interface SessionTokenPayload {
  jti: string;
  sub: string;
  email: string;
  role: AdminRole;
  mfaVerified?: boolean;
  exp: number;
}

interface StoredAdminMfaEntry {
  encryptedSecret: string;
  enabled: boolean;
  lastUsedStep?: number;
  failedAttempts: number;
  lockedUntilMs?: number;
  recoveryCodeHashes: Set<string>;
}

export interface PersistentRevocationStore {
  revoke(jti: string, principalId: string, expEpochSec: number): Promise<void>;
  isRevoked(jti: string): Promise<boolean>;
}

function parseCookieHeader(rawCookie?: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!rawCookie) return result;
  for (const part of rawCookie.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) result[key] = decodeURIComponent(val);
  }
  return result;
}

export class AdminAuthService {
  private readonly sessionSecret: string;
  private mfaEncryptionKey: string;
  private readonly mfaPreviousEncryptionKeys: string[];
  private readonly allowedOrigins: string[];
  // Bounded local cache + optional persistent DB store for cross-replica token revocation
  private readonly revokedJtis = new Map<string, number>();
  private readonly persistentRevocationStore: PersistentRevocationStore | null;
  // Encrypted per-admin TOTP secrets + replay & lockout tracking
  private readonly adminMfaEntries = new Map<string, StoredAdminMfaEntry>();

  constructor(
    private readonly db: DatabaseRepository,
    sessionSecret?: string,
    options?: {
      allowedOrigins?: string[];
      revocationStore?: PersistentRevocationStore;
      supabaseClient?: SupabaseClient | null;
      mfaEncryptionKey?: string;
      mfaPreviousEncryptionKeys?: string[];
    }
  ) {
    this.sessionSecret =
      sessionSecret ||
      process.env.ADMIN_SESSION_SECRET ||
      crypto.randomBytes(32).toString('hex');

    this.mfaEncryptionKey =
      (options?.mfaEncryptionKey || process.env.MFA_ENCRYPTION_KEY || '').trim() || this.sessionSecret;

    const envPrev = (process.env.MFA_ENCRYPTION_KEY_PREVIOUS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    this.mfaPreviousEncryptionKeys = [
      ...(options?.mfaPreviousEncryptionKeys || []),
      ...envPrev,
    ].filter((k) => k && k !== this.mfaEncryptionKey);

    this.allowedOrigins = options?.allowedOrigins || [
      'https://ophireummultimedia.com',
      'https://www.ophireummultimedia.com',
      'https://ophireumtechnology.github.io',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ];

    if (options?.revocationStore) {
      this.persistentRevocationStore = options.revocationStore;
    } else {
      const supaUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
      const supaKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
      const client =
        options?.supabaseClient !== undefined
          ? options.supabaseClient
          : supaUrl && supaKey && !supaUrl.includes('your-ompnetwork-id')
          ? createClient(supaUrl, supaKey, { auth: { autoRefreshToken: false, persistSession: false } })
          : null;

      this.persistentRevocationStore = client
        ? {
            async revoke(jti: string, principalId: string, expEpochSec: number): Promise<void> {
              await client
                .from('revoked_session_tokens')
                .upsert(
                  {
                    jti,
                    principal_type: 'admin',
                    principal_id: principalId,
                    expires_at: new Date(expEpochSec * 1000).toISOString(),
                  },
                  { onConflict: 'jti' }
                );
            },
            async isRevoked(jti: string): Promise<boolean> {
              const { data, error } = await client
                .from('revoked_session_tokens')
                .select('jti')
                .eq('jti', jti)
                .maybeSingle();
              return !error && Boolean(data);
            },
          }
        : null;
    }

    const bootstrapEmail = (process.env.ADMIN_BOOTSTRAP_EMAIL || '').trim().toLowerCase();
    const bootstrapMfa = (process.env.ADMIN_BOOTSTRAP_MFA_SECRET || '').trim();
    if (bootstrapEmail && bootstrapMfa) {
      this.adminMfaEntries.set(bootstrapEmail, {
        encryptedSecret: encryptMfaSecret(bootstrapMfa, this.mfaEncryptionKey),
        enabled: true,
        failedAttempts: 0,
        recoveryCodeHashes: new Set(),
      });
    }
  }

  public rotateMfaEncryptionKey(newKeyMaterial: string): { rotatedCount: number; newKeyId: string } {
    const trimmed = newKeyMaterial.trim();
    if (trimmed.length < 32) {
      throw new Error('New MFA encryption key must be at least 32 characters.');
    }
    const oldKey = this.mfaEncryptionKey;
    const oldRing = [oldKey, ...this.mfaPreviousEncryptionKeys];
    let rotatedCount = 0;

    for (const [, entry] of this.adminMfaEntries.entries()) {
      const plain = decryptMfaSecret(entry.encryptedSecret, oldKey, oldRing);
      entry.encryptedSecret = encryptMfaSecret(plain, trimmed);
      rotatedCount += 1;
    }

    if (oldKey && !this.mfaPreviousEncryptionKeys.includes(oldKey)) {
      this.mfaPreviousEncryptionKeys.unshift(oldKey);
    }
    this.mfaEncryptionKey = trimmed;

    return {
      rotatedCount,
      newKeyId: computeMfaKeyId(trimmed),
    };
  }

  public isBootstrapLoginConfigured(): boolean {
    const email = (process.env.ADMIN_BOOTSTRAP_EMAIL || '').trim();
    const pass = (process.env.ADMIN_BOOTSTRAP_PASSWORD || '').trim();
    return Boolean(email && pass && pass.length >= 12);
  }

  public isAdminMfaRequiredByPolicy(): boolean {
    return process.env.REQUIRE_ADMIN_MFA === 'true';
  }

  public isAdminMfaEnabled(email: string): boolean {
    return Boolean(this.adminMfaEntries.get(email.trim().toLowerCase())?.enabled);
  }

  public getEncryptedAdminMfaSecret(email: string): string | undefined {
    return this.adminMfaEntries.get(email.trim().toLowerCase())?.encryptedSecret;
  }

  public enrollAdminMfa(email: string): {
    secret: string;
    otpAuthUri: string;
    recoveryCodes: string[];
  } {
    const normalized = email.trim().toLowerCase();
    const secret = generateTotpSecret();
    const recoveryCodes = generateRecoveryCodes(10);
    this.adminMfaEntries.set(normalized, {
      encryptedSecret: encryptMfaSecret(secret, this.mfaEncryptionKey),
      enabled: false,
      failedAttempts: 0,
      recoveryCodeHashes: new Set(recoveryCodes.map(hashRecoveryCode)),
    });
    return {
      secret,
      otpAuthUri: buildTotpOtpAuthUri(normalized, secret, 'OPHIREUM Admin'),
      recoveryCodes,
    };
  }

  public confirmAdminMfaEnrollment(email: string, totpCode: string, timestampMs = Date.now()): boolean {
    const normalized = email.trim().toLowerCase();
    const entry = this.adminMfaEntries.get(normalized);
    if (!entry) return false;
    const plainSecret = decryptMfaSecret(entry.encryptedSecret, this.mfaEncryptionKey, this.mfaPreviousEncryptionKeys);
    const check = verifyTotpCodeWithStep(plainSecret, totpCode, timestampMs);
    if (!check.valid || check.matchedStep === undefined) return false;
    entry.enabled = true;
    entry.lastUsedStep = check.matchedStep;
    entry.failedAttempts = 0;
    entry.lockedUntilMs = undefined;
    return true;
  }

  public verifyAdminMfaCode(
    email: string,
    totpOrRecoveryCode: string,
    timestampMs = Date.now()
  ): { ok: boolean; reason?: 'locked' | 'replay' | 'invalid' | 'mfa_not_enrolled'; usedRecoveryCode?: boolean } {
    const normalized = email.trim().toLowerCase();
    const entry = this.adminMfaEntries.get(normalized);
    if (!entry || !entry.enabled) {
      if (this.isAdminMfaRequiredByPolicy()) {
        return { ok: false, reason: 'mfa_not_enrolled' };
      }
      return { ok: true };
    }

    if (entry.lockedUntilMs && timestampMs < entry.lockedUntilMs) {
      return { ok: false, reason: 'locked' };
    }

    const cleanInput = totpOrRecoveryCode.trim();
    if (!cleanInput) {
      return { ok: false, reason: 'invalid' };
    }

    // 1. Check single-use recovery code (e.g. XXXXX-XXXXX)
    if (cleanInput.includes('-') || /^[A-F0-9]{10}$/i.test(cleanInput)) {
      const hashed = hashRecoveryCode(cleanInput);
      if (entry.recoveryCodeHashes.has(hashed)) {
        entry.recoveryCodeHashes.delete(hashed);
        entry.failedAttempts = 0;
        entry.lockedUntilMs = undefined;
        return { ok: true, usedRecoveryCode: true };
      }
    }

    // 2. Check RFC 6238 TOTP code with strict replay prevention
    const plainSecret = decryptMfaSecret(entry.encryptedSecret, this.mfaEncryptionKey, this.mfaPreviousEncryptionKeys);
    const check = verifyTotpCodeWithStep(plainSecret, cleanInput, timestampMs);
    if (!check.valid || check.matchedStep === undefined) {
      entry.failedAttempts += 1;
      if (entry.failedAttempts >= 5) {
        entry.lockedUntilMs = timestampMs + 15 * 60 * 1000;
      }
      return { ok: false, reason: 'invalid' };
    }

    if (entry.lastUsedStep !== undefined && check.matchedStep <= entry.lastUsedStep) {
      return { ok: false, reason: 'replay' };
    }

    // Lazy re-encrypt onto the active v2 key if decrypted using an older key/version
    const activePrefix = `enc:v2:${computeMfaKeyId(this.mfaEncryptionKey)}:`;
    if (!entry.encryptedSecret.startsWith(activePrefix)) {
      entry.encryptedSecret = encryptMfaSecret(plainSecret, this.mfaEncryptionKey);
    }

    entry.lastUsedStep = check.matchedStep;
    entry.failedAttempts = 0;
    entry.lockedUntilMs = undefined;
    return { ok: true };
  }

  private pruneRevokedTokens(): void {
    const nowSec = Math.floor(Date.now() / 1000);
    for (const [jti, exp] of this.revokedJtis.entries()) {
      if (exp < nowSec) {
        this.revokedJtis.delete(jti);
      }
    }
    if (this.revokedJtis.size > 10_000) {
      const oldestKey = this.revokedJtis.keys().next().value;
      if (oldestKey) this.revokedJtis.delete(oldestKey);
    }
  }

  public issueSessionToken(admin: AdminUserRecord, ttlSeconds = 3600, mfaVerified = false): string {
    const payload: SessionTokenPayload = {
      jti: crypto.randomUUID(),
      sub: admin.id,
      email: admin.email,
      role: admin.role,
      mfaVerified,
      exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    };
    const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    const sig = crypto
      .createHmac('sha256', this.sessionSecret)
      .update(encodedPayload)
      .digest('base64url');
    return `${encodedPayload}.${sig}`;
  }

  public revokeSessionToken(token: string): boolean {
    const payload = this.verifySessionToken(token);
    if (!payload) return false;
    this.pruneRevokedTokens();
    this.revokedJtis.set(payload.jti, payload.exp);
    if (this.persistentRevocationStore) {
      void this.persistentRevocationStore.revoke(payload.jti, payload.sub, payload.exp).catch(() => undefined);
    }
    return true;
  }

  public async revokeSessionTokenAsync(token: string): Promise<boolean> {
    const payload = this.verifySessionToken(token);
    if (!payload) return false;
    this.pruneRevokedTokens();
    this.revokedJtis.set(payload.jti, payload.exp);
    if (this.persistentRevocationStore) {
      await this.persistentRevocationStore.revoke(payload.jti, payload.sub, payload.exp).catch(() => undefined);
    }
    return true;
  }

  public verifySessionToken(token: string): SessionTokenPayload | null {
    if (!token || !token.includes('.')) return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [encodedPayload, providedSig] = parts;

    const expectedSig = crypto
      .createHmac('sha256', this.sessionSecret)
      .update(encodedPayload)
      .digest('base64url');

    const providedBuf = Buffer.from(providedSig, 'utf8');
    const expectedBuf = Buffer.from(expectedSig, 'utf8');
    if (providedBuf.length !== expectedBuf.length) return null;
    if (!crypto.timingSafeEqual(providedBuf, expectedBuf)) return null;

    try {
      const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as SessionTokenPayload;
      if (
        !payload ||
        typeof payload.sub !== 'string' ||
        typeof payload.email !== 'string' ||
        typeof payload.role !== 'string' ||
        typeof payload.exp !== 'number'
      ) {
        return null;
      }
      if (payload.exp < Math.floor(Date.now() / 1000)) {
        return null;
      }
      if (payload.jti && this.revokedJtis.has(payload.jti)) {
        return null;
      }
      return payload;
    } catch {
      return null;
    }
  }

  public verifyBootstrapCredentials(email: string, password: string): boolean {
    const expectedEmail = (process.env.ADMIN_BOOTSTRAP_EMAIL || '').trim().toLowerCase();
    const expectedPass = (process.env.ADMIN_BOOTSTRAP_PASSWORD || '').trim();
    if (!expectedEmail || !expectedPass || expectedPass.length < 12) {
      return false;
    }
    const emailMatches = email.trim().toLowerCase() === expectedEmail;
    const passBuf = Buffer.from(password, 'utf8');
    const expectedBuf = Buffer.from(expectedPass, 'utf8');
    if (passBuf.length !== expectedBuf.length) {
      return false;
    }
    return emailMatches && crypto.timingSafeEqual(passBuf, expectedBuf);
  }

  public extractTokenWithSource(req: Request): { token: string | null; source: 'bearer' | 'cookie' | null } {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const bearer = authHeader.slice('Bearer '.length).trim();
      if (bearer) return { token: bearer, source: 'bearer' };
    }
    const cookies = parseCookieHeader(req.headers.cookie);
    if (cookies[ADMIN_SESSION_COOKIE]) {
      return { token: cookies[ADMIN_SESSION_COOKIE], source: 'cookie' };
    }
    return { token: null, source: null };
  }

  public extractTokenFromRequest(req: Request): string | null {
    return this.extractTokenWithSource(req).token;
  }

  public async resolveAuthenticatedPrincipal(req: Request): Promise<{
    authenticated: boolean;
    adminUser?: AdminUserRecord;
    identityEmail?: string;
    sessionJti?: string;
    authSource?: 'bearer' | 'cookie';
    mfaVerified?: boolean;
    mfaBypassBlocked?: boolean;
  }> {
    const { token, source } = this.extractTokenWithSource(req);
    if (!token || !source) {
      return { authenticated: false };
    }

    // 1. Check server-signed admin session token with strict principal binding + cross-replica revocation check
    const sessionPayload = this.verifySessionToken(token);
    if (sessionPayload) {
      if (sessionPayload.jti && this.persistentRevocationStore) {
        const revokedInDb = await this.persistentRevocationStore.isRevoked(sessionPayload.jti).catch(() => false);
        if (revokedInDb) {
          this.revokedJtis.set(sessionPayload.jti, sessionPayload.exp);
          return { authenticated: false };
        }
      }

      const adminRecord = await this.db.findActiveAdminByEmail(sessionPayload.email);
      const principalMatches =
        Boolean(adminRecord && adminRecord.isActive) &&
        adminRecord!.id === sessionPayload.sub &&
        adminRecord!.role === sessionPayload.role &&
        Boolean(ROLE_PERMISSIONS[adminRecord!.role]);

      if (principalMatches && adminRecord) {
        const mfaEnabled = this.isAdminMfaEnabled(adminRecord.email);
        const mfaRequired = mfaEnabled || this.isAdminMfaRequiredByPolicy();
        if (mfaRequired && !sessionPayload.mfaVerified) {
          return {
            authenticated: true,
            identityEmail: adminRecord.email,
            sessionJti: sessionPayload.jti,
            authSource: source,
            mfaVerified: false,
            mfaBypassBlocked: true,
          };
        }
        return {
          authenticated: true,
          adminUser: {
            ...adminRecord,
            mfaEnabled,
          },
          identityEmail: adminRecord.email,
          sessionJti: sessionPayload.jti,
          authSource: source,
          mfaVerified: Boolean(sessionPayload.mfaVerified),
        };
      }
      return { authenticated: true, identityEmail: sessionPayload.email, authSource: source };
    }

    // 2. Check Supabase-issued JWT via server-side auth.getUser(token) + admin_users RBAC lookup
    const supaUser = await this.db.verifySupabaseUserToken(token);
    if (supaUser) {
      const adminRecord = await this.db.findActiveAdminByEmail(supaUser.email, supaUser.id);
      if (adminRecord && adminRecord.isActive && Boolean(ROLE_PERMISSIONS[adminRecord.role])) {
        return {
          authenticated: true,
          adminUser: {
            ...adminRecord,
            mfaEnabled: this.isAdminMfaEnabled(adminRecord.email),
          },
          identityEmail: supaUser.email,
          authSource: source,
          mfaVerified: true,
        };
      }
      return {
        authenticated: true,
        identityEmail: supaUser.email,
        authSource: source,
      };
    }

    return { authenticated: false };
  }

  public requireAdmin = async (
    req: AuthenticatedAdminRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const resolved = await this.resolveAuthenticatedPrincipal(req);
      if (!resolved.authenticated) {
        logStructured('warn', 'admin_auth_rejected_unauthenticated', {
          correlationId: req.correlationId,
          path: req.path,
          ip: req.ip,
        });
        res.status(401).json({
          success: false,
          code: 'UNAUTHORIZED',
          error: 'Authentication required to access administrative resources.',
        });
        return;
      }

      if (resolved.authSource === 'cookie' && !isAdminCookieCsrfSafe(req, this.allowedOrigins)) {
        logStructured('warn', 'admin_csrf_check_failed', {
          correlationId: req.correlationId,
          path: req.path,
          method: req.method,
          origin: req.headers.origin,
        });
        res.status(403).json({
          success: false,
          code: 'CSRF_CHECK_FAILED',
          error: 'State-changing cookie-authenticated administrative request failed CSRF validation.',
        });
        return;
      }

      if (resolved.mfaBypassBlocked) {
        logStructured('warn', 'admin_mfa_verification_required', {
          correlationId: req.correlationId,
          path: req.path,
          email: resolved.identityEmail,
        });
        res.status(403).json({
          success: false,
          code: 'MFA_VERIFICATION_REQUIRED',
          error: 'Privileged session requires verified multi-factor authentication.',
        });
        return;
      }

      if (!resolved.adminUser) {
        logStructured('warn', 'admin_auth_forbidden_non_admin', {
          correlationId: req.correlationId,
          path: req.path,
          email: resolved.identityEmail,
          ip: req.ip,
        });
        res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          error: 'Insufficient privileges. Administrator role required.',
        });
        return;
      }

      req.adminUser = resolved.adminUser;
      req.adminSessionJti = resolved.sessionJti;
      req.adminAuthSource = resolved.authSource;
      req.adminMfaVerified = resolved.mfaVerified;
      next();
    } catch (err: any) {
      logStructured('error', 'admin_auth_middleware_error', {
        correlationId: req.correlationId,
        error: err?.message,
      });
      res.status(401).json({
        success: false,
        code: 'UNAUTHORIZED',
        error: 'Unable to validate administrative credentials.',
      });
    }
  };

  public requirePermission(permission: AdminPermission) {
    return async (
      req: AuthenticatedAdminRequest,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      const runCheck = () => {
        if (!req.adminUser || !hasAdminPermission(req.adminUser.role, permission)) {
          logStructured('warn', 'admin_permission_denied', {
            correlationId: req.correlationId,
            path: req.path,
            actor: req.adminUser?.email,
            role: req.adminUser?.role,
            requiredPermission: permission,
          });
          res.status(403).json({
            success: false,
            code: 'INSUFFICIENT_PERMISSION',
            error: `Permission '${permission}' is required for this administrative action.`,
          });
          return;
        }
        next();
      };

      if (req.adminUser) {
        runCheck();
        return;
      }

      await this.requireAdmin(req, res, runCheck);
    };
  }
}
