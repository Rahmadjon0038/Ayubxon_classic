'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CheckCircle2, Loader2, Megaphone, Phone, Send, Sparkles } from 'lucide-react';
import { useParams } from 'next/navigation';
import { api, getErrorMessage } from '@/lib/api';
import { AdCampaign } from '@/lib/types';

type PublicCampaignResponse = { campaign: AdCampaign };

type LeadFormState = {
  fullName: string;
  phoneNumber: string;
  email: string;
  comment: string;
};

const emptyForm: LeadFormState = {
  fullName: '',
  phoneNumber: '',
  email: '',
  comment: '',
};

export default function PublicAdPage() {
  const params = useParams<{ slug: string }>();
  const slug = Array.isArray(params?.slug) ? params.slug[0] : params?.slug;
  const [form, setForm] = useState<LeadFormState>(emptyForm);
  const [pageUrl, setPageUrl] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setPageUrl(window.location.href);
  }, []);

  const campaignQuery = useQuery({
    queryKey: ['public-ad-campaign', slug],
    queryFn: async () => {
      const { data } = await api.get<PublicCampaignResponse>(`/ad-campaigns/public/${slug}`);
      return data.campaign;
    },
    enabled: Boolean(slug),
    retry: false,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        fullName: form.fullName.trim(),
        phoneNumber: form.phoneNumber.trim(),
        email: form.email.trim(),
        comment: form.comment.trim(),
        pageUrl,
      };
      const { data } = await api.post(`/ad-campaigns/public/${slug}/leads`, payload);
      return data;
    },
    onSuccess: async () => {
      setSuccess(true);
      setForm(emptyForm);
    },
  });

  const formTitle = useMemo(() => {
    if (campaignQuery.data?.formTitle?.trim()) return campaignQuery.data.formTitle;
    return campaignQuery.data?.title ?? 'Ariza qoldiring';
  }, [campaignQuery.data]);

  const formSubtitle = useMemo(() => {
    if (campaignQuery.data?.formSubtitle?.trim()) return campaignQuery.data.formSubtitle;
    return 'Ism va telefon raqamingizni qoldiring, siz bilan bog‘lanamiz.';
  }, [campaignQuery.data]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSuccess(false);
    await submitMutation.mutateAsync();
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_26%),radial-gradient(circle_at_bottom_right,_rgba(168,85,247,0.16),_transparent_24%),linear-gradient(to_bottom,_#f6fbff,_#ffffff)] text-slate-900 dark:bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.14),_transparent_22%),radial-gradient(circle_at_bottom_right,_rgba(168,85,247,0.10),_transparent_22%),linear-gradient(to_bottom,_#020617,_#08111f)] dark:text-white">
      <div className="pointer-events-none absolute inset-x-[-10%] top-[-8%] h-[320px] rounded-full bg-[radial-gradient(circle,_rgba(255,255,255,0.95),_rgba(255,255,255,0))] blur-3xl dark:bg-[radial-gradient(circle,_rgba(148,163,184,0.10),_rgba(148,163,184,0))]" />
      <div className="pointer-events-none absolute right-[-10%] top-[20%] h-[280px] w-[280px] rounded-full bg-cyan-200/30 blur-3xl dark:bg-cyan-500/10" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white shadow-sm dark:bg-tg-panel">
            <Megaphone size={19} className="text-brand-600 dark:text-brand-400" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">Ad Lead Form</div>
            <div className="font-semibold text-slate-900 dark:text-white">Reklamadan kelgan ariza</div>
          </div>
        </div>

        <div className="grid flex-1 gap-4 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <section className="rounded-[30px] border border-white/70 bg-white/82 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.10)] backdrop-blur-xl dark:border-tg-border/70 dark:bg-tg-panel/[0.94] sm:p-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700 dark:border-cyan-500/20 dark:bg-cyan-500/10 dark:text-cyan-300">
              <Sparkles size={14} />
              {campaignQuery.data ? campaignQuery.data.slug : 'Yuklanmoqda...'}
            </div>

            {campaignQuery.isLoading && (
              <div className="mt-6 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <Loader2 size={16} className="animate-spin" />
                Reklama ma&apos;lumotlari yuklanmoqda...
              </div>
            )}

            {campaignQuery.isError && (
              <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
                Reklama topilmadi yoki faol emas.
              </div>
            )}

            {!campaignQuery.isLoading && campaignQuery.data && (
              <>
                <div className="mt-6">
                  <h1 className="max-w-2xl text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-5xl">
                    {formTitle}
                  </h1>
                  <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300 sm:text-lg">
                    {formSubtitle}
                  </p>
                </div>

                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  <InfoChip icon={<Phone size={16} />} title="Telefon" body="Raqam qoldiring" />
                  <InfoChip icon={<CheckCircle2 size={16} />} title="Javob" body="Tez orada bog‘lanamiz" />
                </div>

                <div className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-tg-hover dark:bg-tg-panelAlt/50 sm:p-5">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Kampaniya
                  </h2>
                  <p className="mt-2 text-base font-semibold text-slate-950 dark:text-white">
                    {campaignQuery.data.title}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {campaignQuery.data.description || 'Tavsif kiritilmagan.'}
                  </p>
                </div>
              </>
            )}
          </section>

          <section className="rounded-[30px] border border-white/70 bg-white/88 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-tg-border/70 dark:bg-tg-panel/[0.95] sm:p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <Field label="Ism familiya *">
                <input
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  placeholder="Masalan: Ali Valiyev"
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-tg-hover dark:bg-tg-panelAlt dark:text-white"
                />
              </Field>

              <Field label="Telefon raqam *">
                <input
                  value={form.phoneNumber}
                  onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                  placeholder="+998 90 123 45 67"
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-tg-hover dark:bg-tg-panelAlt dark:text-white"
                />
              </Field>

              <Field label="Email">
                <input
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="name@example.com"
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-tg-hover dark:bg-tg-panelAlt dark:text-white"
                />
              </Field>

              <Field label="Izoh">
                <textarea
                  rows={4}
                  value={form.comment}
                  onChange={(e) => setForm({ ...form, comment: e.target.value })}
                  placeholder="Qaysi fan yoki xizmatga qiziqyapsiz?"
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-tg-hover dark:bg-tg-panelAlt dark:text-white"
                />
              </Field>

              <button
                type="submit"
                disabled={submitMutation.isPending || !campaignQuery.data}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-600 to-blue-500 px-4 py-3.5 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(59,130,246,0.28)] transition hover:from-brand-700 hover:to-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                Yuborish
              </button>

              {submitMutation.isError && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
                  {getErrorMessage(submitMutation.error)}
                </div>
              )}

              {success && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                  Ma&apos;lumotlar yuborildi. Tez orada siz bilan bog&apos;lanamiz.
                </div>
              )}
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
      {children}
    </label>
  );
}

function InfoChip({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-tg-hover dark:bg-tg-panel">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white">
        {icon}
        {title}
      </div>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{body}</p>
    </div>
  );
}
