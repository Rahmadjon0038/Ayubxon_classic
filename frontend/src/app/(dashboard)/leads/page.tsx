'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  CircleDashed,
  Loader2,
  MessageCircleMore,
  Phone,
  Search,
  Sparkles,
  Users,
  XCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Avatar from '@/components/Avatar';
import { useLocale } from '@/components/LocaleProvider';
import { api, getErrorMessage } from '@/lib/api';
import { contactDisplayName, formatRelativeTime } from '@/lib/format';
import { getSocket } from '@/lib/socket';
import { useInstagramAccount } from '@/lib/useInstagramAccount';
import { ConversationListItem } from '@/lib/types';

type BoardBucketId = 'new' | 'solved' | 'pending' | 'rejected';

const bucketConfig: Record<
  BoardBucketId,
  {
    titleKey: string;
    badgeClass: string;
    titleClass: string;
    accentClass: string;
  }
> = {
  new: {
    titleKey: 'leads.columnNew',
    badgeClass: 'bg-gray-100 text-gray-700 dark:bg-tg-panelAlt dark:text-tg-textMuted',
    titleClass: 'text-brand-600 dark:text-brand-400',
    accentClass: 'bg-brand-500',
  },
  solved: {
    titleKey: 'leads.columnInterested',
    badgeClass: 'bg-gray-100 text-gray-700 dark:bg-tg-panelAlt dark:text-tg-textMuted',
    titleClass: 'text-emerald-600 dark:text-emerald-400',
    accentClass: 'bg-emerald-500',
  },
  pending: {
    titleKey: 'leads.columnNotInterested',
    badgeClass: 'bg-gray-100 text-gray-700 dark:bg-tg-panelAlt dark:text-tg-textMuted',
    titleClass: 'text-amber-600 dark:text-amber-400',
    accentClass: 'bg-amber-500',
  },
  rejected: {
    titleKey: 'leads.columnRejected',
    badgeClass: 'bg-gray-100 text-gray-700 dark:bg-tg-panelAlt dark:text-tg-textMuted',
    titleClass: 'text-rose-600 dark:text-rose-400',
    accentClass: 'bg-rose-500',
  },
};

function lastMessagePreview(item: ConversationListItem, t: (key: string) => string): string {
  const msg = item.lastMessage;
  if (!msg) return t('leads.noMessageYet');
  if (msg.text) return msg.text;
  if (msg.attachmentType === 'image') return t('leads.imageLabel');
  if (msg.attachmentType === 'video') return t('leads.videoLabel');
  if (msg.attachmentType === 'audio') return t('leads.audioLabel');
  if (msg.attachmentType === 'template') return t('leads.templateLabel');
  if (msg.attachmentType) return t('leads.fileLabel');
  return t('leads.messageLabel');
}

function classifyConversation(item: ConversationListItem): BoardBucketId {
  if (item.status === 'CLOSED' || item.courseDecision === 'WILL_NOT_WRITE') return 'rejected';
  if (item.talkStatus === 'TALKED') return 'solved';
  if (item.leadTemperature === 'HOT' || item.unreadCount > 0) return 'new';
  return 'pending';
}

function sortByLatest(a: ConversationListItem, b: ConversationListItem): number {
  const at = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
  const bt = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
  return bt - at;
}

