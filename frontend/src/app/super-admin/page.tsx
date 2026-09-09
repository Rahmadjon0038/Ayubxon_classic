'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import LogoMark from '@/components/LogoMark';
import { useLocale } from '@/components/LocaleProvider';
import { clearSuperAdminToken, getErrorMessage, getSuperAdminToken, superAdminApi } from '@/lib/api';

interface OrganizationListItem {
  id: string;
  name: string;
  createdAt: string;
  admins: { id: string; email: string }[];
  instagramAccounts: { id: string; username: string; isConnected: boolean }[];
}

interface CreatedCredentials {
  organizationName: string;
  email: string;
  password: string;
}

export default function SuperAdminDashboardPage() {
  const router = useRouter();
  const { t } = useLocale();
  const queryClient = useQueryClient();
  const [ready, setReady] = useState(false);

  const [organizationName, setOrganizationName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [created, setCreated] = useState<CreatedCredentials | null>(null);

  useEffect(() => {
    if (!getSuperAdminToken()) {
      router.replace('/super-admin/login');
    } else {
      setReady(true);
    }
  }, [router]);

  const organizationsQuery = useQuery({
    queryKey: ['super-admin', 'organizations'],
    queryFn: async () => {
      const { data } = await superAdminApi.get<{ organizations: OrganizationListItem[] }>('/organizations');
      return data.organizations;
    },
    enabled: ready,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data } = await superAdminApi.post('/organizations', { organizationName, email, password });
      return data;
    },
    onSuccess: () => {
      setCreated({ organizationName, email, password });
      setOrganizationName('');
      setEmail('');
      setPassword('');
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'organizations'] });
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setCreated(null);
    createMutation.mutate();
  };

  const handleLogout = () => {
    clearSuperAdminToken();
    router.replace('/super-admin/login');
  };

  if (!ready) return null;

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 dark:bg-tg-bg sm:px-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <LogoMark width={140} height={48} />
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 dark:border-tg-hover dark:text-tg-textMuted dark:hover:bg-tg-panelAlt"
            >
              <LogOut size={16} />
              {t('superAdmin.logout')}
            </button>
          </div>
        </div>

        <h1 className="text-lg font-semibold dark:text-tg-text">{t('superAdmin.dashboardTitle')}</h1>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-gray-300 bg-white p-6 shadow-sm dark:border-tg-border/70 dark:bg-tg-panel"
        >
          <h2 className="text-sm font-semibold text-gray-700 dark:text-tg-textMuted">{t('superAdmin.createTitle')}</h2>

          <div>
            <label className="mb-2 block text-sm font-medium dark:text-tg-text">{t('superAdmin.organizationName')}</label>
            <input
              type="text"
              required
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-base outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-tg-hover dark:bg-tg-panelAlt dark:text-tg-text dark:focus:ring-brand-500/20"
              placeholder="Ayubxon Classic"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium dark:text-tg-text">{t('superAdmin.email')}</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-base outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-tg-hover dark:bg-tg-panelAlt dark:text-tg-text dark:focus:ring-brand-500/20"
              placeholder="client@example.com"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium dark:text-tg-text">{t('superAdmin.password')}</label>
            <input
              type="text"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-base outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-tg-hover dark:bg-tg-panelAlt dark:text-tg-text dark:focus:ring-brand-500/20"
              placeholder="••••••••"
            />
          </div>

          {createMutation.isError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
              {getErrorMessage(createMutation.error)}
            </p>
          )}

          {created && (
            <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-500/10 dark:text-green-400">
              {t('superAdmin.createSuccess')} <strong>{created.email}</strong> / <strong>{created.password}</strong>
            </p>
          )}

          <button
            type="submit"
            disabled={createMutation.isPending}
            className="w-full rounded-xl bg-brand-600 py-3 text-base font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {createMutation.isPending ? t('superAdmin.creating') : t('superAdmin.create')}
          </button>
        </form>

        <div className="rounded-2xl border border-gray-300 bg-white p-6 shadow-sm dark:border-tg-border/70 dark:bg-tg-panel">
          <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-tg-textMuted">{t('superAdmin.listTitle')}</h2>

          {organizationsQuery.isLoading ? (
            <p className="text-sm text-gray-500 dark:text-tg-textFaint">{t('common.loading')}</p>
          ) : !organizationsQuery.data?.length ? (
            <p className="text-sm text-gray-500 dark:text-tg-textFaint">{t('superAdmin.listEmpty')}</p>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-tg-border/70">
              {organizationsQuery.data.map((org) => {
                const connected = org.instagramAccounts.some((a) => a.isConnected);
                return (
                  <li key={org.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium dark:text-tg-text">{org.name}</p>
                      <p className="truncate text-xs text-gray-500 dark:text-tg-textFaint">
                        {org.admins.map((a) => a.email).join(', ') || '—'}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                        connected
                          ? 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400'
                          : 'bg-gray-100 text-gray-600 dark:bg-tg-panelAlt dark:text-tg-textMuted'
                      }`}
                    >
                      {connected ? t('superAdmin.instagramConnected') : t('superAdmin.instagramNotConnected')}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
