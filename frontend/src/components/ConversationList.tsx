'use client';

import { Inbox, Search } from 'lucide-react';
import Avatar from './Avatar';
import { useLocale } from './LocaleProvider';
import { contactDisplayName, formatTime } from '@/lib/format';
import { ConversationListItem } from '@/lib/types';

interface Props {
  conversations: ConversationListItem[];
  isLoading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  hasSearchResults: boolean;
}

function lastMessagePreview(item: ConversationListItem, t: (key: string) => string): string {
  const msg = item.lastMessage;
  if (!msg) return t('inbox.noMessage');
  if (msg.text) return msg.text;
  if (msg.attachmentType === 'image') return t('inbox.imagePreview');
  if (msg.attachmentType === 'video') return t('inbox.videoPreview');
  if (msg.attachmentType === 'audio') return t('inbox.audioPreview');
  if (msg.attachmentType === 'like_heart') return '❤️';
  if (msg.attachmentType) return t('inbox.filePreview');
  return t('inbox.messageLabel');
}

export default function ConversationList({
  conversations,
  isLoading,
  selectedId,
  onSelect,
  search,
  onSearchChange,
  hasSearchResults,
}: Props) {
  const { t } = useLocale();

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-300 px-4 py-4 dark:border-gray-800">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="text-base font-semibold dark:text-gray-100">{t('inbox.title')}</h2>
          <label className="relative w-full lg:max-w-xs">
            <Search
              size={16}
              strokeWidth={2}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
            />
            <input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t('inbox.searchPlaceholder')}
              className="h-10 w-full rounded-xl border border-gray-300 bg-white pl-9 pr-3 text-sm text-gray-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            />
          </label>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading && <p className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-500">{t('common.loading')}</p>}

        {!isLoading && conversations.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-gray-500 dark:text-gray-500">
            <Inbox size={28} strokeWidth={1.5} />
            <p className="text-sm">{hasSearchResults ? t('inbox.searchEmptyBody') : t('inbox.emptyBody')}</p>
          </div>
        )}

        {conversations.map((item) => {
          const active = item.id === selectedId;
          const name = contactDisplayName(item.contact);
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              className={`flex w-full items-center gap-3 border-b border-gray-200 px-4 py-3 text-left transition dark:border-gray-800 ${
                active ? 'bg-brand-50 dark:bg-brand-500/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <Avatar src={item.contact.profilePictureUrl} name={name} size={44} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5">
                    {item.aiPaused && (
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
                        title={t('inbox.aiPausedDot')}
                      />
                    )}
                    <span className="truncate text-sm font-medium dark:text-gray-100">{name}</span>
                  </span>
                  <span className="shrink-0 text-xs text-gray-500 dark:text-gray-500">
                    {formatTime(item.lastMessageAt)}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-gray-600 dark:text-gray-400">{lastMessagePreview(item, t)}</span>
                  {item.unreadCount > 0 && (
                    <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 px-1.5 text-xs font-medium text-white">
                      {item.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