export default function LeadsPage() {
  const router = useRouter();
  const { t } = useLocale();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const accountQuery = useInstagramAccount();
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
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<Pick<ConversationListItem, 'leadTemperature' | 'talkStatus' | 'courseDecision' | 'status'>>;
    }) => {
      const { data } = await api.patch<{ conversation: ConversationListItem }>(
        `/conversations/${id}/status`,
        patch,
      );
      return data.conversation;
    },
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: ['conversations'] });
      const previous = queryClient.getQueryData<ConversationListItem[]>(['conversations', accountKey]);
      queryClient.setQueryData<ConversationListItem[]>(['conversations', accountKey], (old) =>
        old?.map((item) => (item.id === id ? { ...item, ...patch } : item)),
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

  const visibleConversations = useMemo(() => {
    const items = conversationsQuery.data ?? [];
    const q = search.trim().toLowerCase();

    return items
      .filter((item) => {
        if (!q) return true;

        const haystack = [
          contactDisplayName(item.contact),
          item.contact.username ?? '',
          item.contact.name ?? '',
          item.contact.phoneNumber ?? '',
          item.lastMessage?.text ?? '',
          item.lastMessage?.attachmentType ?? '',
          item.leadTemperature,
          item.talkStatus,
          item.courseDecision,
          item.status,
        ]
          .join(' ')
          .toLowerCase();

        return haystack.includes(q);
      })
      .sort(sortByLatest);
  }, [conversationsQuery.data, search]);

  const buckets = useMemo(() => {
    const next: Record<BoardBucketId, ConversationListItem[]> = {
      new: [],
      solved: [],
      pending: [],
      rejected: [],
    };

    for (const item of visibleConversations) {
      next[classifyConversation(item)].push(item);
    }

    for (const list of Object.values(next)) {
      list.sort(sortByLatest);
    }

    return next;
  }, [visibleConversations]);

  const stats = useMemo(
    () => ({
      total: visibleConversations.length,
      newCount: buckets.new.length,
      solvedCount: buckets.solved.length,
      pendingCount: buckets.pending.length,
      rejectedCount: buckets.rejected.length,
    }),
    [buckets, visibleConversations.length],
  );

  const handleDrop = (conversationId: string, bucketId: BoardBucketId) => {
    const patchByBucket: Record<BoardBucketId, Partial<Pick<ConversationListItem, 'leadTemperature' | 'talkStatus' | 'courseDecision' | 'status'>>> = {
      new: {
        status: 'OPEN',
        leadTemperature: 'HOT',
        talkStatus: 'NOT_TALKED',
        courseDecision: 'WILL_WRITE',
      },
      solved: {
        status: 'OPEN',
        leadTemperature: 'WARM',
        talkStatus: 'TALKED',
        courseDecision: 'WILL_WRITE',
      },
      pending: {
        status: 'OPEN',
        leadTemperature: 'COLD',
        talkStatus: 'NOT_TALKED',
        courseDecision: 'WILL_WRITE',
      },
      rejected: {
        status: 'CLOSED',
        leadTemperature: 'COLD',
        talkStatus: 'NOT_TALKED',
        courseDecision: 'WILL_NOT_WRITE',
      },
    };

    updateMutation.mutate({ id: conversationId, patch: patchByBucket[bucketId] });
    setDraggedId(null);
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-50 p-2.5 dark:bg-tg-bg">
      <div className="w-full space-y-2.5">
        <div className="flex flex-col gap-2 rounded-lg border border-gray-300 bg-white p-2 shadow-sm md:flex-row md:items-center md:justify-between dark:border-tg-border dark:bg-tg-panel">
          <label className="relative block flex-1 md:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 dark:text-tg-textFaint" size={14} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('leads.searchPlaceholder')}
              className="w-full rounded-md border border-gray-300 bg-white py-1.5 pl-8 pr-3 text-xs outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-tg-hover dark:bg-tg-panel dark:text-tg-text dark:placeholder:text-gray-600"
            />
          </label>

          <div className="flex flex-wrap items-center gap-1.5">
            <StatChip label={t('leads.statTotal')} value={stats.total} icon={<Users size={12} />} />
            <StatChip label={t('leads.statNew')} value={stats.newCount} icon={<Sparkles size={12} />} accent="text-brand-600 dark:text-brand-400" />
            <StatChip label={t('leads.statInterested')} value={stats.solvedCount} icon={<CheckCircle2 size={12} />} accent="text-emerald-600 dark:text-emerald-400" />
            <StatChip label={t('leads.statNotInterested')} value={stats.pendingCount} icon={<CircleDashed size={12} />} accent="text-amber-600 dark:text-amber-400" />
            <StatChip label={t('leads.statRejected')} value={stats.rejectedCount} icon={<XCircle size={12} />} accent="text-rose-600 dark:text-rose-400" />
          </div>
        </div>

        {conversationsQuery.isError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
            {getErrorMessage(conversationsQuery.error)}
          </div>
        )}

        <section className="pb-1">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {(['new', 'solved', 'pending', 'rejected'] as BoardBucketId[]).map((bucketId) => {
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
                  className="flex min-h-[220px] flex-col rounded-lg border border-gray-300 bg-white p-1.5 shadow-sm sm:min-h-[420px] xl:min-h-[560px] dark:border-tg-border dark:bg-tg-panel"
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
                      <div className="flex flex-1 items-center justify-center rounded-md border border-dashed border-gray-300 px-3 py-6 text-center text-xs text-gray-500 dark:border-tg-hover dark:text-tg-textFaint">
                        <MessageCircleMore size={15} className="mr-1.5" />
                        {t('leads.empty')}
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
                          onClick={() => router.push(`/leads/${conversation.id}`)}
                          className={`cursor-pointer rounded-md border border-gray-300 bg-white p-2 transition hover:border-gray-400 hover:shadow-sm dark:border-tg-border dark:bg-tg-panel dark:hover:border-tg-hover ${dragClass}`}
                        >
                          <div className="flex items-start gap-2">
                            <Avatar src={conversation.contact.profilePictureUrl} name={name} size={34} enlargeOnClick />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-1.5">
                                <div className="min-w-0">
                                  <p className="truncate text-[13px] font-semibold text-gray-900 dark:text-tg-text">{name}</p>
                                  {conversation.contact.username && (
                                    <p className="truncate text-[11px] text-gray-600 dark:text-tg-textMuted">
                                      @{conversation.contact.username}
                                    </p>
                                  )}
                                </div>

                                {conversation.unreadCount > 0 && (
                                  <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-semibold text-white">
                                    {conversation.unreadCount}
                                  </span>
                                )}
                              </div>

                              <p className="mt-1 max-h-8 overflow-hidden text-xs text-gray-600 dark:text-tg-textMuted">
                                {lastMessagePreview(conversation, t)}
                              </p>

                              {conversation.contact.phoneNumber && (
                                <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                                  <Phone size={11} className="shrink-0" />
                                  {conversation.contact.phoneNumber}
                                </p>
                              )}

                              <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-gray-500 dark:text-tg-textFaint">
                                <span>{formatRelativeTime(conversation.lastMessageAt)}</span>
                                <span className="flex items-center gap-1">
                                  {conversation.aiPaused && (
                                    <span className="rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 font-medium text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
                                      {t('leads.operatorBadge')}
                                    </span>
                                  )}
                                  <span className="rounded-full border border-gray-300 px-1.5 py-0.5 text-gray-600 dark:border-tg-hover dark:text-tg-textMuted">
                                    {conversation.status === 'OPEN' ? t('leads.statusOpen') : t('leads.statusClosed')}
                                  </span>
                                </span>
                              </div>
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
          <div className="flex min-h-[180px] items-center justify-center rounded-lg border border-gray-300 bg-white text-sm text-gray-500 shadow-sm dark:border-tg-border dark:bg-tg-panel dark:text-tg-textFaint">
            <Loader2 className="mr-2 animate-spin" size={16} />
            {t('common.loading')}
          </div>
        )}

        {!conversationsQuery.isLoading && visibleConversations.length === 0 && (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white px-6 py-10 text-center text-gray-600 shadow-sm dark:border-tg-border dark:bg-tg-panel dark:text-tg-textMuted">
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-tg-panelAlt dark:text-tg-textFaint">
              <MessageCircleMore size={18} />
            </div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-tg-text">{t('leads.noResultsTitle')}</h3>
            <p className="mt-1 text-xs text-gray-600 dark:text-tg-textMuted">{t('leads.noResultsBody')}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatChip({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-gray-300 bg-gray-50 px-2.5 py-1 text-xs dark:border-tg-hover dark:bg-tg-panelAlt">
      <span className={accent ?? 'text-gray-500 dark:text-tg-textFaint'}>{icon}</span>
      <span className="font-semibold text-gray-900 dark:text-tg-text">{value}</span>
      <span className="text-gray-600 dark:text-tg-textMuted">{label}</span>
    </div>
  );
}
