import crypto from 'crypto';
import path from 'path';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import jwt, { SignOptions } from 'jsonwebtoken';
import multer from 'multer';
import { z } from 'zod';
import { env, isProduction } from '../config/env';
import { AppError } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { UPLOAD_DIR } from '../lib/uploads';
import { requireSuperAuth, SuperAuthenticatedRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validate';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => !isProduction,
  message: { error: 'Juda kop urinish. 15 daqiqadan keyin qayta urinib koring' },
});

const loginSchema = z.object({
  email: z.string().email('Email notogri'),
  password: z.string().min(1, 'Parol kiritilishi shart'),
});

router.post('/login', loginLimiter, validateBody(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body as z.infer<typeof loginSchema>;

    const superAdmin = await prisma.superAdmin.findUnique({ where: { email: email.toLowerCase() } });
    const passwordOk = superAdmin ? await bcrypt.compare(password, superAdmin.passwordHash) : false;
    if (!superAdmin || !passwordOk) {
      return res.status(401).json({ error: 'Email yoki parol notogri' });
    }

    const token = jwt.sign(
      { superAdminId: superAdmin.id, scope: 'super-admin' },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN } as SignOptions,
    );

    return res.json({ token, superAdmin: { id: superAdmin.id, email: superAdmin.email } });
  } catch (err) {
    return next(err);
  }
});

router.get('/me', requireSuperAuth, async (req: SuperAuthenticatedRequest, res, next) => {
  try {
    const superAdmin = await prisma.superAdmin.findUnique({
      where: { id: req.superAdminId },
      select: { id: true, email: true, createdAt: true },
    });
    if (!superAdmin) {
      return res.status(401).json({ error: 'Super-admin topilmadi' });
    }
    return res.json({ superAdmin });
  } catch (err) {
    return next(err);
  }
});

// Tayyor tariflar — narx faqat frontendda ko'rsatiladi (hozircha mock, haqiqiy tolov
// tizimi ulanmagan).
const PLAN_NAMES = ['Basic', 'Standart', 'Pro'] as const;

const subscriptionFields = {
  planName: z.enum(PLAN_NAMES).optional(),
  subscriptionStatus: z.enum(['ACTIVE', 'EXPIRED']).optional(),
};

const createOrganizationSchema = z.object({
  organizationName: z.string().trim().min(2, "Kompaniya nomi kamida 2 belgidan iborat bolishi kerak"),
  phone: z.string().trim().regex(/^\+998\d{9}$/, "Telefon raqam +998XXXXXXXXX korinishida bolishi kerak"),
  password: z.string().min(6, 'Parol kamida 6 belgidan iborat bolishi kerak'),
  ...subscriptionFields,
});

const updateSubscriptionSchema = z.object(subscriptionFields);

// Yangi mijoz uchun workspace + kirish ma'lumotlarini yaratadi. Faqat super-admin
// chaqira oladi — mijozning o'zi hech qachon ro'yxatdan ota olmaydi.
router.post(
  '/organizations',
  requireSuperAuth,
  validateBody(createOrganizationSchema),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof createOrganizationSchema>;

      const existing = await prisma.admin.findUnique({ where: { phone: body.phone } });
      if (existing) {
        return res.status(409).json({ error: 'Bu telefon raqam allaqachon ishlatilgan' });
      }

      const passwordHash = await bcrypt.hash(body.password, 12);

      const { organization, admin } = await prisma.$transaction(async (tx) => {
        const organization = await tx.organization.create({
          data: {
            name: body.organizationName,
            planName: body.planName ?? null,
            subscriptionStatus: body.subscriptionStatus ?? 'ACTIVE',
          },
        });
        const admin = await tx.admin.create({
          data: { organizationId: organization.id, phone: body.phone, passwordHash },
        });
        return { organization, admin };
      });

      return res.status(201).json({
        organization: {
          id: organization.id,
          name: organization.name,
          planName: organization.planName,
          subscriptionStatus: organization.subscriptionStatus,
        },
        admin: { id: admin.id, phone: admin.phone },
      });
    } catch (err) {
      return next(err);
    }
  },
);

// Mavjud kabinetning to'lov/obuna holatini yangilaydi (hozircha qo'lda — real to'lov
// tizimi ulanmagan).
router.patch(
  '/organizations/:id/subscription',
  requireSuperAuth,
  validateBody(updateSubscriptionSchema),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof updateSubscriptionSchema>;

      const organization = await prisma.organization.update({
        where: { id: req.params.id },
        data: {
          ...(body.planName !== undefined ? { planName: body.planName } : {}),
          ...(body.subscriptionStatus !== undefined ? { subscriptionStatus: body.subscriptionStatus } : {}),
        },
      });

      return res.json({
        organization: {
          id: organization.id,
          name: organization.name,
          planName: organization.planName,
          subscriptionStatus: organization.subscriptionStatus,
        },
      });
    } catch (err) {
      return next(err);
    }
  },
);

