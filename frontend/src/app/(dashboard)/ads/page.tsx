'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Copy,
  ExternalLink,
  Loader2,
  Megaphone,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import { api, getErrorMessage } from '@/lib/api';
import { formatDateTime, formatRelativeTime } from '@/lib/format';
import { useInstagramAccount } from '@/lib/useInstagramAccount';
import { AdCampaign, AdLead } from '@/lib/types';

type CampaignFormState = {
  title: string;
  description: string;
  formTitle: string;
  formSubtitle: string;
  isActive: boolean;
};

const emptyForm: CampaignFormState = {
  title: '',
  description: '',
  formTitle: '',
  formSubtitle: '',
  isActive: true,
};

type CampaignListResponse = { items: AdCampaign[] };
type LeadListResponse = { items: AdLead[] };

function buildPublicLink(origin: string, slug: string): string {
  return `${origin.replace(/\/$/, '')}/ad/${slug}`;
}

export default function AdsPage() {
  const queryClient = useQueryClient();
  const accountQuery = useInstagramAccount();
  const accountKey = accountQuery.data?.id ?? 'none';
  const [origin, setOrigin] = useState('');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [form, setForm] = useState<CampaignFormState>(emptyForm);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const campaignsQuery = useQuery({
    queryKey: ['ad-campaigns', accountKey],
    queryFn: async () => {
      const { data } = await api.get<CampaignListResponse>('/ad-campaigns');
      return data.items;
    },
    refetchInterval: 30_000,
  });

  useEffect(() => {
    const items = campaignsQuery.data ?? [];
    if (!selectedCampaignId && items.length > 0) {
      setSelectedCampaignId(items[0].id);
    }
  }, [campaignsQuery.data, selectedCampaignId]);

  const selectedCampaign = useMemo(
    () => (campaignsQuery.data ?? []).find((campaign) => campaign.id === selectedCampaignId) ?? null,
    [campaignsQuery.data, selectedCampaignId],
  );

  const leadQuery = useQuery({
    queryKey: ['ad-campaign-leads', accountKey, selectedCampaignId],
    queryFn: async () => {
      if (!selectedCampaignId) return [] as AdLead[];
      const { data } = await api.get<LeadListResponse>(`/ad-campaigns/${selectedCampaignId}/leads`);
      return data.items;
    },
    enabled: Boolean(selectedCampaignId),
    refetchInterval: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        formTitle: form.formTitle.trim(),
        formSubtitle: form.formSubtitle.trim(),
        isActive: form.isActive,
      };
      const { data } = await api.post<{ item: AdCampaign }>('/ad-campaigns', payload);
      return data.item;
    },
    onSuccess: async (item) => {
      setForm(emptyForm);
      await queryClient.invalidateQueries({ queryKey: ['ad-campaigns'] });
      setSelectedCampaignId(item.id);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (campaign: AdCampaign) => {
      const { data } = await api.patch<{ item: AdCampaign }>(`/ad-campaigns/${campaign.id}`, {
        title: campaign.title,
        description: campaign.description ?? '',
        formTitle: campaign.formTitle ?? '',
        formSubtitle: campaign.formSubtitle ?? '',
        isActive: !campaign.isActive,
      });
      return data.item;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['ad-campaigns'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      await api.delete(`/ad-campaigns/${campaignId}`);
      return campaignId;
    },
    onSuccess: async (deletedId) => {
      await queryClient.invalidateQueries({ queryKey: ['ad-campaigns'] });
      if (selectedCampaignId === deletedId) {
        setSelectedCampaignId(null);
      }
    },
  });

  const filteredCampaigns = useMemo(() => {
    const q = search.trim().toLowerCase();
    const items = campaignsQuery.data ?? [];
    if (!q) return items;
    return items.filter((item) =>
      [item.title, item.slug, item.description ?? '', item.formTitle ?? '', item.formSubtitle ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [campaignsQuery.data, search]);

  const campaignLeadRows = leadQuery.data ?? [];

  return (
    <div className="h-full overflow-y-auto bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.12),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(168,85,247,0.10),_transparent_24%),linear-gradient(to_bottom,_#f8fbff,_#ffffff)] p-3 dark:bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.12),_transparent_24%),radial-gradient(circle_at_bottom_right,_rgba(168,85,247,0.08),_transparent_22%),linear-gradient(to_bottom,_#020617,_#081120)]">
      <div className="mx-auto flex min-h-full max-w-[1600px] flex-col gap-3">
        <section className="overflow-hidden rounded-[28px] border border-white/75 bg-white/80 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-tg-border/70 dark:bg-tg-panel/[0.94] sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
                <Megaphone size={14} />
                Reklama leadlari
              </div>
              <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-3xl">
                Yangi reklama yarating va maxsus link oling
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-tg-textMuted sm:text-base">
                Bu sahifada siz reklama kampaniyasini yaratasiz. Hosil bo‘lgan linkni Meta Ads’da
                ishlatasiz, leadlar esa alohida shu bo‘limga tushadi. DM leadlar sahifasiga tegilmaydi.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[360px]">
              <MetricCard label="Kampaniyalar" value={campaignsQuery.data?.length ?? 0} icon={<Megaphone size={16} />} />
              <MetricCard label="Leadlar" value={campaignLeadRows.length} icon={<Users size={16} />} />
            </div>
          </div>
        </section>

        <div className="grid flex-1 gap-3 xl:grid-cols-[420px_minmax(0,1fr)]">
          <section className="rounded-[26px] border border-gray-200 bg-white p-4 shadow-sm dark:border-tg-border dark:bg-tg-panel sm:p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-950 dark:text-white">Reklama yaratish</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-tg-textMuted">
                  Nomi, tavsifi va form matnini yozing. Link avtomatik yaratiladi.
                </p>
              </div>
              <button
                type="button"
                onClick={() => queryClient.invalidateQueries({ queryKey: ['ad-campaigns'] })}
                className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-gray-50 dark:border-tg-hover dark:text-tg-textMuted dark:hover:bg-tg-panelAlt"
              >
                <RefreshCcw size={14} />
                Yangilash
              </button>
            </div>

            {campaignsQuery.isError && (
              <div className="mb-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
                {getErrorMessage(campaignsQuery.error)}
              </div>
            )}

            <div className="space-y-3">
              <Field label="Reklama nomi *">
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Masalan: Ingliz tili kursi"
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-tg-hover dark:bg-tg-panelAlt dark:text-tg-text"
                />
              </Field>
              <Field label="Qisqa tavsif">
                <textarea
                  rows={4}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Bu reklama qaysi auditoriya uchun, nimalar taklif qilinadi..."
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-tg-hover dark:bg-tg-panelAlt dark:text-tg-text"
                />
              </Field>
              <Field label="Formada chiqadigan sarlavha">
                <input
                  value={form.formTitle}
                  onChange={(e) => setForm({ ...form, formTitle: e.target.value })}
                  placeholder="Masalan: Bepul konsultatsiya uchun ariza"
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-tg-hover dark:bg-tg-panelAlt dark:text-tg-text"
                />
              </Field>
              <Field label="Forma osti matni">
                <textarea
                  rows={3}
                  value={form.formSubtitle}
                  onChange={(e) => setForm({ ...form, formSubtitle: e.target.value })}
                  placeholder="Ism va telefon qoldiring, siz bilan bog'lanamiz."
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-tg-hover dark:bg-tg-panelAlt dark:text-tg-text"
                />
              </Field>

              <ToggleRow
                label="Kampaniya faol bo'lsin"
                checked={form.isActive}
                onChange={() => setForm((prev) => ({ ...prev, isActive: !prev.isActive }))}
              />

              <button
                type="button"
                disabled={!form.title.trim() || createMutation.isPending}
                onClick={() => createMutation.mutate()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-blue-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(59,130,246,0.25)] transition hover:from-brand-700 hover:to-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {createMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                Reklama yaratish
              </button>

              {createMutation.isError && (
                <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
                  {getErrorMessage(createMutation.error)}
                </p>
              )}
            </div>
          </section>

          <div className="grid min-h-0 gap-3 lg:grid-cols-[380px_minmax(0,1fr)]">
            <section className="rounded-[26px] border border-gray-200 bg-white p-4 shadow-sm dark:border-tg-border dark:bg-tg-panel sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-950 dark:text-white">Kampaniyalar</h2>
                  <p className="mt-1 text-sm text-slate-600 dark:text-tg-textMuted">
                    Har kampaniya uchun alohida link yaratiladi.
                  </p>
                </div>
                <label className="relative block w-36">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Qidirish"
                    className="w-full rounded-full border border-gray-300 bg-white py-2 pl-8 pr-3 text-xs outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-tg-hover dark:bg-tg-panelAlt dark:text-tg-text"
                  />
                </label>
              </div>

              <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
                {campaignsQuery.isLoading && (
                  <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-300 px-4 py-10 text-sm text-slate-500 dark:border-tg-hover dark:text-tg-textMuted">
                    <Loader2 size={16} className="animate-spin" />
                    Yuklanmoqda...
                  </div>
                )}

                {!campaignsQuery.isLoading && filteredCampaigns.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-slate-500 dark:border-tg-hover dark:text-tg-textMuted">
                    Hozircha reklama yo‘q.
                  </div>
                )}

                {filteredCampaigns.map((campaign) => {
                  const active = campaign.id === selectedCampaignId;
                  const publicLink = origin ? buildPublicLink(origin, campaign.slug) : `/ad/${campaign.slug}`;
                  return (
                    <button
                      key={campaign.id}
                      type="button"
                      onClick={() => setSelectedCampaignId(campaign.id)}
                      className={`w-full rounded-2xl border p-3 text-left transition ${
                        active
                          ? 'border-brand-300 bg-brand-50 shadow-[0_10px_25px_rgba(59,130,246,0.12)] dark:border-brand-500/40 dark:bg-brand-500/10'
                          : 'border-gray-200 bg-white hover:border-brand-200 hover:bg-gray-50 dark:border-tg-hover dark:bg-tg-panelAlt dark:hover:border-brand-500/30 dark:hover:bg-tg-panelAlt/80'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">{campaign.title}</p>
                          <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-tg-textMuted">
                            /ad/{campaign.slug}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            campaign.isActive
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                              : 'bg-gray-100 text-gray-700 dark:bg-tg-panelAlt dark:text-tg-textMuted'
                          }`}
                        >
                          {campaign.isActive ? 'Faol' : 'To‘xtatilgan'}
                        </span>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-600 dark:text-tg-textMuted">
                        <span className="inline-flex items-center gap-1">
                          <Users size={12} />
                          {campaign.leadCount ?? 0} lead
                        </span>
                        <span>{formatRelativeTime(campaign.updatedAt)}</span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void navigator.clipboard.writeText(publicLink);
                          }}
                          className="inline-flex items-center gap-1 rounded-full border border-gray-300 px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:bg-white dark:border-tg-hover dark:text-tg-textMuted dark:hover:bg-tg-panel"
                        >
                          <Copy size={12} />
                          Link
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(publicLink, '_blank', 'noopener,noreferrer');
                          }}
                          className="inline-flex items-center gap-1 rounded-full border border-gray-300 px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:bg-white dark:border-tg-hover dark:text-tg-textMuted dark:hover:bg-tg-panel"
                        >
                          <ExternalLink size={12} />
                          Ochish
                        </button>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="min-h-0 rounded-[26px] border border-gray-200 bg-white p-4 shadow-sm dark:border-tg-border dark:bg-tg-panel sm:p-5">
              {!selectedCampaign && (
                <div className="flex h-full min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-gray-300 text-center dark:border-tg-hover">
                  <div>
                    <Megaphone className="mx-auto text-gray-400" size={40} />
                    <h3 className="mt-4 text-base font-semibold text-slate-950 dark:text-white">
                      Kampaniyani tanlang
                    </h3>
                    <p className="mt-1 text-sm text-slate-600 dark:text-tg-textMuted">
                      Chap tomondagi ro‘yxatdan kampaniyani oching yoki yangi reklama yarating.
                    </p>
                  </div>
                </div>
              )}

              {selectedCampaign && (
                <CampaignDetails
                  campaign={selectedCampaign}
                  publicLink={origin ? buildPublicLink(origin, selectedCampaign.slug) : `/ad/${selectedCampaign.slug}`}
                  leads={campaignLeadRows}
                  onToggleActive={() => toggleMutation.mutate(selectedCampaign)}
                  onDelete={() => deleteMutation.mutate(selectedCampaign.id)}
                  isToggling={toggleMutation.isPending}
                  isDeleting={deleteMutation.isPending}
                  loading={leadQuery.isLoading}
                  error={leadQuery.isError ? getErrorMessage(leadQuery.error) : null}
                />
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function CampaignDetails({
  campaign,
  publicLink,
  leads,
  onToggleActive,
  onDelete,
  isToggling,
  isDeleting,
  loading,
  error,
}: {
  campaign: AdCampaign;
  publicLink: string;
  leads: AdLead[];
  onToggleActive: () => void;
  onDelete: () => void;
  isToggling: boolean;
  isDeleting: boolean;
  loading: boolean;
  error: string | null;
}) {
  return (
    <div className="flex h-full min-h-[420px] flex-col">
      <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-slate-50 p-4 dark:border-tg-hover dark:bg-tg-panelAlt/50 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-lg font-semibold text-slate-950 dark:text-white">{campaign.title}</h2>
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                campaign.isActive
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                  : 'bg-gray-100 text-gray-700 dark:bg-tg-panel dark:text-tg-textMuted'
              }`}
            >
              {campaign.isActive ? 'Faol' : 'To‘xtatilgan'}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600 dark:text-tg-textMuted">
            {campaign.description || 'Tavsif kiritilmagan.'}
          </p>
          <div className="mt-3 grid gap-2 text-sm text-slate-600 dark:text-tg-textMuted sm:grid-cols-2">
            <p>
              <span className="font-medium text-slate-900 dark:text-white">Forma:</span>{' '}
              {campaign.formTitle || campaign.title}
            </p>
            <p>
              <span className="font-medium text-slate-900 dark:text-white">Slug:</span> /ad/{campaign.slug}
            </p>
          </div>
          <p className="mt-3 rounded-xl bg-white px-3 py-2 text-sm text-slate-700 shadow-sm dark:bg-tg-panel dark:text-tg-text">
            {campaign.formSubtitle || 'Ism va telefon qoldiring, siz bilan bog‘lanamiz.'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void navigator.clipboard.writeText(publicLink)}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-gray-50 dark:border-tg-hover dark:bg-tg-panel dark:text-tg-textMuted dark:hover:bg-tg-panelAlt"
          >
            <Copy size={15} />
            Link nusxalash
          </button>
          <button
            type="button"
            onClick={onToggleActive}
            disabled={isToggling}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-gray-50 disabled:opacity-60 dark:border-tg-hover dark:bg-tg-panel dark:text-tg-textMuted dark:hover:bg-tg-panelAlt"
          >
            {isToggling ? <Loader2 size={15} className="animate-spin" /> : <RefreshCcw size={15} />}
            {campaign.isActive ? 'To‘xtatish' : 'Faollashtirish'}
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={isDeleting}
            className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100 disabled:opacity-60 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/15"
          >
            {isDeleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
            O‘chirish
          </button>
        </div>
      </div>

      <div className="mt-4 flex-1 overflow-hidden rounded-2xl border border-gray-200 dark:border-tg-hover">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-tg-hover">
          <div>
            <h3 className="text-sm font-semibold text-slate-950 dark:text-white">Kelayotgan leadlar</h3>
            <p className="text-xs text-slate-500 dark:text-tg-textMuted">
              Meta Ads’dan tushgan userlar shu yerda ko‘rinadi.
            </p>
          </div>
          <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
            {leads.length} ta
          </span>
        </div>

        <div className="max-h-[560px] overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center gap-2 px-4 py-12 text-sm text-slate-500 dark:text-tg-textMuted">
              <Loader2 size={16} className="animate-spin" />
              Yuklanmoqda...
            </div>
          )}

          {!loading && error && (
            <div className="px-4 py-12 text-sm text-rose-600 dark:text-rose-300">{error}</div>
          )}

          {!loading && !error && leads.length === 0 && (
            <div className="px-4 py-12 text-center text-sm text-slate-500 dark:text-tg-textMuted">
              Hozircha lead yo‘q.
            </div>
          )}

          {!loading && !error && leads.length > 0 && (
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm dark:divide-tg-hover">
              <thead className="sticky top-0 bg-white dark:bg-tg-panel">
                <tr className="text-xs uppercase tracking-wide text-slate-500 dark:text-tg-textMuted">
                  <Th>Ism</Th>
                  <Th>Telefon</Th>
                  <Th>Email</Th>
                  <Th>Izoh</Th>
                  <Th>Vaqt</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-tg-hover">
                {leads.map((lead) => (
                  <tr key={lead.id} className="align-top">
                    <Td>
                      <div className="font-medium text-slate-950 dark:text-white">{lead.fullName}</div>
                    </Td>
                    <Td>
                      <div className="font-mono text-xs text-slate-700 dark:text-tg-text">{lead.phoneNumber}</div>
                    </Td>
                    <Td>
                      <div className="text-slate-700 dark:text-tg-text">{lead.email || '—'}</div>
                    </Td>
                    <Td>
                      <div className="max-w-[260px] whitespace-pre-wrap text-slate-600 dark:text-tg-textMuted">
                        {lead.comment || '—'}
                      </div>
                      {lead.pageUrl && (
                        <a
                          href={lead.pageUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
                        >
                          <ExternalLink size={12} />
                          Link
                        </a>
                      )}
                    </Td>
                    <Td>
                      <div className="text-slate-600 dark:text-tg-textMuted">{formatDateTime(lead.createdAt)}</div>
                    </Td>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-tg-textMuted">{label}</span>
      {children}
    </label>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="flex w-full items-center justify-between rounded-xl border border-gray-300 bg-white px-3 py-3 text-left transition hover:border-brand-300 hover:bg-brand-50 dark:border-tg-hover dark:bg-tg-panelAlt dark:hover:border-brand-500/30 dark:hover:bg-brand-500/10"
    >
      <span className="text-sm font-medium text-slate-700 dark:text-tg-text">{label}</span>
      <span
        className={`relative h-6 w-11 rounded-full transition ${
          checked ? 'bg-brand-500' : 'bg-gray-300 dark:bg-tg-hover'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
            checked ? 'left-5' : 'left-0.5'
          }`}
        />
      </span>
    </button>
  );
}

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white/90 p-4 shadow-sm dark:border-tg-border dark:bg-tg-panel">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-tg-textMuted">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950 dark:text-white">{value}</div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 font-medium">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3">{children}</td>;
}
