'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Loader2, Phone, PhoneCall, PhoneMissed, Search, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Avatar from '@/components/Avatar';
import { useLocale } from '@/components/LocaleProvider';
import { api, getErrorMessage } from '@/lib/api';
import { contactDisplayName, formatRelativeTime } from '@/lib/format';
import { getMonthNames } from '@/lib/i18n';
import { getSocket } from '@/lib/socket';
import { CallStatus, ConversationListItem, InstagramAccount } from '@/lib/types';

const bucketConfig: Record<
  CallStatus,
  { titleKey: string; badgeClass: string; titleClass: string; accentClass: string; Icon: typeof Sparkles }
> = {
  NEW: {
    titleKey: 'calls.columnNew',
    badgeClass: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    titleClass: 'text-brand-600 dark:text-brand-400',
    accentClass: 'bg-brand-500',
    Icon: Sparkles,
  },
  TALKED: {
    titleKey: 'calls.columnTalked',
    badgeClass: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    titleClass: 'text-emerald-600 dark:text-emerald-400',
    accentClass: 'bg-emerald-500',
    Icon: PhoneCall,
  },
  NOT_ANSWERED: {
    titleKey: 'calls.columnNotAnswered',
    badgeClass: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    titleClass: 'text-rose-600 dark:text-rose-400',
    accentClass: 'bg-rose-500',
    Icon: PhoneMissed,
  },
};

const CALL_BUCKETS: CallStatus[] = ['NEW', 'TALKED', 'NOT_ANSWERED'];

function sortByLatest(a: ConversationListItem, b: ConversationListItem): number {
  const at = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
  const bt = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
  return bt - at;
}

