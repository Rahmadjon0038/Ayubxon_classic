import type { Metadata, Viewport } from 'next';
import './globals.css';
import Providers from './providers';
import { NO_FLASH_THEME_SCRIPT } from '@/lib/theme';

export const metadata: Metadata = {
  metadataBase: new URL('https://inboxcrm.uz'),
  title: {
    default: 'InboxCrm | Mijozlar boshqaruvi',
    template: '%s | InboxCrm',
  },
  description:
    'Instagram Direct xabarlarini, lidlarni va AI javoblarni bir joydan boshqarish uchun CRM platforma.',
  applicationName: 'InboxCrm',
  keywords: [
    'Instagram DM',
    'CRM',
    'mijozlar boshqaruvi',
    'lidlar',
    'AI javoblar',
    'Instagram lead management',
  ],
  authors: [{ name: 'InboxCrm' }],
  creator: 'InboxCrm',
  publisher: 'InboxCrm',
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'uz_UZ',
    url: '/',
    siteName: 'InboxCrm',
    title: 'InboxCrm | Mijozlar boshqaruvi',
    description:
      'Instagram Direct xabarlarini, lidlarni va AI javoblarni bir joydan boshqarish uchun CRM platforma.',
    images: [
      {
        url: '/inboxcrm-icon.svg',
        width: 512,
        height: 512,
        alt: 'InboxCrm logotipi',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'InboxCrm | Mijozlar boshqaruvi',
    description:
      'Instagram Direct xabarlarini, lidlarni va AI javoblarni bir joydan boshqarish uchun CRM platforma.',
    images: ['/inboxcrm-icon.svg'],
  },
  icons: {
    icon: [
      { url: '/inboxcrm-icon.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/inboxcrm-icon.svg',
    apple: '/inboxcrm-icon.svg',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#020617' },
  ],
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