// Kabinetni butunlay ochiradi — Admin, InstagramAccount va shu bilan bogliq barcha
// ma'lumotlar (suhbatlar, bilim bazasi va h.k.) kaskad tarzda ochiriladi. Qaytarib
// bolmaydi.
router.delete('/organizations/:id', requireSuperAuth, async (req, res, next) => {
  try {
    await prisma.organization.delete({ where: { id: req.params.id } });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

// Yaratilgan kabinetlar ro'yxati — kimga qachon kabinet berilgani va Instagram
// akkaunt ulanganmi degan holatni ko'rish uchun.
router.get('/organizations', requireSuperAuth, async (_req, res, next) => {
  try {
    const organizations = await prisma.organization.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        admins: { select: { id: true, phone: true } },
        instagramAccounts: { select: { id: true, username: true, isConnected: true } },
      },
    });

    return res.json({
      organizations: organizations.map((org) => ({
        id: org.id,
        name: org.name,
        createdAt: org.createdAt,
        planName: org.planName,
        subscriptionStatus: org.subscriptionStatus,
        admins: org.admins,
        instagramAccounts: org.instagramAccounts,
      })),
    });
  } catch (err) {
    return next(err);
  }
});

const STATS_MONTHS_BACK = 12;

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

const MONTH_KEY_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

// Platforma darajasidagi umumiy korsatkichlar — nechta kabinet, nechtasi faol/muddati
// tugagan, nechtasi Instagram ulagan (hozirgi holat), va tanlangan oy bilan tugaydigan
// oxirgi 12 oy boyicha yangi kabinetlar soni.
router.get('/stats', requireSuperAuth, async (req, res, next) => {
  try {
    const rawMonth = typeof req.query.month === 'string' ? req.query.month : undefined;
    const selectedMonth = rawMonth && MONTH_KEY_RE.test(rawMonth) ? rawMonth : monthKeyFromDate(new Date());
    const [selYear, selMonthNum] = selectedMonth.split('-').map(Number);
    const monthEnd = new Date(selYear, selMonthNum, 1);

    const months = lastMonthKeys(STATS_MONTHS_BACK, new Date(selYear, selMonthNum - 1, 1));
    const trendWindowStart = new Date(selYear, selMonthNum - 1 - (STATS_MONTHS_BACK - 1), 1);

    const [
      totalOrganizations,
      activeSubscriptions,
      expiredSubscriptions,
      organizationsWithConnectedAccount,
      orgDates,
      planGroups,
    ] = await Promise.all([
      prisma.organization.count(),
      prisma.organization.count({ where: { subscriptionStatus: 'ACTIVE' } }),
      prisma.organization.count({ where: { subscriptionStatus: 'EXPIRED' } }),
      prisma.organization.count({ where: { instagramAccounts: { some: { isConnected: true } } } }),
      prisma.organization.findMany({
        where: { createdAt: { gte: trendWindowStart, lt: monthEnd } },
        select: { createdAt: true },
      }),
      prisma.organization.groupBy({ by: ['planName'], _count: { _all: true } }),
    ]);

    const newOrgsByMonth = new Map<string, number>();
    for (const org of orgDates) {
      const key = monthKeyFromDate(org.createdAt);
      newOrgsByMonth.set(key, (newOrgsByMonth.get(key) ?? 0) + 1);
    }
    const monthlyNewOrganizations = months.map((month) => ({ month, count: newOrgsByMonth.get(month) ?? 0 }));

    const planBreakdown = planGroups
      .filter((g) => g.planName)
      .map((g) => ({ planName: g.planName as string, count: g._count._all }));

    return res.json({
      selectedMonth,
      totals: {
        totalOrganizations,
        activeSubscriptions,
        expiredSubscriptions,
        connectedInstagramAccounts: organizationsWithConnectedAccount,
      },
      monthlyNewOrganizations,
      planBreakdown,
    });
  } catch (err) {
    return next(err);
  }
});

const ALLOWED_LOGO_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']);

const logoUpload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).slice(0, 10) || '';
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_LOGO_MIME.has(file.mimetype)) return cb(null, true);
    cb(new AppError('Faqat rasm (jpg/png/webp/svg) yuklash mumkin', 400));
  },
});

// Butun platforma logotipini o'zgartiradi (galereyadan tanlangan rasm) — faqat
// super-admin. Barcha login sahifalari va sidebarlarda shu logo ko'rsatiladi.
router.post('/logo', requireSuperAuth, logoUpload.single('file'), async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) throw new AppError('Fayl yuborilmadi', 400);
    if (!env.BACKEND_URL) {
      throw new AppError('BACKEND_URL sozlanmagan — fayl yuklash uchun .env da korsating', 500);
    }

    const logoUrl = `${env.BACKEND_URL.replace(/\/$/, '')}/uploads/${file.filename}`;
    await prisma.platformSettings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', logoUrl },
      update: { logoUrl },
    });

    return res.status(201).json({ logoUrl });
  } catch (err) {
    return next(err);
  }
});

export default router;
