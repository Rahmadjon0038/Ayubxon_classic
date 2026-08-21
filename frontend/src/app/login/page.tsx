'use client';

import { useMutation } from '@tanstack/react-query';
import { Eye, EyeOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import LogoMark from '@/components/LogoMark';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useLocale } from '@/components/LocaleProvider';
import { api, getErrorMessage, getToken, setToken } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const { t } = useLocale();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (getToken()) router.replace('/inbox');
  }, [router]);

  const loginMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ token: string }>('/auth/login', { email, password });
      return data;
    },
    onSuccess: (data) => {
      setToken(data.token);
      router.replace('/inbox');
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    loginMutation.mutate();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-5 py-8 dark:bg-tg-bg dark:bg-[radial-gradient(circle_at_top_left,_rgba(82,136,193,0.12),_transparent_38%),radial-gradient(circle_at_bottom_right,_rgba(139,92,246,0.08),_transparent_32%)]">
      <div className="fixed right-5 top-5">
        <LanguageSwitcher />
      </div>

      <div className="w-full max-w-md">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-4 flex justify-center">
            <LogoMark width={170} height={58} />
          </div>
          <p className="mt-2 text-base text-gray-600 dark:text-tg-textMuted">{t('login.subtitle')}</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-2xl border border-gray-300 bg-white p-8 shadow-sm backdrop-blur-xl backdrop-saturate-150 dark:border-tg-border/70 dark:bg-tg-panel/[0.94]"
        >
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-medium dark:text-tg-text">
              {t('common.email')}
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-tg-hover dark:bg-tg-panelAlt dark:text-tg-text dark:focus:ring-brand-500/20"
              placeholder="admin@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-medium dark:text-tg-text">
              {t('login.password')}
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 pr-12 text-base outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-tg-hover dark:bg-tg-panelAlt dark:text-tg-text dark:focus:ring-brand-500/20"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-tg-hover dark:hover:text-tg-text"
                aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {loginMutation.isError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
              {getErrorMessage(loginMutation.error)}
            </p>
          )}

          <button
            type="submit"
            disabled={loginMutation.isPending}
            className="w-full rounded-xl bg-brand-600 py-3.5 text-base font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {loginMutation.isPending ? t('login.submitting') : t('login.submit')}
          </button>
        </form>
      </div>
    </div>
  );
}
