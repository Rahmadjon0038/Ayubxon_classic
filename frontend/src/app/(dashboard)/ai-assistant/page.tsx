'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Clock3, EyeOff, MapPin, Plus, Search, Phone, PencilLine, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, getErrorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { BranchInfo, GroupInfo, PromotionInfo, PromotionScope } from '@/lib/types';

type SectionKey = 'branches' | 'groups' | 'promotions';
type ModalKind = SectionKey | null;

interface SettingsResponse {
  aiEnabled: boolean;
}

interface ListResponse<T> {
  items: T[];
}

interface BranchFormState {
  name: string;
  locationUrl: string;
  workingHours: string;
  phoneNumber: string;
  subjectNames: string;
  extraInfo: string;
  isActive: boolean;
}

interface GroupFormState {
  branchId: string;
  subjectName: string;
  price: string;
  details: string;
  isActive: boolean;
}

interface PromotionFormState {
  scope: PromotionScope;
  branchId: string;
  title: string;
  details: string;
  isActive: boolean;
}

const TABS: { key: SectionKey; label: string; desc: string }[] = [
  { key: 'branches', label: 'Filiallar', desc: 'Asosiy ma\'lumotlar' },
  { key: 'groups', label: 'Guruhlar', desc: 'Filialga bog\'langan guruhlar' },
  { key: 'promotions', label: 'Aksiyalar', desc: 'Chegirmalar va maxsus takliflar' },
];

const emptyBranchForm: BranchFormState = {
  name: '',
  locationUrl: '',
  workingHours: '',
  phoneNumber: '',
  subjectNames: '',
  extraInfo: '',
  isActive: true,
};

const emptyGroupForm: GroupFormState = {
  branchId: '',
  subjectName: '',
  price: '',
  details: '',
  isActive: true,
};

const emptyPromotionForm: PromotionFormState = {
  scope: 'ALL_BRANCHES',
  branchId: '',
  title: '',
  details: '',
  isActive: true,
};

