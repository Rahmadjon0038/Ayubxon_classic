'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Avatar from './Avatar';
import LanguageSwitcher from './LanguageSwitcher';
import LogoMark from './LogoMark';
import { useLocale } from './LocaleProvider';
import ThemeToggle from './ThemeToggle';
import { api } from '@/lib/api';
import { InstagramAccount } from '@/lib/types';

interface Props {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export default function AppHeader({ collapsed, onToggleCollapsed }: Props) {
  const { t } = useLocale();
  const accountQuery = useQuery({
    queryKey: ['instagram-account'],
    queryFn: async () => {
      const { data } = await api.get<{ account: InstagramAccount | null }>('/instagram/account');
      return data.account;
    },
    staleTime: 60_000,
  });

  const account = accountQuery.data;

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-gray-300 bg-white px-3 sm:px-5 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center gap-2.5">
        <LogoMark className="h-9" width={112} height={36} showLabel />

        <button
          type="button"
          onClick={onToggleCollapsed}
          className="ml-1 hidden h-8 w-8 items-center justify-center rounded-lg text-gray-600 transition hover:bg-gray-100 hover:text-gray-900 md:inline-flex dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
          aria-label={collapsed ? t('header.expandSidebar') : t('header.collapseSidebar')}
          title={collapsed ? t('header.expandSidebar') : t('header.collapseSidebar')}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <LanguageSwitcher />
        <ThemeToggle />

        {account && (
          <div
            className="flex min-w-0 items-center gap-2 border-l border-gray-300 pl-2 sm:pl-3 dark:border-gray-800"
            title={t('header.connectedAccount', { username: account.username })}
          >
            <span className="hidden max-w-[140px] truncate text-sm font-medium text-gray-700 sm:inline dark:text-gray-200">
              @{account.username}
            </span>
            <Avatar src={account.profilePictureUrl} name={account.name || account.username} size={40} />
          </div>
        )}
      </div>
    </header>
  );
}
