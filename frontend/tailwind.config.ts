import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef8ff',
          100: '#d9eeff',
          500: '#2f8fcb',
          600: '#1f79b7',
          700: '#175f93',
        },
      },
    },
  },
  plugins: [],
};

export default config;
