'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useState } from 'react';
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

export default function AiAssistantPage() {
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

  // Server javobi kelganda formani bir marta to'ldiramiz — undan keyin admin
  // tahrirlashda query qayta yuklansa ham kiritilgan matn ustidan yozib yuborilmaydi.
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

  // Tumbler bosilgan zahoti serverga saqlanadi — asosiy formadan mustaqil,
  // shuning uchun markaz ma'lumotlari hali to'ldirilmagan bo'lsa ham ishlaydi.
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
    setAiEnabled(next); // optimistik yangilanish — tugma darhol siljiydi
    toggleMutation.mutate(next, {
      onError: () => setAiEnabled(!next), // server rad etsa eski holatga qaytariladi
    });
  };

  const inputClass =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100';
  const settings = settingsQuery.data?.settings;

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-lg font-semibold">AI Assistent</h1>
          <p className="mt-1 text-sm text-gray-500">
            Instagram DM&apos;larga avtomatik javob beruvchi AI shu ma&apos;lumotlarga tayanadi.
            Kurslar, narxlar yoki manzil o&apos;zgarsa, shu yerda yangilang — AI keyingi
            xabarlardan boshlab yangi ma&apos;lumotdan foydalanadi.
          </p>
        </div>

        {/* AI yoqish/ochirish */}
        <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-sm font-semibold text-gray-700">AI avtomatik javob</h2>
            <p className="mt-1 text-xs text-gray-500">
              Yoqilgan bo&apos;lsa, kelgan har bir DM&apos;ga AI darhol javob yozadi. O&apos;chirilgan
              bo&apos;lsa, xabarlar faqat inbox&apos;da ko&apos;rinadi va admin qo&apos;lda javob yozadi.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {toggleMutation.isPending && (
              <span className="text-xs text-gray-400">Saqlanmoqda...</span>
            )}
            {toggleMutation.isError && (
              <span className="text-xs text-red-500">{getErrorMessage(toggleMutation.error)}</span>
            )}
            <button
              type="button"
              role="switch"
              aria-checked={aiEnabled}
              onClick={handleToggle}
              disabled={settingsQuery.isLoading || toggleMutation.isPending}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50 ${
                aiEnabled ? 'bg-brand-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                  aiEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {settingsQuery.isLoading && (
          <p className="text-sm text-gray-400">Yuklanmoqda...</p>
        )}

        {settingsQuery.isError && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {getErrorMessage(settingsQuery.error)}
          </p>
        )}

        {!settingsQuery.isLoading && !settingsQuery.isError && (
          <form
            onSubmit={handleSubmit}
            className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">Markaz ma&apos;lumotlari</h2>
              {settings?.updatedAt && (
                <span className="text-xs text-gray-400">
                  Oxirgi yangilanish: {formatDateTime(settings.updatedAt)}
                </span>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
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
              <label className="mb-1 block text-sm font-medium">
                Kurslar va narxlar <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={6}
                maxLength={8000}
                value={form.coursesAndPrices}
                onChange={(e) => setForm({ ...form, coursesAndPrices: e.target.value })}
                className={inputClass}
                placeholder={
                  '- Ingliz tili (Beginner - Advanced): 350,000 so\'m/oy\n' +
                  '- Matematika (abituriyentlar uchun): 400,000 so\'m/oy\n' +
                  'Dars jadvali: Dushanba/Chorshanba/Juma 18:00-20:00'
                }
              />
              <p className="mt-1 text-xs text-gray-400">
                AI faqat shu ro&apos;yxatdagi kurslar haqida gapiradi — mavjud bo&apos;lmagan kursni
                o&apos;ylab topmaydi.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Manzil <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={2}
                maxLength={2000}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className={inputClass}
                placeholder="Toshkent sh., Chilonzor tumani, ..."
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Aloqa telefonlari <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={300}
                value={form.phoneNumbers}
                onChange={(e) => setForm({ ...form, phoneNumbers: e.target.value })}
                className={inputClass}
                placeholder="+998 90 123 45 67, +998 91 234 56 78"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Aksiyalar va chegirmalar</label>
              <textarea
                rows={3}
                maxLength={4000}
                value={form.promotions}
                onChange={(e) => setForm({ ...form, promotions: e.target.value })}
                className={inputClass}
                placeholder="Ixtiyoriy — masalan: Avgust oyida ro'yxatdan o'tganlarga 20% chegirma"
              />
            </div>

            {saveMutation.isError && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {getErrorMessage(saveMutation.error)}
              </p>
            )}
            {saveMutation.isSuccess && (
              <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
                Saqlandi ✓ AI keyingi xabarlarda shu ma&apos;lumotdan foydalanadi.
              </p>
            )}

            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              {saveMutation.isPending ? 'Saqlanmoqda...' : 'Saqlash'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
