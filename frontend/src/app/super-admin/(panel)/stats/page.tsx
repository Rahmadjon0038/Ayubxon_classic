'use client';

import { useQuery } from '@tanstack/react-query';
import { Building2, Camera, CheckCircle2, XCircle } from 'lucide-react';
import MonthlyBarChart from '@/components/stats/MonthlyBarChart';
import { useLocale } from '@/components/LocaleProvider';
import { getMonthNames, getMonthShortNames } from '@/lib/i18n';
import { superAdminApi } from '@/lib/api';

const COLOR_VIOLET = '#7c3aed';

interface SuperAdminStatsResponse {
  totals: {
    totalOrganizations: number;
    activeSubscriptions: number;
    expiredSubscriptions: number;
    connectedInstagramAccounts: number;
  };
  monthlyNewOrganizations: { month: string; count: number }[];
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-300 bg-white p-4 shadow-sm sm:p-5 dark:border-tg-border dark:bg-tg-panel">
      <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-tg-text">{title}</h2>
      {children}
    </div>
  );
}

function StatTile({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-300 bg-white p-3.5 shadow-sm dark:border-tg-border dark:bg-tg-panel">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="truncate text-lg font-semibold text-gray-900 dark:text-tg-text">{value}</p>
        <p className="truncate text-xs text-gray-600 dark:text-tg-textMuted">{label}</p>
      </div>
    </div>
  );
}

export default function SuperAdminStatsPage() {
  const { t, locale } = useLocale();
  const monthNames = getMonthNames(locale);
  const monthNamesShort = getMonthShortNames(locale);

  const statsQuery = useQuery({
    queryKey: ['super-admin', 'stats'],
    queryFn: async () => {
      const { data } = await superAdminApi.get<SuperAdminStatsResponse>('/stats');
      return data;
    },
  });

  const stats = statsQuery.data;

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="text-lg font-semibold dark:text-tg-text">{t('superAdmin.statsTitle')}</h1>

        {stats && (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile
                label={t('superAdmin.totalOrganizations')}
                value={stats.totals.totalOrganizations}
                icon={<Building2 size={17} />}
              />
              <StatTile
                label={t('superAdmin.activeSubscriptions')}
                value={stats.totals.activeSubscriptions}
                icon={<CheckCircle2 size={17} />}
              />
              <StatTile
                label={t('superAdmin.expiredSubscriptions')}
                value={stats.totals.expiredSubscriptions}
                icon={<XCircle size={17} />}
              />
              <StatTile
                label={t('superAdmin.connectedAccounts')}
                value={stats.totals.connectedInstagramAccounts}
                icon={<Camera size={17} />}
              />
            </div>

            <Card title={t('superAdmin.monthlyNewOrgsTitle')}>
              <MonthlyBarChart
                months={stats.monthlyNewOrganizations.map((m) => m.month)}
                series={[
                  {
                    key: 'organizations',
                    label: t('superAdmin.monthlyNewOrgsTitle'),
                    color: COLOR_VIOLET,
                    values: stats.monthlyNewOrganizations.map((m) => m.count),
                  },
                ]}
                monthNames={monthNames}
                monthNamesShort={monthNamesShort}
                emptyLabel={t('stats.noData')}
              />
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
