// Bir martalik migratsiya skripti: eski (legacy) matn ko'rinishidagi bilimlar bazasini
// yangi struktura (BranchInfo / GroupInfo / PromotionInfo) ga o'tkazadi.
// Ishga tushirish: npx tsx src/scripts/seedTaraqqiyotKb.ts
import { prisma } from '../lib/prisma';

const ACADEMY_NAME = 'Taraqqiyot Teaching Center';

const TWO_TIER_PRICE = "Kattalar uchun: 420 000 so'm/oy\nKichik yoshdagi o'quvchilar uchun: 360 000 so'm/oy";

const COMMON_DETAILS_SUFFIX =
  "Sinov darsi mavjud, zarur bo'lsa daraja aniqlash testi o'tkaziladi. Aniq dars vaqti (ertalabki/kunduzgi/kechki) filial va mavjud guruhga qarab belgilanadi. Kurs davomiyligi dasturga qarab farq qiladi.";

const ARAB_TILI_DAVLATOBOD_OVERRIDE =
  'MUHIM KO\'RSATMA: mijoz aynan shu — Davlatobod filialida Arab tili — haqida so\'raganda, kurs mavjudligi yoki narxi haqida ma\'lumot bermang va "bu yerda yo\'q" ham demang. Buning o\'rniga darhol: "Bu kurs bo\'yicha telefon raqamingizni qoldiring, administratorlarimiz siz bilan bog\'lanishadi." deb javob bering, boshqa hech narsa qo\'shmang.';

interface SubjectSpec {
  name: string;
  price: string;
  details: string;
}

const SUBJECTS: SubjectSpec[] = [
  {
    name: 'Ingliz tili',
    price: TWO_TIER_PRICE,
    details: `Yo'nalishlar: Starter, General English, IELTS Foundation, IELTS, TOEFL, Speaking. ${COMMON_DETAILS_SUFFIX}`,
  },
  { name: 'Rus tili', price: TWO_TIER_PRICE, details: COMMON_DETAILS_SUFFIX },
  { name: 'Turk tili', price: TWO_TIER_PRICE, details: COMMON_DETAILS_SUFFIX },
  { name: 'Nemis tili', price: TWO_TIER_PRICE, details: COMMON_DETAILS_SUFFIX },
  {
    name: 'Koreys tili',
    price: TWO_TIER_PRICE,
    details: `Asosan 2-3-sinfdan boshlab qabul qilinadi. ${COMMON_DETAILS_SUFFIX}`,
  },
  {
    name: 'Xitoy tili',
    price: TWO_TIER_PRICE,
    details: `Asosan 2-3-sinfdan boshlab qabul qilinadi. ${COMMON_DETAILS_SUFFIX}`,
  },
  {
    name: 'Arab tili',
    price: TWO_TIER_PRICE,
    details: `Arab tili kurslari mavjud. ${COMMON_DETAILS_SUFFIX}`,
  },
  { name: 'Yapon tili', price: TWO_TIER_PRICE, details: COMMON_DETAILS_SUFFIX },
  { name: 'Matematika', price: TWO_TIER_PRICE, details: COMMON_DETAILS_SUFFIX },
  { name: 'Fizika', price: TWO_TIER_PRICE, details: COMMON_DETAILS_SUFFIX },
  { name: 'Kimyo', price: TWO_TIER_PRICE, details: COMMON_DETAILS_SUFFIX },
  { name: 'Biologiya', price: TWO_TIER_PRICE, details: COMMON_DETAILS_SUFFIX },
  { name: 'Ona tili', price: TWO_TIER_PRICE, details: COMMON_DETAILS_SUFFIX },
  { name: 'Tarix', price: TWO_TIER_PRICE, details: COMMON_DETAILS_SUFFIX },
  {
    name: 'Mental arifmetika',
    price: "Kichik yoshdagi o'quvchilar uchun: 360 000 so'm/oy",
    details: "Kichik yoshdagi o'quvchilar uchun mo'ljallangan. Sinov darsi mavjud.",
  },
  {
    name: 'Kompyuter savodxonligi',
    price: "420 000 so'm/oy",
    details: "Narx yosh bo'yicha farqlanmaydi. Sinov darsi mavjud.",
  },
  {
    name: 'IT kurslari',
    price: "600 000 so'm/oy",
    details: "Narx yosh bo'yicha farqlanmaydi. Kurs yakunida sertifikat beriladi. Sinov darsi mavjud.",
  },
];

const SUBJECT_NAMES_LIST = SUBJECTS.map((s) => s.name).join(', ');

