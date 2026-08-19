'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useState } from 'react';
import { useLocale } from '@/components/LocaleProvider';
import { api, getErrorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { AcademySettings } from '@/lib/types';

interface SettingsResponse {
  settings: AcademySettings | null;
  aiEnabled: boolean;
}

interface FormState {
  academyName: string;
  coursesAndPrices: string;
  address: string;
  phoneNumbers: string;
  promotions: string;
}

const emptyForm: FormState = {
  academyName: '',
  coursesAndPrices: '',
  address: '',
  phoneNumbers: '',
  promotions: '',
};

export default function AiAssistantLegacyPage() {
  const { t } = useLocale();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const settingsQuery = useQuery({
    queryKey: ['academy-settings'],
    queryFn: async () => {
      const { data } = await api.get<SettingsResponse>('/academy-settings');
      return data;
    },
  });

  useEffect(() => {
    if (!settingsQuery.data || hydrated) return;
    const { settings, aiEnabled: enabled } = settingsQuery.data;
    if (settings) {
      setForm({
        academyName: settings.academyName,
        coursesAndPrices: settings.coursesAndPrices,
        address: settings.address,
        phoneNumbers: settings.phoneNumbers,
        promotions: settings.promotions ?? '',
      });
    }
    setAiEnabled(enabled);
    setHydrated(true);
  }, [settingsQuery.data, hydrated]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.put<SettingsResponse>('/academy-settings', form);
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['academy-settings'], data);
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    saveMutation.mutate();
  };

  const toggleMutation = useMutation({
    mutationFn: async (next: boolean) => {
      const { data } = await api.patch<{ aiEnabled: boolean }>('/academy-settings/ai-toggle', {
        aiEnabled: next,
      });
      return data;
    },
    onSuccess: (data) => {
      setAiEnabled(data.aiEnabled);
      queryClient.setQueryData<SettingsResponse | undefined>(['academy-settings'], (old) =>
        old ? { ...old, aiEnabled: data.aiEnabled } : old,
      );
    },
  });

  const handleToggle = () => {
    const next = !aiEnabled;
    setAiEnabled(next);
    toggleMutation.mutate(next, {
      onError: () => setAiEnabled(!next),
    });
  };

  const inputClass =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:ring-brand-500/20';
  const settings = settingsQuery.data?.settings;

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-lg font-semibold dark:text-gray-100">AI Assistent - Eski sahifa</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Bu sahifa eski markaz ma&apos;lumotlari formasi. Yangi sahifa uchun ma&apos;lumotlarni shu yerdan ko&apos;chirib olishingiz mumkin.
          </p>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-gray-300 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">AI avtomatik javob</h2>
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
              Yoqilgan bo&apos;lsa, kelgan har bir DM&apos;ga AI darhol javob yozadi. O&apos;chirilgan bo&apos;lsa, xabarlar faqat inbox&apos;da ko&apos;rinadi va admin qo&apos;lda javob yozadi.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={aiEnabled}
            onClick={handleToggle}
            disabled={settingsQuery.isLoading || toggleMutation.isPending}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50 ${
              aiEnabled ? 'bg-brand-600' : 'bg-gray-300 dark:bg-gray-700'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                aiEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {settingsQuery.isLoading && (
          <p className="text-sm text-gray-500 dark:text-gray-500">{t('common.loading')}</p>
        )}

        {settingsQuery.isError && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
            {getErrorMessage(settingsQuery.error)}
          </p>
        )}

        {!settingsQuery.isLoading && !settingsQuery.isError && (
          <form
            onSubmit={handleSubmit}
            className="space-y-4 rounded-xl border border-gray-300 bg-white p-4 shadow-sm sm:p-5 dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Markaz ma&apos;lumotlari</h2>
              {settings?.updatedAt && (
                <span className="text-xs text-gray-500 dark:text-gray-500">
                  Oxirgi yangilanish: {formatDateTime(settings.updatedAt)}
                </span>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium dark:text-gray-200">
                Markaz nomi <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={200}
                value={form.academyName}
                onChange={(e) => setForm({ ...form, academyName: e.target.value })}
                className={inputClass}
                placeholder="Masalan: Star Education o'quv markazi"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium dark:text-gray-200">
                Kurslar va narxlar <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={10}
                maxLength={8000}
                value={form.coursesAndPrices}
                onChange={(e) => setForm({ ...form, coursesAndPrices: e.target.value })}
                className={inputClass}
                placeholder="- Ingliz tili (Beginner - Advanced): 350,000 so'm/oy"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium dark:text-gray-200">
                Manzil <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={5}
                maxLength={2000}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className={inputClass}
                placeholder="Toshkent sh., ..."
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium dark:text-gray-200">
                Aloqa telefonlari <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                maxLength={300}
                value={form.phoneNumbers}
                onChange={(e) => setForm({ ...form, phoneNumbers: e.target.value })}
                className={inputClass}
                placeholder="+998 90 123 45 67, +998 91 234 56 78"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium dark:text-gray-200">Aksiyalar va chegirmalar</label>
              <textarea
                rows={4}
                maxLength={4000}
                value={form.promotions}
                onChange={(e) => setForm({ ...form, promotions: e.target.value })}
                className={inputClass}
                placeholder="Ixtiyoriy — masalan: Avgust oyida ro'yxatdan o'tganlarga 20% chegirma"
              />
            </div>

            {saveMutation.isError && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
                {getErrorMessage(saveMutation.error)}
              </p>
            )}
            {saveMutation.isSuccess && (
              <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-500/10 dark:text-green-400">
                Saqlandi ✓ AI keyingi xabarlarda shu ma&apos;lumotdan foydalanadi.
              </p>
            )}

            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              {saveMutation.isPending ? t('common.saving') : t('common.save')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
