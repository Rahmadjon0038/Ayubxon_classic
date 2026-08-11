// O'zbekiston mobil operator kodlari — 9 xonali (kod bolmagan) raqamni chin
// telefon raqami sifatida tasdiqlash uchun (tasodifiy 9 xonali sonlarni, masalan
// buyurtma ID yoki narxni, telefon deb qabul qilib qolmaslik uchun).
const UZ_MOBILE_PREFIXES = new Set([
  '90', '91', '93', '94', '95', '97', '98', '99',
  '33', '88', '20', '50', '55', '71', '77', '78',
]);

// Matndan O'zbekiston telefon raqamini topadi (masalan "+998 90 123 45 67",
// "998901234567", "0901234567", "901234567" formatlarining barchasini qabul qiladi)
// va "+998901234567" korinishida qaytaradi. Topilmasa null.
//
// Bu — AI holatidan (yoqilgan/ochirilgan/operatorga otkazilgan) qatiy nazar har bir
// kontakt xabarida ishlaydigan tezkor, OpenAI'siz tekshiruv. Shu orqali mijoz operator
// bilan gaplashayotganda ham (AI umuman ishtirok etmasa ham) qoldirgan raqami saqlanadi.
export function extractPhoneNumber(text: string): string | null {
  const candidates = text.match(/\d[\d\s\-()]{7,}\d/g);
  if (!candidates) return null;

  for (const raw of candidates) {
    const digits = raw.replace(/\D/g, '');
    let localNumber: string | null = null;

    if (digits.length === 12 && digits.startsWith('998')) {
      localNumber = digits.slice(3);
    } else if (digits.length === 10 && digits.startsWith('0')) {
      localNumber = digits.slice(1);
    } else if (digits.length === 9) {
      localNumber = digits;
    }

    if (localNumber && UZ_MOBILE_PREFIXES.has(localNumber.slice(0, 2))) {
      return `+998${localNumber}`;
    }
  }

  return null;
}
