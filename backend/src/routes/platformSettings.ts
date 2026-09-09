import { Router } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

// Public — login sahifalari va sidebarlar (hali autentifikatsiyadan o'tmagan holatda ham)
// platforma logotipini shu orqali oladi.
router.get('/', async (_req, res, next) => {
  try {
    const settings = await prisma.platformSettings.findUnique({ where: { id: 'singleton' } });
    return res.json({ logoUrl: settings?.logoUrl ?? null });
  } catch (err) {
    return next(err);
  }
});

export default router;
