'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BarChart3, Bot, Camera, Inbox, LogOut, Settings } from 'lucide-react';
import Avatar from '@/components/Avatar';
import { useLocale } from '@/components/LocaleProvider';
import { clearToken, getToken } from '@/lib/api';
import { disconnectSocket } from '@/lib/socket';
import { useInstagramAccount } from '@/lib/useInstagramAccount';

const navItems = [
  { href: '/inbox', key: 'nav.inbox', Icon: Inbox },
  { href: '/stats', key: 'nav.stats', Icon: BarChart3 },
  { href: '/instagram', key: 'nav.instagram', Icon: Camera },
  { href: '/ai-assistant', key: 'nav.aiAssistant', Icon: Bot },
  { href: '/settings', key: 'nav.settings', Icon: Settings },
] as const;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useLocale();
  const [ready, setReady] = useState(false);
  const accountQuery = useInstagramAccount();
  const account = accountQuery.data;

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
    } else {
      setReady(true);
    }
  }, [router]);

  const handleLogout = () => {
    disconnectSocket();
    clearToken();
    router.replace('/login');
  };

  if (!ready) return null;

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-slate-50 dark:bg-tg-bg">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row md:gap-2 md:p-2 lg:gap-3 lg:p-3">
        <aside className="hidden w-[81px] shrink-0 flex-col rounded-2xl border border-gray-300 bg-white/80 shadow-sm backdrop-blur-xl backdrop-saturate-150 md:flex dark:border-tg-border/70 dark:bg-tg-sidebar">
          {account && (
            <div className="flex justify-center py-3">
              <Avatar src={account.profilePictureUrl} name={account.name || account.username} size={40} />
            </div>
          )}

          <nav className="flex-1 space-y-1 px-2 pt-3">
            {navItems.map(({ href, key, Icon }) => {
              const active = pathname.startsWith(href);
              const label = t(key);
              return (
                <Link
                  key={href}
                  href={href}
                  title={label}
                  className={`flex flex-col items-center gap-1 rounded-xl px-0.5 py-2.5 text-center text-[10px] font-medium leading-tight transition ${
                    active
                      ? 'bg-brand-50 text-brand-700 dark:bg-tg-active dark:text-tg-accent'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-tg-textMuted dark:hover:bg-tg-panelAlt'
                  }`}
                >
                  <Icon size={20} strokeWidth={active ? 2.3 : 2} />
                  <span className="line-clamp-2 w-full break-words">{label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="p-2">
            <button
              onClick={handleLogout}
              title={t('nav.logout')}
              className="flex w-full flex-col items-center gap-1 rounded-xl px-1 py-2.5 text-center text-[11px] font-medium leading-tight text-gray-600 transition hover:bg-red-50 hover:text-red-600 dark:text-tg-textMuted dark:hover:bg-red-500/10 dark:hover:text-red-400"
            >
              <LogOut size={19} strokeWidth={2} />
              <span>{t('nav.logout')}</span>
            </button>
          </div>
        </aside>

        <main className="min-h-0 flex-1 overflow-hidden md:rounded-2xl">{children}</main>

        {/* Mobil pastki navigatsiya — yon panel md: dan boshlab korinadi, undan pastda shu almashadi. */}
        <nav className="flex shrink-0 items-stretch justify-around border-t border-gray-300 bg-white/80 backdrop-blur-xl backdrop-saturate-150 pb-[env(safe-area-inset-bottom)] md:hidden dark:border-tg-border/70 dark:bg-tg-sidebar">
          {navItems.map(({ href, key, Icon }) => {
            const active = pathname.startsWith(href);
            const label = t(key);
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                title={label}
                className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 transition ${
                  active ? 'text-brand-600 dark:text-brand-400' : 'text-gray-600 dark:text-tg-textMuted'
                }`}
              >
                <Icon size={21} strokeWidth={active ? 2.4 : 2} />
              </Link>
            );
          })}
          <button
            type="button"
            onClick={handleLogout}
            aria-label={t('nav.logout')}
            title={t('nav.logout')}
            className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-gray-600 transition dark:text-tg-textMuted"
          >
            <LogOut size={21} />
          </button>
        </nav>
      </div>
    </div>
  );
}
