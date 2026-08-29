'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  EyeOff,
  FileJson,
  ImagePlus,
  Plus,
  Search,
  PencilLine,
  Trash2,
  Video,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from 'react';
import { api, getErrorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { BranchInfo, GroupInfo } from '@/lib/types';

const MAX_PHOTOS = 2;

interface ImportResult {
  academyNameUpdated: boolean;
  branches: { created: number; updated: number };
  groups: { created: number; updated: number; skipped: string[] };
}

const IMPORT_TEMPLATE = `{
  "academyName": "Ayubxon Classic",
  "branches": [
    {
      "name": "Asosiy do'kon",
      "locationUrl": "https://maps.google.com/?q=Ayubxon+Classic",
      "workingHours": "09:00-20:00",
      "phoneNumber": "+998 99 695 55 50",
      "description": "Erkaklar va ayollar uchun sifatli tayyor kiyim-kechak sotuvchi do'kon.",
      "photoUrls": [],
      "isActive": true
    }
  ],
  "groups": [
    {
      "branchName": "Asosiy do'kon",
      "videoUrl": "https://www.instagram.com/reel/xxxxxxxxxxx/",
      "details": "Rangi qora yoki kulrang.\\nPidjak narxi 450 000 so'm\\nKo'ylak narxi 190 000 so'm\\nShim narxi 180 000 so'm",
      "isActive": true
    }
  ]
}`;

type SectionKey = 'branches' | 'groups';
type ModalKind = 'groups' | null;

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
  description: string;
  photoUrls: string[];
  extraInfo: string;
  isActive: boolean;
}

interface GroupFormState {
  branchId: string;
  videoUrl: string;
  details: string;
  isActive: boolean;
}

const TABS: { key: SectionKey; label: string; desc: string }[] = [
  { key: 'branches', label: "Do'kon", desc: "Asosiy ma'lumotlar" },
  { key: 'groups', label: 'Mahsulotlar', desc: "Do'konga bog'langan mahsulotlar" },
];

const emptyBranchForm: BranchFormState = {
  name: '',
  locationUrl: '',
  workingHours: '',
  phoneNumber: '',
  description: '',
  photoUrls: [],
  extraInfo: '',
  isActive: true,
};

const emptyGroupForm: GroupFormState = {
  branchId: '',
  videoUrl: '',
  details: '',
  isActive: true,
};

