import { downloadContactAvatar, isLocalUploadUrl } from '../lib/avatar';
import { prisma } from '../lib/prisma';
import { getAccessToken, getConnectedAccount } from '../services/accountService';
import { fetchContactProfile } from '../services/instagramApi';

// Instagram'ning profil rasm havolasi vaqtinchalik bolgani uchun, ilgari saqlangan
// kontakt rasmlari muddati tugab, korinmay qolgan bolishi mumkin. Bu skript barcha
// kontaktlarning rasmini qayta olib, ozimizga (/uploads) doimiy saqlaydi.
// Ishlatish: npm run backfill-avatars
async function main() {
  const account = await getConnectedAccount();
  if (!account) {
    console.error("Ulangan Instagram akkaunt topilmadi — avval akkauntni ulang.");
    process.exit(1);
  }
  const accessToken = getAccessToken(account);

  const contacts = await prisma.contact.findMany();
  console.log(`${contacts.length} ta kontakt topildi.`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const contact of contacts) {
    if (isLocalUploadUrl(contact.profilePictureUrl)) {
      skipped++;
      continue;
    }

    try {
      const profile = await fetchContactProfile(accessToken, contact.instagramScopedId);
      const localAvatarUrl = profile?.profilePictureUrl
        ? await downloadContactAvatar(profile.profilePictureUrl)
        : null;

      if (!localAvatarUrl) {
        failed++;
        continue;
      }

      await prisma.contact.update({
        where: { id: contact.id },
        data: {
          profilePictureUrl: localAvatarUrl,
          name: profile?.name ?? contact.name,
          username: profile?.username ?? contact.username,
        },
      });
      updated++;
      console.log(`  yangilandi: ${contact.username ?? contact.instagramScopedId}`);
    } catch (err) {
      failed++;
      console.warn(`  xato (${contact.instagramScopedId}):`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`Tayyor. Yangilandi: ${updated}, otkazib yuborildi: ${skipped}, xato: ${failed}`);
}

main()
  .catch((err) => {
    console.error('Backfill xatosi:', err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
