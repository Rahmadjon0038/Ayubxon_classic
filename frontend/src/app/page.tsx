'use client';

import Link from 'next/link';
import { ArrowRight, MessageSquareMore, Sparkles, Users } from 'lucide-react';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import LogoMark from '@/components/LogoMark';
import ThemeToggle from '@/components/ThemeToggle';
import { useLocale } from '@/components/LocaleProvider';
import { getToken } from '@/lib/api';

const features = [
  {
    icon: MessageSquareMore,
    titleKey: 'home.feature1Title',
    bodyKey: 'home.feature1Body',
    iconClass: 'text-violet-600 bg-violet-100 dark:bg-violet-500/15 dark:text-violet-300',
  },
  {
    icon: Users,
    titleKey: 'home.feature2Title',
    bodyKey: 'home.feature2Body',
    iconClass: 'text-blue-600 bg-blue-100 dark:bg-blue-500/15 dark:text-blue-300',
  },
  {
    icon: Sparkles,
    titleKey: 'home.feature3Title',
    bodyKey: 'home.feature3Body',
    iconClass: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300',
  },
] as const;

export default function HomePage() {
  const { t } = useLocale();
  const isAuthenticated = getToken();

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(168,139,250,0.14),_transparent_34%),radial-gradient(circle_at_bottom_left,_rgba(191,219,254,0.4),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.14),_transparent_26%),linear-gradient(to_bottom,_#f7fbff,_#ffffff)] text-slate-900 dark:bg-[radial-gradient(circle_at_top_left,_rgba(168,139,250,0.12),_transparent_28%),radial-gradient(circle_at_bottom_left,_rgba(59,130,246,0.12),_transparent_22%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.08),_transparent_24%),linear-gradient(to_bottom,_#071121,_#020617)] dark:text-slate-100">
      <div className="pointer-events-none absolute inset-x-[-10%] top-[-8%] h-[320px] rounded-full bg-[radial-gradient(circle,_rgba(255,255,255,0.9),_rgba(255,255,255,0))] blur-3xl dark:bg-[radial-gradient(circle,_rgba(148,163,184,0.12),_rgba(148,163,184,0))]" />
      <div className="pointer-events-none absolute bottom-[-12%] left-[-8%] h-[360px] w-[360px] rounded-full bg-violet-200/30 blur-3xl dark:bg-violet-500/10" />
      <div className="pointer-events-none absolute right-[-7%] top-[18%] h-[260px] w-[260px] rounded-full bg-sky-200/25 blur-3xl dark:bg-sky-500/10" />

      <div className="relative mx-auto flex min-h-screen max-w-[1680px] flex-col px-4 py-4 sm:px-6 lg:px-10">
        <header className="rounded-[28px] border border-white/70 bg-white/75 px-3 py-3 shadow-[0_10px_35px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-950/55">
          <div className="flex items-center justify-between">
            <LogoMark className="-ml-1" width={176} height={54} />

            <div className="flex items-center gap-1.5 sm:gap-2">
              <ThemeToggle />
              <LanguageSwitcher />
              <Link
                href={isAuthenticated ? '/inbox' : '/login'}
                className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/90 px-4 py-1.5 text-sm font-semibold text-violet-700 shadow-[0_8px_20px_rgba(99,102,241,0.08)] transition hover:border-violet-300 hover:bg-white dark:border-slate-700 dark:bg-slate-900/90 dark:text-violet-300 dark:hover:bg-slate-900"
              >
                {t('home.signIn')}
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </header>

        <section className="flex flex-1 flex-col px-2 pb-2 pt-8 sm:px-4 lg:px-8">
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <div className="mb-5">
              <LogoMark className="mx-auto" width={360} height={124} />
            </div>

            <h1 className="max-w-4xl text-4xl font-extrabold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl dark:text-white">
              {t('home.title')}
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl dark:text-slate-300">
              {t('home.subtitle')}
            </p>

            <div className="mt-10">
              <Link
                href={isAuthenticated ? '/inbox' : '/login'}
                className="inline-flex min-w-[220px] items-center justify-center gap-3 rounded-full bg-gradient-to-r from-violet-600 to-blue-500 px-8 py-4 text-lg font-semibold text-white shadow-[0_18px_40px_rgba(99,102,241,0.24)] transition hover:from-violet-700 hover:to-blue-600"
              >
                {t('home.signIn')}
                <ArrowRight size={20} />
              </Link>
            </div>
          </div>

          <div className="mt-10 grid gap-0 overflow-hidden md:grid-cols-3">
            {features.map(({ icon: Icon, titleKey, bodyKey, iconClass }, index) => (
              <div
                key={titleKey}
                className={`px-6 py-8 text-center ${index < features.length - 1 ? 'border-b border-slate-200 md:border-b-0 md:border-r dark:border-slate-800' : ''}`}
              >
                <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-[1.25rem] ${iconClass}`}>
                  <Icon size={30} />
                </div>
                <h2 className="mt-5 text-xl font-bold text-slate-950 dark:text-white">{t(titleKey)}</h2>
                <p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-slate-600 dark:text-slate-400">
                  {t(bodyKey)}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
