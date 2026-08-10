'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { MessagesSquare } from 'lucide-react';
import ChatWindow from '@/components/ChatWindow';
import ConversationList from '@/components/ConversationList';
import { useLocale } from '@/components/LocaleProvider';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import {
  ConversationListItem,
  InstagramAccount,
  Message,
  MessageUpdatedEvent,
  NewMessageEvent,
} from '@/lib/types';

export default function InboxPage() {
  const { t } = useLocale();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
    // Socket uzilib qolgan holatlar uchun zaxira yangilanish.
    refetchInterval: 30_000,
  });

  useEffect(() => {
    setSelectedId(null);
    queryClient.removeQueries({ queryKey: ['messages'] });
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
  }, [accountKey]);

  // Socket.IO: yangi xabar kelganda ochiq suhbat va royxatni yangilaydi.
  useEffect(() => {
    const socket = getSocket();

    const onNewMessage = (event: NewMessageEvent) => {
      queryClient.setQueryData<Message[]>(['messages', event.conversationId], (old) => {
        if (!old) return old;
        if (old.some((m) => m.id === event.message.id)) return old;
        return [...old, event.message];
      });
      // Ochiq suhbatga kelgan xabar darhol oqilgan deb belgilanadi.
      if (event.conversationId === selectedId && event.message.senderType === 'CONTACT') {
        api
          .post(`/conversations/${event.conversationId}/read`)
          .catch(() => {})
        .finally(() => queryClient.invalidateQueries({ queryKey: ['conversations'] }));
        queryClient.setQueryData<ConversationListItem[]>(['conversations', accountKey], (old) =>
          old?.map((c) =>
            c.id === event.conversationId
              ? { ...c, unreadCount: 0, lastMessage: event.message, lastMessageAt: event.message.sentAt }
              : c,
          ),
        );
      } else {
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
      }
    };

    // Mavjud xabar yangilanganda (masalan, kontakt reaksiya qoyganda).
    const onMessageUpdated = (event: MessageUpdatedEvent) => {
      queryClient.setQueryData<Message[]>(['messages', event.conversationId], (old) =>
        old?.map((m) => (m.id === event.message.id ? event.message : m)),
      );
    };

    socket.on('new_message', onNewMessage);
    socket.on('message_updated', onMessageUpdated);
    return () => {
      socket.off('new_message', onNewMessage);
      socket.off('message_updated', onMessageUpdated);
    };
  }, [queryClient, selectedId]);

  useEffect(() => {
    const conversationId = searchParams.get('conversation');
    if (conversationId) {
      setSelectedId(conversationId);
    }
  }, [searchParams]);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    api.post(`/conversations/${id}/read`).catch(() => {});
    queryClient.setQueryData<ConversationListItem[]>(['conversations', accountKey], (old) =>
      old?.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)),
    );
  };

  const selected = conversationsQuery.data?.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="flex h-full">
      {/* Mobilda faqat bittasi korinadi: suhbat tanlanmagan bolsa royxat, tanlangan bolsa chat.
          md: dan boshlab ikkalasi doim yonma-yon turadi. */}
      <div
        className={`w-full shrink-0 border-r border-gray-300 bg-white md:block md:w-80 dark:border-gray-800 dark:bg-gray-900 ${
          selectedId ? 'hidden md:block' : 'block'
        }`}
      >
        <ConversationList
          conversations={conversationsQuery.data ?? []}
          isLoading={conversationsQuery.isLoading}
          selectedId={selectedId}
          onSelect={handleSelect}
        />
      </div>
      <div className={`flex-1 bg-gray-50 dark:bg-gray-950 ${selectedId ? 'block' : 'hidden md:block'}`}>
        {selected ? (
          <ChatWindow
            conversation={selected}
            onBack={() => setSelectedId(null)}
            onDeleted={() => {
              setSelectedId(null);
              queryClient.invalidateQueries({ queryKey: ['conversations'] });
            }}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-gray-500 dark:text-gray-500">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-800">
              <MessagesSquare size={28} strokeWidth={1.5} />
            </div>
            <p className="text-sm">{t('inbox.selectConversation')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
