import bcrypt from 'bcryptjs';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import jwt, { SignOptions } from 'jsonwebtoken';
import { z } from 'zod';
import { env, isProduction } from '../config/env';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  // TEMP (2026-08-21): dev paytida bloklanmaslik uchun vaqtincha ochirilgan.
  // Ish tugagach isProduction tekshiruvisiz qoldirmasdan qayta yoqish kerak.
  skip: () => !isProduction,
  message: { error: 'Juda kop urinish. 15 daqiqadan keyin qayta urinib koring' },
});

const loginSchema = z.object({
  email: z.string().email('Email notogri'),
  password: z.string().min(1, 'Parol kiritilishi shart'),
});

function signToken(admin: { id: string; organizationId: string }) {
  return jwt.sign({ adminId: admin.id, organizationId: admin.organizationId }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as SignOptions);
}

// Diqqat: o'z-o'zidan ro'yxatdan o'tish (public /register) YO'Q — yangi workspace/kabinet
// faqat super-admin panel orqali (POST /api/super-admin/organizations) yaratiladi.
router.post('/login', loginLimiter, validateBody(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body as z.infer<typeof loginSchema>;

    const admin = await prisma.admin.findUnique({ where: { email: email.toLowerCase() } });
    const passwordOk = admin ? await bcrypt.compare(password, admin.passwordHash) : false;
    if (!admin || !passwordOk) {
      return res.status(401).json({ error: 'Email yoki parol notogri' });
    }

    const token = signToken(admin);

    return res.json({
      token,
      admin: { id: admin.id, email: admin.email, organizationId: admin.organizationId },
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/me', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const admin = await prisma.admin.findUnique({
      where: { id: req.adminId },
      select: { id: true, email: true, createdAt: true, organizationId: true, organization: { select: { name: true } } },
    });
    if (!admin) {
      return res.status(401).json({ error: 'Admin topilmadi' });
    }
    return res.json({ admin });
  } catch (err) {
    return next(err);
  }
});

export default router;
