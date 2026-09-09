import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

// Ishlatish:
//   npm run create-super-admin -- owner@example.com StrongPassword123
// yoki SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD environment variablelari orqali.
// Mavjud bo'lsa faqat paroli yangilanadi.
async function main() {
  const email = process.argv[2] || process.env.SUPER_ADMIN_EMAIL;
  const password = process.argv[3] || process.env.SUPER_ADMIN_PASSWORD;

  const schema = z.object({
    email: z.string().email('Email notogri'),
    password: z.string().min(8, 'Parol kamida 8 belgi bolishi kerak'),
  });

  const parsed = schema.safeParse({ email, password });
  if (!parsed.success) {
    console.error('Xato:');
    for (const issue of parsed.error.issues) {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
    console.error('\nIshlatish: npm run create-super-admin -- <email> <parol>');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const superAdmin = await prisma.superAdmin.upsert({
    where: { email: parsed.data.email.toLowerCase() },
    create: { email: parsed.data.email.toLowerCase(), passwordHash },
    update: { passwordHash },
  });

  console.log(`Super-admin tayyor: ${superAdmin.email} (id: ${superAdmin.id})`);
}

main()
  .catch((err) => {
    console.error('Super-admin yaratishda xato:', err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
