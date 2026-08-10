'use client';

import { useQuery } from '@tanstack/react-query';
import { ExternalLink, FileText, ShieldCheck } from 'lucide-react';
import { api, API_URL } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { Admin } from '@/lib/types';

export default function SettingsPage() {
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
          <h1 className="text-lg font-semibold">Sozlamalar</h1>
          <p className="mt-1 text-sm text-gray-500">Platforma va admin malumotlari.</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">Administrator</h2>
          {meQuery.isLoading ? (
            <p className="text-sm text-gray-400">Yuklanmoqda...</p>
          ) : (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-gray-500">Email</dt>
              <dd className="min-w-0 break-all">{meQuery.data?.email}</dd>
              <dt className="text-gray-500">Yaratilgan</dt>
              <dd className="min-w-0 break-all">
                {meQuery.data?.createdAt ? formatDateTime(meQuery.data.createdAt) : '—'}
              </dd>
            </dl>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">Tizim</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="shrink-0 text-gray-500">Backend API</dt>
            <dd className="min-w-0 break-all font-mono text-xs">{API_URL}</dd>
            <dt className="shrink-0 text-gray-500">Webhook URL</dt>
            <dd className="min-w-0 break-all font-mono text-xs">{API_URL}/api/webhooks/instagram</dd>
          </dl>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">Huquqiy hujjatlar</h2>
          <div className="flex flex-col gap-2 sm:flex-row">
            <a
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-1 items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              <FileText size={16} className="shrink-0 text-gray-500" />
              Foydalanish shartlari
              <ExternalLink size={13} className="ml-auto shrink-0 text-gray-400" />
            </a>
            <a
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-1 items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              <ShieldCheck size={16} className="shrink-0 text-gray-500" />
              Maxfiylik siyosati
              <ExternalLink size={13} className="ml-auto shrink-0 text-gray-400" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
