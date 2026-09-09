'use client';

import { useQuery } from '@tanstack/react-query';
import { useLocale } from '@/components/LocaleProvider';
import { superAdminApi } from '@/lib/api';

type SubscriptionStatus = 'ACTIVE' | 'EXPIRED';
type PlanName = 'Standart' | 'Pro';

interface OrganizationListItem {
  id: string;
  name: string;
  planName: PlanName | null;
  subscriptionStatus: SubscriptionStatus;
  admins: { id: string; phone: string }[];
}

// Tarif -> narx (so'mda). Hozircha qo'lda belgilangan — Click/Payme ulanganda bu
// narxlar API orqali dinamik keladi, jadval strukturasi o'zgarmaydi.
const PLAN_PRICES: Record<PlanName, number> = {
  Standart: 300_000,
  Pro: 500_000,
};

function formatSum(amount: number): string {
  return `${amount.toLocaleString('uz-UZ')} so'm`;
}

function StatusBadge({ status }: { status: SubscriptionStatus }) {
  const { t } = useLocale();
  const active = status === 'ACTIVE';
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${
        active
          ? 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400'
          : 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400'
      }`}
    >
      {active ? t('superAdmin.statusActive') : t('superAdmin.statusExpired')}
    </span>
  );
}

export default function SuperAdminPaymentsPage() {
  const { t } = useLocale();

  const organizationsQuery = useQuery({
    queryKey: ['super-admin', 'organizations'],
    queryFn: async () => {
      const { data } = await superAdminApi.get<{ organizations: OrganizationListItem[] }>('/organizations');
      return data.organizations;
    },
  });

  const orgs = organizationsQuery.data ?? [];
  const monthlyTotal = orgs
    .filter((o) => o.subscriptionStatus === 'ACTIVE' && o.planName)
    .reduce((sum, o) => sum + (o.planName ? PLAN_PRICES[o.planName] : 0), 0);

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-4xl space-y-4">
        <div>
          <h1 className="text-lg font-semibold dark:text-tg-text">{t('superAdmin.paymentsTitle')}</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-tg-textMuted">{t('superAdmin.paymentsSubtitle')}</p>
        </div>

        <div className="rounded-xl border border-gray-300 bg-white p-3.5 shadow-sm dark:border-tg-border dark:bg-tg-panel">
          <p className="text-lg font-semibold text-gray-900 dark:text-tg-text">{formatSum(monthlyTotal)}</p>
          <p className="text-xs text-gray-600 dark:text-tg-textMuted">{t('superAdmin.expectedMonthlyRevenue')}</p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-300 bg-white shadow-sm dark:border-tg-border dark:bg-tg-panel">
          {organizationsQuery.isLoading ? (
            <p className="p-4 text-sm text-gray-500 dark:text-tg-textFaint">{t('common.loading')}</p>
          ) : !orgs.length ? (
            <p className="p-4 text-sm text-gray-500 dark:text-tg-textFaint">{t('superAdmin.listEmpty')}</p>
          ) : (
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs text-gray-500 dark:border-tg-border/70 dark:text-tg-textFaint">
                  <th className="px-4 py-3 font-medium">{t('superAdmin.organizationName')}</th>
                  <th className="px-4 py-3 font-medium">{t('common.phone')}</th>
                  <th className="px-4 py-3 font-medium">{t('superAdmin.plan')}</th>
                  <th className="px-4 py-3 font-medium">{t('superAdmin.price')}</th>
                  <th className="px-4 py-3 font-medium">{t('superAdmin.subscriptionStatus')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-tg-border/50">
                {orgs.map((org) => (
                  <tr key={org.id}>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-tg-text">{org.name}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-tg-textMuted">
                      {org.admins.map((a) => a.phone).join(', ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-tg-textMuted">
                      {org.planName === 'Standart'
                        ? t('superAdmin.planStandart')
                        : org.planName === 'Pro'
                          ? t('superAdmin.planPro')
                          : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-tg-textMuted">
                      {org.planName ? formatSum(PLAN_PRICES[org.planName]) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={org.subscriptionStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