function firstLine(text: string, fallback: string): string {
  const line = text.split('\n').find((part) => part.trim().length > 0)?.trim();
  return line ? (line.length > 60 ? `${line.slice(0, 60)}…` : line) : fallback;
}

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
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importParseError, setImportParseError] = useState<string | null>(null);

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

  const branches = branchesQuery.data ?? [];
  const groups = groupsQuery.data ?? [];
  // Bitta biznesda bitta do'kon bo'ladi — ro'yxat emas, shuning uchun birinchi (yagona)
  // yozuv bevosita formaga yuklanadi.
  const existingBranch = branches[0] ?? null;

  const branchMap = useMemo(() => new Map(branches.map((branch) => [branch.id, branch])), [branches]);

  const [branchFormHydrated, setBranchFormHydrated] = useState(false);
  useEffect(() => {
    if (branchFormHydrated || branchesQuery.isLoading) return;
    if (existingBranch) {
      setBranchForm({
        name: existingBranch.name,
        locationUrl: existingBranch.locationUrl,
        workingHours: existingBranch.workingHours,
        phoneNumber: existingBranch.phoneNumber,
        description: existingBranch.description,
        photoUrls: existingBranch.photoUrls,
        extraInfo: existingBranch.extraInfo ?? '',
        isActive: existingBranch.isActive,
      });
    }
    setBranchFormHydrated(true);
  }, [existingBranch, branchesQuery.isLoading, branchFormHydrated]);

  const photoUploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post<{ url: string }>('/knowledge-base/branches/upload-photo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data.url;
    },
    onSuccess: (url) => {
      setBranchForm((prev) => ({ ...prev, photoUrls: [...prev.photoUrls, url].slice(0, MAX_PHOTOS) }));
    },
  });

  function handlePhotoSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    photoUploadMutation.reset();
    photoUploadMutation.mutate(file);
  }

  function removePhoto(url: string) {
    setBranchForm((prev) => ({ ...prev, photoUrls: prev.photoUrls.filter((item) => item !== url) }));
  }

  const branchSaveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: branchForm.name.trim(),
        locationUrl: branchForm.locationUrl.trim(),
        workingHours: branchForm.workingHours.trim(),
        phoneNumber: branchForm.phoneNumber.trim(),
        description: branchForm.description.trim(),
        photoUrls: branchForm.photoUrls,
        extraInfo: branchForm.extraInfo.trim(),
        isActive: branchForm.isActive,
      };

      if (existingBranch) {
        const { data } = await api.put<{ item: BranchInfo }>(`/knowledge-base/branches/${existingBranch.id}`, payload);
        return data.item;
      }

      const { data } = await api.post<{ item: BranchInfo }>('/knowledge-base/branches', payload);
      return data.item;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['knowledge-branches'] });
    },
  });

  const groupSaveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        branchId: groupForm.branchId,
        videoUrl: groupForm.videoUrl.trim(),
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

  const importMutation = useMutation({
    mutationFn: async (payload: unknown) => {
      const { data } = await api.post<{ result: ImportResult }>('/knowledge-base/import', payload);
      return data.result;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['knowledge-branches'] }),
        queryClient.invalidateQueries({ queryKey: ['knowledge-groups'] }),
        queryClient.invalidateQueries({ queryKey: ['academy-settings-ai'] }),
      ]);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ kind, id }: { kind: SectionKey; id: string }) => {
      const endpointMap: Record<SectionKey, string> = {
        branches: '/knowledge-base/branches',
        groups: '/knowledge-base/groups',
      };
      await api.delete(`${endpointMap[kind]}/${id}`);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['knowledge-branches'] }),
        queryClient.invalidateQueries({ queryKey: ['knowledge-groups'] }),
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

  function closeModal() {
    setModalKind(null);
    setEditingId(null);
    setGroupForm(emptyGroupForm);
  }

  function openImport() {
    setImportText('');
    setImportParseError(null);
    importMutation.reset();
    setImportOpen(true);
  }

  function closeImport() {
    setImportOpen(false);
  }

  function insertImportTemplate() {
    setImportText(IMPORT_TEMPLATE);
    setImportParseError(null);
    importMutation.reset();
  }

  function handleImportSubmit() {
    setImportParseError(null);
    let payload: unknown;
    try {
      payload = JSON.parse(importText);
    } catch {
      setImportParseError("JSON formati noto'g'ri — matnni tekshirib qaytadan urinib ko'ring.");
      return;
    }
    importMutation.mutate(payload);
  }

  function openCreateGroup() {
    setEditingId(null);
    setModalKind('groups');
    setGroupForm(emptyGroupForm);
  }

  function openEditGroup(group: GroupInfo) {
    setEditingId(group.id);
    setModalKind('groups');
    setGroupForm({
      branchId: group.branchId,
      videoUrl: group.videoUrl ?? '',
      details: group.details,
      isActive: group.isActive,
    });
  }

  const filteredGroups = groups.filter((item) => {
    const branchName = branchMap.get(item.branchId)?.name ?? '';
    const haystack = [item.details, item.videoUrl ?? '', branchName].join(' ').toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  });

  const inputClass =
    'w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-tg-hover dark:bg-tg-panel dark:text-tg-text dark:placeholder:text-slate-500 dark:focus:border-slate-500 dark:focus:ring-slate-800';
  const selectClass =
    'w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-tg-hover dark:bg-tg-panel dark:text-tg-text dark:focus:border-slate-500 dark:focus:ring-slate-800';

  const isLoading = branchesQuery.isLoading || groupsQuery.isLoading;
  const isError = branchesQuery.isError || groupsQuery.isError;
  const error = branchesQuery.error || groupsQuery.error;

  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-4 sm:p-6 dark:bg-tg-bg">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-tg-border dark:bg-tg-panel sm:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-600 dark:text-sky-400">
                AI Assistant
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 dark:text-tg-text">
                Bilimlar bazasi
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-tg-textMuted">
                Do&apos;kon asosiy ma&apos;lumot hisoblanadi. Mahsulotlar do&apos;konga bog&apos;lanadi.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={openImport}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-tg-hover dark:bg-tg-panel dark:text-tg-text dark:hover:border-tg-hover"
              >
                <FileJson size={16} />
                JSON orqali to&apos;ldirish
              </button>
              <button
                type="button"
                onClick={handleToggle}
                disabled={toggleMutation.isPending || settingsQuery.isLoading}
                className={`flex min-w-[200px] items-center justify-between gap-4 rounded-lg border px-4 py-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  aiEnabled
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
                    : 'border-slate-300 bg-slate-50 text-slate-700 dark:border-tg-hover dark:bg-tg-panelAlt dark:text-tg-text'
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
                      : 'border-slate-300 bg-slate-200 dark:border-tg-hover dark:bg-tg-hover'
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

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-tg-border dark:bg-tg-panel sm:p-5">
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
                        : 'border-slate-300 bg-slate-50 text-slate-600 hover:border-slate-400 hover:text-slate-900 dark:border-tg-hover dark:bg-tg-panelAlt dark:text-tg-textMuted dark:hover:border-tg-hover dark:hover:text-tg-text'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className="ml-2 text-xs opacity-70">{tab.desc}</span>
                  </button>
                );
              })}
            </div>

            {activeTab === 'groups' && (
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
            )}
          </div>
        </div>

        {isLoading && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500 dark:border-tg-hover dark:bg-tg-panel dark:text-tg-textMuted">
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
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-tg-border dark:bg-tg-panel sm:p-5">
                <div className="mb-5">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-tg-text">Do&apos;kon</h2>
                  <p className="mt-1 text-sm text-slate-600 dark:text-tg-textMuted">
                    Nomi, tavsifi, manzili, ish vaqti, egasining telefon raqami va rasmlari shu yerda saqlanadi.
                  </p>
                </div>

                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    branchSaveMutation.mutate();
                  }}
                  className="space-y-4"
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Nomi *">
                      <input
                        type="text"
                        required
                        value={branchForm.name}
                        onChange={(event) => setBranchForm({ ...branchForm, name: event.target.value })}
                        className={inputClass}
                        placeholder="Ayubxon Classic"
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
                        placeholder="09:00 - 20:00"
                      />
                    </Field>
                    <Field label="Egasining telefon raqami *">
                      <input
                        type="text"
                        required
                        value={branchForm.phoneNumber}
                        onChange={(event) => setBranchForm({ ...branchForm, phoneNumber: event.target.value })}
                        className={inputClass}
                        placeholder="+998 99 123 45 67"
                      />
                    </Field>
                    <Field label="Do'kon haqida ma'lumot *" className="sm:col-span-2">
                      <textarea
                        required
                        rows={3}
                        value={branchForm.description}
                        onChange={(event) => setBranchForm({ ...branchForm, description: event.target.value })}
                        className={inputClass}
                        placeholder="Erkaklar va ayollar uchun sifatli tayyor kiyim-kechak sotuvchi do'kon."
                      />
                    </Field>
                    <Field label="Qo'shimcha ma'lumot" className="sm:col-span-2">
                      <textarea
                        rows={4}
                        value={branchForm.extraInfo}
                        onChange={(event) => setBranchForm({ ...branchForm, extraInfo: event.target.value })}
                        className={inputClass}
                        placeholder="Do'kon haqida bilish kerak bo'lgan boshqa qo'shimcha ma'lumotlar."
                      />
                    </Field>
                    <Field label={`Rasmlar (ko'pi bilan ${MAX_PHOTOS} ta)`} className="sm:col-span-2">
                      <div className="flex flex-wrap items-center gap-3">
                        {branchForm.photoUrls.map((url) => (
                          <div
                            key={url}
                            className="group relative h-20 w-20 overflow-hidden rounded-lg border border-slate-200 dark:border-tg-hover"
                          >
                            <img src={url} alt="Do'kon rasmi" className="h-full w-full object-cover" />
                            <button
                              type="button"
                              onClick={() => removePhoto(url)}
                              className="absolute right-1 top-1 rounded-full bg-slate-950/70 p-1 text-white transition hover:bg-rose-600"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                        {branchForm.photoUrls.length < MAX_PHOTOS && (
                          <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 text-slate-400 transition hover:border-slate-400 hover:text-slate-600 dark:border-tg-hover dark:text-tg-textMuted dark:hover:border-tg-hover">
                            {photoUploadMutation.isPending ? (
                              <span className="text-[10px]">Yuklanmoqda...</span>
                            ) : (
                              <>
                                <ImagePlus size={18} />
                                <span className="text-[10px]">Rasm qo&apos;shish</span>
                              </>
                            )}
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              className="hidden"
                              onChange={handlePhotoSelect}
                              disabled={photoUploadMutation.isPending}
                            />
                          </label>
                        )}
                      </div>
                      {photoUploadMutation.isError && (
                        <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">
                          {getErrorMessage(photoUploadMutation.error)}
                        </p>
                      )}
                    </Field>
                  </div>

                  <StatusRow
                    active={branchForm.isActive}
                    onToggle={() => setBranchForm({ ...branchForm, isActive: !branchForm.isActive })}
                  />

                  <SaveBar
                    pending={branchSaveMutation.isPending}
                    error={branchSaveMutation.isError ? getErrorMessage(branchSaveMutation.error) : null}
                    success={branchSaveMutation.isSuccess ? 'Saqlandi ✓' : null}
                  />
                </form>
              </section>
            )}

            {activeTab === 'groups' && (
              <SectionShell
                title="Mahsulotlar"
                subtitle="Instagram video linki va mahsulot haqidagi erkin matnli ma'lumot (rang, o'lcham, narx va h.k.) shu yerda saqlanadi."
                onAdd={openCreateGroup}
                addLabel="Yangi mahsulot qo'shish"
              >
                {filteredGroups.length === 0 ? (
                  <EmptyState onAdd={openCreateGroup} label="Mahsulot qo'shish" />
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {filteredGroups.map((group) => (
                      <GroupCard
                        key={group.id}
                        item={group}
                        branchName={branchMap.get(group.branchId)?.name ?? "Do'kon topilmadi"}
                        onEdit={() => openEditGroup(group)}
                        onDelete={() =>
                          setDeleteTarget({ kind: 'groups', id: group.id, title: firstLine(group.details, 'Mahsulot') })
                        }
                      />
                    ))}
                  </div>
                )}
              </SectionShell>
            )}
          </>
        )}
      </div>

      {modalKind === 'groups' && (
        <ModalShell title={editingId ? 'Tahrirlash' : 'Yangi mahsulot qo\'shish'} onClose={closeModal}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              groupSaveMutation.mutate();
            }}
            className="space-y-4"
          >
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Do'kon *" className="md:col-span-2">
                  <select
                    required
                    value={groupForm.branchId}
                    onChange={(event) => setGroupForm({ ...groupForm, branchId: event.target.value })}
                    className={selectClass}
                  >
                    <option value="">Do'kon tanlang</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Instagram video linki" className="md:col-span-2">
                  <input
                    type="url"
                    value={groupForm.videoUrl}
                    onChange={(event) => setGroupForm({ ...groupForm, videoUrl: event.target.value })}
                    className={inputClass}
                    placeholder="https://www.instagram.com/reel/..."
                  />
                </Field>
                <Field label="Mahsulot ma'lumoti *" className="md:col-span-2">
                  <textarea
                    required
                    rows={8}
                    value={groupForm.details}
                    onChange={(event) => setGroupForm({ ...groupForm, details: event.target.value })}
                    className={inputClass}
                    placeholder={"Videoda ko'rsatilgan mahsulotlar haqida erkin matn — masalan:\nRangi qora yoki kulrang.\nPidjak narxi 450 000 so'm\nKo'ylak narxi 190 000 so'm\nShim narxi 180 000 so'm"}
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
        </ModalShell>
      )}

      {importOpen && (
        <ModalShell title="JSON orqali to'ldirish" onClose={closeImport} maxWidth="max-w-3xl">
          <div className="space-y-4">
            <p className="text-sm leading-6 text-slate-600 dark:text-tg-textMuted">
              Do&apos;kon va mahsulotlarni bittada qo&apos;shish uchun JSON yopishtiring va
              &quot;Yuklash&quot;ni bosing. Mavjud do&apos;kon nomi bilan mos kelsa — yangilanadi,
              aks holda yangi yozuv sifatida qo&apos;shiladi. Keyin har birini alohida
              tahrirlashingiz mumkin.
            </p>

            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700 dark:text-tg-text">JSON</label>
              <button
                type="button"
                onClick={insertImportTemplate}
                className="text-xs font-medium text-sky-600 hover:underline dark:text-sky-400"
              >
                Namunani joylashtirish
              </button>
            </div>
            <textarea
              value={importText}
              onChange={(event) => setImportText(event.target.value)}
              rows={16}
              spellCheck={false}
              placeholder="Bu yerga JSON yopishtiring..."
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 font-mono text-xs text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-tg-hover dark:bg-tg-panel dark:text-tg-text dark:placeholder:text-slate-500 dark:focus:border-slate-500 dark:focus:ring-slate-800"
            />

            {importParseError && (
              <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                {importParseError}
              </p>
            )}

            {importMutation.isError && (
              <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                {getErrorMessage(importMutation.error)}
              </p>
            )}

            {importMutation.isSuccess && importMutation.data && (
              <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                <p className="font-medium">Tayyor!</p>
                <p>
                  Do&apos;konlar: {importMutation.data.branches.created} yangi,{' '}
                  {importMutation.data.branches.updated} yangilandi
                </p>
                <p>
                  Mahsulotlar: {importMutation.data.groups.created} yangi,{' '}
                  {importMutation.data.groups.updated} yangilandi
                  {importMutation.data.groups.skipped.length > 0 &&
                    `, ${importMutation.data.groups.skipped.length} o'tkazib yuborildi`}
                </p>
                {importMutation.data.groups.skipped.length > 0 && (
                  <div className="mt-2 rounded-lg bg-white/60 p-3 text-xs text-emerald-900 dark:bg-black/20 dark:text-emerald-200">
                    <p className="font-medium">O&apos;tkazib yuborilganlar (do&apos;kon nomi mos kelmadi):</p>
                    <ul className="mt-1 list-inside list-disc space-y-0.5">
                      {importMutation.data.groups.skipped.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                onClick={closeImport}
                className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-tg-hover dark:bg-tg-panel dark:text-tg-text dark:hover:border-tg-hover"
              >
                Yopish
              </button>
              <button
                type="button"
                onClick={handleImportSubmit}
                disabled={importMutation.isPending || importText.trim().length === 0}
                className="rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
              >
                {importMutation.isPending ? 'Yuklanmoqda...' : 'Yuklash'}
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {deleteTarget && (
        <ModalShell title="O'chirishni tasdiqlash" onClose={() => setDeleteTarget(null)} maxWidth="max-w-lg">
          <p className="text-sm leading-6 text-slate-600 dark:text-tg-textMuted">
            Ushbu yozuvni o&apos;chirmoqchimisiz? Bu amalni qaytarib bo&apos;lmaydi.
          </p>
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-tg-border dark:bg-tg-panelAlt">
            <p className="text-sm font-medium text-slate-900 dark:text-tg-text">{deleteTarget.title}</p>
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
              className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-tg-hover dark:bg-tg-panel dark:text-tg-text dark:hover:border-tg-hover"
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
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-tg-border dark:bg-tg-panel">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-tg-text">{title}</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-tg-textMuted">{subtitle}</p>
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
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center dark:border-tg-hover dark:bg-tg-panelAlt">
      <p className="text-sm text-slate-600 dark:text-tg-textMuted">Hozircha yozuv yo&apos;q.</p>
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
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-tg-text">{label}</label>
      {children}
    </div>
  );
}

function StatusRow({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <label className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-tg-border dark:bg-tg-panelAlt dark:text-tg-text">
      <span>Holati</span>
      <button
        type="button"
        onClick={onToggle}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${active ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-tg-hover'}`}
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
  success,
  onCancel,
}: {
  pending: boolean;
  error: string | null;
  success?: string | null;
  onCancel?: () => void;
}) {
  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
      {error ? (
        <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300 sm:mr-auto">
          {error}
        </p>
      ) : (
        success && (
          <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300 sm:mr-auto">
            {success}
          </p>
        )
      )}
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-tg-hover dark:bg-tg-panel dark:text-tg-text dark:hover:border-tg-hover"
        >
          Bekor qilish
        </button>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
      >
        {pending ? 'Saqlanmoqda...' : 'Saqlash'}
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
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/45 px-4 py-6 backdrop-blur-sm sm:items-center">
      <div
        className={`flex max-h-[calc(100vh-3rem)] w-full ${maxWidth} flex-col rounded-2xl border border-slate-200 bg-white shadow-lg dark:border-tg-border dark:bg-tg-panel`}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-tg-border">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-tg-text">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-tg-panelAlt dark:hover:text-tg-text"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
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
    <article className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-tg-border dark:bg-tg-panel">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="line-clamp-1 text-lg font-semibold text-slate-900 dark:text-tg-text">
            {firstLine(item.details, 'Mahsulot')}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-tg-textMuted">{item.isActive ? 'Faol' : 'Faol emas'}</p>
        </div>
        <span className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 dark:border-tg-hover dark:text-tg-textMuted">
          Mahsulot
        </span>
      </div>

      <div className="mt-4 space-y-2 text-sm text-slate-700 dark:text-tg-textMuted">
        <p>
          <span className="font-medium text-slate-500 dark:text-tg-textFaint">Do&apos;kon:</span> {branchName}
        </p>
        {item.videoUrl && (
          <a
            href={item.videoUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 break-all text-sky-600 hover:underline dark:text-sky-400"
          >
            <Video size={16} className="shrink-0" />
            <span>Instagram videoni ko&apos;rish</span>
          </a>
        )}
      </div>

      <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700 dark:bg-tg-panelAlt dark:text-tg-textMuted">
        <p className="font-medium text-slate-500 dark:text-tg-textFaint">Ma&apos;lumot</p>
        <p className="mt-1 whitespace-pre-wrap">{item.details}</p>
      </div>

      <div className="mt-4 text-xs text-slate-500 dark:text-tg-textMuted">
        <p>Yangilangan: {formatDateTime(item.updatedAt)}</p>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 dark:border-tg-hover dark:bg-tg-panel dark:text-tg-text"
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
