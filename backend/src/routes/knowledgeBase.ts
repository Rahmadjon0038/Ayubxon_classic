import { KnowledgeBaseCategory } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { getAccount } from '../services/accountService';

const router = Router();

router.use(requireAuth);

const categoryValues = Object.values(KnowledgeBaseCategory) as [KnowledgeBaseCategory, ...KnowledgeBaseCategory[]];

const itemSchema = z.object({
  title: z.string().trim().min(1, 'Nomi majburiy').max(200),
  category: z.enum(categoryValues),
  course: z.string().trim().max(200).optional().or(z.literal('')),
  branch: z.string().trim().max(200).optional().or(z.literal('')),
  details: z.string().trim().min(1, 'Batafsil ma’lumot majburiy').max(8000),
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

router.get('/', async (_req, res, next) => {
  try {
    const instagramAccountId = await resolveAccountId();
    const items = await prisma.knowledgeBaseItem.findMany({
      where: { instagramAccountId },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });

    return res.json({ items });
  } catch (err) {
    return next(err);
  }
});

router.post('/', validateBody(itemSchema), async (req, res, next) => {
  try {
    const instagramAccountId = await resolveAccountId();
    const body = req.body as z.infer<typeof itemSchema>;
    const item = await prisma.knowledgeBaseItem.create({
      data: {
        instagramAccountId,
        title: body.title,
        category: body.category,
        course: normalizeOptionalText(body.course),
        branch: normalizeOptionalText(body.branch),
        details: body.details,
        isActive: body.isActive,
      },
    });

    return res.status(201).json({ item });
  } catch (err) {
    return next(err);
  }
});

router.put('/:id', validateBody(itemSchema), async (req, res, next) => {
  try {
    const instagramAccountId = await resolveAccountId();
    const body = req.body as z.infer<typeof itemSchema>;
    const existing = await prisma.knowledgeBaseItem.findFirst({
      where: {
        id: req.params.id,
        instagramAccountId,
      },
    });

    if (!existing) {
      throw new AppError('Bilim topilmadi', 404);
    }

    const item = await prisma.knowledgeBaseItem.update({
      where: { id: existing.id },
      data: {
        title: body.title,
        category: body.category,
        course: normalizeOptionalText(body.course),
        branch: normalizeOptionalText(body.branch),
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
    const existing = await prisma.knowledgeBaseItem.findFirst({
      where: {
        id: req.params.id,
        instagramAccountId,
      },
      select: { id: true },
    });

    if (!existing) {
      throw new AppError('Bilim topilmadi', 404);
    }

    await prisma.knowledgeBaseItem.delete({
      where: { id: existing.id },
    });

    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

export default router;
