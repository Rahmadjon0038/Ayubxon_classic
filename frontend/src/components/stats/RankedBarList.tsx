'use client';

interface Item {
  label: string;
  value: number;
}

interface Props {
  items: Item[];
  color: string;
  emptyLabel: string;
}

export default function RankedBarList({ items, color, emptyLabel }: Props) {
  if (items.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center text-xs text-gray-400 dark:text-tg-textFaint">
        {emptyLabel}
      </div>
    );
  }

  const max = Math.max(...items.map((i) => i.value));

  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item.label}>
          <div className="mb-1 flex items-center justify-between gap-2 text-xs">
            <span className="truncate text-gray-700 dark:text-tg-textMuted">{item.label}</span>
            <span className="shrink-0 font-medium text-gray-900 dark:text-tg-text">{item.value}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-tg-panelAlt">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.max(4, (item.value / max) * 100)}%`, backgroundColor: color }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
