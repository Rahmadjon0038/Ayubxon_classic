'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, EyeOff, Plus, Search, PencilLine, Trash2, X } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { api, getErrorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { KnowledgeBaseCategory, KnowledgeBaseItem } from '@/lib/types';

type FilterKey = 'ALL' | KnowledgeBaseCategory;

interface KnowledgeBaseListResponse {
  items: KnowledgeBaseItem[];
}

interface SettingsResponse {
  aiEnabled: boolean;
}

interface KnowledgeFormState {
  title: string;
  category: KnowledgeBaseCategory;
  course: string;
  branch: string;
  details: string;
  isActive: boolean;
}

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'ALL', label: 'Barchasi' },
  { key: 'COURSE', label: 'Kurslar' },
  { key: 'GROUP', label: 'Guruhlar' },
  { key: 'PROMOTION', label: 'Aksiyalar' },
  { key: 'PRICE', label: 'Narxlar' },
  { key: 'BRANCH', label: 'Filiallar' },
  { key: 'OTHER', label: 'Boshqa' },
];

const CATEGORY_LABELS: Record<KnowledgeBaseCategory, string> = {
  COURSE: 'Kurs',
  GROUP: 'Guruh',
  PROMOTION: 'Aksiya',
  PRICE: 'Narx',
  BRANCH: 'Filial',
  OTHER: 'Boshqa',
};

const CATEGORY_BADGE_CLASSES: Record<KnowledgeBaseCategory, string> = {
  COURSE: 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/20',
  GROUP: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20',
  PROMOTION:
    'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20',
  PRICE: 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/20',
  BRANCH: 'bg-cyan-50 text-cyan-700 ring-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-300 dark:ring-cyan-500/20',
  OTHER: 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-700/40 dark:text-slate-200 dark:ring-slate-600',
};

const emptyForm: KnowledgeFormState = {
  title: '',
  category: 'COURSE',
  course: '',
  branch: '',
  details: '',
  isActive: true,
};

function getCategoryLabel(category: KnowledgeBaseCategory): string {
  return CATEGORY_LABELS[category] ?? category;
}

function getCategoryBadgeClasses(category: KnowledgeBaseCategory): string {
  return CATEGORY_BADGE_CLASSES[category] ?? CATEGORY_BADGE_CLASSES.OTHER;
}

