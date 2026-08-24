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
  subjectNames: z.string().trim().min(1, "Fan yo'nalishlari majburiy").max(4000),
  extraInfo: z.string().trim().max(8000).optional().or(z.literal('')),
  isActive: z.boolean().optional().default(true),
});

const groupImportSchema = z.object({
  branchName: z.string().trim().min(1, 'branchName majburiy'),
  subjectName: z.string().trim().min(1, 'Fan nomi majburiy').max(200),
  price: z.string().trim().min(1, 'Kurs narxi majburiy').max(200),
  details: z.string().trim().min(1, "Batafsil ma'lumot majburiy").max(8000),
  isActive: z.boolean().optional().default(true),
});

const promotionImportSchema = z
  .object({
    scope: z.enum(['ALL_BRANCHES', 'BRANCH']).optional().default('ALL_BRANCHES'),
    branchName: z.string().trim().optional().or(z.literal('')),
    title: z.string().trim().min(1, 'Sarlavha majburiy').max(200),
    details: z.string().trim().min(1, "Batafsil ma'lumot majburiy").max(8000),
    isActive: z.boolean().optional().default(true),
  })
  .superRefine((value, ctx) => {
    if (value.scope === 'BRANCH' && !value.branchName?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['branchName'], message: 'BRANCH qamrovida branchName majburiy' });
    }
  });

const importSchema = z.object({
  academyName: z.string().trim().min(1).max(200).optional(),
  branches: z.array(branchImportSchema).max(200).optional().default([]),
  groups: z.array(groupImportSchema).max(2000).optional().default([]),
  promotions: z.array(promotionImportSchema).max(500).optional().default([]),
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
      promotions: { created: 0, updated: 0, skipped: [] as string[] },
    };

    if (body.academyName) {
      await prisma.academySettings.updateMany({
        where: { instagramAccountId },
        data: { academyName: body.academyName },
      });
      result.academyNameUpdated = true;
    }

    // Filial nomi -> id xaritasi. Avval bazadagi mavjud filiallar bilan boshlanadi,
    // shu import davomida yaratilgan/yangilangan filiallar ustiga qo'shiladi.
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
        subjectNames: branch.subjectNames,
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

    const existingGroups = await prisma.groupInfo.findMany({
      where: { instagramAccountId },
      select: { id: true, branchId: true, subjectName: true },
    });
    const groupIdByKey = new Map(
      existingGroups.map((g) => [`${g.branchId}::${g.subjectName.trim().toLowerCase()}`, g.id]),
    );

    for (const group of body.groups) {
      const branchId = branchIdByName.get(group.branchName.trim().toLowerCase());
      if (!branchId) {
        result.groups.skipped.push(`${group.branchName} / ${group.subjectName} (filial topilmadi)`);
        continue;
      }
      const key = `${branchId}::${group.subjectName.trim().toLowerCase()}`;
      const existingId = groupIdByKey.get(key);
      const data = {
        branchId,
        subjectName: group.subjectName,
        price: group.price,
        details: group.details,
        isActive: group.isActive,
      };

      if (existingId) {
        await prisma.groupInfo.update({ where: { id: existingId }, data });
        result.groups.updated += 1;
      } else {
        const created = await prisma.groupInfo.create({ data: { instagramAccountId, ...data } });
        groupIdByKey.set(key, created.id);
        result.groups.created += 1;
      }
    }

    const existingPromotions = await prisma.promotionInfo.findMany({
      where: { instagramAccountId },
      select: { id: true, title: true, branchId: true },
    });
    const promotionIdByKey = new Map(
      existingPromotions.map((p) => [`${p.branchId ?? 'ALL'}::${p.title.trim().toLowerCase()}`, p.id]),
    );

    for (const promotion of body.promotions) {
      let branchId: string | null = null;
      if (promotion.scope === 'BRANCH') {
        const resolved = branchIdByName.get((promotion.branchName ?? '').trim().toLowerCase());
        if (!resolved) {
          result.promotions.skipped.push(`${promotion.title} (filial topilmadi: ${promotion.branchName})`);
          continue;
        }
        branchId = resolved;
      }
      const key = `${branchId ?? 'ALL'}::${promotion.title.trim().toLowerCase()}`;
      const existingId = promotionIdByKey.get(key);
      const data = {
        scope: promotion.scope,
        branchId,
        title: promotion.title,
        details: promotion.details,
        isActive: promotion.isActive,
      };

      if (existingId) {
        await prisma.promotionInfo.update({ where: { id: existingId }, data });
        result.promotions.updated += 1;
      } else {
        const created = await prisma.promotionInfo.create({ data: { instagramAccountId, ...data } });
        promotionIdByKey.set(key, created.id);
        result.promotions.created += 1;
      }
    }

    return res.status(200).json({ result });
  } catch (err) {
    return next(err);
  }
});

export default router;
