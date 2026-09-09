'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocale } from '@/components/LocaleProvider';
import { api, getErrorMessage } from '@/lib/api';

interface SystemPromptResponse {
  systemPrompt: string;
  category: { id: string; name: string } | null;
}

// Mijozning o'zi AI'ga qanday muomala qilish/qoidalar haqida yozadigan erkin matn —
// bo'sh qoldirilsa, tizim standart (mavjud) qoidalarga tushadi. Super-admin kabinet
// yaratganda tanlagan kategoriyaning namunaviy matni shu yerga boshlang'ich sifatida
// nusxalangan bo'ladi, mijoz uni istalganda o'zgartirishi mumkin.
export default function SystemPromptCard() {
  const { t } = useLocale();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [value, setValue] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  const query = useQuery({
    queryKey: ['system-prompt'],
    queryFn: async () => {
      const { data } = await api.get<SystemPromptResponse>('/system-prompt');
      return data;
    },
  });

  useEffect(() => {
    if (query.data && !dirty) setValue(query.data.systemPrompt);
  }, [query.data, dirty]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.put<{ systemPrompt: string }>('/system-prompt', { systemPrompt: value });
      return data;
    },
    onSuccess: () => {
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      queryClient.invalidateQueries({ queryKey: ['system-prompt'] });
    },
  });

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-tg-border dark:bg-tg-panel">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 p-2 text-left sm:p-4"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-tg-text">
          <Sparkles size={16} className="text-brand-600 dark:text-brand-400" />
          {t('systemPrompt.title')}
          {query.data?.category && (
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-400">
              {query.data.category.name}
            </span>
          )}
        </span>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-slate-200 p-2 dark:border-tg-border sm:p-4">
          <p className="text-xs text-slate-600 dark:text-tg-textMuted">{t('systemPrompt.subtitle')}</p>
          <textarea
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setDirty(true);
            }}
            rows={10}
            placeholder={t('systemPrompt.placeholder')}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-tg-hover dark:bg-tg-panelAlt dark:text-tg-text dark:focus:ring-brand-500/20"
          />

          {saveMutation.isError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-500/10 dark:text-red-400">
              {getErrorMessage(saveMutation.error)}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !dirty}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-50"
            >
              {saveMutation.isPending ? t('common.saving') : t('common.save')}
            </button>
            {saved && (
              <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <Check size={14} />
                {t('systemPrompt.saved')}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
