import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

// Ishlatish:
//   npm run create-admin -- +998901234567 StrongPassword123 "Kompaniya nomi"
// yoki ADMIN_PHONE / ADMIN_PASSWORD / ADMIN_ORG_NAME environment variablelari orqali.
// Admin allaqachon mavjud bo'lsa faqat paroli yangilanadi (organization o'zgarmaydi).
// Diqqat: odatda yangi kabinetlar endi super-admin panel (/super-admin) orqali
// yaratiladi — bu skript qo'lda CLI orqali yaratish kerak bo'lganda ishlatiladi.
async function main() {
  const phone = process.argv[2] || process.env.ADMIN_PHONE;
  const password = process.argv[3] || process.env.ADMIN_PASSWORD;
  const organizationName = process.argv[4] || process.env.ADMIN_ORG_NAME || 'Default workspace';

  const schema = z.object({
    phone: z.string().trim().min(7, 'Telefon raqam notogri'),
    password: z.string().min(8, 'Parol kamida 8 belgi bolishi kerak'),
    organizationName: z.string().min(2, 'Kompaniya nomi kamida 2 belgi bolishi kerak'),
  });

  const parsed = schema.safeParse({ phone, password, organizationName });
  if (!parsed.success) {
    console.error('Xato:');
    for (const issue of parsed.error.issues) {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
    console.error('\nIshlatish: npm run create-admin -- <telefon> <parol> [kompaniya nomi]');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  const existing = await prisma.admin.findUnique({ where: { phone: parsed.data.phone } });
  const admin = existing
    ? await prisma.admin.update({ where: { id: existing.id }, data: { passwordHash } })
    : await prisma.admin.create({
        data: {
          phone: parsed.data.phone,
          passwordHash,
          organization: { create: { name: parsed.data.organizationName } },
        },
      });

  console.log(`Admin tayyor: ${admin.phone} (id: ${admin.id}, organizationId: ${admin.organizationId})`);
}

main()
  .catch((err) => {
    console.error('Admin yaratishda xato:', err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
