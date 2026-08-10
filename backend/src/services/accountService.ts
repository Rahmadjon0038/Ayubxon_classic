import { InstagramAccount } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { decryptToken } from '../lib/crypto';
import { AppError } from '../lib/errors';

// MVP: bir vaqtning ozida faqat bitta Instagram akkaunt "ulangan" (isConnected=true)
// holatda boladi. Dashboard shu ulangan akkauntni korsatadi; ulangani bolmasa,
// oxirgi murojaat qilingan akkaunt (masalan hozirgina uzilgan) korsatiladi.
export async function getAccount(): Promise<InstagramAccount | null> {
  const connected = await prisma.instagramAccount.findFirst({
    where: { isConnected: true },
    orderBy: { updatedAt: 'desc' },
  });
  if (connected) return connected;
  return prisma.instagramAccount.findFirst({ orderBy: { updatedAt: 'desc' } });
}

export async function getConnectedAccount(): Promise<InstagramAccount | null> {
  const account = await getAccount();
  if (!account || !account.isConnected || !account.encryptedAccessToken) return null;
  return account;
}

// Webhook payloadidagi haqiqiy Instagram biznes akkaunt ID (entry.id) orqali topadi.
// Hozircha bitta akkaunt bo'lsa ham, bir nechta akkaunt qo'shilganda shu funksiya
// har bir akkauntni to'g'ri ajratib beradi.
export async function getConnectedAccountByInstagramId(
  instagramAccountId: string,
): Promise<InstagramAccount | null> {
  const account = await prisma.instagramAccount.findUnique({ where: { instagramAccountId } });
  if (!account || !account.isConnected || !account.encryptedAccessToken) return null;
  return account;
}

export function getAccessToken(account: InstagramAccount): string {
  if (!account.encryptedAccessToken) {
    throw new AppError('Instagram akkaunt uchun access token saqlanmagan', 400);
  }
  return decryptToken(account.encryptedAccessToken);
}

// Frontendga qaytariladigan xavfsiz korinish — token hech qachon qaytarilmaydi.
export function toPublicAccount(account: InstagramAccount) {
  return {
    id: account.id,
    instagramAccountId: account.instagramAccountId,
    username: account.username,
    name: account.name,
    profilePictureUrl: account.profilePictureUrl,
    accountType: account.accountType,
    isConnected: account.isConnected,
    hasToken: Boolean(account.encryptedAccessToken),
    tokenExpiresAt: account.tokenExpiresAt,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}
