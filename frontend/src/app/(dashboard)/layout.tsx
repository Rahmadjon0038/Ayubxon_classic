'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Bot, Camera, Inbox, KanbanSquare, LogOut, Phone, Settings } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import { useLocale } from '@/components/LocaleProvider';
import { clearToken, getToken } from '@/lib/api';
import { disconnectSocket } from '@/lib/socket';

const navItems = [
  { href: '/leads', key: 'nav.leads', Icon: KanbanSquare },
  { href: '/inbox', key: 'nav.inbox', Icon: Inbox },
  { href: '/calls', key: 'nav.calls', Icon: Phone },
  { href: '/instagram', key: 'nav.instagram', Icon: Camera },
  { href: '/ai-assistant', key: 'nav.aiAssistant', Icon: Bot },
  { href: '/settings', key: 'nav.settings', Icon: Settings },
] as const;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useLocale();
  const [ready, setReady] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem('sidebar-collapsed');
    setCollapsed(saved === '1');
  }, []);

  useEffect(() => {
    window.localStorage.setItem('sidebar-collapsed', collapsed ? '1' : '0');
  }, [collapsed]);

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
    <div className="flex h-screen flex-col overflow-hidden">
      <AppHeader collapsed={collapsed} onToggleCollapsed={() => setCollapsed((current) => !current)} />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
        <aside
          className={`hidden shrink-0 flex-col border-r border-gray-300 bg-white transition-[width] duration-200 md:flex dark:border-gray-800 dark:bg-gray-900 ${
            collapsed ? 'w-16' : 'w-60'
          }`}
        >
          <nav className={`flex-1 space-y-1 pt-4 ${collapsed ? 'px-2' : 'px-3'}`}>
            {navItems.map(({ href, key, Icon }) => {
              const active = pathname.startsWith(href);
              const label = t(key);
              return (
                <Link
                  key={href}
                  href={href}
                  title={collapsed ? label : undefined}
                  className={`flex items-center rounded-lg py-2 text-sm font-medium transition ${
                    collapsed ? 'justify-center px-2' : 'gap-3 px-3'
                  } ${
                    active
                      ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                  }`}
                >
                  <Icon size={17} strokeWidth={active ? 2.3 : 2} />
                  {!collapsed && label}
                </Link>
              );
            })}
          </nav>

          <div className={`border-t border-gray-300 dark:border-gray-800 ${collapsed ? 'p-2' : 'p-3'}`}>
            <button
              onClick={handleLogout}
              title={collapsed ? t('nav.logout') : undefined}
              className={`flex w-full items-center rounded-lg py-2 text-sm font-medium text-gray-600 transition hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-500/10 dark:hover:text-red-400 ${
                collapsed ? 'justify-center px-2' : 'gap-3 px-3'
              }`}
            >
              <LogOut size={17} strokeWidth={2} />
              {!collapsed && t('nav.logout')}
            </button>
          </div>
        </aside>

        <main className="min-h-0 flex-1 overflow-hidden">{children}</main>

        {/* Mobil pastki navigatsiya — yon panel md: dan boshlab korinadi, undan pastda shu almashadi. */}
        <nav className="flex shrink-0 items-stretch justify-around border-t border-gray-300 bg-white pb-[env(safe-area-inset-bottom)] md:hidden dark:border-gray-800 dark:bg-gray-900">
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
                  active ? 'text-brand-600 dark:text-brand-400' : 'text-gray-600 dark:text-gray-400'
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
            className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-gray-600 transition dark:text-gray-400"
          >
            <LogOut size={21} />
          </button>
        </nav>
      </div>
    </div>
  );
}
