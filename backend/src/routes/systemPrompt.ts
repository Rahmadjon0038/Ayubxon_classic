import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';

const router = Router();

router.use(requireAuth);

// Mijoz o'z workspace'ining AI system promptini o'qiydi (kategoriyadan nusxalangan
// bo'lishi yoki o'zi tahrirlagan bo'lishi mumkin).
router.get('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const organization = await prisma.organization.findUnique({
      where: { id: req.organizationId! },
      select: { systemPrompt: true, category: { select: { id: true, name: true } } },
    });
    return res.json({ systemPrompt: organization?.systemPrompt ?? '', category: organization?.category ?? null });
  } catch (err) {
    return next(err);
  }
});

const updateSchema = z.object({
  systemPrompt: z.string().trim().max(20000),
});

router.put('/', validateBody(updateSchema), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { systemPrompt } = req.body as z.infer<typeof updateSchema>;
    const organization = await prisma.organization.update({
      where: { id: req.organizationId! },
      data: { systemPrompt: systemPrompt || null },
    });
    return res.json({ systemPrompt: organization.systemPrompt ?? '' });
  } catch (err) {
    return next(err);
  }
});

export default router;
