'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import Avatar from '@/components/Avatar';
import { useLocale } from '@/components/LocaleProvider';
import { api, getErrorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { InstagramAccount } from '@/lib/types';

export default function InstagramPage() {
  const { t } = useLocale();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    instagramAccountId: '',
    username: '',
    accessToken: '',
    verifyToken: '',
  });

  const accountQuery = useQuery({
    queryKey: ['instagram-account'],
    queryFn: async () => {
      const { data } = await api.get<{ account: InstagramAccount | null }>('/instagram/account');
      return data.account;
    },
  });

  const refreshAfterAccountChange = () => {
    queryClient.invalidateQueries({ queryKey: ['instagram-account'] });
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
    queryClient.removeQueries({ queryKey: ['messages'] });
  };

  const connectMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/instagram/connect', {
        instagramAccountId: form.instagramAccountId || undefined,
        username: form.username || undefined,
        accessToken: form.accessToken,
        verifyToken: form.verifyToken,
      });
      return data;
    },
    onSuccess: () => {
      // Token faqat yuborish paytida xotirada boladi, formadan darhol tozalanadi.
      setForm({ instagramAccountId: '', username: '', accessToken: '', verifyToken: '' });
      refreshAfterAccountChange();
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => (await api.post('/instagram/test-connection')).data,
    onSuccess: refreshAfterAccountChange,
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => (await api.post('/instagram/disconnect')).data,
    onSuccess: refreshAfterAccountChange,
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    connectMutation.mutate();
  };

  const account = accountQuery.data;
  const inputClass =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:ring-brand-500/20';

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-lg font-semibold dark:text-gray-100">{t('instagram.title')}</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{t('instagram.subtitle')}</p>
        </div>

        {/* Akkaunt holati */}
        <div className="rounded-xl border border-gray-300 bg-white p-4 shadow-sm sm:p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">{t('instagram.accountStatus')}</h2>

          {accountQuery.isLoading && <p className="text-sm text-gray-500 dark:text-gray-500">{t('common.loading')}</p>}

          {!accountQuery.isLoading && !account && (
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <span className="h-2.5 w-2.5 rounded-full bg-gray-300 dark:bg-gray-600" />
              {t('instagram.notConnected')}
            </div>
          )}

          {account && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Avatar
                  src={account.profilePictureUrl}
                  name={account.name || account.username}
                  size={56}
                />
                <div className="min-w-0">
                  <p className="truncate font-medium dark:text-gray-100">@{account.username}</p>
                  {account.name && <p className="truncate text-sm text-gray-600 dark:text-gray-400">{account.name}</p>}
                </div>
                <span
                  className={`ml-auto flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                    account.isConnected
                      ? 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      account.isConnected ? 'bg-green-500' : 'bg-gray-400'
                    }`}
                  />
                  {account.isConnected ? t('instagram.connected') : t('instagram.disconnected')}
                </span>
              </div>

              <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
                <dt className="text-gray-600 dark:text-gray-400">{t('instagram.accountId')}</dt>
                <dd className="break-all font-mono text-xs dark:text-gray-200">{account.instagramAccountId}</dd>
                <dt className="text-gray-600 dark:text-gray-400">{t('instagram.accountType')}</dt>
                <dd className="dark:text-gray-200">{account.accountType || '—'}</dd>
                <dt className="text-gray-600 dark:text-gray-400">{t('instagram.token')}</dt>
                <dd className="dark:text-gray-200">{account.hasToken ? t('instagram.tokenStored') : t('instagram.tokenMissing')}</dd>
                <dt className="text-gray-600 dark:text-gray-400">{t('instagram.tokenExpiry')}</dt>
                <dd className="dark:text-gray-200">
                  {account.tokenExpiresAt ? `~${formatDateTime(account.tokenExpiresAt)}` : '—'}
                </dd>
              </dl>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  onClick={() => testMutation.mutate()}
                  disabled={testMutation.isPending || !account.hasToken}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  {testMutation.isPending ? t('instagram.testing') : t('instagram.testConnection')}
                </button>
                {account.isConnected && (
                  <button
                    onClick={() => disconnectMutation.mutate()}
                    disabled={disconnectMutation.isPending}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
                  >
                    {t('instagram.disconnect')}
                  </button>
                )}
              </div>

              {testMutation.isSuccess && (
                <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-500/10 dark:text-green-400">
                  {t('instagram.testSuccess')}
                </p>
              )}
              {testMutation.isError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
                  {getErrorMessage(testMutation.error)}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Ulash formasi */}
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl border border-gray-300 bg-white p-4 shadow-sm sm:p-5 dark:border-gray-800 dark:bg-gray-900"
        >
          <div>
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('instagram.connectFormTitle')}</h2>
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{t('instagram.connectFormDesc')}</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium dark:text-gray-200">{t('instagram.instagramAccountId')}</label>
            <input
              type="text"
              value={form.instagramAccountId}
              onChange={(e) => setForm({ ...form, instagramAccountId: e.target.value })}
              className={inputClass}
              placeholder={t('instagram.instagramAccountIdPlaceholder')}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium dark:text-gray-200">{t('instagram.instagramUsername')}</label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className={inputClass}
              placeholder={t('instagram.instagramUsernamePlaceholder')}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium dark:text-gray-200">
              {t('instagram.accessToken')} <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              required
              value={form.accessToken}
              onChange={(e) => setForm({ ...form, accessToken: e.target.value })}
              className={inputClass}
              placeholder="IGAAR..."
              autoComplete="off"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium dark:text-gray-200">
              {t('instagram.verifyToken')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={form.verifyToken}
              onChange={(e) => setForm({ ...form, verifyToken: e.target.value })}
              className={inputClass}
              placeholder={t('instagram.verifyTokenPlaceholder')}
            />
          </div>

          {connectMutation.isError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
              {getErrorMessage(connectMutation.error)}
            </p>
          )}
          {connectMutation.isSuccess && (
            <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-500/10 dark:text-green-400">
              {t('instagram.connectSuccess')}
            </p>
          )}

          <button
            type="submit"
            disabled={connectMutation.isPending}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {connectMutation.isPending ? t('instagram.testing') : t('instagram.connectSubmit')}
          </button>
        </form>
      </div>
    </div>
  );
}
