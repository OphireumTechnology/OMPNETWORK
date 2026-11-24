import React from 'react';
import { BRAND_ASSETS } from '../data/brandAssets';

export type BrandLogoVariant = 'emblem' | 'horizontal' | 'stacked';
export type BrandLogoTheme = 'dark' | 'light' | 'portal-dark';
export type BrandLogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'header' | 'hero';
export type BrandLogoRing = 'brand' | 'gold' | 'subtle' | 'none';

export interface BrandLogoProps {
  /** Display composition: standalone circular emblem, horizontal lockup, or stacked lockup */
  variant?: BrandLogoVariant;
  /** Surface contrast theme for lockup typography */
  theme?: BrandLogoTheme;
  /** Controlled responsive sizing */
  size?: BrandLogoSize;
  /** Controlled frame treatment matching public website or client portal */
  ring?: BrandLogoRing;
  /** Optional company title override for horizontal/stacked lockups */
  title?: string;
  /** Optional secondary brand line (e.g., "OPHIREUM NETWORK" or "Client Portal") */
  subtitle?: string;
  /** Prioritize loading for above-the-fold placements */
  eager?: boolean;
  /** Mark image decorative when adjacent accessible text already names the brand */
  decorative?: boolean;
  /** Optional wrapper classes */
  className?: string;
}

const EMBLEM_SIZE_CLASSES: Record<BrandLogoSize, string> = {
  xs: 'w-7 h-7',
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
  xl: 'w-16 h-16',
  header: 'w-[44px] h-[44px] sm:w-[54px] sm:h-[54px]',
  hero: 'w-[190px] h-[190px] sm:w-[210px] sm:h-[210px]',
};

const RING_CLASSES: Record<BrandLogoRing, string> = {
  brand:
    'p-[2px] bg-gradient-to-tr from-[#D4AF37] via-[#00C2C7] to-[#C0C7D1] shadow-md shadow-[#00C2C7]/20',
  gold: 'p-[2px] bg-gradient-to-tr from-[#B8923A] via-[#D9B664] to-[#B8923A]/70 shadow-sm',
  subtle: 'p-[1.5px] bg-[#E6E2D8] shadow-xs',
  none: 'p-0 bg-transparent',
};

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'emblem',
  theme = 'dark',
  size = 'md',
  ring = 'brand',
  title = 'Ophireum Multimedia',
  subtitle,
  eager = false,
  decorative = false,
  className = '',
}) => {
  const isHero = size === 'hero';
  const logoSrc = isHero ? BRAND_ASSETS.highResLogo : BRAND_ASSETS.primaryLogo;
  const ringPaddingOverride = isHero && ring === 'brand' ? 'p-[3px] shadow-xl' : '';

  const emblem = (
    <div
      className={`relative aspect-square rounded-full shrink-0 overflow-hidden select-none ${EMBLEM_SIZE_CLASSES[size]} ${RING_CLASSES[ring]} ${ringPaddingOverride}`}
    >
      <img
        src={logoSrc}
        alt={decorative ? '' : BRAND_ASSETS.altText}
        aria-hidden={decorative ? true : undefined}
        loading={eager ? 'eager' : 'lazy'}
        decoding={eager ? 'sync' : 'async'}
        draggable={false}
        className="w-full h-full object-cover rounded-full bg-white"
      />
    </div>
  );

  if (variant === 'emblem') {
    return className ? <div className={`inline-flex items-center justify-center shrink-0 ${className}`}>{emblem}</div> : emblem;
  }

  const titleColor =
    theme === 'light' ? 'text-[#0F1D36]' : 'text-white';

  const subtitleColor =
    theme === 'light'
      ? 'text-[#0F4C3A]'
      : theme === 'portal-dark'
      ? 'text-[#D9B664]'
      : 'text-[#00C2C7]';

  if (variant === 'stacked') {
    return (
      <div className={`inline-flex flex-col items-center text-center ${className}`}>
        {emblem}
        <div className="mt-3 space-y-0.5">
          <span className={`block text-sm font-bold tracking-tight ${titleColor}`}>{title}</span>
          {subtitle && (
            <span className={`block text-[11px] font-medium tracking-wide ${subtitleColor}`}>
              {subtitle}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-3 min-w-0 ${className}`}>
      {emblem}
      <div className="min-w-0 text-left">
        <span
          className={`block font-bold tracking-tight leading-tight truncate ${
            size === 'sm' || size === 'xs' ? 'text-sm' : 'text-[15px]'
          } ${titleColor}`}
        >
          {title}
        </span>
        {subtitle && (
          <span className={`block text-[11px] font-medium tracking-wide truncate mt-0.5 ${subtitleColor}`}>
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
};

export default BrandLogo;