// "2026-08" korinishidagi kalit — oy filteri shu boyicha guruhlaydi.
function monthKey(dateString: string): string {
  const d = new Date(dateString);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function CallsPage() {
  const router = useRouter();
  const { t, locale } = useLocale();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState('all');
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const accountQuery = useQuery({
    queryKey: ['instagram-account'],
    queryFn: async () => {
      const { data } = await api.get<{ account: InstagramAccount | null }>('/instagram/account');
      return data.account;
    },
  });
  const accountKey = accountQuery.data?.id ?? 'none';

  const conversationsQuery = useQuery({
    queryKey: ['conversations', accountKey],
    queryFn: async () => {
      const { data } = await api.get<{ conversations: ConversationListItem[] }>('/conversations');
      return data.conversations;
    },
    refetchInterval: 30_000,
  });

  useEffect(() => {
    const socket = getSocket();
    const refresh = () => queryClient.invalidateQueries({ queryKey: ['conversations'] });
    socket.on('new_message', refresh);
    socket.on('message_updated', refresh);

    return () => {
      socket.off('new_message', refresh);
      socket.off('message_updated', refresh);
    };
  }, [queryClient]);

  const updateMutation = useMutation({
    mutationFn: async ({ id, callStatus }: { id: string; callStatus: CallStatus }) => {
      const { data } = await api.patch<{ conversation: ConversationListItem }>(`/conversations/${id}/status`, {
        callStatus,
      });
      return data.conversation;
    },
    onMutate: async ({ id, callStatus }) => {
      await queryClient.cancelQueries({ queryKey: ['conversations'] });
      const previous = queryClient.getQueryData<ConversationListItem[]>(['conversations', accountKey]);
      queryClient.setQueryData<ConversationListItem[]>(['conversations', accountKey], (old) =>
        old?.map((item) => (item.id === id ? { ...item, callStatus } : item)),
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['conversations', accountKey], context.previous);
      }
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<ConversationListItem[]>(['conversations', accountKey], (old) =>
        old?.map((item) => (item.id === updated.id ? updated : item)),
      );
    },
  });

  // Faqat qiziqish bildirib telefon raqam qoldirgan mijozlar shu bolimga tushadi.
  const withPhone = useMemo(
    () => (conversationsQuery.data ?? []).filter((item) => Boolean(item.contact.phoneNumber)),
    [conversationsQuery.data],
  );

  const monthOptions = useMemo(() => {
    const set = new Set(withPhone.map((item) => monthKey(item.createdAt)));
    return Array.from(set).sort().reverse();
  }, [withPhone]);

  const monthLabel = (key: string): string => {
    if (key === 'all') return t('calls.monthAll');
    const [year, monthNum] = key.split('-').map(Number);
    return `${getMonthNames(locale)[monthNum - 1]} ${year}`;
  };

  const visibleConversations = useMemo(() => {
    const q = search.trim().toLowerCase();

    return withPhone.filter((item) => {
      if (month !== 'all' && monthKey(item.createdAt) !== month) return false;
      if (!q) return true;

      const haystack = [
        contactDisplayName(item.contact),
        item.contact.username ?? '',
        item.contact.name ?? '',
        item.contact.phoneNumber ?? '',
        item.interestedCourse ?? '',
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [withPhone, search, month]);

  const buckets = useMemo(() => {
    const next: Record<CallStatus, ConversationListItem[]> = { NEW: [], TALKED: [], NOT_ANSWERED: [] };
    for (const item of visibleConversations) next[item.callStatus].push(item);
    for (const list of Object.values(next)) list.sort(sortByLatest);
    return next;
  }, [visibleConversations]);

  const handleDrop = (conversationId: string, bucketId: CallStatus) => {
    updateMutation.mutate({ id: conversationId, callStatus: bucketId });
    setDraggedId(null);
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-50 p-2.5 dark:bg-gray-950">
      <div className="w-full space-y-2.5">
        <div className="flex flex-col gap-2 rounded-lg border border-gray-300 bg-white p-2 shadow-sm md:flex-row md:items-center md:justify-between dark:border-gray-800 dark:bg-gray-900">
          <div className="flex flex-1 flex-col gap-2 sm:flex-row">
            <label className="relative block flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-500" size={14} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('calls.searchPlaceholder')}
                className="w-full rounded-md border border-gray-300 bg-white py-1.5 pl-8 pr-3 text-xs outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-600"
              />
            </label>

            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            >
              <option value="all">{t('calls.monthAll')}</option>
              {monthOptions.map((key) => (
                <option key={key} value={key}>
                  {monthLabel(key)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 rounded-full border border-gray-300 bg-gray-50 px-2.5 py-1 text-xs dark:border-gray-700 dark:bg-gray-800">
            <Phone size={12} className="text-gray-500 dark:text-gray-500" />
            <span className="font-semibold text-gray-900 dark:text-gray-100">{visibleConversations.length}</span>
            <span className="text-gray-600 dark:text-gray-400">{t('calls.statTotal')}</span>
          </div>
        </div>

        {conversationsQuery.isError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
            {getErrorMessage(conversationsQuery.error)}
          </div>
        )}

        <section className="pb-1">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {CALL_BUCKETS.map((bucketId) => {
              const config = bucketConfig[bucketId];
              const items = buckets[bucketId];

              return (
                <article
                  key={bucketId}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggedId) handleDrop(draggedId, bucketId);
                  }}
                  className="flex min-h-[220px] flex-col rounded-lg border border-gray-300 bg-white p-1.5 shadow-sm sm:min-h-[420px] xl:min-h-[560px] dark:border-gray-800 dark:bg-gray-900"
                >
                  <div className="mb-1.5 flex items-center justify-between gap-2 px-1 pt-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${config.accentClass}`} />
                      <h2 className={`text-xs font-semibold ${config.titleClass}`}>{t(config.titleKey)}</h2>
                    </div>
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${config.badgeClass}`}>
                      {items.length}
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col gap-1.5">
                    {items.length === 0 && (
                      <div className="flex flex-1 items-center justify-center rounded-md border border-dashed border-gray-300 px-3 py-6 text-center text-xs text-gray-500 dark:border-gray-700 dark:text-gray-500">
                        <config.Icon size={15} className="mr-1.5" />
                        {t('calls.empty')}
                      </div>
                    )}

                    {items.map((conversation) => {
                      const name = contactDisplayName(conversation.contact);
                      const dragClass = draggedId === conversation.id ? 'opacity-50' : '';

                      return (
                        <article
                          key={conversation.id}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', conversation.id);
                            e.dataTransfer.effectAllowed = 'move';
                            setDraggedId(conversation.id);
                          }}
                          onDragEnd={() => setDraggedId(null)}
                          onClick={() => router.push(`/calls/${conversation.id}`)}
                          className={`cursor-pointer rounded-md border border-gray-300 bg-white p-2 transition hover:border-gray-400 hover:shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700 ${dragClass}`}
                        >
                          <div className="flex items-start gap-2">
                            <Avatar src={conversation.contact.profilePictureUrl} name={name} size={34} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[13px] font-semibold text-gray-900 dark:text-gray-100">{name}</p>
                              {conversation.contact.username && (
                                <p className="truncate text-[11px] text-gray-600 dark:text-gray-400">
                                  @{conversation.contact.username}
                                </p>
                              )}

                              <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                                <Phone size={11} className="shrink-0" />
                                {conversation.contact.phoneNumber}
                              </p>

                              <p className="mt-1 flex items-center gap-1 text-[11px] text-gray-600 dark:text-gray-400">
                                <BookOpen size={11} className="shrink-0" />
                                <span className="truncate">
                                  {conversation.interestedCourse || t('calls.noCourse')}
                                </span>
                              </p>

                              <p className="mt-1.5 text-[10px] text-gray-500 dark:text-gray-500">
                                {formatRelativeTime(conversation.lastMessageAt)}
                              </p>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {conversationsQuery.isLoading && (
          <div className="flex min-h-[180px] items-center justify-center rounded-lg border border-gray-300 bg-white text-sm text-gray-500 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-500">
            <Loader2 className="mr-2 animate-spin" size={16} />
            {t('common.loading')}
          </div>
        )}

        {!conversationsQuery.isLoading && withPhone.length === 0 && (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white px-6 py-10 text-center text-gray-600 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500">
              <Phone size={18} />
            </div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('calls.noPhoneTitle')}</h3>
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{t('calls.noPhoneBody')}</p>
          </div>
        )}

        {!conversationsQuery.isLoading && withPhone.length > 0 && visibleConversations.length === 0 && (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white px-6 py-10 text-center text-gray-600 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('calls.noResultsTitle')}</h3>
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{t('calls.noResultsBody')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
