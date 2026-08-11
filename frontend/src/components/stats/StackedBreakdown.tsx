'use client';

import { useState } from 'react';

export interface BreakdownSegment {
  key: string;
  label: string;
  color: string;
  value: number;
}

interface Props {
  segments: BreakdownSegment[];
  emptyLabel: string;
}

export default function StackedBreakdown({ segments, emptyLabel }: Props) {
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  if (total === 0) {
    return (
      <div className="flex h-24 items-center justify-center text-xs text-gray-400 dark:text-gray-600">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div>
      <div className="flex h-4 w-full gap-0.5 overflow-hidden rounded-full">
        {segments
          .filter((s) => s.value > 0)
          .map((s) => (
            <div
              key={s.key}
              onMouseEnter={() => setHoverKey(s.key)}
              onMouseLeave={() => setHoverKey((cur) => (cur === s.key ? null : cur))}
              className="h-full transition-opacity"
              style={{
                width: `${(s.value / total) * 100}%`,
                backgroundColor: s.color,
                opacity: hoverKey === null || hoverKey === s.key ? 1 : 0.5,
              }}
              title={`${s.label}: ${s.value.toLocaleString()}`}
            />
          ))}
      </div>

      <ul className="mt-3 space-y-1.5">
        {segments.map((s) => {
          const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
          return (
            <li
              key={s.key}
              onMouseEnter={() => setHoverKey(s.key)}
              onMouseLeave={() => setHoverKey((cur) => (cur === s.key ? null : cur))}
              className="flex items-center justify-between gap-2 text-xs"
            >
              <span className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                {s.label}
              </span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {s.value.toLocaleString()} <span className="text-gray-500 dark:text-gray-500">({pct}%)</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
