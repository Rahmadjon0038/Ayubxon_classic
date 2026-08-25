import crypto from 'crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { isProduction } from '../config/env';
import { AppError } from '../lib/errors';
import { extractPhoneNumber } from '../lib/phone';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { getAccount } from '../services/accountService';
import { notifyNewAdLead } from '../bot/telegramNotifier';

const router = Router();

const publicLeadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => !isProduction,
  message: { error: 'Juda kop sorov yuborildi. Birozdan keyin qayta urinib koring' },
});

const campaignSchema = z.object({
  title: z.string().trim().min(1, 'Reklama nomi majburiy').max(200),
  description: z.string().trim().max(4000).optional().or(z.literal('')),
  formTitle: z.string().trim().max(200).optional().or(z.literal('')),
  formSubtitle: z.string().trim().max(500).optional().or(z.literal('')),
  isActive: z.boolean().default(true),
});

const adLeadSchema = z.object({
  fullName: z.string().trim().min(1, 'Ism majburiy').max(200),
  phoneNumber: z.string().trim().min(5, 'Telefon raqam majburiy').max(50),
  email: z.string().trim().email('Email noto\'g\'ri').optional().or(z.literal('')),
  comment: z.string().trim().max(2000).optional().or(z.literal('')),
  pageUrl: z.string().trim().url().optional().or(z.literal('')),
});

