import crypto from 'crypto';
import path from 'path';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { env } from '../config/env';
import { AppError } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { UPLOAD_DIR } from '../lib/uploads';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { getAccount } from '../services/accountService';

const router = Router();

router.use(requireAuth);

const MAX_PHOTOS = 2;

const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

const photoUpload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).slice(0, 10) || '';
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_IMAGE_MIME.has(file.mimetype)) return cb(null, true);
    cb(new AppError('Faqat rasm (jpg/png/webp) yuklash mumkin', 400));
  },
});

const branchSchema = z.object({
  name: z.string().trim().min(1, 'Nomi majburiy').max(200),
  locationUrl: z.string().trim().url('Haqiqiy link kiriting').max(500),
  workingHours: z.string().trim().min(1, 'Ish vaqti majburiy').max(500),
  phoneNumber: z.string().trim().min(1, 'Telefon raqami majburiy').max(100),
  description: z.string().trim().min(1, "Do'kon haqida ma'lumot majburiy").max(4000),
  photoUrls: z.array(z.string().trim().url()).max(MAX_PHOTOS, `Ko'pi bilan ${MAX_PHOTOS} ta rasm`).default([]),
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

// Do'kon rasmini yuklaydi va public URL qaytaradi — bu URL branch create/update
// so'rovidagi photoUrls massiviga qo'shiladi (yaratilayotgan yozuv hali ID'ga ega
// bo'lmasligi mumkinligi uchun yuklash alohida, ID'ga bog'lanmagan endpoint).
router.post('/upload-photo', photoUpload.single('file'), async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) throw new AppError('Fayl yuborilmadi', 400);
    if (!env.BACKEND_URL) {
      throw new AppError('BACKEND_URL sozlanmagan — fayl yuklash uchun .env da korsating', 500);
    }

    const url = `${env.BACKEND_URL.replace(/\/$/, '')}/uploads/${file.filename}`;
    return res.status(201).json({ url });
  } catch (err) {
    return next(err);
  }
});

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
        description: body.description,
        photoUrls: body.photoUrls,
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
        description: body.description,
        photoUrls: body.photoUrls,
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
