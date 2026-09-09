'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { useLocale } from '@/components/LocaleProvider';
import { getErrorMessage, superAdminApi } from '@/lib/api';

interface Category {
  id: string;
  name: string;
  basePrompt: string;
  organizationCount: number;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl border border-gray-300 bg-white p-4 shadow-lg sm:p-5 dark:border-tg-border dark:bg-tg-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-tg-textMuted">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-500 transition hover:bg-gray-100 dark:text-tg-textMuted dark:hover:bg-tg-panelAlt"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CategoryForm({ category, onClose }: { category: Category | null; onClose: () => void }) {
  const { t } = useLocale();
  const queryClient = useQueryClient();
  const [name, setName] = useState(category?.name ?? '');
  const [basePrompt, setBasePrompt] = useState(category?.basePrompt ?? '');

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (category) {
        const { data } = await superAdminApi.put(`/categories/${category.id}`, { name, basePrompt });
        return data;
      }
      const { data } = await superAdminApi.post('/categories', { name, basePrompt });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'categories'] });
      onClose();
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    saveMutation.mutate();
  };

  return (
    <Modal title={category ? t('superAdmin.editCategory') : t('superAdmin.createCategory')} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium dark:text-tg-text">{t('superAdmin.categoryName')}</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('superAdmin.categoryNamePlaceholder')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-tg-hover dark:bg-tg-panelAlt dark:text-tg-text dark:focus:ring-brand-500/20"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium dark:text-tg-text">{t('superAdmin.categoryBasePrompt')}</label>
          <textarea
            required
            rows={12}
            value={basePrompt}
            onChange={(e) => setBasePrompt(e.target.value)}
            placeholder={t('superAdmin.categoryBasePromptPlaceholder')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-tg-hover dark:bg-tg-panelAlt dark:text-tg-text dark:focus:ring-brand-500/20"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-tg-textFaint">{t('superAdmin.categoryBasePromptHint')}</p>
        </div>

        {saveMutation.isError && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
            {getErrorMessage(saveMutation.error)}
          </p>
        )}

        <button
          type="submit"
          disabled={saveMutation.isPending}
          className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {saveMutation.isPending ? t('common.saving') : t('common.save')}
        </button>
      </form>
    </Modal>
  );
}

export default function SuperAdminCategoriesPage() {
  const { t } = useLocale();
  const queryClient = useQueryClient();
  const [modalCategory, setModalCategory] = useState<Category | null | undefined>(undefined);

  const categoriesQuery = useQuery({
    queryKey: ['super-admin', 'categories'],
    queryFn: async () => {
      const { data } = await superAdminApi.get<{ categories: Category[] }>('/categories');
      return data.categories;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await superAdminApi.delete(`/categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'categories'] });
    },
  });

  const handleDelete = (category: Category) => {
    if (window.confirm(`${category.name}\n\n${t('superAdmin.deleteCategoryConfirm')}`)) {
      deleteMutation.mutate(category.id);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold dark:text-tg-text">{t('superAdmin.categoriesTitle')}</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-tg-textMuted">{t('superAdmin.categoriesSubtitle')}</p>
          </div>
          <button
            type="button"
            onClick={() => setModalCategory(null)}
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
          >
            <Plus size={16} />
            {t('superAdmin.createCategory')}
          </button>
        </div>

        {categoriesQuery.isLoading ? (
          <p className="text-sm text-gray-500 dark:text-tg-textFaint">{t('common.loading')}</p>
        ) : !categoriesQuery.data?.length ? (
          <p className="text-sm text-gray-500 dark:text-tg-textFaint">{t('superAdmin.categoriesEmpty')}</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {categoriesQuery.data.map((category) => (
              <div
                key={category.id}
                className="rounded-xl border border-gray-300 bg-white p-4 shadow-sm dark:border-tg-border dark:bg-tg-panel"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium dark:text-tg-text">{category.name}</p>
                    <p className="text-xs text-gray-500 dark:text-tg-textFaint">
                      {category.organizationCount} {t('superAdmin.categoryUsageCount')}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setModalCategory(category)}
                      className="rounded-lg border border-gray-300 p-1.5 text-gray-600 transition hover:bg-gray-100 dark:border-tg-hover dark:text-tg-textMuted dark:hover:bg-tg-panelAlt"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(category)}
                      className="rounded-lg border border-gray-300 p-1.5 text-red-600 transition hover:bg-red-50 dark:border-tg-hover dark:text-red-400 dark:hover:bg-red-500/10"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <p className="mt-2 line-clamp-3 text-xs text-gray-600 dark:text-tg-textMuted">{category.basePrompt}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalCategory !== undefined && (
        <CategoryForm category={modalCategory} onClose={() => setModalCategory(undefined)} />
      )}
    </div>
  );
}
