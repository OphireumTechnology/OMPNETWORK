import crypto from 'crypto';
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
// RFC 6238 TOTP MFA Helper (Node crypto, zero external dependencies)
// ---------------------------------------------------------------------------
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateTotpSecret(byteLength = 20): string {
  const bytes = crypto.randomBytes(byteLength);
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function base32ToBuffer(secret: string): Buffer {
  const cleaned = secret.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function generateTotpCode(secret: string, timestampMs = Date.now(), stepSeconds = 30): string {
  const key = base32ToBuffer(secret);
  const counter = Math.floor(timestampMs / 1000 / stepSeconds);
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  counterBuf.writeUInt32BE(counter >>> 0, 4);
  const hmac = crypto.createHmac('sha1', key).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, '0');
}

export function verifyTotpCode(
  secret: string,
  code: string,
  timestampMs = Date.now(),
  windowSteps = 1
): boolean {
  const normalized = code.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(normalized)) return false;
  const providedBuf = Buffer.from(normalized, 'utf8');
  for (let delta = -windowSteps; delta <= windowSteps; delta += 1) {
    const candidate = generateTotpCode(secret, timestampMs + delta * 30_000);
    const candidateBuf = Buffer.from(candidate, 'utf8');
    if (providedBuf.length === candidateBuf.length && crypto.timingSafeEqual(providedBuf, candidateBuf)) {
      return true;
    }
  }
  return false;
}

export function buildTotpOtpAuthUri(accountEmail: string, secret: string, issuer = 'OPHIREUM NETWORK'): string {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountEmail)}?secret=${encodeURIComponent(
    secret
  )}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

export interface AuthenticatedAdminRequest extends Request {
  adminUser?: AdminUserRecord;
  adminSessionJti?: string;
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

export const ADMIN_SESSION_COOKIE = 'opm_admin_session';

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
  // Bounded revocation table: jti -> expEpochSec
  private readonly revokedJtis = new Map<string, number>();
  // Per-admin TOTP secrets (populated via enrollment or ADMIN_MFA_SECRET env)
  private readonly adminMfaSecrets = new Map<string, { secret: string; enabled: boolean }>();

  constructor(private readonly db: DatabaseRepository, sessionSecret?: string) {
    // Only read from server environment; generate ephemeral random key in non-configured dev instances
    // so an attacker cannot forge tokens with a static fallback string.
    this.sessionSecret =
      sessionSecret ||
      process.env.ADMIN_SESSION_SECRET ||
      crypto.randomBytes(32).toString('hex');

    const bootstrapEmail = (process.env.ADMIN_BOOTSTRAP_EMAIL || '').trim().toLowerCase();
    const bootstrapMfa = (process.env.ADMIN_BOOTSTRAP_MFA_SECRET || '').trim();
    if (bootstrapEmail && bootstrapMfa) {
      this.adminMfaSecrets.set(bootstrapEmail, { secret: bootstrapMfa, enabled: true });
    }
  }

  public isBootstrapLoginConfigured(): boolean {
    const email = (process.env.ADMIN_BOOTSTRAP_EMAIL || '').trim();
    const pass = (process.env.ADMIN_BOOTSTRAP_PASSWORD || '').trim();
    return Boolean(email && pass && pass.length >= 12);
  }

  public isAdminMfaEnabled(email: string): boolean {
    return Boolean(this.adminMfaSecrets.get(email.trim().toLowerCase())?.enabled);
  }

  public enrollAdminMfa(email: string): { secret: string; otpAuthUri: string } {
    const normalized = email.trim().toLowerCase();
    const secret = generateTotpSecret();
    this.adminMfaSecrets.set(normalized, { secret, enabled: false });
    return {
      secret,
      otpAuthUri: buildTotpOtpAuthUri(normalized, secret, 'OPHIREUM Admin'),
    };
  }

  public confirmAdminMfaEnrollment(email: string, totpCode: string): boolean {
    const normalized = email.trim().toLowerCase();
    const entry = this.adminMfaSecrets.get(normalized);
    if (!entry) return false;
    if (!verifyTotpCode(entry.secret, totpCode)) return false;
    entry.enabled = true;
    return true;
  }

  public verifyAdminMfaCode(email: string, totpCode: string): boolean {
    const normalized = email.trim().toLowerCase();
    const entry = this.adminMfaSecrets.get(normalized);
    if (!entry || !entry.enabled) return true;
    return verifyTotpCode(entry.secret, totpCode);
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

  public extractTokenFromRequest(req: Request): string | null {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const bearer = authHeader.slice('Bearer '.length).trim();
      if (bearer) return bearer;
    }
    const cookies = parseCookieHeader(req.headers.cookie);
    if (cookies[ADMIN_SESSION_COOKIE]) {
      return cookies[ADMIN_SESSION_COOKIE];
    }
    return null;
  }

  public async resolveAuthenticatedPrincipal(req: Request): Promise<{
    authenticated: boolean;
    adminUser?: AdminUserRecord;
    identityEmail?: string;
    sessionJti?: string;
  }> {
    const token = this.extractTokenFromRequest(req);
    if (!token) {
      return { authenticated: false };
    }

    // 1. Check server-signed admin session token with strict principal binding (sub + role + active status)
    const sessionPayload = this.verifySessionToken(token);
    if (sessionPayload) {
      const adminRecord = await this.db.findActiveAdminByEmail(sessionPayload.email);
      const principalMatches =
        Boolean(adminRecord && adminRecord.isActive) &&
        adminRecord!.id === sessionPayload.sub &&
        adminRecord!.role === sessionPayload.role &&
        Boolean(ROLE_PERMISSIONS[adminRecord!.role]);

      if (principalMatches && adminRecord) {
        return {
          authenticated: true,
          adminUser: {
            ...adminRecord,
            mfaEnabled: this.isAdminMfaEnabled(adminRecord.email),
          },
          identityEmail: adminRecord.email,
          sessionJti: sessionPayload.jti,
        };
      }
      return { authenticated: true, identityEmail: sessionPayload.email };
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
        };
      }
      return {
        authenticated: true,
        identityEmail: supaUser.email,
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
