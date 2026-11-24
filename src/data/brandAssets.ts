/**
 * Centralized Official Brand Asset Registry — Ophireum Multimedia Production
 *
 * Single source of truth for all approved logo, favicon, manifest, document,
 * and email template brand URLs across OMPNETWORK.
 *
 * All files in `public/branding/` are direct Lanczos-resized derivatives of the
 * official company master logo (`OPHIREUM_Logo_6504e623.png`, 4096x4096) with
 * zero redesign, recoloring, or artwork alteration.
 */

const rawBaseUrl =
  typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL
    ? import.meta.env.BASE_URL
    : '/';

const normalizedBase = rawBaseUrl.endsWith('/') ? rawBaseUrl : `${rawBaseUrl}/`;

export const CANONICAL_BRAND_ORIGIN = 'https://ophireummultimedia.com';

export const BRAND_ASSETS = {
  /** Official 512x512 high-DPI circular emblem for all UI surfaces */
  primaryLogo: `${normalizedBase}branding/ophireum-logo.png`,
  /** Official 1024x1024 high-resolution asset for print documents & hero displays */
  highResLogo: `${normalizedBase}branding/ophireum-logo-1024.png`,
  /** Official application & favicon icons */
  icon192: `${normalizedBase}branding/ophireum-logo-192.png`,
  icon512: `${normalizedBase}branding/ophireum-logo-512.png`,
  appleTouchIcon: `${normalizedBase}branding/apple-touch-icon.png`,
  favicon32: `${normalizedBase}branding/favicon-32x32.png`,
  favicon16: `${normalizedBase}branding/favicon-16x16.png`,
  faviconIco: `${normalizedBase}favicon.ico`,
  /** Canonical absolute HTTPS URLs for transactional emails, downloaded HTML receipts, JSON-LD & OpenGraph */
  hostedPrimaryLogoUrl: `${CANONICAL_BRAND_ORIGIN}/branding/ophireum-logo.png`,
  hostedHighResLogoUrl: `${CANONICAL_BRAND_ORIGIN}/branding/ophireum-logo-1024.png`,
  /** Standard descriptive alt text */
  altText: 'Ophireum Multimedia Production Official Logo',
} as const;

/**
 * Resolves an absolute URL for the official logo suitable for standalone downloaded
 * HTML documents (invoices/receipts) so the logo loads reliably when opened locally.
 */
export function resolveAbsoluteLogoUrl(): string {
  if (typeof window !== 'undefined' && window.location && /^https?:$/i.test(window.location.protocol)) {
    return `${window.location.origin}${BRAND_ASSETS.primaryLogo.startsWith('/') ? BRAND_ASSETS.primaryLogo : `/${BRAND_ASSETS.primaryLogo.replace(/^\.\//, '')}`}`;
  }
  return BRAND_ASSETS.hostedPrimaryLogoUrl;
}
