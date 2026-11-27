import crypto from 'crypto';
import { redactSensitiveText } from './resilience';

export type LogLevel = 'info' | 'warn' | 'error';

const SENSITIVE_KEY_PATTERN = /(password|secret|token|authorization|cookie|api[-_]?key|service[-_]?role|private[-_]?key|bearer)/i;

export function maskEmail(email: string): string {
  const trimmed = email.trim();
  const atIdx = trimmed.indexOf('@');
  if (atIdx <= 1) return '***';
  return `${trimmed.slice(0, 2)}***@${trimmed.slice(atIdx + 1)}`;
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\s+/g, '');
  if (digits.length <= 4) return '****';
  return `${'*'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

export function redactSensitiveData(value: unknown, depth = 0): unknown {
  if (depth > 5 || value === null || value === undefined) return value;
  if (typeof value === 'string') {
    if (value.startsWith('Bearer ')) return 'Bearer [REDACTED]';
    return redactSensitiveText(value).redactedText;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => redactSensitiveData(item, depth + 1));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        out[key] = '[REDACTED]';
      } else if (key.toLowerCase() === 'email' && typeof val === 'string') {
        out[key] = maskEmail(val);
      } else if ((key.toLowerCase() === 'phone' || key.toLowerCase() === 'contactnumber') && typeof val === 'string') {
        out[key] = maskPhone(val);
      } else {
        out[key] = redactSensitiveData(val, depth + 1);
      }
    }
    return out;
  }
  return value;
}

export function createCorrelationId(existingHeader?: string | string[]): string {
  if (typeof existingHeader === 'string' && /^[a-zA-Z0-9\-_]{8,64}$/.test(existingHeader.trim())) {
    return existingHeader.trim();
  }
  return `opm-${crypto.randomUUID()}`;
}

export function logStructured(
  level: LogLevel,
  event: string,
  meta: Record<string, unknown> = {}
): void {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    service: 'ophireum-api',
    event,
    ...(redactSensitiveData(meta) as Record<string, unknown>),
  };

  const line = JSON.stringify(payload);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}
