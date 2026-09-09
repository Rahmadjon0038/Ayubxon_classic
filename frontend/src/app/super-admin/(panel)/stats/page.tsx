'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, Camera, ChevronLeft, ChevronRight, CheckCircle2, XCircle } from 'lucide-react';
import MonthlyBarChart from '@/components/stats/MonthlyBarChart';
import { currentMonthKey, monthFullLabel, shiftMonthKey } from '@/components/stats/chartUtils';
import { useLocale } from '@/components/LocaleProvider';
import { getMonthNames, getMonthShortNames } from '@/lib/i18n';
import { superAdminApi } from '@/lib/api';
import { planLabelKey, PlanName } from '@/lib/plans';

const COLOR_VIOLET = '#7c3aed';

interface SuperAdminStatsResponse {
  selectedMonth: string;
  totals: {
    totalOrganizations: number;
    activeSubscriptions: number;
    expiredSubscriptions: number;
    connectedInstagramAccounts: number;
  };
  monthlyNewOrganizations: { month: string; count: number }[];
  planBreakdown: { planName: string; count: number }[];
}

function PlanBreakdownList({ items }: { items: { planName: string; count: number }[] }) {
  const { t } = useLocale();
  const max = Math.max(1, ...items.map((i) => i.count));

  if (!items.length) {
    return <p className="text-sm text-gray-500 dark:text-tg-textFaint">{t('stats.noData')}</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.planName}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-medium text-gray-900 dark:text-tg-text">
              {t(planLabelKey(item.planName as PlanName))}
            </span>
            <span className="text-gray-600 dark:text-tg-textMuted">{item.count}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-tg-panelAlt">
            <div className="h-full rounded-full bg-brand-500" style={{ width: `${(item.count / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
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

function MonthPicker({
  selectedMonth,
  onChange,
  monthNames,
  thisMonthLabel,
  prevMonthLabel,
  nextMonthLabel,
}: {
  selectedMonth: string;
  onChange: (month: string) => void;
  monthNames: string[];
  thisMonthLabel: string;
  prevMonthLabel: string;
  nextMonthLabel: string;
}) {
  const isCurrentMonth = selectedMonth === currentMonthKey();

  return (
    <div className="flex items-center gap-1 rounded-lg border border-gray-300 bg-white p-1 shadow-sm dark:border-tg-border dark:bg-tg-panel">
      <button
        type="button"
        aria-label={prevMonthLabel}
        onClick={() => onChange(shiftMonthKey(selectedMonth, -1))}
        className="flex h-7 w-7 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 dark:text-tg-textMuted dark:hover:bg-tg-panelAlt"
      >
        <ChevronLeft size={16} />
      </button>

      <span className="min-w-[9rem] text-center text-sm font-medium capitalize text-gray-900 dark:text-tg-text">
        {monthFullLabel(selectedMonth, monthNames)}
      </span>

      <button
        type="button"
        aria-label={nextMonthLabel}
        onClick={() => onChange(shiftMonthKey(selectedMonth, 1))}
        disabled={isCurrentMonth}
        className="flex h-7 w-7 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent dark:text-tg-textMuted dark:hover:bg-tg-panelAlt"
      >
        <ChevronRight size={16} />
      </button>

      {!isCurrentMonth && (
        <button
          type="button"
          onClick={() => onChange(currentMonthKey())}
          className="ml-1 rounded-md px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-500/10"
        >
          {thisMonthLabel}
        </button>
      )}
    </div>
  );
}

export default function SuperAdminStatsPage() {
  const { t, locale } = useLocale();
  const monthNames = getMonthNames(locale);
  const monthNamesShort = getMonthShortNames(locale);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey);

  const statsQuery = useQuery({
    queryKey: ['super-admin', 'stats', selectedMonth],
    queryFn: async () => {
      const { data } = await superAdminApi.get<SuperAdminStatsResponse>('/stats', { params: { month: selectedMonth } });
      return data;
    },
  });

  const stats = statsQuery.data;

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-lg font-semibold dark:text-tg-text">{t('superAdmin.statsTitle')}</h1>
          <MonthPicker
            selectedMonth={selectedMonth}
            onChange={setSelectedMonth}
            monthNames={monthNames}
            thisMonthLabel={t('stats.thisMonth')}
            prevMonthLabel={t('stats.prevMonth')}
            nextMonthLabel={t('stats.nextMonth')}
          />
        </div>

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

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
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
                  selectedMonth={selectedMonth}
                  emptyLabel={t('stats.noData')}
                />
              </Card>

              <Card title={t('superAdmin.planBreakdownTitle')}>
                <PlanBreakdownList items={stats.planBreakdown} />
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
