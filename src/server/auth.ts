import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { DatabaseRepository, AdminUserRecord } from './db/types';
import { logStructured } from './logger';

export interface AuthenticatedAdminRequest extends Request {
  adminUser?: AdminUserRecord;
  correlationId?: string;
}

interface SessionTokenPayload {
  sub: string;
  email: string;
  role: 'admin' | 'super_admin';
  exp: number;
}

export class AdminAuthService {
  private readonly sessionSecret: string;
  private readonly sessionSecretIsStable: boolean;

  constructor(private readonly db: DatabaseRepository, sessionSecret?: string) {
    const configuredSecret = sessionSecret || process.env.ADMIN_SESSION_SECRET;
    this.sessionSecretIsStable = Boolean(configuredSecret && configuredSecret.trim().length >= 32);
    this.sessionSecret = configuredSecret || crypto.randomBytes(32).toString('hex');
  }

  public isBootstrapLoginConfigured(): boolean {
    const email = (process.env.ADMIN_BOOTSTRAP_EMAIL || '').trim();
    const pass = (process.env.ADMIN_BOOTSTRAP_PASSWORD || '').trim();
    return Boolean(email && pass && pass.length >= 12);
  }

  public isSessionSecretConfigured(): boolean {
    // The generated fallback is intentionally ephemeral for local development.
    // Production must supply a stable secret so sessions survive restarts safely.
    return this.sessionSecretIsStable;
  }

  public issueSessionToken(admin: AdminUserRecord, ttlSeconds = 3600): string {
    const payload: SessionTokenPayload = {
      sub: admin.id,
      email: admin.email.trim().toLowerCase(),
      role: admin.role,
      exp: Math.floor(Date.now() / 1000) + Math.min(Math.max(ttlSeconds, 60), 3600),
    };
    const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    const sig = crypto.createHmac('sha256', this.sessionSecret).update(encodedPayload).digest('base64url');
    return `${encodedPayload}.${sig}`;
  }

  public verifySessionToken(token: string): SessionTokenPayload | null {
    if (!token || !token.includes('.')) return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [encodedPayload, providedSig] = parts;
    const expectedSig = crypto.createHmac('sha256', this.sessionSecret).update(encodedPayload).digest('base64url');
    const providedBuf = Buffer.from(providedSig, 'utf8');
    const expectedBuf = Buffer.from(expectedSig, 'utf8');
    if (providedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(providedBuf, expectedBuf)) return null;

    try {
      const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as SessionTokenPayload;
      if (
        !payload ||
        typeof payload.sub !== 'string' ||
        !payload.sub ||
        typeof payload.email !== 'string' ||
        !payload.email ||
        !['admin', 'super_admin'].includes(payload.role) ||
        typeof payload.exp !== 'number' ||
        !Number.isFinite(payload.exp) ||
        payload.exp <= Math.floor(Date.now() / 1000)
      ) return null;
      return payload;
    } catch {
      return null;
    }
  }

  public verifyBootstrapCredentials(email: string, password: string): boolean {
    const expectedEmail = (process.env.ADMIN_BOOTSTRAP_EMAIL || '').trim().toLowerCase();
    const expectedPass = (process.env.ADMIN_BOOTSTRAP_PASSWORD || '').trim();
    if (!expectedEmail || !expectedPass || expectedPass.length < 12) return false;
    const emailMatches = email.trim().toLowerCase() === expectedEmail;
    const passBuf = Buffer.from(password, 'utf8');
    const expectedBuf = Buffer.from(expectedPass, 'utf8');
    if (passBuf.length !== expectedBuf.length) return false;
    return emailMatches && crypto.timingSafeEqual(passBuf, expectedBuf);
  }

  public async resolveAuthenticatedPrincipal(req: Request): Promise<{
    authenticated: boolean;
    adminUser?: AdminUserRecord;
    identityEmail?: string;
  }> {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return { authenticated: false };
    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) return { authenticated: false };

    const sessionPayload = this.verifySessionToken(token);
    if (sessionPayload) {
      const adminRecord = await this.db.findActiveAdminByEmail(sessionPayload.email);
      // Bind every signed claim to the current active principal. Email-only lookup
      // must never preserve access after account replacement, deactivation or role change.
      if (
        adminRecord &&
        adminRecord.isActive &&
        adminRecord.id === sessionPayload.sub &&
        adminRecord.email.trim().toLowerCase() === sessionPayload.email.trim().toLowerCase() &&
        adminRecord.role === sessionPayload.role
      ) {
        return { authenticated: true, adminUser: adminRecord, identityEmail: adminRecord.email };
      }
      return { authenticated: true, identityEmail: sessionPayload.email };
    }

    const supaUser = await this.db.verifySupabaseUserToken(token);
    if (supaUser) {
      const adminRecord = await this.db.findActiveAdminByEmail(supaUser.email, supaUser.id);
      if (adminRecord && adminRecord.isActive) {
        return { authenticated: true, adminUser: adminRecord, identityEmail: supaUser.email };
      }
      return { authenticated: true, identityEmail: supaUser.email };
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
          correlationId: req.correlationId, path: req.path, ip: req.ip,
        });
        res.status(401).json({
          success: false, code: 'UNAUTHORIZED',
          error: 'Authentication required to access administrative resources.',
        });
        return;
      }
      if (!resolved.adminUser) {
        logStructured('warn', 'admin_auth_forbidden_non_admin', {
          correlationId: req.correlationId, path: req.path,
          email: resolved.identityEmail, ip: req.ip,
        });
        res.status(403).json({
          success: false, code: 'FORBIDDEN',
          error: 'Insufficient privileges. Administrator role required.',
        });
        return;
      }
      req.adminUser = resolved.adminUser;
      next();
    } catch (err: any) {
      logStructured('error', 'admin_auth_middleware_error', {
        correlationId: req.correlationId, error: err?.message,
      });
      res.status(401).json({
        success: false, code: 'UNAUTHORIZED',
        error: 'Unable to validate administrative credentials.',
      });
    }
  };
}
