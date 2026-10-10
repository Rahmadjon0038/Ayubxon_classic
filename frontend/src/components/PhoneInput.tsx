'use client';

import { ChangeEvent } from 'react';

interface Props {
  id?: string;
  value: string; // Faqat +998'dan keyingi 9 ta raqam (masalan "971234567")
  onChange: (digits: string) => void;
  required?: boolean;
  autoFocus?: boolean;
  // Super-admin formalaridagi kabi kichikroq (rounded-lg, text-sm) ko'rinish uchun.
  dense?: boolean;
  // Berilsa, maydonga harf yoki "@" kiritilganda (masalan brauzer saqlangan emailni
  // avtomatik to'ldirganda) qiymat raqamlarga qirqib tashlanmaydi — shu xom qiymat bilan
  // chaqiriladi. Faqat eski (email bilan yaratilgan) hisoblar kiradigan login formasida kerak.
  onNonPhoneInput?: (raw: string) => void;
}

// "971234567" -> "97 123 45 67" (2-3-2-2 guruhlash — O'zbekiston uyali raqam formati).
function formatDigits(digits: string): string {
  const parts = [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 7), digits.slice(7, 9)].filter(Boolean);
  return parts.join(' ');
}

// +998 doim ko'rinib turadigan prefiks — foydalanuvchi faqat qolgan 9 ta raqamni kiritadi.
export default function PhoneInput({ id, value, onChange, required, autoFocus, dense = false, onNonPhoneInput }: Props) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (onNonPhoneInput && /[A-Za-z@]/.test(raw)) {
      onNonPhoneInput(raw);
      return;
    }
    onChange(raw.replace(/\D/g, '').slice(0, 9));
  };

  const rounding = dense ? 'rounded-lg' : 'rounded-xl';
  const padding = dense ? 'px-3 py-2 text-sm' : 'px-4 py-3 text-base';

  return (
    <div
      className={`flex w-full overflow-hidden border border-gray-300 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100 dark:border-tg-hover dark:focus-within:ring-brand-500/20 ${rounding}`}
    >
      <span className={`flex items-center bg-gray-50 text-gray-600 dark:bg-tg-panelAlt dark:text-tg-textMuted ${padding}`}>
        +998
      </span>
      <input
        id={id}
        type="tel"
        inputMode="numeric"
        required={required}
        autoFocus={autoFocus}
        autoComplete="tel-national"
        value={formatDigits(value)}
        onChange={handleChange}
        className={`w-full min-w-0 flex-1 border-0 bg-white text-gray-900 outline-none dark:bg-tg-panelAlt dark:text-tg-text ${padding}`}
        placeholder="97 123 45 67"
      />
    </div>
  );
}
