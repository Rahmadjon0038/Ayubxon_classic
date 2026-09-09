'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import LogoMark from './LogoMark';
import { usePlatformLogo } from '@/lib/usePlatformLogo';

interface Props {
  width?: number;
  height?: number;
}

// Faqat super-admin paneli ichida ishlatiladi (sidebar, sozlamalar). Oddiy foydalanuvchi
// kabinetlarida va login/bosh sahifada bu komponent umuman ishlatilmaydi — ular hamma
// vaqt standart LogoMark'ni ko'radi. Super-admin galereyadan rasm yuklagan bo'lsa, shu
// rasm dumaloq avatar sifatida ko'rsatiladi va bosilganda ekran markazida kattalashadi.
export default function SuperAdminLogo({ width = 40, height = 40 }: Props) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const platformLogoQuery = usePlatformLogo();
  const customLogoUrl = platformLogoQuery.data;

  useEffect(() => {
    if (!previewOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [previewOpen]);

  if (!customLogoUrl) {
    // Hali maxsus logo yuklanmagan — standart logo, oddiy holicha (bosilmaydi).
    return <LogoMark width={width} height={height} />;
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setPreviewOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') setPreviewOpen(true);
        }}
        className="relative shrink-0 cursor-zoom-in overflow-hidden rounded-full"
        style={{ width, height }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={customLogoUrl} alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
      </div>

      {previewOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          // document.body ga portal orqali chiqariladi — aks holda ota elementlardagi
          // backdrop-blur/filter kabi CSS xususiyatlari fixed pozitsiyalash uchun yangi
          // "containing block" yaratib, rasm butun ekran o'rniga ota konteyner ichida
          // joylashib qolishiga sabab bo'ladi.
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-6"
            onClick={() => setPreviewOpen(false)}
          >
            <button
              type="button"
              onClick={() => setPreviewOpen(false)}
              aria-label="Close"
              className="absolute right-5 top-5 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={customLogoUrl}
              alt=""
              className="max-h-[80vh] max-w-[80vw] rounded-2xl object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>,
          document.body,
        )}
    </>
  );
}
