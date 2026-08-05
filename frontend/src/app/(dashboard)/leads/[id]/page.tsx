'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, MessageCircleMore } from 'lucide-react';
import ChatWindow from '@/components/ChatWindow';
import { api, getErrorMessage } from '@/lib/api';
import { formatRelativeTime } from '@/lib/format';
import { ConversationListItem } from '@/lib/types';

export default function LeadDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const conversationId = params.id;

  const conversationQuery = useQuery({
    queryKey: ['conversation', conversationId],
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
    queryClient.setQueryData<ConversationListItem>(['conversation', conversationId], (old) =>
      old ? { ...old, unreadCount: 0 } : old,
    );
    queryClient.setQueryData<ConversationListItem[]>(['conversations'], (old) =>
      old?.map((c) => (c.id === conversation.id ? { ...c, unreadCount: 0 } : c)),
    );
  }, [conversation, conversationId, queryClient]);

  return (
    <div className="h-full overflow-hidden bg-gray-50 p-3">
      <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-3">
        <div className="shrink-0 flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <Link
            href="/leads"
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 transition hover:text-brand-600"
          >
            <ArrowLeft size={18} />
            Orqaga
          </Link>

          {conversation && (
            <div className="hidden items-center gap-2 text-sm text-gray-500 sm:flex">
              <span className="rounded-full border border-gray-200 px-2.5 py-1">
                {formatRelativeTime(conversation.lastMessageAt)}
              </span>
              <span className="rounded-full border border-gray-200 px-2.5 py-1">
                {conversation.status === 'OPEN' ? 'Ochiq' : 'Yopiq'}
              </span>
            </div>
          )}
        </div>

        {conversationQuery.isLoading && (
          <div className="flex min-h-[280px] items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-400 shadow-sm">
            <Loader2 className="mr-2 animate-spin" size={18} />
            Yuklanmoqda...
          </div>
        )}

        {conversationQuery.isError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {getErrorMessage(conversationQuery.error)}
          </div>
        )}

        {!conversationQuery.isLoading && !conversation && !conversationQuery.isError && (
          <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-gray-200 bg-white px-6 text-center text-gray-500 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100 text-gray-400">
              <MessageCircleMore size={22} />
            </div>
            <h2 className="text-base font-semibold text-gray-900">Suhbat topilmadi</h2>
            <p className="text-sm text-gray-500">Ushbu lead uchun chat mavjud emas yoki o‘chirib yuborilgan.</p>
            <Link href="/leads" className="text-sm font-medium text-brand-600">
              Leads sahifasiga qaytish
            </Link>
          </div>
        )}

        {conversation && (
          <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <ChatWindow
              conversation={conversation}
              onDeleted={() => {
                queryClient.invalidateQueries({ queryKey: ['conversations'] });
                router.push('/leads');
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
