import { randomUUID } from 'crypto';
import { prisma } from '../lib/prisma';

// Bir martalik ko'chirish skripti: eski single-tenant bazada Admin/InstagramAccount
// jadvallarida organizationId ustuni yo'q edi. `prisma db push` bo'sh bo'lmagan
// jadvalga NOT NULL (default'siz) ustun qo'sha olmaydi, shu sabab bu skript `db push`dan
// OLDIN ishga tushiriladi: Organization jadvalini (agar yo'q bo'lsa) yaratadi, bitta
// "Default workspace" hosil qiladi va mavjud Admin/InstagramAccount qatorlarini shunga
// bog'laydi. Idempotent — organizationId ustuni allaqachon bor bo'lsa (yoki bo'sh bazada)
// hech narsa qilmaydi.
async function columnExists(table: string, column: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_name = $1 AND column_name = $2
     ) AS exists`,
    table,
    column,
  );
  return Boolean(rows[0]?.exists);
}

async function main() {
  const adminTableExists = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Admin') AS exists`,
  );
  if (!adminTableExists[0]?.exists) {
    console.log('[migrate] Admin jadvali hali yoq (yangi baza) — otkazib yuborildi.');
    return;
  }

  // Admin.email -> Admin.phone: login endi telefon raqami orqali. Eski qatorlarda
  // phone bo'lmasa, vaqtincha eski email qiymati bilan toldiramiz (mijoz keyin
  // super-admindan haqiqiy raqamini yangilatishi mumkin) — shunda ustunni NOT NULL
  // qilishda mavjud qatorlar uchun xato chiqmaydi.
  const hasEmailColumn = await columnExists('Admin', 'email');
  const hasPhoneColumn = await columnExists('Admin', 'phone');
  if (hasEmailColumn && !hasPhoneColumn) {
    console.log('[migrate] Admin.email -> Admin.phone kochirilmoqda...');
    await prisma.$executeRawUnsafe(`ALTER TABLE "Admin" ADD COLUMN IF NOT EXISTS "phone" TEXT`);
    await prisma.$executeRawUnsafe(`UPDATE "Admin" SET "phone" = "email" WHERE "phone" IS NULL`);
  }

  const adminHasColumn = await columnExists('Admin', 'organizationId');
  if (adminHasColumn) {
    console.log('[migrate] organizationId ustuni allaqachon mavjud — otkazib yuborildi.');
    return;
  }

  console.log('[migrate] Eski single-tenant baza aniqlandi — Organization qatlamiga kochirilmoqda...');

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Organization" (
      "id" TEXT PRIMARY KEY,
      "name" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const orgId = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "Organization" ("id", "name") VALUES ($1, $2)`,
    orgId,
    'Default workspace',
  );

  await prisma.$executeRawUnsafe(`ALTER TABLE "Admin" ADD COLUMN IF NOT EXISTS "organizationId" TEXT`);
  await prisma.$executeRawUnsafe(`UPDATE "Admin" SET "organizationId" = $1 WHERE "organizationId" IS NULL`, orgId);

  await prisma.$executeRawUnsafe(
    `ALTER TABLE "InstagramAccount" ADD COLUMN IF NOT EXISTS "organizationId" TEXT`,
  );
  await prisma.$executeRawUnsafe(
    `UPDATE "InstagramAccount" SET "organizationId" = $1 WHERE "organizationId" IS NULL`,
    orgId,
  );

  console.log(`[migrate] Tayyor. Barcha mavjud admin/Instagram akkauntlar "Default workspace" (${orgId}) ga bog'landi.`);
}

main()
  .catch((err) => {
    console.error('[migrate] Xato:', err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
