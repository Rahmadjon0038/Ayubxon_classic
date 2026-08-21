import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eaf3fb',
          100: '#d3e6f5',
          400: '#6ab0e6',
          500: '#5288c1',
          600: '#3f74ad',
          700: '#2f5c8f',
        },
        // Telegram macOS (dark) palitrasiga moslashtirilgan — chuqur dark navy, past
        // kontrastli ajratgichlar, aksent faqat tugma/yuborilgan xabar uchun (tanlangan
        // chat qatori esa subtle, aksent emas).
        tg: {
          bg: '#0E1621',
          sidebar: '#121C26',
          panel: '#131C26',
          panelAlt: '#182430',
          hover: '#202B38',
          border: '#1A2733',
          active: '#1C2836',
          accent: '#3390EC',
          text: '#FFFFFF',
          textMuted: '#7F91A4',
          textFaint: '#5A6B7D',
        },
      },
    },
  },
  plugins: [],
};

export default config;
