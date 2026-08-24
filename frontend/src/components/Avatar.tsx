'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface AvatarProps {
  src: string | null;
  name: string;
  size?: number;
  enlargeOnClick?: boolean;
}

export default function Avatar({ src, name, size = 40, enlargeOnClick = false }: AvatarProps) {
  const [hasError, setHasError] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  useEffect(() => {
    if (!expanded) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setExpanded(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [expanded]);

  const initials = name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  if (src && !hasError) {
    const clickable = enlargeOnClick;
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={name}
          width={size}
          height={size}
          className={`shrink-0 rounded-full object-cover ${clickable ? 'cursor-pointer transition hover:opacity-80' : ''}`}
          style={{ width: size, height: size }}
          onError={() => setHasError(true)}
          onClick={
            clickable
              ? (event) => {
                  event.stopPropagation();
                  setExpanded(true);
                }
              : undefined
          }
        />
        {expanded &&
          createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-6 backdrop-blur-sm"
              onClick={(event) => {
                event.stopPropagation();
                setExpanded(false);
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={name}
                className="max-h-[85vh] max-w-[85vw] rounded-2xl object-contain shadow-2xl"
              />
              <p className="absolute bottom-8 left-1/2 -translate-x-1/2 text-sm font-medium text-white/90">
                {name}
              </p>
            </div>,
            document.body,
          )}
      </>
    );
  }

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-gray-200 text-sm font-medium text-gray-600 dark:bg-tg-hover dark:text-tg-textMuted"
      style={{ width: size, height: size }}
    >
      {initials || '?'}
    </div>
  );
}