const COMMON_BRANCH_EXTRA_INFO = `Qabul yoshi: asosan 6 yoshdan boshlab (kursga qarab farq qilishi mumkin). Xitoy va Koreys tili kurslariga asosan 2-3-sinfdan qabul qilinadi.
Dars vaqtlari: ertalabki, kunduzgi va kechki guruhlar mavjud — aniq vaqt kurs, filial va mavjud guruhga qarab belgilanadi.
Kurs davomiyligi yo'nalish va dasturga qarab farq qiladi. Barcha fanlarda sinov darsi mavjud.
Ro'yxatdan o'tish: kurs, filial va qulay dars vaqti aniqlanadi, zarur bo'lsa daraja aniqlash testi o'tkaziladi, so'ng mos guruh tanlanadi.
Qo'shimcha imkoniyatlar: Speaking Club, turli eventlar, imtihonlar, sinov testlari, kutubxona, qo'shimcha darslar, amaliy mashg'ulotlar va turli ta'limiy tadbirlar — mavjudligi filial va kursga qarab farq qilishi mumkin.`;

interface BranchSpec {
  name: string;
  address: string;
  landmark?: string;
  workingHours: string;
  phoneNumber: string;
}

const BRANCHES: BranchSpec[] = [
  {
    name: 'Boburshox filiali',
    address: "Namangan shahri, Boburshox ko'chasi, 7-uy",
    landmark: 'Bolalar stomatologiyasi ro\'parasida',
    workingHours: '08:00–22:00',
    phoneNumber: '+998 99 695 55 50',
  },
  {
    name: 'Chorsu filiali',
    address: "Namangan shahri, Chorsu dahasi, O'zbegim gullari, 2-qavat",
    workingHours: '08:00–21:00',
    phoneNumber: '+998 99 909 55 50',
  },
  {
    name: 'Davlatobod filiali',
    address: 'Davlatobod tumani, 1-mikrorayon',
    landmark: 'Otchopar, Tegen Market 2-qavati',
    workingHours: '08:00–21:00',
    phoneNumber: '+998 99 511 55 50',
  },
];

function mapsSearchUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

async function main() {
  const account = await prisma.instagramAccount.findFirst({
    where: { isConnected: true },
    orderBy: { updatedAt: 'desc' },
  });
  if (!account) {
    throw new Error('Ulangan Instagram akkaunt topilmadi');
  }
  console.log(`Akkaunt: ${account.username} (${account.id})`);

  await prisma.academySettings.update({
    where: { instagramAccountId: account.id },
    data: { academyName: ACADEMY_NAME },
  });
  console.log(`Markaz nomi yangilandi: ${ACADEMY_NAME}`);

  for (const branch of BRANCHES) {
    const extraInfo = branch.landmark
      ? `Mo'ljal: ${branch.landmark}.\n\n${COMMON_BRANCH_EXTRA_INFO}`
      : COMMON_BRANCH_EXTRA_INFO;

    const createdBranch = await prisma.branchInfo.create({
      data: {
        instagramAccountId: account.id,
        name: branch.name,
        locationUrl: mapsSearchUrl(`${ACADEMY_NAME} ${branch.address}`),
        workingHours: branch.workingHours,
        phoneNumber: branch.phoneNumber,
        subjectNames: SUBJECT_NAMES_LIST,
        extraInfo,
        isActive: true,
      },
    });
    console.log(`Filial yaratildi: ${createdBranch.name} (${createdBranch.id})`);

    for (const subject of SUBJECTS) {
      const isDavlatobodArab = branch.name === 'Davlatobod filiali' && subject.name === 'Arab tili';

      await prisma.groupInfo.create({
        data: {
          instagramAccountId: account.id,
          branchId: createdBranch.id,
          subjectName: subject.name,
          price: isDavlatobodArab ? "Ma'lumot berilmaydi — operatorga yo'naltiriladi" : subject.price,
          details: isDavlatobodArab ? ARAB_TILI_DAVLATOBOD_OVERRIDE : subject.details,
          isActive: true,
        },
      });
    }
    console.log(`  -> ${SUBJECTS.length} ta guruh qo'shildi`);
  }

  await prisma.promotionInfo.create({
    data: {
      instagramAccountId: account.id,
      scope: 'ALL_BRANCHES',
      title: "2-3 fan bo'yicha chegirma",
      details:
        "2 yoki 3 ta fan bo'yicha bir vaqtda ta'lim oladigan o'quvchilarga chegirma berilishi mumkin. Chegirma miqdori holatga qarab markaz ma'muriyati tomonidan belgilanadi — faqat markaz tomonidan tasdiqlangan amaldagi aksiya shartlari qo'llaniladi, tasdiqlanmagan chegirma miqdori aytilmaydi.",
      isActive: true,
    },
  });
  console.log('Aksiya qo\'shildi: 2-3 fan bo\'yicha chegirma');
}

main()
  .then(() => console.log('Tugadi.'))
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
