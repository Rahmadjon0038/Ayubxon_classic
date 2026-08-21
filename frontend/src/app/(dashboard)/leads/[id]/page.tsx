'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, MessageCircleMore } from 'lucide-react';
import ChatWindow from '@/components/ChatWindow';
import { useLocale } from '@/components/LocaleProvider';
import { api, getErrorMessage } from '@/lib/api';
import { useInstagramAccount } from '@/lib/useInstagramAccount';
import { ConversationListItem } from '@/lib/types';

export default function LeadDetailPage() {
  const router = useRouter();
  const { t } = useLocale();
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const conversationId = params.id;

  const accountQuery = useInstagramAccount();
  const accountKey = accountQuery.data?.id ?? 'none';

  const conversationQuery = useQuery({
    queryKey: ['conversation', accountKey, conversationId],
    queryFn: async () => {
      const { data } = await api.get<{ conversation: ConversationListItem }>(`/conversations/${conversationId}`);
      return data.conversation;
    },
    enabled: Boolean(conversationId),
  });

  const conversation = conversationQuery.data ?? null;

  // Lead ochilganda Inbox'dagidek "oqilgan" deb belgilanadi — royxatdagi 1 soni yoqoladi.
  useEffect(() => {
    if (!conversation || conversation.unreadCount === 0) return;
    api.post(`/conversations/${conversation.id}/read`).catch(() => {});
    queryClient.setQueryData<ConversationListItem>(['conversation', accountKey, conversationId], (old) =>
      old ? { ...old, unreadCount: 0 } : old,
    );
    queryClient.setQueryData<ConversationListItem[]>(['conversations', accountKey], (old) =>
      old?.map((c) => (c.id === conversation.id ? { ...c, unreadCount: 0 } : c)),
    );
  }, [accountKey, conversation, conversationId, queryClient]);

  return (
    <div className="h-full overflow-hidden bg-gray-50 p-2 dark:bg-tg-bg sm:p-3">
      <div className="h-full overflow-hidden md:rounded-2xl md:border md:border-gray-300 md:bg-white md:shadow-sm dark:md:border-tg-border/70 dark:md:bg-tg-panel/40">
        {conversationQuery.isLoading && (
          <div className="flex h-full items-center justify-center text-gray-500 dark:text-tg-textFaint">
            <Loader2 className="mr-2 animate-spin" size={18} />
            {t('common.loading')}
          </div>
        )}

        {conversationQuery.isError && (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-red-600 dark:text-red-400">
            {getErrorMessage(conversationQuery.error)}
          </div>
        )}

        {!conversationQuery.isLoading && !conversation && !conversationQuery.isError && (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-gray-600 dark:text-tg-textMuted">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-tg-panelAlt dark:text-tg-textFaint">
              <MessageCircleMore size={22} />
            </div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-tg-text">{t('leadDetail.notFoundTitle')}</h2>
            <p className="text-sm text-gray-600 dark:text-tg-textMuted">{t('leadDetail.notFoundBody')}</p>
            <Link href="/leads" className="text-sm font-medium text-brand-600 dark:text-brand-400">
              {t('leadDetail.backToLeads')}
            </Link>
          </div>
        )}

        {conversation && (
          <ChatWindow
            conversation={conversation}
            backHref="/leads"
            onDeleted={() => {
              queryClient.invalidateQueries({ queryKey: ['conversations'] });
              queryClient.removeQueries({ queryKey: ['conversation', accountKey, conversationId] });
              queryClient.removeQueries({ queryKey: ['messages', conversationId] });
              queryClient.removeQueries({ queryKey: ['messages'] });
              router.push('/leads');
            }}
          />
        )}
      </div>
    </div>
  );
}
