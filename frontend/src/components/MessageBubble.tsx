'use client';

import { AlertCircle, Check, Clock, FileText, Heart, Play, Trash2 } from 'lucide-react';
import { useLocale } from './LocaleProvider';
import { formatDateTime } from '@/lib/format';
import { Message } from '@/lib/types';

interface Props {
  message: Message;
  onReact?: (message: Message, action: 'react' | 'unreact') => void;
  reactPending?: boolean;
  onDelete?: (message: Message) => void;
  deletePending?: boolean;
}

export default function MessageBubble({ message, onReact, reactPending, onDelete, deletePending }: Props) {
  const { t } = useLocale();
  const isAdmin = message.senderType === 'ADMIN';
  const isImage = message.attachmentType === 'image';
  const isVideo = message.attachmentType === 'video';
  const isAudio = message.attachmentType === 'audio';
  // Instagramdagi tez yurak (like) stikeri URLsiz keladi.
  const isHeartSticker = message.attachmentType === 'like_heart';
  const isInstagramLink = Boolean(message.attachmentUrl && message.attachmentUrl.includes('instagram.com'));
  // Ulashilgan post/reel (attachmentUrl faqat sahifa havolasi) — oEmbed orqali olingan preview bor.
  const isReelShare = Boolean(message.attachmentThumbnailUrl) || isInstagramLink;

  const hasReacted = Boolean(message.adminReaction);
  const canReact = !isAdmin && Boolean(message.instagramMessageId) && onReact;
  // Bubble burchagida korinadigan reaksiya: admin xabariga kontakt qoygani yoki aksincha.
  const shownReaction = isAdmin ? message.contactReaction : message.adminReaction;

  const deleteButton = onDelete && (
    <button
      type="button"
      disabled={deletePending}
      onClick={() => onDelete(message)}
      title={t('messageBubble.deleteMessage')}
      className={`mb-1 rounded-full p-1.5 text-gray-500 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:text-gray-500 dark:hover:bg-red-500/10 dark:hover:text-red-400 ${
        deletePending ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
      }`}
    >
      <Trash2 size={15} />
    </button>
  );

  return (
    <div className={`group flex items-end gap-1.5 ${isAdmin ? 'justify-end' : 'justify-start'}`}>
      {isAdmin && deleteButton}
      <div className={`relative max-w-md ${shownReaction ? 'mb-2.5' : ''}`}>
        <div
          className={`rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
            isAdmin
              ? 'rounded-br-sm bg-brand-600 text-white'
              : 'rounded-bl-sm border border-gray-300 bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100'
          }`}
        >
          {isHeartSticker && <span className="text-4xl leading-none">❤️</span>}

          {message.attachmentUrl && (
            <div className="mb-1.5 overflow-hidden rounded-lg">
              {isReelShare ? (
                <a
                  href={message.attachmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative block"
                >
                  {message.attachmentThumbnailUrl ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={message.attachmentThumbnailUrl}
                        alt={t('messageBubble.reelAlt')}
                        className="max-h-80 w-full object-cover"
                      />
                      <span className="absolute inset-0 flex items-center justify-center bg-black/10">
                        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm">
                          <Play size={18} fill="currentColor" />
                        </span>
                      </span>
                    </>
                  ) : (
                    <div className="flex min-h-28 items-center justify-center bg-gradient-to-br from-brand-50 via-white to-brand-100 px-4 py-6 text-brand-700">
                      <span className="flex items-center gap-2 rounded-full border border-brand-200 bg-white/80 px-3 py-2 text-sm font-medium shadow-sm">
                        <Play size={16} fill="currentColor" />
                        Instagram havolasi
                      </span>
                    </div>
                  )}
                </a>
              ) : isImage ? (
                <a href={message.attachmentUrl} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={message.attachmentUrl}
                    alt={t('messageBubble.imageAlt')}
                    className="max-h-64 w-full object-cover"
                  />
                </a>
              ) : isVideo ? (
                <video src={message.attachmentUrl} controls className="max-h-64 w-full" />
              ) : isAudio ? (
                <audio src={message.attachmentUrl} controls className="w-60" />
              ) : (
                <a
                  href={message.attachmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-1.5 text-xs underline ${
                    isAdmin ? 'text-white' : 'text-brand-600'
                  }`}
                >
                  <FileText size={14} />
                  {t('messageBubble.openFile')}
                </a>
              )}
            </div>
          )}

          {message.text && <p className="whitespace-pre-wrap break-words">{message.text}</p>}

          {/* Matn ham, media ham bolmagan xabar (masalan qollab-quvvatlanmaydigan tur) */}
          {!message.text && !message.attachmentUrl && !isHeartSticker && (
            <p className={`italic ${isAdmin ? 'text-brand-100' : 'text-gray-500 dark:text-gray-500'}`}>
              {t('messageBubble.unsupported')}
            </p>
          )}

          <div
            className={`mt-1 flex items-center gap-1 text-[11px] ${
              isAdmin ? 'text-brand-100' : 'text-gray-500 dark:text-gray-500'
            }`}
          >
            <span>{formatDateTime(message.sentAt)}</span>
            {isAdmin && message.status === 'SENT' && <Check size={12} />}
            {isAdmin && message.status === 'SENDING' && <Clock size={12} />}
            {isAdmin && message.status === 'FAILED' && (
              <span className="flex items-center gap-0.5 text-red-300">
                <AlertCircle size={12} /> {t('messageBubble.failedToSend')}
              </span>
            )}
          </div>
        </div>

        {/* Bubble burchagidagi reaksiya belgisi */}
        {shownReaction && (
          <span
            className={`absolute -bottom-2.5 flex h-5 items-center rounded-full border border-gray-300 bg-white px-1.5 text-xs shadow-sm dark:border-gray-700 dark:bg-gray-800 ${
              isAdmin ? 'right-2' : 'left-2'
            }`}
          >
            {shownReaction === 'love' ? '❤️' : shownReaction}
          </span>
        )}
      </div>

      {/* Kontakt xabari ustiga hover qilganda chiqadigan reaksiya tugmasi */}
      {canReact && (
        <button
          type="button"
          disabled={reactPending}
          onClick={() => onReact!(message, hasReacted ? 'unreact' : 'react')}
          title={hasReacted ? t('messageBubble.removeReaction') : t('messageBubble.addReaction')}
          className={`mb-1 rounded-full p-1.5 transition disabled:opacity-40 ${
            hasReacted
              ? 'text-red-500 opacity-100 hover:bg-red-500/10'
              : 'text-gray-500 opacity-0 hover:bg-gray-100 hover:text-red-500 group-hover:opacity-100 dark:text-gray-500 dark:hover:bg-gray-800'
          }`}
        >
          <Heart size={15} fill={hasReacted ? 'currentColor' : 'none'} />
        </button>
      )}
      {!isAdmin && deleteButton}
    </div>
  );
}
