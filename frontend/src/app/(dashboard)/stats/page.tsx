'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, BookOpen, Loader2, MessagesSquare, Phone, PhoneCall, Users } from 'lucide-react';
import { useLocale } from '@/components/LocaleProvider';
import MonthlyBarChart from '@/components/stats/MonthlyBarChart';
import RankedBarList from '@/components/stats/RankedBarList';
import StackedBreakdown from '@/components/stats/StackedBreakdown';
import { currentMonthKey, monthFullLabel, shiftMonthKey } from '@/components/stats/chartUtils';
import { api, getErrorMessage } from '@/lib/api';
import { getMonthNames, getMonthShortNames } from '@/lib/i18n';
import { useInstagramAccount } from '@/lib/useInstagramAccount';
import { StatsResponse } from '@/lib/types';

// Tasdiqlangan (CVD-xavfsiz) rang toplami — Lidlar/Qongiroqlar bolimlaridagi rang tiliga mos.
const COLOR_VIOLET = '#7c3aed';
const COLOR_EMERALD = '#059669';
const COLOR_AMBER = '#d97706';
const COLOR_ROSE = '#e11d48';

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-300 bg-white p-4 shadow-sm dark:border-tg-border dark:bg-tg-panel">
      <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-tg-text">{title}</h2>
      {children}
    </div>
  );
}

function StatTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-gray-300 bg-white p-3.5 shadow-sm dark:border-tg-border dark:bg-tg-panel">
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

export default function StatsPage() {
  const { t, locale } = useLocale();
  const monthNames = getMonthNames(locale);
  const monthNamesShort = getMonthShortNames(locale);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey);

  const accountQuery = useInstagramAccount();
  const accountKey = accountQuery.data?.id ?? 'none';

  const statsQuery = useQuery({
    queryKey: ['stats', accountKey, selectedMonth],
    queryFn: async () => {
      const { data } = await api.get<StatsResponse>('/stats', { params: { month: selectedMonth } });
      return data;
    },
    refetchInterval: 60_000,
  });

  const stats = statsQuery.data;

  const talkedPct =
    stats && stats.totals.totalConversations > 0
      ? Math.round((stats.totals.talkedCount / stats.totals.totalConversations) * 100)
      : 0;

  return (
    <div className="h-full overflow-y-auto bg-gray-50 p-2.5 dark:bg-tg-bg">
      <div className="mx-auto w-full max-w-6xl space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-gray-500 dark:text-tg-textFaint">{t('stats.selectedMonthHint')}</p>
          <MonthPicker
            selectedMonth={selectedMonth}
            onChange={setSelectedMonth}
            monthNames={monthNames}
            thisMonthLabel={t('stats.thisMonth')}
            prevMonthLabel={t('stats.prevMonth')}
            nextMonthLabel={t('stats.nextMonth')}
          />
        </div>

        {statsQuery.isError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
            {getErrorMessage(statsQuery.error)}
          </div>
        )}

        {statsQuery.isLoading && (
          <div className="flex min-h-[300px] items-center justify-center rounded-lg border border-gray-300 bg-white text-sm text-gray-500 shadow-sm dark:border-tg-border dark:bg-tg-panel dark:text-tg-textFaint">
            <Loader2 className="mr-2 animate-spin" size={16} />
            {t('common.loading')}
          </div>
        )}

        {stats && (
          <>
            <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
              <StatTile label={t('stats.totalLeads')} value={stats.totals.totalConversations} icon={<Users size={17} />} />
              <StatTile label={t('stats.totalWithPhone')} value={stats.totals.totalWithPhone} icon={<Phone size={17} />} />
              <StatTile label={t('stats.totalMessages')} value={stats.totals.totalMessages} icon={<MessagesSquare size={17} />} />
              <StatTile label={t('stats.talkedRate')} value={`${talkedPct}%`} icon={<PhoneCall size={17} />} />
            </div>

            <div className="grid grid-cols-1 gap-2.5 xl:grid-cols-2">
              <Card title={t('stats.monthlyLeadsTitle')}>
                <MonthlyBarChart
                  months={stats.monthlyLeads.map((m) => m.month)}
                  series={[
                    {
                      key: 'leads',
                      label: t('stats.monthlyLeadsTitle'),
                      color: COLOR_VIOLET,
                      values: stats.monthlyLeads.map((m) => m.count),
                    },
                  ]}
                  monthNames={monthNames}
                  monthNamesShort={monthNamesShort}
                  selectedMonth={selectedMonth}
                  emptyLabel={t('stats.noData')}
                />
              </Card>

              <Card title={t('stats.monthlyMessagesTitle')}>
                <MonthlyBarChart
                  months={stats.monthlyMessages.map((m) => m.month)}
                  series={[
                    {
                      key: 'contact',
                      label: t('stats.fromContact'),
                      color: COLOR_VIOLET,
                      values: stats.monthlyMessages.map((m) => m.contact),
                    },
                    {
                      key: 'admin',
                      label: t('stats.fromAdmin'),
                      color: COLOR_EMERALD,
                      values: stats.monthlyMessages.map((m) => m.admin),
                    },
                  ]}
                  monthNames={monthNames}
                  monthNamesShort={monthNamesShort}
                  selectedMonth={selectedMonth}
                  emptyLabel={t('stats.noData')}
                />
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-3">
              <Card title={t('stats.temperatureTitle')}>
                <StackedBreakdown
                  emptyLabel={t('stats.noData')}
                  segments={[
                    { key: 'HOT', label: t('stats.hot'), color: COLOR_ROSE, value: stats.leadTemperature.HOT },
                    { key: 'WARM', label: t('stats.warm'), color: COLOR_AMBER, value: stats.leadTemperature.WARM },
                    { key: 'COLD', label: t('stats.cold'), color: COLOR_VIOLET, value: stats.leadTemperature.COLD },
                  ]}
                />
              </Card>

              <Card title={t('stats.callStatusTitle')}>
                <StackedBreakdown
                  emptyLabel={t('stats.noData')}
                  segments={[
                    { key: 'NEW', label: t('stats.callNew'), color: COLOR_VIOLET, value: stats.callStatus.NEW },
                    { key: 'TALKED', label: t('stats.callTalked'), color: COLOR_EMERALD, value: stats.callStatus.TALKED },
                    {
                      key: 'NOT_ANSWERED',
                      label: t('stats.callNotAnswered'),
                      color: COLOR_ROSE,
                      value: stats.callStatus.NOT_ANSWERED,
                    },
                  ]}
                />
              </Card>

              <Card title={t('stats.topCoursesTitle')}>
                <div className="flex items-center gap-1.5 pb-1 text-[11px] text-gray-500 dark:text-tg-textFaint">
                  <BookOpen size={12} />
                  {t('stats.topCoursesHint')}
                </div>
                <RankedBarList
                  items={stats.topCourses.map((c) => ({ label: c.course, value: c.count }))}
                  color={COLOR_VIOLET}
                  emptyLabel={t('stats.noData')}
                />
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
