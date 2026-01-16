import { motion } from 'framer-motion';
import { useId, useMemo, useState } from 'react';

import { appEnv } from '../../lib/env';

interface AuroraSentinelLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
  glowing?: boolean;
  markScale?: number;
}

const sizeMap = {
  sm: { text: 'text-2xl', iconPx: 32 },
  md: { text: 'text-4xl', iconPx: 40 },
  lg: { text: 'text-5xl', iconPx: 48 },
  xl: { text: 'text-6xl', iconPx: 56 },
} as const;

export default function AuroraSentinelLogo({
  size = 'md',
  showText = true,
  className = '',
  glowing = false,
  markScale = 1,
}: AuroraSentinelLogoProps) {
  const { text, iconPx } = sizeMap[size];
  const gradientId = useId();
  const [logoIndex, setLogoIndex] = useState(0);

  const logoCandidates = useMemo(() => {
    const prefix = appEnv.assetBasePath();
    return [
      `${prefix}aurora-sentinel-logo.png`,
      `${prefix}aurora-sentinel-logo.webp`,
      `${prefix}aurora-sentinel-logo.svg`,
      `${prefix}logo.png`,
      `${prefix}logo.webp`,
      `${prefix}logo.svg`,
      `${prefix}aurora-logo.png`,
    ];
  }, []);

  const logoSrc = logoCandidates[logoIndex];
  const logoAvailable = logoIndex < logoCandidates.length;
  const iconSize = Math.max(12, Math.round(iconPx * (Number.isFinite(markScale) ? markScale : 1)));
  const safeScale = Number.isFinite(markScale) ? markScale : 1;
  const markBottomMarginClass = safeScale >= 4 ? '-mb-12' : safeScale >= 2 ? '-mb-6' : 'mb-2';
  const textTightClass = safeScale >= 4 ? '-mt-8 leading-none' : safeScale >= 2 ? '-mt-5 leading-none' : 'leading-tight';
  const markImgTightClass = safeScale >= 4 ? 'scale-[1.18] -translate-y-2' : safeScale >= 2 ? 'scale-[1.1] -translate-y-1' : '';

  return (
    <div className={`flex flex-col items-center gap-0 ${className}`}>
      <motion.div
        animate={
          glowing
            ? {
                filter: [
                  'drop-shadow(0 0 20px rgba(34, 211, 238, 0.35))',
                  'drop-shadow(0 0 40px rgba(34, 211, 238, 0.55))',
                  'drop-shadow(0 0 20px rgba(34, 211, 238, 0.35))',
                ],
              }
            : {}
        }
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        className="text-center"
      >
        <div className={`flex items-center justify-center ${markBottomMarginClass}`}>
          <div className="relative" style={{ width: iconSize, height: iconSize }}>
            {logoAvailable ? (
              <img
                src={logoSrc}
                alt="Aurora Sentinel"
                className={`absolute inset-0 w-full h-full object-contain ${markImgTightClass}`}
                onError={() => setLogoIndex((i) => i + 1)}
              />
            ) : (
              <svg viewBox="0 0 64 64" className="absolute inset-0 w-full h-full" aria-hidden="true">
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--aurora-cyan))" />
                    <stop offset="45%" stopColor="hsl(var(--aurora-blue))" />
                    <stop offset="100%" stopColor="hsl(var(--aurora-violet))" />
                  </linearGradient>
                </defs>
                <path
                  d="M32 4c8 6 16 6 24 8v22c0 15-10 24-24 28C18 58 8 49 8 34V12c8-2 16-2 24-8Z"
                  fill={`url(#${gradientId})`}
                  opacity="0.95"
                />
                <path
                  d="M32 14c5 4 10 4 16 5v14c0 9-6 15-16 17-10-2-16-8-16-17V19c6-1 11-1 16-5Z"
                  fill="hsl(var(--background))" 
                  opacity="0.55"
                />
                <path
                  d="M18 34c6-2 10-6 14-12 2 7 7 12 14 14-6 2-10 6-14 12-2-7-7-12-14-14Z"
                  fill={`url(#${gradientId})`}
                  opacity="0.8"
                />
              </svg>
            )}
            <div
              className="absolute inset-0 rounded-full blur-xl"
              style={{ background: 'radial-gradient(circle, hsl(var(--aurora-cyan) / 0.25), transparent 65%)' }}
            />
          </div>
        </div>
        {showText ? (
          <h1 className={`${text} font-bold tracking-tight ${textTightClass}`}>
            <span className="text-foreground">Aurora</span>{' '}
            <span className="aurora-text">Sentinel</span>
          </h1>
        ) : null}
      </motion.div>
    </div>
  );
}
