'use client';

import { useEffect, useState } from 'react';
import { usePlatformLogo } from '@/lib/usePlatformLogo';

interface Props {
  className?: string;
  width?: number;
  height?: number;
  showLabel?: boolean;
  // Avatar-ko'rinishda (dumaloq, kadrga to'ldirib kesilgan) ko'rsatish uchun —
  // sidebar/sozlamalardagi kichik logo belgisida ishlatiladi.
  rounded?: boolean;
  // Bosilganda logoni butun ekran markazida kattalashtirib ko'rsatadi.
  previewOnClick?: boolean;
}

export default function LogoMark({
  className = '',
  width = 120,
  height = 40,
  showLabel = false,
  rounded = false,
  previewOnClick = false,
}: Props) {
  const [isDark, setIsDark] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
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
  const canPreview = previewOnClick && Boolean(src);

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div
        role={canPreview ? 'button' : undefined}
        tabIndex={canPreview ? 0 : undefined}
        onClick={canPreview ? () => setPreviewOpen(true) : undefined}
        onKeyDown={
          canPreview
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') setPreviewOpen(true);
              }
            : undefined
        }
        className={`relative shrink-0 overflow-hidden ${rounded ? 'rounded-full' : ''} ${
          canPreview ? 'cursor-zoom-in' : ''
        }`}
        style={{ width, height }}
        aria-hidden={!canPreview}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          className={`absolute inset-0 h-full w-full object-center ${rounded ? 'object-cover' : 'object-contain'}`}
        />
      </div>
      {showLabel && <span className="text-sm font-semibold tracking-tight text-slate-900 dark:text-tg-text">InboxCrm</span>}

      {previewOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-6"
          onClick={() => setPreviewOpen(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            className="max-h-[80vh] max-w-[80vw] rounded-2xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