export default function AiAssistantPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<SectionKey>('branches');
  const [search, setSearch] = useState('');
  const [modalKind, setModalKind] = useState<ModalKind>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ kind: SectionKey; id: string; title: string } | null>(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiHydrated, setAiHydrated] = useState(false);
  const [branchForm, setBranchForm] = useState<BranchFormState>(emptyBranchForm);
  const [groupForm, setGroupForm] = useState<GroupFormState>(emptyGroupForm);
  const [promotionForm, setPromotionForm] = useState<PromotionFormState>(emptyPromotionForm);

  const settingsQuery = useQuery({
    queryKey: ['academy-settings-ai'],
    queryFn: async () => {
      const { data } = await api.get<SettingsResponse>('/academy-settings');
      return data;
    },
  });

  useEffect(() => {
    if (!settingsQuery.data || aiHydrated) return;
    setAiEnabled(settingsQuery.data.aiEnabled);
    setAiHydrated(true);
  }, [settingsQuery.data, aiHydrated]);

  const branchesQuery = useQuery({
    queryKey: ['knowledge-branches'],
    queryFn: async () => {
      const { data } = await api.get<ListResponse<BranchInfo>>('/knowledge-base/branches');
      return data.items;
    },
  });

  const groupsQuery = useQuery({
    queryKey: ['knowledge-groups'],
    queryFn: async () => {
      const { data } = await api.get<ListResponse<GroupInfo>>('/knowledge-base/groups');
      return data.items;
    },
  });

  const promotionsQuery = useQuery({
    queryKey: ['knowledge-promotions'],
    queryFn: async () => {
      const { data } = await api.get<ListResponse<PromotionInfo>>('/knowledge-base/promotions');
      return data.items;
    },
  });

  const branches = branchesQuery.data ?? [];
  const groups = groupsQuery.data ?? [];
  const promotions = promotionsQuery.data ?? [];

  const branchMap = useMemo(() => new Map(branches.map((branch) => [branch.id, branch])), [branches]);

  const branchSaveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: branchForm.name.trim(),
        locationUrl: branchForm.locationUrl.trim(),
        workingHours: branchForm.workingHours.trim(),
        phoneNumber: branchForm.phoneNumber.trim(),
        subjectNames: branchForm.subjectNames.trim(),
        extraInfo: branchForm.extraInfo.trim(),
        isActive: branchForm.isActive,
      };

      if (editingId) {
        const { data } = await api.put<{ item: BranchInfo }>(`/knowledge-base/branches/${editingId}`, payload);
        return data.item;
      }

      const { data } = await api.post<{ item: BranchInfo }>('/knowledge-base/branches', payload);
      return data.item;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['knowledge-branches'] });
      closeModal();
    },
  });

  const groupSaveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        branchId: groupForm.branchId,
        subjectName: groupForm.subjectName.trim(),
        price: groupForm.price.trim(),
        details: groupForm.details.trim(),
        isActive: groupForm.isActive,
      };

      if (editingId) {
        const { data } = await api.put<{ item: GroupInfo }>(`/knowledge-base/groups/${editingId}`, payload);
        return data.item;
      }

      const { data } = await api.post<{ item: GroupInfo }>('/knowledge-base/groups', payload);
      return data.item;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['knowledge-groups'] });
      closeModal();
    },
  });

  const promotionSaveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        scope: promotionForm.scope,
        branchId: promotionForm.scope === 'BRANCH' ? promotionForm.branchId : '',
        title: promotionForm.title.trim(),
        details: promotionForm.details.trim(),
        isActive: promotionForm.isActive,
      };

      if (editingId) {
        const { data } = await api.put<{ item: PromotionInfo }>(`/knowledge-base/promotions/${editingId}`, payload);
        return data.item;
      }

      const { data } = await api.post<{ item: PromotionInfo }>('/knowledge-base/promotions', payload);
      return data.item;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['knowledge-promotions'] });
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ kind, id }: { kind: SectionKey; id: string }) => {
      const endpointMap: Record<SectionKey, string> = {
        branches: '/knowledge-base/branches',
        groups: '/knowledge-base/groups',
        promotions: '/knowledge-base/promotions',
      };
      await api.delete(`${endpointMap[kind]}/${id}`);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['knowledge-branches'] }),
        queryClient.invalidateQueries({ queryKey: ['knowledge-groups'] }),
        queryClient.invalidateQueries({ queryKey: ['knowledge-promotions'] }),
      ]);
      setDeleteTarget(null);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (next: boolean) => {
      const { data } = await api.patch<{ aiEnabled: boolean }>('/academy-settings/ai-toggle', {
        aiEnabled: next,
      });
      return data;
    },
    onSuccess: (data) => {
      setAiEnabled(data.aiEnabled);
      queryClient.setQueryData<SettingsResponse | undefined>(['academy-settings-ai'], (old) =>
        old ? { ...old, aiEnabled: data.aiEnabled } : old,
      );
    },
  });

  const handleToggle = () => {
    const next = !aiEnabled;
    setAiEnabled(next);
    toggleMutation.mutate(next, {
      onError: () => setAiEnabled(!next),
    });
  };

  function resetForms() {
    setBranchForm(emptyBranchForm);
    setGroupForm(emptyGroupForm);
    setPromotionForm(emptyPromotionForm);
  }

  function closeModal() {
    setModalKind(null);
    setEditingId(null);
    resetForms();
  }

  function openCreate(kind: SectionKey) {
    setEditingId(null);
    setModalKind(kind);
    resetForms();
  }

  function openEdit(kind: SectionKey, item: BranchInfo | GroupInfo | PromotionInfo) {
    setEditingId(item.id);
    setModalKind(kind);
    if (kind === 'branches') {
      const branch = item as BranchInfo;
      setBranchForm({
        name: branch.name,
        locationUrl: branch.locationUrl,
        workingHours: branch.workingHours,
        phoneNumber: branch.phoneNumber,
        subjectNames: branch.subjectNames,
        extraInfo: branch.extraInfo ?? '',
        isActive: branch.isActive,
      });
    }
    if (kind === 'groups') {
      const group = item as GroupInfo;
      setGroupForm({
        branchId: group.branchId,
        subjectName: group.subjectName,
        price: group.price,
        details: group.details,
        isActive: group.isActive,
      });
    }
    if (kind === 'promotions') {
      const promotion = item as PromotionInfo;
      setPromotionForm({
        scope: promotion.scope,
        branchId: promotion.branchId ?? '',
        title: promotion.title,
        details: promotion.details,
        isActive: promotion.isActive,
      });
    }
  }

  const filteredBranches = branches.filter((item) => {
    const haystack = [item.name, item.locationUrl, item.workingHours, item.phoneNumber, item.subjectNames, item.extraInfo ?? '']
      .join(' ')
      .toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  });

  const filteredGroups = groups.filter((item) => {
    const branchName = branchMap.get(item.branchId)?.name ?? '';
    const haystack = [item.subjectName, item.price, item.details, branchName].join(' ').toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  });

  const filteredPromotions = promotions.filter((item) => {
    const branchName = item.branchId ? branchMap.get(item.branchId)?.name ?? '' : 'Barcha filiallar';
    const haystack = [item.title, item.details, branchName].join(' ').toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  });

  const inputClass =
    'w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50 dark:placeholder:text-slate-500 dark:focus:border-slate-500 dark:focus:ring-slate-800';
  const selectClass =
    'w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50 dark:focus:border-slate-500 dark:focus:ring-slate-800';

  const isLoading = branchesQuery.isLoading || groupsQuery.isLoading || promotionsQuery.isLoading;
  const isError = branchesQuery.isError || groupsQuery.isError || promotionsQuery.isError;
  const error = branchesQuery.error || groupsQuery.error || promotionsQuery.error;

  return (
    <div className="min-h-full overflow-y-auto bg-slate-50 p-4 sm:p-6 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-600 dark:text-sky-400">
                AI Assistant
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                Bilimlar bazasi
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-400">
                Filiallar asosiy ma&apos;lumot hisoblanadi. Guruhlar va aksiyalar alohida filialga bog&apos;lanadi.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleToggle}
                disabled={toggleMutation.isPending || settingsQuery.isLoading}
                className={`flex min-w-[200px] items-center justify-between gap-4 rounded-lg border px-4 py-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  aiEnabled
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
                    : 'border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                }`}
                aria-pressed={aiEnabled}
                aria-label={aiEnabled ? 'AI o‘chirish' : 'AI yoqish'}
              >
                <span className="flex items-center gap-2">
                  {aiEnabled ? <Check size={16} /> : <EyeOff size={16} />}
                  {aiEnabled ? 'AI yoqilgan' : 'AI o\'chirilgan'}
                </span>
                <span
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition ${
                    aiEnabled
                      ? 'border-emerald-500 bg-emerald-500'
                      : 'border-slate-300 bg-slate-200 dark:border-slate-600 dark:bg-slate-700'
                  }`}
                  aria-hidden="true"
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition ${
                      aiEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </span>
              </button>
            </div>
          </div>

          {settingsQuery.isError && (
            <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
              {getErrorMessage(settingsQuery.error)}
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {TABS.map((tab) => {
                const active = tab.key === activeTab;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                      active
                        ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                        : 'border-slate-300 bg-slate-50 text-slate-600 hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-slate-100'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className="ml-2 text-xs opacity-70">{tab.desc}</span>
                  </button>
                );
              })}
            </div>

            <div className="relative w-full lg:max-w-sm">
              <Search
                size={16}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Qidirish..."
                className={`${inputClass} pl-10`}
              />
            </div>
          </div>
        </div>

        {isLoading && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
            Yuklanmoqda...
          </div>
        )}

        {isError && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
            {getErrorMessage(error)}
          </div>
        )}

        {!isLoading && !isError && (
          <>
            {activeTab === 'branches' && (
              <SectionShell
                title="Filiallar"
                subtitle="Nomi, joylashuv linki, ish vaqti, telefon raqami va fan yo'nalishlari shu yerda saqlanadi."
                onAdd={() => openCreate('branches')}
                addLabel="Yangi filial qo'shish"
              >
                {filteredBranches.length === 0 ? (
                  <EmptyState onAdd={() => openCreate('branches')} label="Filial qo'shish" />
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {filteredBranches.map((branch) => (
                      <BranchCard
                        key={branch.id}
                        item={branch}
                        onEdit={() => openEdit('branches', branch)}
                        onDelete={() => setDeleteTarget({ kind: 'branches', id: branch.id, title: branch.name })}
                      />
                    ))}
                  </div>
                )}
              </SectionShell>
            )}

            {activeTab === 'groups' && (
              <SectionShell
                title="Guruhlar"
                subtitle="Har bir guruh filialga bog'lanadi. Fan nomi, kurs narxi va batafsil ma'lumot alohida yoziladi."
                onAdd={() => openCreate('groups')}
                addLabel="Yangi guruh qo'shish"
              >
                {filteredGroups.length === 0 ? (
                  <EmptyState onAdd={() => openCreate('groups')} label="Guruh qo'shish" />
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {filteredGroups.map((group) => (
                      <GroupCard
                        key={group.id}
                        item={group}
                        branchName={branchMap.get(group.branchId)?.name ?? 'Filial topilmadi'}
                        onEdit={() => openEdit('groups', group)}
                        onDelete={() => setDeleteTarget({ kind: 'groups', id: group.id, title: group.subjectName })}
                      />
                    ))}
                  </div>
                )}
              </SectionShell>
            )}

            {activeTab === 'promotions' && (
              <SectionShell
                title="Aksiyalar"
                subtitle="Chegirma yoki aksiya barcha filiallar uchun yoki bitta filial uchun belgilanishi mumkin."
                onAdd={() => openCreate('promotions')}
                addLabel="Yangi aksiya qo'shish"
              >
                {filteredPromotions.length === 0 ? (
                  <EmptyState onAdd={() => openCreate('promotions')} label="Aksiya qo'shish" />
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {filteredPromotions.map((promotion) => (
                      <PromotionCard
                        key={promotion.id}
                        item={promotion}
                        branchName={promotion.branchId ? branchMap.get(promotion.branchId)?.name ?? 'Filial topilmadi' : 'Barcha filiallar'}
                        onEdit={() => openEdit('promotions', promotion)}
                        onDelete={() => setDeleteTarget({ kind: 'promotions', id: promotion.id, title: promotion.title })}
                      />
                    ))}
                  </div>
                )}
              </SectionShell>
            )}
          </>
        )}
      </div>

      {modalKind && (
        <ModalShell title={editingId ? 'Tahrirlash' : 'Yangi yozuv qo\'shish'} onClose={closeModal}>
          {modalKind === 'branches' && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                branchSaveMutation.mutate();
              }}
              className="space-y-4"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Nomi *">
                  <input
                    type="text"
                    required
                    value={branchForm.name}
                    onChange={(event) => setBranchForm({ ...branchForm, name: event.target.value })}
                    className={inputClass}
                    placeholder="Boburshox filiali"
                  />
                </Field>
                <Field label="Joylashuv linki *">
                  <input
                    type="url"
                    required
                    value={branchForm.locationUrl}
                    onChange={(event) => setBranchForm({ ...branchForm, locationUrl: event.target.value })}
                    className={inputClass}
                    placeholder="https://maps.google.com/..."
                  />
                </Field>
                <Field label="Ish vaqti *">
                  <input
                    type="text"
                    required
                    value={branchForm.workingHours}
                    onChange={(event) => setBranchForm({ ...branchForm, workingHours: event.target.value })}
                    className={inputClass}
                    placeholder="09:00 - 19:00"
                  />
                </Field>
                <Field label="Telefon raqami *">
                  <input
                    type="text"
                    required
                    value={branchForm.phoneNumber}
                    onChange={(event) => setBranchForm({ ...branchForm, phoneNumber: event.target.value })}
                    className={inputClass}
                    placeholder="+998 99 123 45 67"
                  />
                </Field>
                <Field label="Fan yo'nalishlari *" className="md:col-span-2">
                  <textarea
                    required
                    rows={3}
                    value={branchForm.subjectNames}
                    onChange={(event) => setBranchForm({ ...branchForm, subjectNames: event.target.value })}
                    className={inputClass}
                    placeholder="Ingliz tili, Turk tili, IELTS, Matematika..."
                  />
                </Field>
                <Field label="Qo'shimcha ma'lumot" className="md:col-span-2">
                  <textarea
                    rows={4}
                    value={branchForm.extraInfo}
                    onChange={(event) => setBranchForm({ ...branchForm, extraInfo: event.target.value })}
                    className={inputClass}
                    placeholder="Filial haqida bilish kerak bo'lgan barcha qo'shimcha ma'lumotlar."
                  />
                </Field>
              </div>

              <StatusRow
                active={branchForm.isActive}
                onToggle={() => setBranchForm({ ...branchForm, isActive: !branchForm.isActive })}
              />

              <SaveBar
                pending={branchSaveMutation.isPending}
                error={branchSaveMutation.isError ? getErrorMessage(branchSaveMutation.error) : null}
                onCancel={closeModal}
              />
            </form>
          )}

          {modalKind === 'groups' && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                groupSaveMutation.mutate();
              }}
              className="space-y-4"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Filial *" className="md:col-span-2">
                  <select
                    required
                    value={groupForm.branchId}
                    onChange={(event) => setGroupForm({ ...groupForm, branchId: event.target.value })}
                    className={selectClass}
                  >
                    <option value="">Filial tanlang</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Fan nomi *">
                  <input
                    type="text"
                    required
                    value={groupForm.subjectName}
                    onChange={(event) => setGroupForm({ ...groupForm, subjectName: event.target.value })}
                    className={inputClass}
                    placeholder="Arab tili"
                  />
                </Field>
                <Field label="Kurs narxi *">
                  <input
                    type="text"
                    required
                    value={groupForm.price}
                    onChange={(event) => setGroupForm({ ...groupForm, price: event.target.value })}
                    className={inputClass}
                    placeholder="420 000 so'm/oy"
                  />
                </Field>
                <Field label="Batafsil ma'lumot *" className="md:col-span-2">
                  <textarea
                    required
                    rows={6}
                    value={groupForm.details}
                    onChange={(event) => setGroupForm({ ...groupForm, details: event.target.value })}
                    className={inputClass}
                    placeholder="Guruh haqidagi barcha savollarga javob beradigan batafsil ma'lumot. Jadval, yosh, daraja, sinov darsi va boshqa eslatmalar."
                  />
                </Field>
              </div>

              <StatusRow
                active={groupForm.isActive}
                onToggle={() => setGroupForm({ ...groupForm, isActive: !groupForm.isActive })}
              />

              <SaveBar
                pending={groupSaveMutation.isPending}
                error={groupSaveMutation.isError ? getErrorMessage(groupSaveMutation.error) : null}
                onCancel={closeModal}
              />
            </form>
          )}

          {modalKind === 'promotions' && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                promotionSaveMutation.mutate();
              }}
              className="space-y-4"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Qamrov *">
                  <select
                    value={promotionForm.scope}
                    onChange={(event) =>
                      setPromotionForm({
                        ...promotionForm,
                        scope: event.target.value as PromotionScope,
                        branchId: event.target.value === 'ALL_BRANCHES' ? '' : promotionForm.branchId,
                      })
                    }
                    className={selectClass}
                  >
                    <option value="ALL_BRANCHES">Barcha filiallar</option>
                    <option value="BRANCH">Bitta filial</option>
                  </select>
                </Field>
                <Field label="Filial" disabled={promotionForm.scope === 'ALL_BRANCHES'}>
                  <select
                    disabled={promotionForm.scope === 'ALL_BRANCHES'}
                    value={promotionForm.branchId}
                    onChange={(event) => setPromotionForm({ ...promotionForm, branchId: event.target.value })}
                    className={selectClass}
                  >
                    <option value="">Filial tanlang</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Sarlavha *" className="md:col-span-2">
                  <input
                    type="text"
                    required
                    value={promotionForm.title}
                    onChange={(event) => setPromotionForm({ ...promotionForm, title: event.target.value })}
                    className={inputClass}
                    placeholder="Yozgi chegirma"
                  />
                </Field>
                <Field label="Batafsil ma'lumot *" className="md:col-span-2">
                  <textarea
                    required
                    rows={6}
                    value={promotionForm.details}
                    onChange={(event) => setPromotionForm({ ...promotionForm, details: event.target.value })}
                    className={inputClass}
                    placeholder="Aksiya tafsilotlari, amal qilish muddati va kimlarga tegishli ekani."
                  />
                </Field>
              </div>

              <StatusRow
                active={promotionForm.isActive}
                onToggle={() => setPromotionForm({ ...promotionForm, isActive: !promotionForm.isActive })}
              />

              <SaveBar
                pending={promotionSaveMutation.isPending}
                error={promotionSaveMutation.isError ? getErrorMessage(promotionSaveMutation.error) : null}
                onCancel={closeModal}
              />
            </form>
          )}
        </ModalShell>
      )}

      {deleteTarget && (
        <ModalShell title="O'chirishni tasdiqlash" onClose={() => setDeleteTarget(null)} maxWidth="max-w-lg">
          <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">
            Ushbu yozuvni o&apos;chirmoqchimisiz? Bu amalni qaytarib bo&apos;lmaydi.
          </p>
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-50">{deleteTarget.title}</p>
          </div>
          {deleteMutation.isError && (
            <p className="mt-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
              {getErrorMessage(deleteMutation.error)}
            </p>
          )}
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-600"
            >
              Bekor qilish
            </button>
            <button
              type="button"
              onClick={() => deleteMutation.mutate({ kind: deleteTarget.kind, id: deleteTarget.id })}
              disabled={deleteMutation.isPending}
              className="rounded-lg bg-rose-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              O'chirish
            </button>
          </div>
        </ModalShell>
      )}
    </div>
  );
}

function SectionShell({
  title,
  subtitle,
  addLabel,
  onAdd,
  children,
}: {
  title: string;
  subtitle: string;
  addLabel: string;
  onAdd: () => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">{title}</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
        >
          <Plus size={16} />
          {addLabel}
        </button>
      </div>
      {children}
    </section>
  );
}

function EmptyState({ onAdd, label }: { onAdd: () => void; label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center dark:border-slate-700 dark:bg-slate-900">
      <p className="text-sm text-slate-600 dark:text-slate-400">Hozircha yozuv yo&apos;q.</p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
      >
        <Plus size={16} />
        {label}
      </button>
    </div>
  );
}

function Field({
  label,
  children,
  className = '',
  disabled = false,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <div className={className}>
      <label className={`mb-1 block text-sm font-medium ${disabled ? 'text-slate-400' : 'text-slate-700 dark:text-slate-200'}`}>
        {label}
      </label>
      {children}
    </div>
  );
}

function StatusRow({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <label className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
      <span>Holati</span>
      <button
        type="button"
        onClick={onToggle}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${active ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
            active ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </label>
  );
}

function SaveBar({
  pending,
  error,
  onCancel,
}: {
  pending: boolean;
  error: string | null;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
      {error && (
        <p className="mr-auto rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={onCancel}
        className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-600"
      >
        Bekor qilish
      </button>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
      >
        Saqlash
      </button>
    </div>
  );
}

function ModalShell({
  title,
  onClose,
  children,
  maxWidth = 'max-w-2xl',
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm">
      <div className={`w-full ${maxWidth} rounded-2xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-950`}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-900 dark:hover:text-slate-100"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function BranchCard({
  item,
  onEdit,
  onDelete,
}: {
  item: BranchInfo;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-slate-900 dark:text-slate-50">{item.name}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {item.isActive ? 'Faol' : 'Faol emas'}
          </p>
        </div>
        <span className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
          Filial
        </span>
      </div>

      <div className="mt-4 space-y-2 text-sm text-slate-700 dark:text-slate-300">
        <a
          href={item.locationUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-start gap-2 break-all text-sky-600 hover:underline dark:text-sky-400"
        >
          <MapPin size={16} className="mt-0.5 shrink-0" />
          <span>{item.locationUrl}</span>
        </a>
        <div className="flex gap-2">
          <Clock3 size={16} className="mt-0.5 shrink-0 text-slate-400" />
          <span>{item.workingHours}</span>
        </div>
        <div className="flex gap-2">
          <Phone size={16} className="mt-0.5 shrink-0 text-slate-400" />
          <span>{item.phoneNumber}</span>
        </div>
      </div>

      <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-900 dark:text-slate-300">
        <p className="font-medium text-slate-500 dark:text-slate-500">Fan yo&apos;nalishlari</p>
        <p className="mt-1 whitespace-pre-wrap">{item.subjectNames}</p>
      </div>

      {item.extraInfo && (
        <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-900 dark:text-slate-300">
          <p className="font-medium text-slate-500 dark:text-slate-500">Qo&apos;shimcha ma&apos;lumot</p>
          <p className="mt-1 whitespace-pre-wrap">{item.extraInfo}</p>
        </div>
      )}

      <div className="mt-4 text-xs text-slate-500 dark:text-slate-400">
        <p>Yangilangan: {formatDateTime(item.updatedAt)}</p>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
        >
          <PencilLine size={16} />
          Tahrirlash
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm font-medium text-rose-700 transition hover:border-rose-300 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300"
        >
          <Trash2 size={16} />
          O&apos;chirish
        </button>
      </div>
    </article>
  );
}

function GroupCard({
  item,
  branchName,
  onEdit,
  onDelete,
}: {
  item: GroupInfo;
  branchName: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-slate-900 dark:text-slate-50">{item.subjectName}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.isActive ? 'Faol' : 'Faol emas'}</p>
        </div>
        <span className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
          Guruh
        </span>
      </div>

      <div className="mt-4 space-y-2 text-sm text-slate-700 dark:text-slate-300">
        <p>
          <span className="font-medium text-slate-500 dark:text-slate-500">Filial:</span> {branchName}
        </p>
        <p>
          <span className="font-medium text-slate-500 dark:text-slate-500">Kurs narxi:</span> {item.price}
        </p>
      </div>

      <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-900 dark:text-slate-300">
        <p className="font-medium text-slate-500 dark:text-slate-500">Batafsil ma&apos;lumot</p>
        <p className="mt-1 whitespace-pre-wrap">{item.details}</p>
      </div>

      <div className="mt-4 text-xs text-slate-500 dark:text-slate-400">
        <p>Yangilangan: {formatDateTime(item.updatedAt)}</p>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
        >
          <PencilLine size={16} />
          Tahrirlash
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm font-medium text-rose-700 transition hover:border-rose-300 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300"
        >
          <Trash2 size={16} />
          O&apos;chirish
        </button>
      </div>
    </article>
  );
}

function PromotionCard({
  item,
  branchName,
  onEdit,
  onDelete,
}: {
  item: PromotionInfo;
  branchName: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-slate-900 dark:text-slate-50">{item.title}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.isActive ? 'Faol' : 'Faol emas'}</p>
        </div>
        <span className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
          Aksiya
        </span>
      </div>

      <div className="mt-4 space-y-2 text-sm text-slate-700 dark:text-slate-300">
        <p>
          <span className="font-medium text-slate-500 dark:text-slate-500">Filial:</span> {branchName}
        </p>
      </div>

      <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-900 dark:text-slate-300">
        <p className="font-medium text-slate-500 dark:text-slate-500">Batafsil ma&apos;lumot</p>
        <p className="mt-1 whitespace-pre-wrap">{item.details}</p>
      </div>

      <div className="mt-4 text-xs text-slate-500 dark:text-slate-400">
        <p>Yangilangan: {formatDateTime(item.updatedAt)}</p>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
        >
          <PencilLine size={16} />
          Tahrirlash
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm font-medium text-rose-700 transition hover:border-rose-300 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300"
        >
          <Trash2 size={16} />
          O&apos;chirish
        </button>
      </div>
    </article>
  );
}
