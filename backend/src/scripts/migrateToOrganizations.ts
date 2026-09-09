import { randomUUID } from 'crypto';
import { prisma } from '../lib/prisma';

// Bir martalik ko'chirish skripti: eski single-tenant bazada Admin/InstagramAccount
// jadvallarida organizationId ustuni yo'q edi. `prisma db push` bo'sh bo'lmagan
// jadvalga NOT NULL (default'siz) ustun qo'sha olmaydi, shu sabab bu skript `db push`dan
// OLDIN ishga tushiriladi: Organization jadvalini (agar yo'q bo'lsa) yaratadi, bitta
// "Default workspace" hosil qiladi va mavjud Admin/InstagramAccount qatorlarini shunga
// bog'laydi. Idempotent — organizationId ustuni allaqachon bor bo'lsa (yoki bo'sh bazada)
// hech narsa qilmaydi.
async function main() {
  const adminHasColumn = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_name = 'Admin' AND column_name = 'organizationId'
     ) AS exists`,
  );
  if (adminHasColumn[0]?.exists) {
    console.log('[migrate] organizationId ustuni allaqachon mavjud — otkazib yuborildi.');
    return;
  }

  const adminTableExists = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Admin') AS exists`,
  );
  if (!adminTableExists[0]?.exists) {
    console.log('[migrate] Admin jadvali hali yoq (yangi baza) — otkazib yuborildi.');
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