function normalizeOptionalText(value: string | undefined | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function resolveAccountId(): Promise<string> {
  const account = await getAccount();
  if (!account) throw new AppError('Avval Instagram akkauntni ulang', 400);
  return account.id;
}

async function resolveCampaignOrThrow(id: string, instagramAccountId: string) {
  const campaign = await prisma.adCampaign.findFirst({
    where: { id, instagramAccountId },
    select: { id: true },
  });
  if (!campaign) throw new AppError('Reklama topilmadi', 404);
  return campaign.id;
}

async function resolveCampaignBySlug(slug: string, instagramAccountId?: string) {
  return prisma.adCampaign.findFirst({
    where: {
      slug,
      isActive: true,
      ...(instagramAccountId ? { instagramAccountId } : {}),
    },
  });
}

// Public landing: reklamadan kelgan mijoz shu sahifani ko'radi.
router.get('/public/:slug', async (req, res, next) => {
  try {
    const campaign = await resolveCampaignBySlug(req.params.slug);
    if (!campaign) {
      throw new AppError('Reklama topilmadi', 404);
    }

    return res.json({
      campaign: {
        id: campaign.id,
        title: campaign.title,
        slug: campaign.slug,
        description: campaign.description,
        formTitle: campaign.formTitle,
        formSubtitle: campaign.formSubtitle,
        isActive: campaign.isActive,
        createdAt: campaign.createdAt,
        updatedAt: campaign.updatedAt,
      },
    });
  } catch (err) {
    return next(err);
  }
});

// Public form submit: lead shu endpoint orqali platformaga tushadi.
router.post('/public/:slug/leads', publicLeadLimiter, validateBody(adLeadSchema), async (req, res, next) => {
  try {
    const campaign = await resolveCampaignBySlug(req.params.slug);
    if (!campaign) {
      throw new AppError('Reklama topilmadi', 404);
    }

    const body = req.body as z.infer<typeof adLeadSchema>;
    const normalizedPhone = extractPhoneNumber(body.phoneNumber);
    if (!normalizedPhone) {
      throw new AppError('Telefon raqam noto\'g\'ri formatda', 400);
    }

    const lead = await prisma.adLead.create({
      data: {
        instagramAccountId: campaign.instagramAccountId,
        adCampaignId: campaign.id,
        fullName: body.fullName,
        phoneNumber: normalizedPhone,
        email: normalizeOptionalText(body.email),
        comment: normalizeOptionalText(body.comment),
        pageUrl: normalizeOptionalText(body.pageUrl),
      },
    });

    const account = await prisma.instagramAccount.findUnique({
      where: { id: campaign.instagramAccountId },
      select: { name: true, username: true },
    });

    notifyNewAdLead({
      campaignTitle: campaign.formTitle || campaign.title,
      fullName: lead.fullName,
      phoneNumber: lead.phoneNumber,
      email: lead.email,
      comment: lead.comment,
      pageUrl: lead.pageUrl,
    }).catch(() => {});

    return res.status(201).json({
      ok: true,
      lead: {
        id: lead.id,
        fullName: lead.fullName,
        phoneNumber: lead.phoneNumber,
        email: lead.email,
        comment: lead.comment,
        pageUrl: lead.pageUrl,
        createdAt: lead.createdAt,
      },
      campaign: {
        id: campaign.id,
        title: campaign.title,
        slug: campaign.slug,
        description: campaign.description,
        formTitle: campaign.formTitle,
        formSubtitle: campaign.formSubtitle,
      },
      account: account ?? null,
    });
  } catch (err) {
    return next(err);
  }
});

router.use(requireAuth);

router.get('/', async (_req, res, next) => {
  try {
    const instagramAccountId = await resolveAccountId();
    const items = await prisma.adCampaign.findMany({
      where: { instagramAccountId },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        _count: { select: { leads: true } },
      },
    });

    return res.json({
      items: items.map((item) => ({
        id: item.id,
        instagramAccountId: item.instagramAccountId,
        title: item.title,
        slug: item.slug,
        description: item.description,
        formTitle: item.formTitle,
        formSubtitle: item.formSubtitle,
        isActive: item.isActive,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        leadCount: item._count.leads,
      })),
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/', validateBody(campaignSchema), async (req, res, next) => {
  try {
    const instagramAccountId = await resolveAccountId();
    const body = req.body as z.infer<typeof campaignSchema>;
    const title = body.title.trim();
    const slugBase = slugify(title) || 'reklama';
    const suffix = crypto.randomUUID().slice(0, 8);
    let slug = `${slugBase}-${suffix}`;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const existing = await prisma.adCampaign.findUnique({ where: { slug }, select: { id: true } });
      if (!existing) break;
      slug = `${slugBase}-${crypto.randomUUID().slice(0, 8)}`;
    }

    const item = await prisma.adCampaign.create({
      data: {
        instagramAccountId,
        title,
        slug,
        description: normalizeOptionalText(body.description),
        formTitle: normalizeOptionalText(body.formTitle),
        formSubtitle: normalizeOptionalText(body.formSubtitle),
        isActive: body.isActive,
      },
    });

    return res.status(201).json({
      item: {
        id: item.id,
        instagramAccountId: item.instagramAccountId,
        title: item.title,
        slug: item.slug,
        description: item.description,
        formTitle: item.formTitle,
        formSubtitle: item.formSubtitle,
        isActive: item.isActive,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        leadCount: 0,
      },
    });
  } catch (err) {
    return next(err);
  }
});

router.patch('/:id', validateBody(campaignSchema), async (req, res, next) => {
  try {
    const instagramAccountId = await resolveAccountId();
    await resolveCampaignOrThrow(req.params.id, instagramAccountId);
    const body = req.body as z.infer<typeof campaignSchema>;

    const item = await prisma.adCampaign.update({
      where: { id: req.params.id },
      data: {
        title: body.title.trim(),
        description: normalizeOptionalText(body.description),
        formTitle: normalizeOptionalText(body.formTitle),
        formSubtitle: normalizeOptionalText(body.formSubtitle),
        isActive: body.isActive,
      },
      include: { _count: { select: { leads: true } } },
    });

    return res.json({
      item: {
        id: item.id,
        instagramAccountId: item.instagramAccountId,
        title: item.title,
        slug: item.slug,
        description: item.description,
        formTitle: item.formTitle,
        formSubtitle: item.formSubtitle,
        isActive: item.isActive,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        leadCount: item._count.leads,
      },
    });
  } catch (err) {
    return next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const instagramAccountId = await resolveAccountId();
    await resolveCampaignOrThrow(req.params.id, instagramAccountId);
    await prisma.adCampaign.delete({ where: { id: req.params.id } });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

router.get('/:id/leads', async (req, res, next) => {
  try {
    const instagramAccountId = await resolveAccountId();
    await resolveCampaignOrThrow(req.params.id, instagramAccountId);

    const items = await prisma.adLead.findMany({
      where: { instagramAccountId, adCampaignId: req.params.id },
      orderBy: [{ createdAt: 'desc' }],
    });

    return res.json({
      items: items.map((item) => ({
        id: item.id,
        instagramAccountId: item.instagramAccountId,
        adCampaignId: item.adCampaignId,
        fullName: item.fullName,
        phoneNumber: item.phoneNumber,
        email: item.email,
        comment: item.comment,
        pageUrl: item.pageUrl,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
    });
  } catch (err) {
    return next(err);
  }
});

export default router;
