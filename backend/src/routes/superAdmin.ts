import bcrypt from 'bcryptjs';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import jwt, { SignOptions } from 'jsonwebtoken';
import { z } from 'zod';
import { env, isProduction } from '../config/env';
import { prisma } from '../lib/prisma';
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

const createOrganizationSchema = z.object({
  organizationName: z.string().trim().min(2, "Kompaniya nomi kamida 2 belgidan iborat bolishi kerak"),
  email: z.string().email('Email notogri'),
  password: z.string().min(8, 'Parol kamida 8 belgidan iborat bolishi kerak'),
});

// Yangi mijoz uchun workspace + kirish ma'lumotlarini yaratadi. Faqat super-admin
// chaqira oladi — mijozning o'zi hech qachon ro'yxatdan ota olmaydi.
router.post(
  '/organizations',
  requireSuperAuth,
  validateBody(createOrganizationSchema),
  async (req, res, next) => {
    try {
      const { organizationName, email, password } = req.body as z.infer<typeof createOrganizationSchema>;
      const normalizedEmail = email.toLowerCase();

      const existing = await prisma.admin.findUnique({ where: { email: normalizedEmail } });
      if (existing) {
        return res.status(409).json({ error: 'Bu email allaqachon ishlatilgan' });
      }

      const passwordHash = await bcrypt.hash(password, 12);

      const { organization, admin } = await prisma.$transaction(async (tx) => {
        const organization = await tx.organization.create({ data: { name: organizationName } });
        const admin = await tx.admin.create({
          data: { organizationId: organization.id, email: normalizedEmail, passwordHash },
        });
        return { organization, admin };
      });

      return res.status(201).json({
        organization: { id: organization.id, name: organization.name },
        admin: { id: admin.id, email: admin.email },
      });
    } catch (err) {
      return next(err);
    }
  },
);

// Yaratilgan kabinetlar ro'yxati — kimga qachon kabinet berilgani va Instagram
// akkaunt ulanganmi degan holatni ko'rish uchun.
router.get('/organizations', requireSuperAuth, async (_req, res, next) => {
  try {
    const organizations = await prisma.organization.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        admins: { select: { id: true, email: true } },
        instagramAccounts: { select: { id: true, username: true, isConnected: true } },
      },
    });

    return res.json({
      organizations: organizations.map((org) => ({
        id: org.id,
        name: org.name,
        createdAt: org.createdAt,
        admins: org.admins,
        instagramAccounts: org.instagramAccounts,
      })),
    });
  } catch (err) {
    return next(err);
  }
});

export default router;
