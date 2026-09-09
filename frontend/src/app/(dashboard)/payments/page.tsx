'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, CreditCard, Smartphone, X } from 'lucide-react';
import { useState } from 'react';
import { useLocale } from '@/components/LocaleProvider';
import { api, getErrorMessage } from '@/lib/api';
import { formatSum } from '@/lib/plans';
import { getMonthNames } from '@/lib/i18n';

type PaymentStatus = 'PAID' | 'UNPAID';
type PaymentMethod = 'click' | 'payme';

interface PaymentItem {
  month: string;
  amount: number | null;
  status: PaymentStatus;
  method: string | null;
  paidAt: string | null;
}

interface PaymentsResponse {
  items: PaymentItem[];
  currentMonth: string;
  planName: string | null;
}

function monthLabel(monthKey: string, monthNames: string[]): string {
  const [year, monthNum] = monthKey.split('-').map(Number);
  return `${monthNames[monthNum - 1]} ${year}`;
}

function StatusBadge({ status }: { status: PaymentStatus }) {
  const { t } = useLocale();
  const paid = status === 'PAID';
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${
        paid
          ? 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400'
          : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
      }`}
    >
      {paid ? t('payments.paid') : t('payments.unpaid')}
    </span>
  );
}

function PayModal({
  month,
  amount,
  monthNames,
  onClose,
  onPaid,
}: {
  month: string;
  amount: number;
  monthNames: string[];
  onClose: () => void;
  onPaid: () => void;
}) {
  const { t } = useLocale();
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [success, setSuccess] = useState(false);

  const payMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/payments/${month}/pay`, { method });
      return data;
    },
    onSuccess: () => {
      setSuccess(true);
      onPaid();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl border border-gray-300 bg-white p-4 shadow-lg sm:p-5 dark:border-tg-border dark:bg-tg-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-tg-textMuted">
            {monthLabel(month, monthNames)} {t('payments.payTitleSuffix')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-500 transition hover:bg-gray-100 dark:text-tg-textMuted dark:hover:bg-tg-panelAlt"
          >
            <X size={18} />
          </button>
        </div>

        {success ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400">
              <CheckCircle2 size={26} />
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-tg-text">{t('payments.paymentSuccess')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium dark:text-tg-text">{t('payments.choosePaymentMethod')}</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMethod('click')}
                  className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-sm font-medium transition ${
                    method === 'click'
                      ? 'border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-500/10 dark:text-brand-400'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-tg-hover dark:text-tg-text dark:hover:bg-tg-panelAlt'
                  }`}
                >
                  <CreditCard size={20} />
                  Click
                </button>
                <button
                  type="button"
                  onClick={() => setMethod('payme')}
                  className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-sm font-medium transition ${
                    method === 'payme'
                      ? 'border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-500/10 dark:text-brand-400'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-tg-hover dark:text-tg-text dark:hover:bg-tg-panelAlt'
                  }`}
                >
                  <Smartphone size={20} />
                  Payme
                </button>
              </div>
            </div>

            {method && (
              <div>
                <label className="mb-2 block text-sm font-medium dark:text-tg-text">{t('payments.amountLabel')}</label>
                <input
                  type="text"
                  readOnly
                  value={formatSum(amount)}
                  className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm font-mono text-gray-900 outline-none dark:border-tg-hover dark:bg-tg-panelAlt dark:text-tg-text"
                />
              </div>
            )}

            {payMutation.isError && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-500/10 dark:text-red-400">
                {getErrorMessage(payMutation.error)}
              </p>
            )}

            <button
              type="button"
              disabled={!method || payMutation.isPending}
              onClick={() => payMutation.mutate()}
              className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-50"
            >
              {payMutation.isPending ? t('payments.paying') : t('payments.payNow')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PaymentsPage() {
  const { t, locale } = useLocale();
  const monthNames = getMonthNames(locale);
  const queryClient = useQueryClient();
  const [payingMonth, setPayingMonth] = useState<{ month: string; amount: number } | null>(null);

  const paymentsQuery = useQuery({
    queryKey: ['payments'],
    queryFn: async () => {
      const { data } = await api.get<PaymentsResponse>('/payments');
      return data;
    },
  });

  const items = [...(paymentsQuery.data?.items ?? [])].reverse();

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-2xl space-y-4">
        <div>
          <h1 className="text-lg font-semibold dark:text-tg-text">{t('payments.title')}</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-tg-textMuted">{t('payments.subtitle')}</p>
        </div>

        {!paymentsQuery.data?.planName && !paymentsQuery.isLoading && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
            {t('payments.noPlan')}
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-gray-300 bg-white shadow-sm dark:border-tg-border dark:bg-tg-panel">
          {paymentsQuery.isLoading ? (
            <p className="p-4 text-sm text-gray-500 dark:text-tg-textFaint">{t('common.loading')}</p>
          ) : !items.length ? (
            <p className="p-4 text-sm text-gray-500 dark:text-tg-textFaint">{t('payments.empty')}</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-tg-border/50">
              {items.map((item) => (
                <li key={item.month} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="font-medium capitalize text-gray-900 dark:text-tg-text">
                      {monthLabel(item.month, monthNames)}
                    </p>
                    <p className="font-mono text-xs text-gray-500 dark:text-tg-textFaint">
                      {item.amount != null ? formatSum(item.amount) : '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={item.status} />
                    {item.status === 'UNPAID' && item.amount != null && (
                      <button
                        type="button"
                        onClick={() => setPayingMonth({ month: item.month, amount: item.amount! })}
                        className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brand-700"
                      >
                        {t('payments.payButton')}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {payingMonth && (
        <PayModal
          month={payingMonth.month}
          amount={payingMonth.amount}
          monthNames={monthNames}
          onClose={() => setPayingMonth(null)}
          onPaid={() => queryClient.invalidateQueries({ queryKey: ['payments'] })}
        />
      )}
    </div>
  );
}
