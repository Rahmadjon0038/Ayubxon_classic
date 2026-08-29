import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { downloadContactAvatar } from '../lib/avatar';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { getAccessToken, getAccount, getConnectedAccount } from '../services/accountService';
import { fetchInstagramOEmbed } from '../services/instagramApi';

const router = Router();

router.use(requireAuth);

const groupSchema = z.object({
  branchId: z.string().trim().min(1, 'Filial tanlash majburiy'),
  videoUrl: z.string().trim().url('Haqiqiy link kiriting').max(500).optional().or(z.literal('')),
  details: z.string().trim().min(1, 'Mahsulot ma\'lumoti majburiy').max(8000),
  isActive: z.boolean().default(true),
});

function normalizeOptionalText(value?: string | null): string | null {
  const text = value?.trim();
  return text ? text : null;
}

async function resolveAccountId(): Promise<string> {
  const account = await getAccount();
  if (!account) {
    throw new AppError('Avval Instagram akkauntni ulang', 400);
  }
  return account.id;
}

// Admin qo'ygan Instagram video linkidan preview rasm oladi (platforma ichida ko'rsatish
// uchun — adminga Instagram'ga chiqmasdan mahsulot videosini tanib olishga yordam beradi).
// Token yo'q yoki oEmbed muvaffaqiyatsiz bo'lsa jim null qaytadi — mahsulotni saqlashga
// to'sqinlik qilmaydi, faqat preview bo'lmaydi.
async function resolveVideoThumbnail(videoUrl: string | null): Promise<string | null> {
  if (!videoUrl) return null;

  const account = await getConnectedAccount();
  if (!account) return null;

  const oembed = await fetchInstagramOEmbed(getAccessToken(account), videoUrl);
  if (!oembed?.thumbnailUrl) return null;

  return downloadContactAvatar(oembed.thumbnailUrl);
}

async function ensureBranch(branchId: string, instagramAccountId: string) {
  const branch = await prisma.branchInfo.findFirst({
    where: { id: branchId, instagramAccountId },
    select: { id: true },
  });
  if (!branch) {
    throw new AppError('Filial topilmadi', 404);
  }
}

router.get('/', async (_req, res, next) => {
  try {
    const instagramAccountId = await resolveAccountId();
    const items = await prisma.groupInfo.findMany({
      where: { instagramAccountId },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });

    return res.json({ items });
  } catch (err) {
    return next(err);
  }
});

router.post('/', validateBody(groupSchema), async (req, res, next) => {
  try {
    const instagramAccountId = await resolveAccountId();
    const body = req.body as z.infer<typeof groupSchema>;
    await ensureBranch(body.branchId, instagramAccountId);

    const videoUrl = normalizeOptionalText(body.videoUrl);
    const item = await prisma.groupInfo.create({
      data: {
        instagramAccountId,
        branchId: body.branchId,
        videoUrl,
        videoThumbnailUrl: await resolveVideoThumbnail(videoUrl),
        details: body.details,
        isActive: body.isActive,
      },
    });

    return res.status(201).json({ item });
  } catch (err) {
    return next(err);
  }
});

router.put('/:id', validateBody(groupSchema), async (req, res, next) => {
  try {
    const instagramAccountId = await resolveAccountId();
    const body = req.body as z.infer<typeof groupSchema>;
    const existing = await prisma.groupInfo.findFirst({
      where: { id: req.params.id, instagramAccountId },
      select: { id: true },
    });

    if (!existing) {
      throw new AppError('Guruh topilmadi', 404);
    }

    await ensureBranch(body.branchId, instagramAccountId);

    const videoUrl = normalizeOptionalText(body.videoUrl);
    const item = await prisma.groupInfo.update({
      where: { id: existing.id },
      data: {
        branchId: body.branchId,
        videoUrl,
        videoThumbnailUrl: await resolveVideoThumbnail(videoUrl),
        details: body.details,
        isActive: body.isActive,
      },
    });

    return res.json({ item });
  } catch (err) {
    return next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const instagramAccountId = await resolveAccountId();
    const existing = await prisma.groupInfo.findFirst({
      where: { id: req.params.id, instagramAccountId },
      select: { id: true },
    });

    if (!existing) {
      throw new AppError('Guruh topilmadi', 404);
    }

    await prisma.groupInfo.delete({ where: { id: existing.id } });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

export default router;
