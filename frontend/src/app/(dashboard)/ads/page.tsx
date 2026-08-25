'use client';

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  Copy,
  Loader2,
  Megaphone,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { API_URL, api, getErrorMessage } from '@/lib/api';
import { formatDateTime, formatRelativeTime } from '@/lib/format';
import { useInstagramAccount } from '@/lib/useInstagramAccount';
import { AdCampaign, AdLead } from '@/lib/types';

type CampaignFormState = {
  title: string;
  metaPageId: string;
  metaPageName: string;
  metaFormId: string;
  metaFormName: string;
  isActive: boolean;
};

const emptyForm: CampaignFormState = {
  title: '',
  metaPageId: '',
  metaPageName: '',
  metaFormId: '',
  metaFormName: '',
  isActive: true,
};

type CampaignListResponse = { items: AdCampaign[] };
type LeadListResponse = { items: AdLead[] };

function buildWebhookUrl(): string {
  return new URL('/api/webhooks/meta-leads', API_URL).toString();
}

function displayValue(value: string | null | undefined, fallback = 'Biriktirilmagan'): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function fieldEntries(rawFields: Record<string, string[]> | null): Array<[string, string[]]> {
  if (!rawFields) return [];
  return Object.entries(rawFields)
    .filter(([, values]) => values.length > 0)
    .sort(([a], [b]) => a.localeCompare(b));
}

