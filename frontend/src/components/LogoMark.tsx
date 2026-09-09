'use client';

import { useEffect, useState } from 'react';
import { usePlatformLogo } from '@/lib/usePlatformLogo';

interface Props {
  className?: string;
  width?: number;
  height?: number;
  showLabel?: boolean;
}

export default function LogoMark({ className = '', width = 120, height = 40, showLabel = false }: Props) {
  const [isDark, setIsDark] = useState(false);
  const platformLogoQuery = usePlatformLogo();

  useEffect(() => {
    const updateTheme = () => setIsDark(document.documentElement.classList.contains('dark'));
    updateTheme();

    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => observer.disconnect();
  }, []);

  // Super-admin galereyadan tanlab qo'ygan rasm bo'lsa shu ustuvor — bo'lmasa
  // (yoki hali yuklanmoqda) standart tema bo'yicha SVG logoga tushiladi.
  const src = platformLogoQuery.data || (isDark ? '/inboxcrm-dark.svg' : '/inboxcrm-light.svg');

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div
        className="relative shrink-0 overflow-hidden"
        style={{ width, height }}
        aria-hidden="true"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="absolute inset-0 h-full w-full object-contain object-center" />
      </div>
      {showLabel && <span className="text-sm font-semibold tracking-tight text-slate-900 dark:text-tg-text">InboxCrm</span>}
    </div>
  );
}
