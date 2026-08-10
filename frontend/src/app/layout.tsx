import type { Metadata } from 'next';
import './globals.css';
import Providers from './providers';
import { NO_FLASH_THEME_SCRIPT } from '@/lib/theme';

export const metadata: Metadata = {
  title: 'Mijozlar boshqaruvi',
  description: 'Instagram Direct mijozlari va leadlarini boshqarish paneli',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" suppressHydrationWarning>
      <head>
        {/* eslint-disable-next-line react/no-danger */}
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_THEME_SCRIPT }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
