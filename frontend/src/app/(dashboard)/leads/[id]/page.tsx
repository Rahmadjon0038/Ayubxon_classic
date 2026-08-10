'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, MessageCircleMore } from 'lucide-react';
import ChatWindow from '@/components/ChatWindow';
import LeadStatusControls from '@/components/LeadStatusControls';
import { api, getErrorMessage } from '@/lib/api';
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

  // Kanban taxtasidagi drag-and-drop teginish (touch) ekranlarda ishonchli ishlamaydi, shuning
  // uchun lead statusini shu yerdan ham (drag qilmasdan) o'zgartirish imkoni beriladi.
  const statusMutation = useMutation({
    mutationFn: async ({
      field,
      value,
    }: {
      field: 'leadTemperature' | 'talkStatus' | 'courseDecision' | 'status';
      value: string;
    }) => {
      const { data } = await api.patch<{ conversation: ConversationListItem }>(
        `/conversations/${conversationId}/status`,
        { [field]: value },
      );
      return data.conversation;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<ConversationListItem>(['conversation', conversationId], (old) =>
        old ? { ...old, ...updated } : old,
      );
      queryClient.setQueryData<ConversationListItem[]>(['conversations'], (old) =>
        old?.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)),
      );
    },
  });

  return (
    <div className="flex h-full flex-col overflow-hidden bg-gray-50">
      {conversationQuery.isLoading && (
        <div className="flex h-full items-center justify-center text-gray-400">
          <Loader2 className="mr-2 animate-spin" size={18} />
          Yuklanmoqda...
        </div>
      )}

      {conversationQuery.isError && (
        <div className="flex h-full items-center justify-center px-6 text-center text-sm text-red-600">
          {getErrorMessage(conversationQuery.error)}
        </div>
      )}

      {!conversationQuery.isLoading && !conversation && !conversationQuery.isError && (
        <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-gray-500">
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
        <>
          <div className="shrink-0 overflow-x-auto border-b border-gray-200 bg-white px-3 py-2.5 sm:px-5">
            <LeadStatusControls
              conversation={conversation}
              disabled={statusMutation.isPending}
              compact
              onChange={(field, value) => statusMutation.mutate({ field, value })}
            />
          </div>
          <div className="min-h-0 flex-1">
            <ChatWindow
              conversation={conversation}
              backHref="/leads"
              onDeleted={() => {
                queryClient.invalidateQueries({ queryKey: ['conversations'] });
                router.push('/leads');
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}