export default function AdsPage() {
  const queryClient = useQueryClient();
  const accountQuery = useInstagramAccount();
  const accountKey = accountQuery.data?.id ?? 'none';
  const [search, setSearch] = useState('');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [form, setForm] = useState<CampaignFormState>(emptyForm);

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
        metaPageId: form.metaPageId.trim(),
        metaPageName: form.metaPageName.trim(),
        metaFormId: form.metaFormId.trim(),
        metaFormName: form.metaFormName.trim(),
        isActive: form.isActive,
      };
      const { data } = await api.post<{ item: AdCampaign }>('/ad-campaigns', payload);
      return data.item;
    },
    onSuccess: async (item) => {
      setForm(emptyForm);
      setIsModalOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['ad-campaigns', accountKey] });
      setSelectedCampaignId(item.id);
    },
  });

  const subscribeMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      const { data } = await api.post<{ ok: boolean; subscribed: boolean }>(`/ad-campaigns/${campaignId}/subscribe`);
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['ad-campaigns', accountKey] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      await api.delete(`/ad-campaigns/${campaignId}`);
      return campaignId;
    },
    onSuccess: async (deletedId) => {
      await queryClient.invalidateQueries({ queryKey: ['ad-campaigns', accountKey] });
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
      [
        item.title,
        item.metaPageId,
        item.metaPageName,
        item.metaFormId,
        item.metaFormName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [campaignsQuery.data, search]);

  const webhookUrl = buildWebhookUrl();
  const campaignLeads = leadQuery.data ?? [];

  async function copyWebhookUrl() {
    await navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    window.setTimeout(() => setCopiedWebhook(false), 1500);
  }

  function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.title.trim() || createMutation.isPending) return;
    createMutation.mutate();
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <div className="flex min-h-full flex-col gap-3 p-3 md:p-4">
        <header className="rounded-2xl border border-gray-200/80 bg-white/90 p-3 shadow-sm backdrop-blur dark:border-tg-border dark:bg-tg-panel">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-300">
                <Megaphone size={14} />
                Meta Lead Ads
              </div>
              <div>
                <h1 className="text-xl font-semibold text-slate-950 dark:text-white">Reklama kampaniyalari</h1>
                <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-tg-textMuted">
                  Bu sahifa public lead form emas. Kampaniya nomi, Meta Page ID va Form ID shu yerda saqlanadi.
                  Leadlar webhook orqali to‘g‘ridan to‘g‘ri platformaga tushadi.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <StatChip
                label="Kampaniyalar"
                value={campaignsQuery.data?.length ?? 0}
                icon={<Megaphone size={12} />}
              />
              <StatChip label="Leadlar" value={campaignLeads.length} icon={<Users size={12} />} />
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
              >
                <Plus size={16} />
                Yangi kampaniya
              </button>
            </div>
          </div>
        </header>

        <section className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="min-h-0 rounded-2xl border border-gray-200/80 bg-white/90 p-3 shadow-sm dark:border-tg-border dark:bg-tg-panel">
            <div className="space-y-3">
              <div className="space-y-2 rounded-xl border border-brand-200/70 bg-brand-50/60 p-3 dark:border-brand-500/20 dark:bg-brand-500/10">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950 dark:text-white">Webhook URL</p>
                    <p className="mt-0.5 text-xs text-slate-600 dark:text-tg-textMuted">
                      Meta webhook callback shu manzilga ulanadi.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={copyWebhookUrl}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-white px-2.5 py-1.5 text-xs font-medium text-brand-700 transition hover:bg-brand-50 dark:border-brand-500/20 dark:bg-tg-panel dark:text-brand-300"
                  >
                    {copiedWebhook ? <Check size={12} /> : <Copy size={12} />}
                    {copiedWebhook ? 'Nusxalandi' : 'Copy'}
                  </button>
                </div>
                <p className="break-all rounded-lg bg-white px-2.5 py-2 text-xs text-slate-700 dark:bg-tg-panelAlt dark:text-tg-text">
                  {webhookUrl}
                </p>
                <p className="text-xs text-slate-500 dark:text-tg-textMuted">
                  `object: page` va `field: leadgen` eventlari shu endpointga tushadi.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <label className="relative block min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Kampaniya qidirish"
                    className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-8 pr-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-tg-hover dark:bg-tg-panelAlt dark:text-tg-text"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => queryClient.invalidateQueries({ queryKey: ['ad-campaigns', accountKey] })}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50 dark:border-tg-hover dark:bg-tg-panelAlt dark:text-tg-textMuted"
                >
                  <RefreshCw size={16} />
                </button>
              </div>

              <div className="max-h-[calc(100vh-260px)] space-y-2 overflow-y-auto pr-1">
                {campaignsQuery.isLoading && (
                  <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 px-4 py-8 text-sm text-slate-500 dark:border-tg-hover dark:text-tg-textMuted">
                    <Loader2 size={16} className="animate-spin" />
                    Yuklanmoqda...
                  </div>
                )}

                {!campaignsQuery.isLoading && filteredCampaigns.length === 0 && (
                  <div className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-tg-hover dark:text-tg-textMuted">
                    Hozircha kampaniya yo‘q.
                  </div>
                )}

                {filteredCampaigns.map((campaign) => {
                  const active = campaign.id === selectedCampaignId;
                  return (
                    <button
                      key={campaign.id}
                      type="button"
                      onClick={() => setSelectedCampaignId(campaign.id)}
                      className={`w-full rounded-xl border p-3 text-left transition ${
                        active
                          ? 'border-brand-300 bg-brand-50 shadow-[0_10px_25px_rgba(59,130,246,0.12)] dark:border-brand-500/40 dark:bg-brand-500/10'
                          : 'border-gray-200 bg-white hover:border-brand-200 hover:bg-gray-50 dark:border-tg-hover dark:bg-tg-panelAlt dark:hover:border-brand-500/30 dark:hover:bg-tg-panelAlt/80'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">{campaign.title}</p>
                          <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-tg-textMuted">
                            {displayValue(campaign.metaFormName ?? campaign.metaFormId, 'Form ID yo‘q')}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            campaign.isActive
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                              : 'bg-gray-100 text-gray-700 dark:bg-tg-panelAlt dark:text-tg-textMuted'
                          }`}
                        >
                          {campaign.isActive ? 'Faol' : 'O‘chiq'}
                        </span>
                      </div>

                      <div className="mt-3 grid gap-2 text-xs text-slate-600 dark:text-tg-textMuted">
                        <div className="flex items-center justify-between gap-2">
                          <span>Page</span>
                          <span className="truncate text-right">{displayValue(campaign.metaPageName ?? campaign.metaPageId)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span>Leadlar</span>
                          <span>{campaign.leadCount ?? 0}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span>Yangilangan</span>
                          <span>{formatRelativeTime(campaign.updatedAt)}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          <main className="min-h-0 rounded-2xl border border-gray-200/80 bg-white/90 p-3 shadow-sm dark:border-tg-border dark:bg-tg-panel">
            {!selectedCampaign ? (
              <EmptyState />
            ) : (
              <div className="flex h-full min-h-0 flex-col gap-3">
                <div className="rounded-2xl border border-gray-200 bg-white p-3 dark:border-tg-hover dark:bg-tg-panelAlt">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                        <ShieldCheck size={14} />
                        Tanlangan kampaniya
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{selectedCampaign.title}</h2>
                        <p className="mt-1 text-sm text-slate-600 dark:text-tg-textMuted">
                          Meta Page va Form ID ni ko‘rsatadi. Leadlar shu kampaniyaga yoziladi.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => subscribeMutation.mutate(selectedCampaign.id)}
                        disabled={!selectedCampaign.metaPageId || subscribeMutation.isPending}
                        className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {subscribeMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                        Page ulash
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteMutation.mutate(selectedCampaign.id)}
                        disabled={deleteMutation.isPending}
                        className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-500/20 dark:bg-tg-panel dark:hover:bg-red-500/10"
                      >
                        {deleteMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                        O‘chirish
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-[1fr_1.1fr]">
                  <section className="space-y-3 rounded-2xl border border-gray-200 bg-white p-3 dark:border-tg-hover dark:bg-tg-panelAlt">
                    <h3 className="text-sm font-semibold text-slate-950 dark:text-white">Kampaniya ma'lumotlari</h3>
                    <KeyValue label="Meta Page ID" value={displayValue(selectedCampaign.metaPageId)} />
                    <KeyValue label="Meta Page nomi" value={displayValue(selectedCampaign.metaPageName)} />
                    <KeyValue label="Meta Form ID" value={displayValue(selectedCampaign.metaFormId)} />
                    <KeyValue label="Meta Form nomi" value={displayValue(selectedCampaign.metaFormName)} />
                    <KeyValue label="Leadlar soni" value={`${selectedCampaign.leadCount ?? 0}`} />
                    <KeyValue label="Status" value={selectedCampaign.isActive ? 'Faol' : 'O‘chiq'} />
                  </section>

                  <section className="min-h-0 rounded-2xl border border-gray-200 bg-white p-3 dark:border-tg-hover dark:bg-tg-panelAlt">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-950 dark:text-white">Leadlar</h3>
                        <p className="text-xs text-slate-500 dark:text-tg-textMuted">
                          Meta lead formdan kelgan userlar shu yerda chiqadi.
                        </p>
                      </div>
                      {leadQuery.isFetching && <Loader2 size={16} className="animate-spin text-slate-400" />}
                    </div>

                    <div className="max-h-[58vh] space-y-2 overflow-y-auto pr-1">
                      {leadQuery.isLoading && (
                        <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 px-4 py-8 text-sm text-slate-500 dark:border-tg-hover dark:text-tg-textMuted">
                          <Loader2 size={16} className="animate-spin" />
                          Leadlar yuklanmoqda...
                        </div>
                      )}

                      {!leadQuery.isLoading && campaignLeads.length === 0 && (
                        <div className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-tg-hover dark:text-tg-textMuted">
                          Hozircha lead yo‘q.
                        </div>
                      )}

                      {campaignLeads.map((lead) => (
                        <article
                          key={lead.id}
                          className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-tg-hover dark:bg-tg-panel"
                        >
                          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">{lead.fullName}</p>
                              <p className="mt-0.5 text-xs text-slate-500 dark:text-tg-textMuted">
                                {lead.metaLeadId}
                              </p>
                            </div>
                            <span className="text-xs text-slate-500 dark:text-tg-textMuted">
                              {formatDateTime(lead.leadCreatedAt ?? lead.createdAt)}
                            </span>
                          </div>

                          <div className="mt-3 grid gap-2 text-sm text-slate-700 dark:text-tg-text">
                            <LeadLine label="Telefon" value={lead.phoneNumber ?? 'Ko‘rsatilmagan'} />
                            <LeadLine label="Email" value={lead.email ?? 'Ko‘rsatilmagan'} />
                            <LeadLine label="Izoh" value={lead.comment ?? 'Yo‘q'} />
                          </div>

                          {fieldEntries(lead.rawFields).length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {fieldEntries(lead.rawFields).map(([key, values]) => (
                                <span
                                  key={key}
                                  className="inline-flex max-w-full items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-slate-600 dark:border-tg-hover dark:bg-tg-panelAlt dark:text-tg-textMuted"
                                >
                                  <span className="font-semibold text-slate-700 dark:text-white">{key}</span>
                                  <span className="truncate">{values.join(', ')}</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </article>
                      ))}
                    </div>
                  </section>
                </div>
              </div>
            )}
          </main>
        </section>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-3 backdrop-blur-sm md:items-center">
          <form
            onSubmit={handleCreateSubmit}
            className="w-full max-w-2xl rounded-3xl border border-gray-200 bg-white p-4 shadow-2xl dark:border-tg-hover dark:bg-tg-panel"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Kampaniya yaratish</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-tg-textMuted">
                  Nom majburiy. Meta Page ID va Form ID ixtiyoriy, lekin leadlarni avtomatik ulash uchun kerak bo‘ladi.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-full p-2 text-slate-500 transition hover:bg-gray-100 hover:text-slate-900 dark:hover:bg-tg-panelAlt dark:hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Kampaniya nomi *">
                <input
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Masalan: Ingliz tili leadlar"
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-tg-hover dark:bg-tg-panelAlt dark:text-tg-text"
                />
              </Field>
              <Field label="Meta Page ID">
                <input
                  value={form.metaPageId}
                  onChange={(e) => setForm((prev) => ({ ...prev, metaPageId: e.target.value }))}
                  placeholder="1234567890"
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-tg-hover dark:bg-tg-panelAlt dark:text-tg-text"
                />
              </Field>
              <Field label="Meta Page nomi">
                <input
                  value={form.metaPageName}
                  onChange={(e) => setForm((prev) => ({ ...prev, metaPageName: e.target.value }))}
                  placeholder="Taraqqiyot o'quv markazi"
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-tg-hover dark:bg-tg-panelAlt dark:text-tg-text"
                />
              </Field>
              <Field label="Meta Form ID">
                <input
                  value={form.metaFormId}
                  onChange={(e) => setForm((prev) => ({ ...prev, metaFormId: e.target.value }))}
                  placeholder="9988776655"
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-tg-hover dark:bg-tg-panelAlt dark:text-tg-text"
                />
              </Field>
              <Field label="Meta Form nomi">
                <input
                  value={form.metaFormName}
                  onChange={(e) => setForm((prev) => ({ ...prev, metaFormName: e.target.value }))}
                  placeholder="Bepul konsultatsiya"
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-tg-hover dark:bg-tg-panelAlt dark:text-tg-text"
                />
              </Field>
              <Field label="Faollik">
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, isActive: !prev.isActive }))}
                  className={`inline-flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                    form.isActive
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300'
                      : 'border-gray-200 bg-gray-50 text-slate-600 dark:border-tg-hover dark:bg-tg-panelAlt dark:text-tg-textMuted'
                  }`}
                >
                  <span>{form.isActive ? 'Faol' : 'O‘chiq'}</span>
                  <span className={`h-5 w-10 rounded-full p-0.5 ${form.isActive ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                    <span className={`block h-4 w-4 rounded-full bg-white transition ${form.isActive ? 'translate-x-5' : ''}`} />
                  </span>
                </button>
              </Field>
            </div>

            {createMutation.error && (
              <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                {getErrorMessage(createMutation.error)}
              </p>
            )}

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-gray-50 dark:border-tg-hover dark:bg-tg-panelAlt dark:text-tg-text"
              >
                Bekor qilish
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending || !form.title.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {createMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                Kampaniya yaratish
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function StatChip({ label, value, icon }: { label: string; value: ReactNode; icon: ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm dark:border-tg-hover dark:bg-tg-panelAlt dark:text-tg-text">
      <span className="text-brand-600 dark:text-brand-300">{icon}</span>
      <span className="font-medium">{label}:</span>
      <span className="font-semibold text-slate-950 dark:text-white">{value}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1.5">
      <span className="block text-sm font-medium text-slate-700 dark:text-tg-text">{label}</span>
      {children}
    </label>
  );
}

function KeyValue({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5 dark:border-tg-hover dark:bg-tg-panel">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-tg-textMuted">{label}</span>
      <span className="max-w-[70%] break-words text-right text-sm font-semibold text-slate-950 dark:text-white">{value}</span>
    </div>
  );
}

function LeadLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 dark:border-tg-hover dark:bg-tg-panel">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-tg-textMuted">{label}</span>
      <span className="max-w-[70%] break-words text-right text-sm font-medium text-slate-800 dark:text-tg-text">{value}</span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white/40 text-center dark:border-tg-hover dark:bg-tg-panelAlt/30">
      <div className="max-w-md px-4 py-10">
        <Megaphone className="mx-auto text-brand-500" size={40} />
        <h2 className="mt-4 text-lg font-semibold text-slate-950 dark:text-white">Kampaniya tanlanmadi</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-tg-textMuted">
          Chap tomondan kampaniya tanlang yoki yuqoridagi tugma bilan yangi Meta Lead Ads kampaniyasini yarating.
        </p>
      </div>
    </div>
  );
}
