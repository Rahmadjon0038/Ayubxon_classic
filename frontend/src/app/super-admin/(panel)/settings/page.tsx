'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Upload } from 'lucide-react';
import { ChangeEvent, useRef } from 'react';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import LogoMark from '@/components/LogoMark';
import { useLocale } from '@/components/LocaleProvider';
import ThemeToggle from '@/components/ThemeToggle';
import { getErrorMessage, superAdminApi } from '@/lib/api';
import { formatDateTime } from '@/lib/format';

interface SuperAdminMe {
  id: string;
  email: string;
  createdAt: string;
}

function LogoUploadCard() {
  const { t } = useLocale();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await superAdminApi.post<{ logoUrl: string }>('/logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-logo'] });
    },
  });

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadMutation.mutate(file);
    e.target.value = '';
  };

  return (
    <div className="rounded-xl border border-gray-300 bg-white p-4 shadow-sm sm:p-5 dark:border-tg-border dark:bg-tg-panel">
      <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-tg-textMuted">{t('superAdmin.platformLogo')}</h2>
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-tg-hover dark:bg-tg-panelAlt">
          <LogoMark width={56} height={56} />
        </div>
        <div className="min-w-0 flex-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 dark:border-tg-hover dark:text-tg-text dark:hover:bg-tg-panelAlt"
          >
            <Upload size={15} />
            {uploadMutation.isPending ? t('superAdmin.uploadingLogo') : t('superAdmin.uploadLogo')}
          </button>
          {uploadMutation.isError && (
            <p className="mt-2 text-xs text-red-600 dark:text-red-400">{getErrorMessage(uploadMutation.error)}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SuperAdminSettingsPage() {
  const { t } = useLocale();
  const meQuery = useQuery({
    queryKey: ['super-admin', 'me'],
    queryFn: async () => {
      const { data } = await superAdminApi.get<{ superAdmin: SuperAdminMe }>('/me');
      return data.superAdmin;
    },
  });

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-lg font-semibold dark:text-tg-text">{t('superAdmin.settingsTitle')}</h1>

        <LogoUploadCard />

        <div className="rounded-xl border border-gray-300 bg-white p-4 shadow-sm sm:p-5 dark:border-tg-border dark:bg-tg-panel">
          <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-tg-textMuted">{t('settings.appearance')}</h2>
          <div className="flex flex-wrap items-center gap-3">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>

        <div className="rounded-xl border border-gray-300 bg-white p-4 shadow-sm sm:p-5 dark:border-tg-border dark:bg-tg-panel">
          <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-tg-textMuted">{t('settings.administrator')}</h2>
          {meQuery.isLoading ? (
            <p className="text-sm text-gray-500 dark:text-tg-textFaint">{t('common.loading')}</p>
          ) : (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-gray-600 dark:text-tg-textMuted">{t('common.email')}</dt>
              <dd className="min-w-0 break-all dark:text-tg-text">{meQuery.data?.email}</dd>
              <dt className="text-gray-600 dark:text-tg-textMuted">{t('settings.createdAt')}</dt>
              <dd className="min-w-0 break-all dark:text-tg-text">
                {meQuery.data?.createdAt ? formatDateTime(meQuery.data.createdAt) : '—'}
              </dd>
            </dl>
          )}
        </div>
      </div>
    </div>
  );
}
