import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { getAccount } from '../services/accountService';

const router = Router();

router.use(requireAuth);

const branchSchema = z.object({
  name: z.string().trim().min(1, 'Nomi majburiy').max(200),
  locationUrl: z.string().trim().url('Haqiqiy link kiriting').max(500),
  workingHours: z.string().trim().min(1, 'Ish vaqti majburiy').max(500),
  phoneNumber: z.string().trim().min(1, 'Telefon raqami majburiy').max(100),
  subjectNames: z.string().trim().min(1, 'Fan yo\'nalishlari majburiy').max(4000),
  extraInfo: z.string().trim().max(8000).optional().or(z.literal('')),
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
    const items = await prisma.branchInfo.findMany({
      where: { instagramAccountId },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });

    return res.json({ items });
  } catch (err) {
    return next(err);
  }
});

router.post('/', validateBody(branchSchema), async (req, res, next) => {
  try {
    const instagramAccountId = await resolveAccountId();
    const body = req.body as z.infer<typeof branchSchema>;
    const item = await prisma.branchInfo.create({
      data: {
        instagramAccountId,
        name: body.name,
        locationUrl: body.locationUrl,
        workingHours: body.workingHours,
        phoneNumber: body.phoneNumber,
        subjectNames: body.subjectNames,
        extraInfo: normalizeOptionalText(body.extraInfo),
        isActive: body.isActive,
      },
    });

    return res.status(201).json({ item });
  } catch (err) {
    return next(err);
  }
});

router.put('/:id', validateBody(branchSchema), async (req, res, next) => {
  try {
    const instagramAccountId = await resolveAccountId();
    const body = req.body as z.infer<typeof branchSchema>;
    const existing = await prisma.branchInfo.findFirst({
      where: { id: req.params.id, instagramAccountId },
      select: { id: true },
    });

    if (!existing) {
      throw new AppError('Filial topilmadi', 404);
    }

    const item = await prisma.branchInfo.update({
      where: { id: existing.id },
      data: {
        name: body.name,
        locationUrl: body.locationUrl,
        workingHours: body.workingHours,
        phoneNumber: body.phoneNumber,
        subjectNames: body.subjectNames,
        extraInfo: normalizeOptionalText(body.extraInfo),
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
    const existing = await prisma.branchInfo.findFirst({
      where: { id: req.params.id, instagramAccountId },
      select: { id: true },
    });

    if (!existing) {
      throw new AppError('Filial topilmadi', 404);
    }

    await prisma.branchInfo.delete({ where: { id: existing.id } });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

export default router;
