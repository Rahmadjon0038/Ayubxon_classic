'use client';

import { useQuery } from '@tanstack/react-query';
import { ExternalLink, FileText, ShieldCheck } from 'lucide-react';
import { useLocale } from '@/components/LocaleProvider';
import { api, API_URL } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { Admin } from '@/lib/types';

export default function SettingsPage() {
  const { t } = useLocale();
  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const { data } = await api.get<{ admin: Admin }>('/auth/me');
      return data.admin;
    },
  });

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-lg font-semibold dark:text-gray-100">{t('settings.title')}</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{t('settings.subtitle')}</p>
        </div>

        <div className="rounded-xl border border-gray-300 bg-white p-4 shadow-sm sm:p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">{t('settings.administrator')}</h2>
          {meQuery.isLoading ? (
            <p className="text-sm text-gray-500 dark:text-gray-500">{t('common.loading')}</p>
          ) : (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-gray-600 dark:text-gray-400">{t('common.email')}</dt>
              <dd className="min-w-0 break-all dark:text-gray-200">{meQuery.data?.email}</dd>
              <dt className="text-gray-600 dark:text-gray-400">{t('settings.createdAt')}</dt>
              <dd className="min-w-0 break-all dark:text-gray-200">
                {meQuery.data?.createdAt ? formatDateTime(meQuery.data.createdAt) : '—'}
              </dd>
            </dl>
          )}
        </div>

        <div className="rounded-xl border border-gray-300 bg-white p-4 shadow-sm sm:p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">{t('settings.system')}</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="shrink-0 text-gray-600 dark:text-gray-400">{t('settings.backendApi')}</dt>
            <dd className="min-w-0 break-all font-mono text-xs dark:text-gray-200">{API_URL}</dd>
            <dt className="shrink-0 text-gray-600 dark:text-gray-400">{t('settings.webhookUrl')}</dt>
            <dd className="min-w-0 break-all font-mono text-xs dark:text-gray-200">{API_URL}/api/webhooks/instagram</dd>
          </dl>
        </div>

        <div className="rounded-xl border border-gray-300 bg-white p-4 shadow-sm sm:p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">{t('settings.legalDocs')}</h2>
          <div className="flex flex-col gap-2 sm:flex-row">
            <a
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-1 items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <FileText size={16} className="shrink-0 text-gray-600 dark:text-gray-400" />
              {t('settings.terms')}
              <ExternalLink size={13} className="ml-auto shrink-0 text-gray-500 dark:text-gray-500" />
            </a>
            <a
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-1 items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <ShieldCheck size={16} className="shrink-0 text-gray-600 dark:text-gray-400" />
              {t('settings.privacy')}
              <ExternalLink size={13} className="ml-auto shrink-0 text-gray-500 dark:text-gray-500" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
