import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';

const router = Router();

router.use(requireAuth);

// Super-admin panelidagi tariflar bilan bir xil — hozircha qo'lda belgilangan
// (frontend/src/lib/plans.ts dagi PLAN_PRICES bilan mos bo'lishi kerak).
const PLAN_PRICES: Record<string, number> = {
  Basic: 150_000,
  Standart: 300_000,
  Pro: 500_000,
};

const MONTHS_BACK = 12;

function monthKeyFromDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function lastMonthKeys(count: number, end: Date): string[] {
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(end.getFullYear(), end.getMonth() - i, 1);
    keys.push(monthKeyFromDate(d));
  }
  return keys;
}

// Workspace ochilgan oydan keyingi oylar uchun ko'rsatiladi — undan oldingi oylar
// mavjud bo'lmagan.
function monthsSinceCreation(createdAt: Date, end: Date): string[] {
  const all = lastMonthKeys(MONTHS_BACK, end);
  const creationKey = monthKeyFromDate(createdAt);
  return all.filter((m) => m >= creationKey);
}

// Mijozning o'z oylik to'lovlari ro'yxati — hali to'lov qatori yaratilmagan oylar
// "UNPAID" deb hisoblanadi (joriy tarif narxi bilan).
router.get('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const organization = await prisma.organization.findUnique({ where: { id: req.organizationId! } });
    if (!organization) throw new AppError('Workspace topilmadi', 404);

    const now = new Date();
    const months = monthsSinceCreation(organization.createdAt, now);
    const currentMonth = monthKeyFromDate(now);
    const planPrice = organization.planName ? PLAN_PRICES[organization.planName] ?? null : null;

    const existing = await prisma.payment.findMany({
      where: { organizationId: organization.id, month: { in: months } },
    });
    const byMonth = new Map(existing.map((p) => [p.month, p]));

    const items = months.map((month) => {
      const row = byMonth.get(month);
      if (row) {
        return {
          month,
          amount: row.amount,
          status: row.status,
          method: row.method,
          paidAt: row.paidAt,
        };
      }
      return {
        month,
        amount: planPrice,
        status: 'UNPAID' as const,
        method: null,
        paidAt: null,
      };
    });

    return res.json({ items, currentMonth, planName: organization.planName });
  } catch (err) {
    return next(err);
  }
});

const paySchema = z.object({
  method: z.enum(['click', 'payme']),
});

// Berilgan oy uchun to'lovni "amalga oshiradi" (mock — haqiqiy Click/Payme ulanmagan,
// tugma bosilganda darhol PAID qilib belgilanadi).
router.post('/:month/pay', validateBody(paySchema), async (req: AuthenticatedRequest, res, next) => {
  try {
    const month = req.params.month;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      throw new AppError("Oy notogri formatda", 400);
    }

    const organization = await prisma.organization.findUnique({ where: { id: req.organizationId! } });
    if (!organization) throw new AppError('Workspace topilmadi', 404);
    if (!organization.planName) throw new AppError('Sizga hali tarif belgilanmagan', 400);

    const { method } = req.body as z.infer<typeof paySchema>;
    const amount = PLAN_PRICES[organization.planName] ?? 0;

    const payment = await prisma.payment.upsert({
      where: { organizationId_month: { organizationId: organization.id, month } },
      create: {
        organizationId: organization.id,
        month,
        amount,
        status: 'PAID',
        method,
        paidAt: new Date(),
      },
      update: {
        status: 'PAID',
        method,
        amount,
        paidAt: new Date(),
      },
    });

    return res.json({
      item: {
        month: payment.month,
        amount: payment.amount,
        status: payment.status,
        method: payment.method,
        paidAt: payment.paidAt,
      },
    });
  } catch (err) {
    return next(err);
  }
});

export default router;
