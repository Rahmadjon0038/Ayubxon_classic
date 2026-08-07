import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { getAccount } from '../services/accountService';

const router = Router();

router.use(requireAuth);

const settingsSchema = z.object({
  academyName: z.string().trim().min(1, "Markaz nomi majburiy").max(200),
  coursesAndPrices: z.string().trim().min(1, "Kurslar va narxlar majburiy").max(8000),
  address: z.string().trim().min(1, 'Manzil majburiy').max(2000),
  phoneNumbers: z.string().trim().min(1, 'Telefon raqami majburiy').max(300),
  promotions: z.string().trim().max(4000).optional().or(z.literal('')),
  aiEnabled: z.boolean().optional(),
});

// Joriy ulangan Instagram akkaunt uchun AI markaz sozlamalarini qaytaradi.
router.get('/', async (_req, res, next) => {
  try {
    const account = await getAccount();
    if (!account) {
      throw new AppError('Avval Instagram akkauntni ulang', 400);
    }

    const settings = await prisma.academySettings.findUnique({
      where: { instagramAccountId: account.id },
    });

    return res.json({ settings, aiEnabled: account.aiEnabled });
  } catch (err) {
    return next(err);
  }
});

// Sozlamalarni yaratadi yoki yangilaydi (upsert) va AI yoqish/ochirish holatini saqlaydi.
router.put('/', validateBody(settingsSchema), async (req, res, next) => {
  try {
    const account = await getAccount();
    if (!account) {
      throw new AppError('Avval Instagram akkauntni ulang', 400);
    }

    const body = req.body as z.infer<typeof settingsSchema>;
    const promotions = body.promotions ? body.promotions : null;

    const settings = await prisma.academySettings.upsert({
      where: { instagramAccountId: account.id },
      create: {
        instagramAccountId: account.id,
        academyName: body.academyName,
        coursesAndPrices: body.coursesAndPrices,
        address: body.address,
        phoneNumbers: body.phoneNumbers,
        promotions,
      },
      update: {
        academyName: body.academyName,
        coursesAndPrices: body.coursesAndPrices,
        address: body.address,
        phoneNumbers: body.phoneNumbers,
        promotions,
      },
    });

    let aiEnabled = account.aiEnabled;
    if (typeof body.aiEnabled === 'boolean' && body.aiEnabled !== account.aiEnabled) {
      const updated = await prisma.instagramAccount.update({
        where: { id: account.id },
        data: { aiEnabled: body.aiEnabled },
      });
      aiEnabled = updated.aiEnabled;
    }

    return res.json({ settings, aiEnabled });
  } catch (err) {
    return next(err);
  }
});

export default router;
