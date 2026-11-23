/*
Copyright (c) 2026 Ophireum Multimedia Production. All rights reserved.
Developer and claimed rights holder: Ophireum Multimedia Production
DTI-registered business, Philippines | Registration No. 7567003
SPDX-FileCopyrightText: 2026 Ophireum Multimedia Production
SPDX-License-Identifier: LicenseRef-Ophireum-Proprietary
Third-party materials, dependencies, and separately licensed components remain subject to their respective rights and licenses.
*/

import React from 'react';
import { TechIconKind } from '../../types';

interface ServiceTechIconProps {
  kind: TechIconKind;
  size?: 'sm' | 'md' | 'lg';
  ambient?: boolean;
  accent?: 'cyan' | 'gold' | 'silver';
  className?: string;
}

export const ServiceTechIcon: React.FC<ServiceTechIconProps> = ({
  kind,
  size = 'md',
  ambient = false,
  accent = 'cyan',
  className = '',
}) => {
  const dimensions =
    size === 'lg' ? 'w-14 h-14' : size === 'sm' ? 'w-9 h-9' : 'w-11 h-11';
  const strokePrimary =
    accent === 'gold' ? '#D4AF37' : accent === 'silver' ? '#C0C7D1' : '#00C2C7';
  const strokeSecondary = accent === 'gold' ? '#00C2C7' : '#D4AF37';

  const motionClass = ambient
    ? 'ophireum-tech-ambient'
    : 'ophireum-tech-interactive';

  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-xl bg-[#0B1220] border border-slate-700/80 ${dimensions} shrink-0 overflow-hidden ${motionClass} ${className}`}
      aria-hidden="true"
    >
      {kind === 'ai' && (
        <svg viewBox="0 0 48 48" className="w-7 h-7" fill="none">
          <path
            d="M12 16 L24 24 L36 16 M12 32 L24 24 L36 32 M24 10 L24 38"
            stroke={strokePrimary}
            strokeWidth="1.5"
            strokeOpacity="0.45"
            className="tech-path"
          />
          <circle cx="12" cy="16" r="2.6" fill="#C0C7D1" />
          <circle cx="36" cy="16" r="2.6" fill="#C0C7D1" />
          <circle cx="12" cy="32" r="2.6" fill="#C0C7D1" />
          <circle cx="36" cy="32" r="2.6" fill="#C0C7D1" />
          <circle cx="24" cy="10" r="2.2" fill={strokeSecondary} />
          <circle cx="24" cy="38" r="2.2" fill={strokeSecondary} />
          <circle
            cx="24"
            cy="24"
            r="5.5"
            fill="#111827"
            stroke={strokePrimary}
            strokeWidth="2"
            className="tech-core"
          />
          <circle cx="24" cy="24" r="2" fill={strokePrimary} />
        </svg>
      )}

      {kind === 'blockchain' && (
        <svg viewBox="0 0 48 48" className="w-7 h-7" fill="none">
          <path
            d="M16 18 L24 14 L32 18 M16 30 L24 34 L32 30 M16 18 L16 30 M32 18 L32 30 M24 14 L24 24"
            stroke={strokePrimary}
            strokeWidth="1.4"
            strokeOpacity="0.55"
            className="tech-path"
          />
          <rect x="20" y="9" width="8" height="8" rx="1.5" fill="#111827" stroke={strokeSecondary} strokeWidth="1.6" />
          <rect x="9" y="21" width="8" height="8" rx="1.5" fill="#111827" stroke={strokePrimary} strokeWidth="1.6" />
          <rect x="31" y="21" width="8" height="8" rx="1.5" fill="#111827" stroke={strokePrimary} strokeWidth="1.6" />
          <rect x="20" y="31" width="8" height="8" rx="1.5" fill="#111827" stroke={strokePrimary} strokeWidth="1.6" className="tech-core" />
        </svg>
      )}

      {kind === 'website' && (
        <svg viewBox="0 0 48 48" className="w-7 h-7" fill="none">
          <rect x="8" y="11" width="32" height="24" rx="3" fill="#111827" stroke={strokePrimary} strokeWidth="1.7" />
          <line x1="8" y1="17" x2="40" y2="17" stroke={strokePrimary} strokeWidth="1.4" strokeOpacity="0.6" />
          <circle cx="12" cy="14" r="1" fill={strokeSecondary} />
          <circle cx="15.5" cy="14" r="1" fill="#C0C7D1" />
          <rect x="12" y="21" width="12" height="10" rx="1.5" stroke="#C0C7D1" strokeWidth="1.3" strokeOpacity="0.7" className="tech-layer" />
          <line x1="27" y1="22" x2="36" y2="22" stroke={strokePrimary} strokeWidth="1.6" strokeLinecap="round" />
          <line x1="27" y1="26" x2="34" y2="26" stroke="#C0C7D1" strokeWidth="1.4" strokeLinecap="round" />
          <line x1="27" y1="30" x2="36" y2="30" stroke={strokeSecondary} strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      )}

      {kind === 'cloud' && (
        <svg viewBox="0 0 48 48" className="w-7 h-7" fill="none">
          <path
            d="M15 30 H33 C36.3 30 39 27.3 39 24 C39 21 36.8 18.5 33.9 18.1 C32.8 14.1 29.1 11.2 24.8 11.2 C19.7 11.2 15.5 15.2 15.2 20.2 C12.2 20.7 10 23.2 10 26.2 C10 28.3 12.2 30 15 30 Z"
            fill="#111827"
            stroke={strokePrimary}
            strokeWidth="1.7"
          />
          <circle cx="18" cy="37" r="2" fill={strokePrimary} />
          <circle cx="24" cy="37" r="2" fill={strokeSecondary} className="tech-core" />
          <circle cx="30" cy="37" r="2" fill={strokePrimary} />
          <path d="M18 30 V35 M24 30 V35 M30 30 V35" stroke="#C0C7D1" strokeWidth="1.3" strokeOpacity="0.6" className="tech-path" />
        </svg>
      )}

      {kind === 'cybersecurity' && (
        <svg viewBox="0 0 48 48" className="w-7 h-7" fill="none">
          <path
            d="M24 8 L37 13.5 V23.5 C37 31.5 31.3 37.8 24 40 C16.7 37.8 11 31.5 11 23.5 V13.5 L24 8 Z"
            fill="#111827"
            stroke={strokePrimary}
            strokeWidth="1.7"
          />
          <rect x="19" y="22" width="10" height="8" rx="1.5" stroke={strokeSecondary} strokeWidth="1.6" />
          <path d="M21 22 V19.5 C21 17.8 22.3 16.5 24 16.5 C25.7 16.5 27 17.8 27 19.5 V22" stroke="#C0C7D1" strokeWidth="1.5" />
          <circle cx="24" cy="26" r="1.2" fill={strokePrimary} className="tech-core" />
        </svg>
      )}

      {kind === 'enterprise' && (
        <svg viewBox="0 0 48 48" className="w-7 h-7" fill="none">
          <rect x="9" y="10" width="13" height="12" rx="2" fill="#111827" stroke={strokePrimary} strokeWidth="1.6" />
          <rect x="26" y="10" width="13" height="12" rx="2" fill="#111827" stroke={strokeSecondary} strokeWidth="1.6" />
          <rect x="9" y="26" width="13" height="12" rx="2" fill="#111827" stroke="#C0C7D1" strokeWidth="1.5" />
          <rect x="26" y="26" width="13" height="12" rx="2" fill="#111827" stroke={strokePrimary} strokeWidth="1.6" className="tech-layer" />
          <path d="M22 16 H26 M22 32 H26 M15.5 22 V26 M32.5 22 V26" stroke={strokePrimary} strokeWidth="1.5" strokeOpacity="0.6" className="tech-path" />
        </svg>
      )}

      {kind === 'mobile' && (
        <svg viewBox="0 0 48 48" className="w-7 h-7" fill="none">
          <rect x="15" y="7" width="18" height="34" rx="3.5" fill="#111827" stroke={strokePrimary} strokeWidth="1.7" />
          <line x1="21" y1="11" x2="27" y2="11" stroke="#C0C7D1" strokeWidth="1.4" strokeLinecap="round" />
          <rect x="18" y="15" width="12" height="8" rx="1.5" stroke={strokeSecondary} strokeWidth="1.3" className="tech-layer" />
          <rect x="18" y="26" width="12" height="7" rx="1.5" stroke={strokePrimary} strokeWidth="1.3" strokeOpacity="0.7" />
          <circle cx="24" cy="37" r="1.4" fill={strokePrimary} />
        </svg>
      )}

      {kind === 'automation' && (
        <svg viewBox="0 0 48 48" className="w-7 h-7" fill="none">
          <path
            d="M14 14 H30 L34 24 H18 L14 34 H34"
            stroke={strokePrimary}
            strokeWidth="1.6"
            strokeOpacity="0.55"
            className="tech-path"
          />
          <circle cx="14" cy="14" r="3.5" fill="#111827" stroke={strokePrimary} strokeWidth="1.7" />
          <circle cx="34" cy="24" r="3.5" fill="#111827" stroke={strokeSecondary} strokeWidth="1.7" className="tech-core" />
          <circle cx="34" cy="34" r="3.5" fill="#111827" stroke={strokePrimary} strokeWidth="1.7" />
          <circle cx="14" cy="34" r="3" fill="#111827" stroke="#C0C7D1" strokeWidth="1.5" />
        </svg>
      )}

      {kind === 'multimedia' && (
        <svg viewBox="0 0 48 48" className="w-7 h-7" fill="none">
          <rect x="8" y="11" width="32" height="19" rx="2.5" fill="#111827" stroke={strokePrimary} strokeWidth="1.7" />
          <polygon points="21,16 30,20.5 21,25" fill={strokeSecondary} className="tech-core" />
          <line x1="9" y1="35" x2="39" y2="35" stroke="#475569" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="12" y1="35" x2="26" y2="35" stroke={strokePrimary} strokeWidth="2.5" strokeLinecap="round" className="tech-layer" />
          <circle cx="26" cy="35" r="2.2" fill={strokeSecondary} />
        </svg>
      )}

      {kind === 'analytics' && (
        <svg viewBox="0 0 48 48" className="w-7 h-7" fill="none">
          <line x1="10" y1="36" x2="38" y2="36" stroke="#475569" strokeWidth="1.6" strokeLinecap="round" />
          <rect x="12" y="25" width="4.5" height="9" rx="1" fill={strokePrimary} fillOpacity="0.85" />
          <rect x="20" y="19" width="4.5" height="15" rx="1" fill={strokePrimary} />
          <rect x="28" y="14" width="4.5" height="20" rx="1" fill={strokeSecondary} className="tech-layer" />
          <path d="M12 20 L21 15 L29 11 L37 9" stroke="#C0C7D1" strokeWidth="1.5" strokeLinecap="round" className="tech-path" />
          <circle cx="37" cy="9" r="2" fill={strokePrimary} className="tech-core" />
        </svg>
      )}
    </div>
  );
};
