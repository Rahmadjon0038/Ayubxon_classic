import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { getAccount } from '../services/accountService';

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

    const item = await prisma.groupInfo.create({
      data: {
        instagramAccountId,
        branchId: body.branchId,
        videoUrl: normalizeOptionalText(body.videoUrl),
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

    const item = await prisma.groupInfo.update({
      where: { id: existing.id },
      data: {
        branchId: body.branchId,
        videoUrl: normalizeOptionalText(body.videoUrl),
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
