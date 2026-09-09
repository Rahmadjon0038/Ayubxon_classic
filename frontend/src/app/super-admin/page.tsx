'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LogOut, Pencil } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import LogoMark from '@/components/LogoMark';
import { useLocale } from '@/components/LocaleProvider';
import { clearSuperAdminToken, getErrorMessage, getSuperAdminToken, superAdminApi } from '@/lib/api';

type SubscriptionStatus = 'ACTIVE' | 'EXPIRED';

interface OrganizationListItem {
  id: string;
  name: string;
  createdAt: string;
  planName: string | null;
  subscriptionStatus: SubscriptionStatus;
  subscriptionExpiresAt: string | null;
  admins: { id: string; email: string }[];
  instagramAccounts: { id: string; username: string; isConnected: boolean }[];
}

interface CreatedCredentials {
  organizationName: string;
  email: string;
  password: string;
}

function toDateInputValue(value: string | null): string {
  if (!value) return '';
  return value.slice(0, 10);
}

function StatusBadge({ status }: { status: SubscriptionStatus }) {
  const { t } = useLocale();
  const active = status === 'ACTIVE';
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
        active
          ? 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400'
          : 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400'
      }`}
    >
      {active ? t('superAdmin.statusActive') : t('superAdmin.statusExpired')}
    </span>
  );
}

function SubscriptionEditor({ org, onClose }: { org: OrganizationListItem; onClose: () => void }) {
  const { t } = useLocale();
  const queryClient = useQueryClient();
  const [planName, setPlanName] = useState(org.planName ?? '');
  const [status, setStatus] = useState<SubscriptionStatus>(org.subscriptionStatus);
  const [expiresAt, setExpiresAt] = useState(toDateInputValue(org.subscriptionExpiresAt));

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { data } = await superAdminApi.patch(`/organizations/${org.id}/subscription`, {
        planName,
        subscriptionStatus: status,
        subscriptionExpiresAt: expiresAt,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'organizations'] });
      onClose();
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    updateMutation.mutate();
  };

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-3 rounded-xl bg-gray-50 p-3 dark:bg-tg-panelAlt">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-tg-textMuted">
            {t('superAdmin.planName')}
          </label>
          <input
            type="text"
            value={planName}
            onChange={(e) => setPlanName(e.target.value)}
            placeholder={t('superAdmin.planNamePlaceholder')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-tg-hover dark:bg-tg-panel dark:text-tg-text"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-tg-textMuted">
            {t('superAdmin.subscriptionStatus')}
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as SubscriptionStatus)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-tg-hover dark:bg-tg-panel dark:text-tg-text"
          >
            <option value="ACTIVE">{t('superAdmin.statusActive')}</option>
            <option value="EXPIRED">{t('superAdmin.statusExpired')}</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-tg-textMuted">
            {t('superAdmin.subscriptionExpiresAt')}
          </label>
          <input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-tg-hover dark:bg-tg-panel dark:text-tg-text"
          />
        </div>
      </div>

      {updateMutation.isError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-500/10 dark:text-red-400">
          {getErrorMessage(updateMutation.error)}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 dark:border-tg-hover dark:text-tg-textMuted"
        >
          {t('common.cancel')}
        </button>
        <button
          type="submit"
          disabled={updateMutation.isPending}
          className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {updateMutation.isPending ? t('superAdmin.savingSubscription') : t('superAdmin.saveSubscription')}
        </button>
      </div>
    </form>
  );
}

export default function SuperAdminDashboardPage() {
  const router = useRouter();
  const { t } = useLocale();
  const queryClient = useQueryClient();
  const [ready, setReady] = useState(false);

  const [organizationName, setOrganizationName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [planName, setPlanName] = useState('');
  const [subscriptionExpiresAt, setSubscriptionExpiresAt] = useState('');
  const [created, setCreated] = useState<CreatedCredentials | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

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
      const { data } = await superAdminApi.post('/organizations', {
        organizationName,
        email,
        password,
        planName,
        subscriptionExpiresAt,
      });
      return data;
    },
    onSuccess: () => {
      setCreated({ organizationName, email, password });
      setOrganizationName('');
      setEmail('');
      setPassword('');
      setPlanName('');
      setSubscriptionExpiresAt('');
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
          className="space-y-4 rounded-xl border border-gray-300 bg-white p-4 shadow-sm sm:p-5 dark:border-tg-border dark:bg-tg-panel"
        >
          <h2 className="text-sm font-semibold text-gray-700 dark:text-tg-textMuted">{t('superAdmin.createTitle')}</h2>

          <div>
            <label className="mb-2 block text-sm font-medium dark:text-tg-text">{t('superAdmin.organizationName')}</label>
            <input
              type="text"
              required
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-tg-hover dark:bg-tg-panelAlt dark:text-tg-text dark:focus:ring-brand-500/20"
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
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-tg-hover dark:bg-tg-panelAlt dark:text-tg-text dark:focus:ring-brand-500/20"
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
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-tg-hover dark:bg-tg-panelAlt dark:text-tg-text dark:focus:ring-brand-500/20"
              placeholder="••••••••"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium dark:text-tg-text">{t('superAdmin.planName')}</label>
              <input
                type="text"
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
                placeholder={t('superAdmin.planNamePlaceholder')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-tg-hover dark:bg-tg-panelAlt dark:text-tg-text dark:focus:ring-brand-500/20"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium dark:text-tg-text">
                {t('superAdmin.subscriptionExpiresAt')}
              </label>
              <input
                type="date"
                value={subscriptionExpiresAt}
                onChange={(e) => setSubscriptionExpiresAt(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-tg-hover dark:bg-tg-panelAlt dark:text-tg-text dark:focus:ring-brand-500/20"
              />
            </div>
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
            className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {createMutation.isPending ? t('superAdmin.creating') : t('superAdmin.create')}
          </button>
        </form>

        <div className="rounded-xl border border-gray-300 bg-white p-4 shadow-sm sm:p-5 dark:border-tg-border dark:bg-tg-panel">
          <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-tg-textMuted">{t('superAdmin.listTitle')}</h2>

          {organizationsQuery.isLoading ? (
            <p className="text-sm text-gray-500 dark:text-tg-textFaint">{t('common.loading')}</p>
          ) : !organizationsQuery.data?.length ? (
            <p className="text-sm text-gray-500 dark:text-tg-textFaint">{t('superAdmin.listEmpty')}</p>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-tg-border/70">
              {organizationsQuery.data.map((org) => {
                const connected = org.instagramAccounts.some((a) => a.isConnected);
                const isEditing = editingId === org.id;
                return (
                  <li key={org.id} className="py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium dark:text-tg-text">{org.name}</p>
                        <p className="truncate text-xs text-gray-500 dark:text-tg-textFaint">
                          {org.admins.map((a) => a.email).join(', ') || '—'}
                        </p>
                        <p className="mt-1 truncate text-xs text-gray-500 dark:text-tg-textFaint">
                          {t('superAdmin.plan')}: {org.planName || '—'} · {t('superAdmin.expiresAt')}:{' '}
                          {org.subscriptionExpiresAt
                            ? new Date(org.subscriptionExpiresAt).toLocaleDateString()
                            : t('superAdmin.noExpiryDate')}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            connected
                              ? 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400'
                              : 'bg-gray-100 text-gray-600 dark:bg-tg-panelAlt dark:text-tg-textMuted'
                          }`}
                        >
                          {connected ? t('superAdmin.instagramConnected') : t('superAdmin.instagramNotConnected')}
                        </span>
                        <StatusBadge status={org.subscriptionStatus} />
                        <button
                          type="button"
                          onClick={() => setEditingId(isEditing ? null : org.id)}
                          title={t('superAdmin.editSubscription')}
                          className="rounded-lg border border-gray-300 p-1.5 text-gray-600 transition hover:bg-gray-100 dark:border-tg-hover dark:text-tg-textMuted dark:hover:bg-tg-panelAlt"
                        >
                          <Pencil size={14} />
                        </button>
                      </div>
                    </div>

                    {isEditing && <SubscriptionEditor org={org} onClose={() => setEditingId(null)} />}
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