export default function AiAssistantPage() {
  const queryClient = useQueryClient();
  const [selectedFilter, setSelectedFilter] = useState<FilterKey>('ALL');
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<KnowledgeBaseItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeBaseItem | null>(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiHydrated, setAiHydrated] = useState(false);
  const [form, setForm] = useState<KnowledgeFormState>(emptyForm);

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

  const knowledgeQuery = useQuery({
    queryKey: ['knowledge-base'],
    queryFn: async () => {
      const { data } = await api.get<KnowledgeBaseListResponse>('/knowledge-base');
      return data.items;
    },
  });

  const openCreateModal = () => {
    setEditingItem(null);
    setForm(emptyForm);
    setIsModalOpen(true);
  };

  const openEditModal = (item: KnowledgeBaseItem) => {
    setEditingItem(item);
    setForm({
      title: item.title,
      category: item.category,
      course: item.course ?? '',
      branch: item.branch ?? '',
      details: item.details,
      isActive: item.isActive,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
    setForm(emptyForm);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title.trim(),
        category: form.category,
        course: form.course.trim(),
        branch: form.branch.trim(),
        details: form.details.trim(),
        isActive: form.isActive,
      };

      if (editingItem) {
        const { data } = await api.put<{ item: KnowledgeBaseItem }>(`/knowledge-base/${editingItem.id}`, payload);
        return data.item;
      }

      const { data } = await api.post<{ item: KnowledgeBaseItem }>('/knowledge-base', payload);
      return data.item;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['knowledge-base'] });
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/knowledge-base/${id}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['knowledge-base'] });
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

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    saveMutation.mutate();
  };

  const items = knowledgeQuery.data ?? [];
  const searchValue = search.trim().toLowerCase();
  const filteredItems = items.filter((item) => {
    const matchesFilter = selectedFilter === 'ALL' || item.category === selectedFilter;
    const haystack = [item.title, item.details, item.course ?? '', item.branch ?? ''].join(' ').toLowerCase();
    const matchesSearch = !searchValue || haystack.includes(searchValue);
    return matchesFilter && matchesSearch;
  });

  const inputClass =
    'w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50 dark:placeholder:text-slate-500 dark:focus:border-slate-500 dark:focus:ring-slate-800';
  const selectClass =
    'w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50 dark:focus:border-slate-500 dark:focus:ring-slate-800';

  return (
    <div className="relative min-h-full overflow-y-auto bg-slate-50 p-4 sm:p-6 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-col gap-5 p-5 sm:p-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-600 dark:text-sky-400">
                AI Assistant
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl dark:text-slate-50">
                Bilimlar bazasi
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                AI Assistant uchun ma&apos;lumotlarni boshqaring. Har bir bilim alohida card sifatida saqlanadi.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleToggle}
                disabled={toggleMutation.isPending || settingsQuery.isLoading}
                className={`inline-flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  aiEnabled
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
                    : 'border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                }`}
              >
                {aiEnabled ? <Check size={16} /> : <EyeOff size={16} />}
                {aiEnabled ? 'AI yoqilgan' : 'AI o\'chirilgan'}
              </button>

              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
              >
                <Plus size={16} />
                Yangi bilim qo&apos;shish
              </button>
            </div>
          </div>

          {settingsQuery.isError && (
            <div className="border-t border-slate-200 px-5 py-3 text-sm text-rose-600 dark:border-slate-800 dark:text-rose-400">
              {getErrorMessage(settingsQuery.error)}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((filter) => {
                const active = selectedFilter === filter.key;
                return (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() => setSelectedFilter(filter.key)}
                    className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                      active
                        ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                        : 'border-slate-300 bg-slate-50 text-slate-600 hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-slate-100'
                    }`}
                  >
                    {filter.label}
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
                placeholder="Nomi yoki ma&apos;lumoti bo&apos;yicha qidirish..."
                className={`${inputClass} pl-10`}
              />
            </div>
          </div>
        </div>

        {knowledgeQuery.isLoading && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
            Yuklanmoqda...
          </div>
        )}

        {knowledgeQuery.isError && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
            {getErrorMessage(knowledgeQuery.error)}
          </div>
        )}

        {!knowledgeQuery.isLoading && !knowledgeQuery.isError && (
          <>
            {filteredItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm dark:border-slate-700 dark:bg-slate-950">
                <p className="text-base font-medium text-slate-900 dark:text-slate-50">Natija topilmadi</p>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                  Filtr yoki qidiruv bo&apos;yicha mos bilim yo&apos;q. Yangi bilim qo&apos;shib ko&apos;ring.
                </p>
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="mt-5 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                >
                  <Plus size={16} />
                  Yangi bilim qo&apos;shish
                </button>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {filteredItems.map((item) => {
                  const statusClasses = item.isActive
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300'
                    : 'border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400';

                  return (
                    <article
                      key={item.id}
                      className={`flex h-full flex-col rounded-2xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:bg-slate-950 ${
                      item.isActive ? 'border-slate-200 dark:border-slate-800' : 'border-slate-300/70 opacity-90 dark:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${getCategoryBadgeClasses(
                            item.category,
                          )}`}
                        >
                          {getCategoryLabel(item.category)}
                        </span>
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses}`}
                        >
                          {item.isActive ? 'Faol' : 'Faol emas'}
                        </span>
                      </div>

                      <h2 className="mt-4 text-lg font-semibold leading-7 text-slate-900 dark:text-slate-50">
                        {item.title}
                      </h2>

                      <p className="mt-3 max-h-32 overflow-hidden text-sm leading-6 text-slate-600 dark:text-slate-400">
                        {item.details}
                      </p>

                      <div className="mt-4 space-y-2 text-sm">
                        {item.course && (
                          <div className="rounded-lg bg-slate-50 px-3 py-2 text-slate-700 dark:bg-slate-900 dark:text-slate-300">
                            <span className="font-medium text-slate-500 dark:text-slate-500">Tegishli kurs:</span> {item.course}
                          </div>
                        )}
                        {item.branch && (
                          <div className="rounded-lg bg-slate-50 px-3 py-2 text-slate-700 dark:bg-slate-900 dark:text-slate-300">
                            <span className="font-medium text-slate-500 dark:text-slate-500">Filial:</span> {item.branch}
                          </div>
                        )}
                      </div>

                      <div className="mt-4 grid gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                        <div>Yaratilgan: {formatDateTime(item.createdAt)}</div>
                        <div>Yangilangan: {formatDateTime(item.updatedAt)}</div>
                      </div>

                      <div className="mt-4 flex gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(item)}
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-600"
                        >
                          <PencilLine size={16} />
                          Tahrirlash
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(item)}
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm font-medium text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300"
                        >
                          <Trash2 size={16} />
                          O&apos;chirish
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                  {editingItem ? 'Bilimni tahrirlash' : 'Yangi bilim qo&apos;shish'}
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  AI bilishi kerak bo&apos;lgan ma&apos;lumotni card ko&apos;rinishida kiriting.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-900 dark:hover:text-slate-100"
                aria-label="Yopish"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Nomi *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={200}
                    value={form.title}
                    onChange={(event) => setForm({ ...form, title: event.target.value })}
                    placeholder="Masalan: Arab tili — Chorsu yangi guruh"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Kategoriya *
                  </label>
                  <select
                    value={form.category}
                    onChange={(event) =>
                      setForm({ ...form, category: event.target.value as KnowledgeBaseCategory })
                    }
                    className={selectClass}
                  >
                    {FILTERS.filter((filter) => filter.key !== 'ALL').map((filter) => (
                      <option key={filter.key} value={filter.key}>
                        {filter.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Tegishli kurs
                  </label>
                  <input
                    type="text"
                    maxLength={200}
                    value={form.course}
                    onChange={(event) => setForm({ ...form, course: event.target.value })}
                    placeholder="Masalan: Arab tili"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Tegishli filial
                  </label>
                  <input
                    type="text"
                    maxLength={200}
                    value={form.branch}
                    onChange={(event) => setForm({ ...form, branch: event.target.value })}
                    placeholder="Masalan: Chorsu"
                    className={inputClass}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Batafsil ma&apos;lumot *
                  </label>
                  <textarea
                    required
                    rows={7}
                    maxLength={8000}
                    value={form.details}
                    onChange={(event) => setForm({ ...form, details: event.target.value })}
                    placeholder="Chorsu filialida Arab tilidan yangi guruh ochildi. Darslar Dushanba, Chorshanba va Juma kunlari soat 18:00 da."
                    className={inputClass}
                  />
                </div>
              </div>

              <label className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                <span>Holati</span>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, isActive: !form.isActive })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                    form.isActive ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                      form.isActive ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </label>

              {(saveMutation.isError || saveMutation.isPending) && (
                <div
                  className={`rounded-lg px-4 py-3 text-sm ${
                    saveMutation.isError
                      ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-400'
                  }`}
                >
                  {saveMutation.isError ? getErrorMessage(saveMutation.error) : 'Saqlanmoqda...'}
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-600"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                >
                  Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-lg dark:border-slate-800 dark:bg-slate-950">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Bilimni o&apos;chirish</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
              Ushbu bilimni o&apos;chirmoqchimisiz? Bu amalni qaytarib bo&apos;lmaydi.
            </p>

            <div className="mt-5 rounded-lg bg-slate-50 p-4 dark:bg-slate-900">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-50">{deleteTarget.title}</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{deleteTarget.details}</p>
            </div>

            {deleteMutation.isError && (
              <div className="mt-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                {getErrorMessage(deleteMutation.error)}
              </div>
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
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
                disabled={deleteMutation.isPending}
                className="rounded-lg bg-rose-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                O&apos;chirish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
