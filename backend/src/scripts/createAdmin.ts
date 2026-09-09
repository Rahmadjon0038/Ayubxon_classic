import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

// Ishlatish:
//   npm run create-admin -- admin@example.com StrongPassword123 "Kompaniya nomi"
// yoki ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_ORG_NAME environment variablelari orqali.
// Admin allaqachon mavjud bo'lsa faqat paroli yangilanadi (organization o'zgarmaydi).
async function main() {
  const email = process.argv[2] || process.env.ADMIN_EMAIL;
  const password = process.argv[3] || process.env.ADMIN_PASSWORD;
  const organizationName = process.argv[4] || process.env.ADMIN_ORG_NAME || 'Default workspace';

  const schema = z.object({
    email: z.string().email('Email notogri'),
    password: z.string().min(8, 'Parol kamida 8 belgi bolishi kerak'),
    organizationName: z.string().min(2, 'Kompaniya nomi kamida 2 belgi bolishi kerak'),
  });

  const parsed = schema.safeParse({ email, password, organizationName });
  if (!parsed.success) {
    console.error('Xato:');
    for (const issue of parsed.error.issues) {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
    console.error('\nIshlatish: npm run create-admin -- <email> <parol> [kompaniya nomi]');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const normalizedEmail = parsed.data.email.toLowerCase();

  const existing = await prisma.admin.findUnique({ where: { email: normalizedEmail } });
  const admin = existing
    ? await prisma.admin.update({ where: { id: existing.id }, data: { passwordHash } })
    : await prisma.admin.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          organization: { create: { name: parsed.data.organizationName } },
        },
      });

  console.log(`Admin tayyor: ${admin.email} (id: ${admin.id}, organizationId: ${admin.organizationId})`);
}

main()
  .catch((err) => {
    console.error('Admin yaratishda xato:', err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
