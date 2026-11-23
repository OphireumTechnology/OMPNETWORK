/*
Copyright (c) 2026 Ophireum Multimedia Production. All rights reserved.
Developer and claimed rights holder: Ophireum Multimedia Production
DTI-registered business, Philippines | Registration No. 7567003
SPDX-FileCopyrightText: 2026 Ophireum Multimedia Production
SPDX-License-Identifier: LicenseRef-Ophireum-Proprietary
Third-party materials, dependencies, and separately licensed components remain subject to their respective rights and licenses.
*/

export const PRODUCTION_RAILWAY_API_URL = 'https://api.ophireummultimedia.com';

const GITHUB_PAGES_HOSTNAMES = new Set([
  'ophireummultimedia.com',
  'www.ophireummultimedia.com',
  'ophireumtechnology.github.io',
]);

export function normalizeApiBaseUrl(raw?: string | null): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return '';
    }
    return parsed.origin + (parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/+$/, ''));
  } catch {
    return '';
  }
}

export function resolveApiBaseUrl(options?: {
  envBaseUrl?: string;
  hostname?: string;
  isProd?: boolean;
}): string {
  const envVal =
    options?.envBaseUrl !== undefined
      ? options.envBaseUrl
      : typeof import.meta !== 'undefined' && import.meta.env
      ? (import.meta.env.VITE_API_BASE_URL as string | undefined)
      : undefined;

  const normalizedEnv = normalizeApiBaseUrl(envVal);
  if (normalizedEnv) {
    return normalizedEnv;
  }

  const hostname =
    options?.hostname !== undefined
      ? options.hostname.toLowerCase()
      : typeof window !== 'undefined' && window.location
      ? window.location.hostname.toLowerCase()
      : '';

  // On GitHub Pages static origins without explicit override, target the Railway API domain
  // instead of issuing relative /api/* requests against static GitHub Pages hosting.
  if (hostname && GITHUB_PAGES_HOSTNAMES.has(hostname)) {
    return PRODUCTION_RAILWAY_API_URL;
  }

  // Local development (localhost, 127.0.0.1) and unified full-stack Node previews (.run.app, .up.railway.app)
  // use relative same-origin paths (/api/*).
  return '';
}

export function buildApiUrl(path: string, baseUrl: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const cleanBase = normalizeApiBaseUrl(baseUrl);
  return cleanBase ? `${cleanBase}${normalizedPath}` : normalizedPath;
}

export function apiUrl(path: string): string {
  return buildApiUrl(path, resolveApiBaseUrl());
}

export function getBackendConnectionInfo(): {
  baseUrl: string;
  mode: 'explicit_env' | 'github_pages_railway' | 'same_origin';
} {
  const envRaw =
    typeof import.meta !== 'undefined' && import.meta.env
      ? normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL as string | undefined)
      : '';

  if (envRaw) {
    return { baseUrl: envRaw, mode: 'explicit_env' };
  }

  const resolved = resolveApiBaseUrl();
  if (resolved === PRODUCTION_RAILWAY_API_URL) {
    return { baseUrl: resolved, mode: 'github_pages_railway' };
  }

  return { baseUrl: '', mode: 'same_origin' };
}

export function createIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `opm-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}
