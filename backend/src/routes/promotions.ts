import { PromotionScope } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { getAccount } from '../services/accountService';

const router = Router();

router.use(requireAuth);

const promotionSchema = z
  .object({
    scope: z.enum(['ALL_BRANCHES', 'BRANCH']),
    branchId: z.string().trim().optional().or(z.literal('')),
    title: z.string().trim().min(1, 'Sarlavha majburiy').max(200),
    details: z.string().trim().min(1, 'Batafsil ma\'lumot majburiy').max(8000),
    isActive: z.boolean().default(true),
  })
  .superRefine((value, ctx) => {
    if (value.scope === 'BRANCH' && !value.branchId?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['branchId'],
        message: 'Filial tanlash majburiy',
      });
    }
  });

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
    const items = await prisma.promotionInfo.findMany({
      where: { instagramAccountId },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });

    return res.json({ items });
  } catch (err) {
    return next(err);
  }
});

router.post('/', validateBody(promotionSchema), async (req, res, next) => {
  try {
    const instagramAccountId = await resolveAccountId();
    const body = req.body as z.infer<typeof promotionSchema>;
    const branchId = body.scope === 'BRANCH' ? body.branchId?.trim() || null : null;

    if (branchId) {
      await ensureBranch(branchId, instagramAccountId);
    }

    const item = await prisma.promotionInfo.create({
      data: {
        instagramAccountId,
        scope: body.scope as PromotionScope,
        branchId,
        title: body.title,
        details: body.details,
        isActive: body.isActive,
      },
    });

    return res.status(201).json({ item });
  } catch (err) {
    return next(err);
  }
});

router.put('/:id', validateBody(promotionSchema), async (req, res, next) => {
  try {
    const instagramAccountId = await resolveAccountId();
    const body = req.body as z.infer<typeof promotionSchema>;
    const existing = await prisma.promotionInfo.findFirst({
      where: { id: req.params.id, instagramAccountId },
      select: { id: true },
    });

    if (!existing) {
      throw new AppError('Aksiya topilmadi', 404);
    }

    const branchId = body.scope === 'BRANCH' ? body.branchId?.trim() || null : null;
    if (branchId) {
      await ensureBranch(branchId, instagramAccountId);
    }

    const item = await prisma.promotionInfo.update({
      where: { id: existing.id },
      data: {
        scope: body.scope as PromotionScope,
        branchId,
        title: body.title,
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
    const existing = await prisma.promotionInfo.findFirst({
      where: { id: req.params.id, instagramAccountId },
      select: { id: true },
    });

    if (!existing) {
      throw new AppError('Aksiya topilmadi', 404);
    }

    await prisma.promotionInfo.delete({ where: { id: existing.id } });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

export default router;
