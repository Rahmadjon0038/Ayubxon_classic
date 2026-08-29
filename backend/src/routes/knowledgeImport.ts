import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { getAccount } from '../services/accountService';

const router = Router();

router.use(requireAuth);

const branchImportSchema = z.object({
  name: z.string().trim().min(1, 'Nomi majburiy').max(200),
  locationUrl: z.string().trim().url('Haqiqiy link kiriting').max(500),
  workingHours: z.string().trim().min(1, 'Ish vaqti majburiy').max(500),
  phoneNumber: z.string().trim().min(1, 'Telefon raqami majburiy').max(100),
  description: z.string().trim().min(1, "Do'kon haqida ma'lumot majburiy").max(4000),
  photoUrls: z.array(z.string().trim().url()).max(2).optional().default([]),
  extraInfo: z.string().trim().max(8000).optional().or(z.literal('')),
  isActive: z.boolean().optional().default(true),
});

const groupImportSchema = z.object({
  branchName: z.string().trim().min(1, 'branchName majburiy'),
  videoUrl: z.string().trim().url('Haqiqiy link kiriting').max(500).optional().or(z.literal('')),
  details: z.string().trim().min(1, "Mahsulot ma'lumoti majburiy").max(8000),
  isActive: z.boolean().optional().default(true),
});

const importSchema = z.object({
  academyName: z.string().trim().min(1).max(200).optional(),
  branches: z.array(branchImportSchema).max(200).optional().default([]),
  groups: z.array(groupImportSchema).max(2000).optional().default([]),
});

function normalizeOptionalText(value?: string | null): string | null {
  const text = value?.trim();
  return text ? text : null;
}

router.post('/', validateBody(importSchema), async (req, res, next) => {
  try {
    const account = await getAccount();
    if (!account) {
      throw new AppError('Avval Instagram akkauntni ulang', 400);
    }
    const instagramAccountId = account.id;
    const body = req.body as z.infer<typeof importSchema>;

    const result = {
      academyNameUpdated: false,
      branches: { created: 0, updated: 0 },
      groups: { created: 0, updated: 0, skipped: [] as string[] },
    };

    if (body.academyName) {
      await prisma.academySettings.updateMany({
        where: { instagramAccountId },
        data: { academyName: body.academyName },
      });
      result.academyNameUpdated = true;
    }

    // Do'kon nomi -> id xaritasi. Avval bazadagi mavjud do'konlar bilan boshlanadi,
    // shu import davomida yaratilgan/yangilangan do'konlar ustiga qo'shiladi.
    const existingBranches = await prisma.branchInfo.findMany({
      where: { instagramAccountId },
      select: { id: true, name: true },
    });
    const branchIdByName = new Map(existingBranches.map((b) => [b.name.trim().toLowerCase(), b.id]));

    for (const branch of body.branches) {
      const key = branch.name.trim().toLowerCase();
      const existingId = branchIdByName.get(key);
      const data = {
        name: branch.name,
        locationUrl: branch.locationUrl,
        workingHours: branch.workingHours,
        phoneNumber: branch.phoneNumber,
        description: branch.description,
        photoUrls: branch.photoUrls,
        extraInfo: normalizeOptionalText(branch.extraInfo),
        isActive: branch.isActive,
      };

      if (existingId) {
        await prisma.branchInfo.update({ where: { id: existingId }, data });
        result.branches.updated += 1;
      } else {
        const created = await prisma.branchInfo.create({ data: { instagramAccountId, ...data } });
        branchIdByName.set(key, created.id);
        result.branches.created += 1;
      }
    }

    // Mahsulotlarda endi alohida "nomi" maydoni yo'q (erkin matn), shuning uchun
    // dublikatni Instagram video linki bo'yicha aniqlaymiz — link bo'lmasa, har doim
    // yangi yozuv sifatida qo'shiladi.
    const existingGroups = await prisma.groupInfo.findMany({
      where: { instagramAccountId, videoUrl: { not: null } },
      select: { id: true, branchId: true, videoUrl: true },
    });
    const groupIdByKey = new Map(
      existingGroups
        .filter((g): g is typeof g & { videoUrl: string } => Boolean(g.videoUrl))
        .map((g) => [`${g.branchId}::${g.videoUrl.trim().toLowerCase()}`, g.id]),
    );

    for (const group of body.groups) {
      const branchId = branchIdByName.get(group.branchName.trim().toLowerCase());
      if (!branchId) {
        result.groups.skipped.push(`${group.branchName} (filial topilmadi)`);
        continue;
      }
      const videoUrl = normalizeOptionalText(group.videoUrl);
      const key = videoUrl ? `${branchId}::${videoUrl.trim().toLowerCase()}` : null;
      const existingId = key ? groupIdByKey.get(key) : undefined;
      const data = {
        branchId,
        videoUrl,
        details: group.details,
        isActive: group.isActive,
      };

      if (existingId) {
        await prisma.groupInfo.update({ where: { id: existingId }, data });
        result.groups.updated += 1;
      } else {
        const created = await prisma.groupInfo.create({ data: { instagramAccountId, ...data } });
        if (key) groupIdByKey.set(key, created.id);
        result.groups.created += 1;
      }
    }

    return res.status(200).json({ result });
  } catch (err) {
    return next(err);
  }
});

export default router;
