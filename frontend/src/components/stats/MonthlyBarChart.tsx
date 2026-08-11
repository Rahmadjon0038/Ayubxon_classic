'use client';

import { useState } from 'react';
import { monthFullLabel, monthShortLabel, niceMax } from './chartUtils';

export interface BarSeries {
  key: string;
  label: string;
  color: string;
  values: number[];
}

interface Props {
  months: string[];
  series: BarSeries[];
  monthNames: string[];
  monthNamesShort: string[];
  emptyLabel: string;
  selectedMonth?: string;
}

const PLOT_HEIGHT = 176;

export default function MonthlyBarChart({
  months,
  series,
  monthNames,
  monthNamesShort,
  emptyLabel,
  selectedMonth,
}: Props) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const max = niceMax(Math.max(1, ...series.flatMap((s) => s.values)));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));
  const hasData = series.some((s) => s.values.some((v) => v > 0));

  return (
    <div>
      {series.length > 1 && (
        <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
          {series.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <div
          className="flex flex-col justify-between py-0 text-right text-[10px] text-gray-500 dark:text-gray-500"
          style={{ height: PLOT_HEIGHT }}
        >
          {[...ticks].reverse().map((tick, i) => (
            <span key={i}>{tick.toLocaleString()}</span>
          ))}
        </div>

        <div className="relative flex-1">
          {/* Gorizontal gridlinelar */}
          <div className="absolute inset-0 flex flex-col justify-between" style={{ height: PLOT_HEIGHT }}>
            {ticks.map((_, i) => (
              <div key={i} className="h-px bg-gray-200 dark:bg-gray-800" />
            ))}
          </div>

          {!hasData && (
            <div
              className="relative flex items-center justify-center text-xs text-gray-400 dark:text-gray-600"
              style={{ height: PLOT_HEIGHT }}
            >
              {emptyLabel}
            </div>
          )}

          {hasData && (
            <div className="relative flex items-end gap-1" style={{ height: PLOT_HEIGHT }}>
              {months.map((month, i) => (
                <div
                  key={month}
                  className="relative flex flex-1 items-end justify-center gap-0.5"
                  style={{ height: PLOT_HEIGHT }}
                  onMouseEnter={() => setHoverIndex(i)}
                  onMouseLeave={() => setHoverIndex((cur) => (cur === i ? null : cur))}
                >
                  {month === selectedMonth && (
                    <div
                      className="pointer-events-none absolute inset-x-0 bottom-0 rounded-t-[3px] bg-brand-500/10 dark:bg-brand-400/10"
                      style={{ height: PLOT_HEIGHT }}
                    />
                  )}

                  {hoverIndex === i && (
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 w-max -translate-x-1/2 rounded-md border border-gray-300 bg-white px-2 py-1 text-[11px] shadow-md dark:border-gray-700 dark:bg-gray-800">
                      <p className="font-semibold text-gray-900 dark:text-gray-100">
                        {monthFullLabel(month, monthNames)}
                      </p>
                      {series.map((s) => (
                        <p key={s.key} className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                          {s.label}: {s.values[i].toLocaleString()}
                        </p>
                      ))}
                    </div>
                  )}

                  {series.map((s) => (
                    <div
                      key={s.key}
                      className="w-full rounded-t-[3px] transition-[height]"
                      style={{
                        height: `${Math.max(0, (s.values[i] / max) * PLOT_HEIGHT)}px`,
                        backgroundColor: s.color,
                        maxWidth: series.length > 1 ? 12 : 20,
                        opacity: hoverIndex === null || hoverIndex === i ? 1 : 0.55,
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}

          <div className="mt-1.5 flex gap-1">
            {months.map((month) => (
              <span
                key={month}
                className={
                  month === selectedMonth
                    ? 'flex-1 text-center text-[10px] font-semibold text-brand-600 dark:text-brand-400'
                    : 'flex-1 text-center text-[10px] text-gray-500 dark:text-gray-500'
                }
              >
                {monthShortLabel(month, monthNamesShort)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
