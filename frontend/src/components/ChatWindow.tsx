'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Paperclip, SendHorizontal, Trash2, UserRound } from 'lucide-react';
import Avatar from './Avatar';
import MessageBubble from './MessageBubble';
import { api, getErrorMessage } from '@/lib/api';
import { contactDisplayName } from '@/lib/format';
import { getSocket } from '@/lib/socket';
import { ConversationListItem, Message, MessageUpdatedEvent, NewMessageEvent } from '@/lib/types';

interface Props {
  conversation: ConversationListItem;
  onDeleted?: () => void;
  // Berilsa, header boshida orqaga tugmasi chiqadi (masalan Leads sahifasidan ochilganda).
  backHref?: string;
  // Inbox kabi bitta sahifada ro'yxat+chat birga bo'lgan joylarda ishlatiladi: faqat mobil
  // ekranda (list va chat bitta vaqtda ko'rinmaydigan joyda) orqaga tugmasi chiqadi.
  onBack?: () => void;
}

export default function ChatWindow({ conversation, onDeleted, backHref, onBack }: Props) {
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const messagesQuery = useQuery({
    queryKey: ['messages', conversation.id],
    queryFn: async () => {
      const { data } = await api.get<{ messages: Message[] }>(
        `/conversations/${conversation.id}/messages`,
      );
      return data.messages;
    },
  });

  // scrollIntoView orniga konteynerning oziga scrollTop qoyiladi — bu chatga kirganda
  // (yoki yangi xabar kelganda) doim eng pastga tushishini kafolatlaydi. rAF DOM
  // (rasm/avatarlar bilan) toliq chizilgandan keyin ishga tushishi uchun ishlatiladi.
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const raf = requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
    return () => cancelAnimationFrame(raf);
  }, [messagesQuery.data, conversation.id]);

  // Matnga qarab textarea balandligi osadi (maksimal ~10 qator).
  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [text, resizeTextarea]);

  const appendMessage = (message: Message) => {
    queryClient.setQueryData<Message[]>(['messages', conversation.id], (old) => {
      if (!old) return [message];
      if (old.some((m) => m.id === message.id)) return old;
      return [...old, message];
    });
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
  };

  // Ochiq chat qaysi sahifada bolishidan qatiy nazar (Inbox yoki Leads) yangi xabar
  // va reaksiyalar Socket.IO orqali darhol korinishi uchun. Sahifani qayta ochish/yangilash shart emas.
  useEffect(() => {
    const socket = getSocket();

    const onNewMessage = (event: NewMessageEvent) => {
      if (event.conversationId !== conversation.id) return;
      appendMessage(event.message);
      if (event.message.senderType === 'CONTACT') {
        api.post(`/conversations/${conversation.id}/read`).catch(() => {});
        queryClient.setQueryData<ConversationListItem[]>(['conversations'], (old) =>
          old?.map((c) => (c.id === conversation.id ? { ...c, unreadCount: 0 } : c)),
        );
        queryClient.setQueryData<ConversationListItem>(['conversation', conversation.id], (old) =>
          old ? { ...old, unreadCount: 0 } : old,
        );
      }
    };

    const onMessageUpdated = (event: MessageUpdatedEvent) => {
      if (event.conversationId !== conversation.id) return;
      queryClient.setQueryData<Message[]>(['messages', conversation.id], (old) =>
        old?.map((m) => (m.id === event.message.id ? event.message : m)),
      );
    };

    socket.on('new_message', onNewMessage);
    socket.on('message_updated', onMessageUpdated);
    return () => {
      socket.off('new_message', onNewMessage);
      socket.off('message_updated', onMessageUpdated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id, queryClient]);

  const sendMutation = useMutation({
    mutationFn: async (messageText: string) => {
      const { data } = await api.post<{ message: Message }>(
        `/conversations/${conversation.id}/messages`,
        { text: messageText },
      );
      return data.message;
    },
    onSuccess: (message) => {
      setText('');
      appendMessage(message);
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post<{ message: Message }>(
        `/conversations/${conversation.id}/attachments`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      return data.message;
    },
    onSuccess: appendMessage,
  });

  const reactMutation = useMutation({
    mutationFn: async ({ message, action }: { message: Message; action: 'react' | 'unreact' }) => {
      const { data } = await api.post<{ message: Message }>(
        `/conversations/${conversation.id}/messages/${message.id}/react`,
        { action },
      );
      return data.message;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<Message[]>(['messages', conversation.id], (old) =>
        old?.map((m) => (m.id === updated.id ? updated : m)),
      );
    },
  });

  // Handover Protocol: mijoz operator so'raganda AI shu suhbatda avtomatik to'xtaydi
  // (backend'da aniqlanadi). Admin shu tugma orqali AI'ni qo'lda qayta yoqadi.
  const resumeAiMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.patch<{ conversation: ConversationListItem }>(
        `/conversations/${conversation.id}/status`,
        { aiPaused: false },
      );
      return data.conversation;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<ConversationListItem[]>(['conversations'], (old) =>
        old?.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)),
      );
      queryClient.setQueryData<ConversationListItem>(['conversation', conversation.id], (old) =>
        old ? { ...old, ...updated } : old,
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/conversations/${conversation.id}`);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['conversations'] }),
        queryClient.removeQueries({ queryKey: ['messages', conversation.id] }),
      ]);
      onDeleted?.();
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || sendMutation.isPending) return;
    sendMutation.mutate(trimmed);
  };

  const handleFileChange = (files: FileList | null) => {
    const file = files?.[0];
    if (file && !uploadMutation.isPending) {
      uploadMutation.mutate(file);
    }
    // Bir xil faylni qayta tanlash ishlashi uchun input tozalanadi.
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const name = contactDisplayName(conversation.contact);
  const errorSource = sendMutation.isError
    ? sendMutation.error
    : uploadMutation.isError
      ? uploadMutation.error
      : reactMutation.isError
        ? reactMutation.error
        : deleteMutation.isError
          ? deleteMutation.error
        : null;

  const handleDelete = () => {
    if (deleteMutation.isPending) return;
    const confirmed = window.confirm('Bu chatni o‘chirmoqchimisiz? Bu amalni qaytarib bo‘lmaydi.');
    if (!confirmed) return;
    deleteMutation.mutate();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-gray-200 bg-white px-3 py-3 sm:gap-3 sm:px-5">
        {backHref && (
          <Link
            href={backHref}
            className="-ml-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
            aria-label="Orqaga"
          >
            <ArrowLeft size={18} />
          </Link>
        )}
        {!backHref && onBack && (
          <button
            type="button"
            onClick={onBack}
            className="-ml-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 md:hidden"
            aria-label="Ro'yxatga qaytish"
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <Avatar src={conversation.contact.profilePictureUrl} name={name} size={38} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{name}</p>
          {conversation.contact.username && (
            <p className="truncate text-xs text-gray-500">@{conversation.contact.username}</p>
          )}
        </div>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-gray-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
          title="Chatni o'chirish"
        >
          {deleteMutation.isPending ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Trash2 size={16} />
          )}
        </button>
      </div>

      {conversation.aiPaused && (
        <div className="flex flex-col items-start gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-4">
          <span className="flex items-center gap-1.5">
            <UserRound size={14} className="shrink-0" />
            Operator so'ralgan — AI bu suhbatda avtomatik javob bermayapti.
          </span>
          <button
            type="button"
            onClick={() => resumeAiMutation.mutate()}
            disabled={resumeAiMutation.isPending}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-amber-600 px-3 py-1 text-[11px] font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50"
          >
            {resumeAiMutation.isPending && <Loader2 size={12} className="animate-spin" />}
            AI&apos;ni qayta yoqish
          </button>
        </div>
      )}

      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-3 py-4 sm:px-5">
        {messagesQuery.isLoading && (
          <p className="py-6 text-center text-sm text-gray-400">Yuklanmoqda...</p>
        )}
        {messagesQuery.isError && (
          <p className="py-6 text-center text-sm text-red-500">
            {getErrorMessage(messagesQuery.error)}
          </p>
        )}
        <div className="space-y-2">
          {messagesQuery.data?.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              onReact={(msg, action) => reactMutation.mutate({ message: msg, action })}
              reactPending={reactMutation.isPending}
            />
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="border-t border-gray-200 bg-white px-4 py-3">
        {errorSource && (
          <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {getErrorMessage(errorSource)}
          </p>
        )}
        {uploadMutation.isPending && (
          <p className="mb-2 flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">
            <Loader2 size={15} className="animate-spin" />
            Fayl yuborilmoqda...
          </p>
        )}
        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,video/webm,audio/mpeg,audio/mp4,audio/wav,audio/ogg"
            className="hidden"
            onChange={(e) => handleFileChange(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
            title="Rasm, video yoki audio yuborish"
            className="mb-0.5 rounded-full p-2 text-gray-500 transition hover:bg-gray-100 hover:text-brand-600 disabled:opacity-50"
          >
            <Paperclip size={19} />
          </button>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            rows={1}
            placeholder="Xabar yozing..."
            className="flex-1 resize-none rounded-2xl border border-gray-300 px-4 py-2.5 text-sm leading-5 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
          <button
            type="submit"
            disabled={!text.trim() || sendMutation.isPending}
            title="Yuborish (Enter)"
            className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white transition hover:bg-brand-700 disabled:opacity-40"
          >
            {sendMutation.isPending ? (
              <Loader2 size={17} className="animate-spin" />
            ) : (
              <SendHorizontal size={17} />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
