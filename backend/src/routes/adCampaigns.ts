import crypto from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { getAccount, getConnectedAccount, getAccessToken } from '../services/accountService';
import { subscribePageToLeadgen } from '../services/metaLeadAds';

const router = Router();

const campaignSchema = z.object({
  title: z.string().trim().min(1, 'Kampaniya nomi majburiy').max(200),
  metaPageId: z.string().trim().max(100).optional().or(z.literal('')),
  metaPageName: z.string().trim().max(200).optional().or(z.literal('')),
  metaFormId: z.string().trim().max(100).optional().or(z.literal('')),
  metaFormName: z.string().trim().max(200).optional().or(z.literal('')),
  isActive: z.boolean().default(true),
});

type CampaignInput = z.infer<typeof campaignSchema>;

function normalizeOptionalText(value: string | undefined | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

async function resolveAccountId(): Promise<string> {
  const account = await getAccount();
  if (!account) throw new AppError('Avval Instagram akkauntni ulang', 400);
  return account.id;
}

async function resolveConnectedAccount() {
  const account = await getConnectedAccount();
  if (!account) throw new AppError('Meta token topilmadi. Avval akkauntni ulang', 400);
  return account;
}

async function ensureMetaFormUnique(metaFormId: string | null, currentId?: string) {
  if (!metaFormId) return;
  const existing = await prisma.adCampaign.findUnique({
    where: { metaFormId },
    select: { id: true },
  });
  if (existing && existing.id !== currentId) {
    throw new AppError('Bu Meta form ID boshqa kampaniyada ishlatilmoqda', 409);
  }
}

async function resolveCampaignOrThrow(id: string, instagramAccountId: string) {
  const campaign = await prisma.adCampaign.findFirst({
    where: { id, instagramAccountId },
    select: { id: true, metaPageId: true, metaFormId: true },
  });
  if (!campaign) throw new AppError('Kampaniya topilmadi', 404);
  return campaign;
}

function mapCampaign(campaign: {
  id: string;
  instagramAccountId: string;
  title: string;
  metaPageId: string | null;
  metaPageName: string | null;
  metaFormId: string | null;
  metaFormName: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count?: { leads: number };
}) {
  return {
    id: campaign.id,
    instagramAccountId: campaign.instagramAccountId,
    title: campaign.title,
    metaPageId: campaign.metaPageId,
    metaPageName: campaign.metaPageName,
    metaFormId: campaign.metaFormId,
    metaFormName: campaign.metaFormName,
    isActive: campaign.isActive,
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt,
    leadCount: campaign._count?.leads ?? 0,
  };
}

router.use(requireAuth);

router.get('/', async (_req, res, next) => {
  try {
    const instagramAccountId = await resolveAccountId();
    const items = await prisma.adCampaign.findMany({
      where: { instagramAccountId },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      include: { _count: { select: { leads: true } } },
    });

    return res.json({ items: items.map(mapCampaign) });
  } catch (err) {
    return next(err);
  }
});

router.post('/', validateBody(campaignSchema), async (req, res, next) => {
  try {
    const instagramAccountId = await resolveAccountId();
    const body = req.body as CampaignInput;
    const title = body.title.trim();
    const metaPageId = normalizeOptionalText(body.metaPageId);
    const metaPageName = normalizeOptionalText(body.metaPageName);
    const metaFormId = normalizeOptionalText(body.metaFormId);
    const metaFormName = normalizeOptionalText(body.metaFormName);

    await ensureMetaFormUnique(metaFormId);

    const item = await prisma.adCampaign.create({
      data: {
        instagramAccountId,
        title,
        metaPageId,
        metaPageName,
        metaFormId,
        metaFormName,
        isActive: body.isActive,
      },
      include: { _count: { select: { leads: true } } },
    });

    return res.status(201).json({ item: mapCampaign(item) });
  } catch (err) {
    return next(err);
  }
});

router.patch('/:id', validateBody(campaignSchema), async (req, res, next) => {
  try {
    const instagramAccountId = await resolveAccountId();
    await resolveCampaignOrThrow(req.params.id, instagramAccountId);
    const body = req.body as CampaignInput;
    const metaFormId = normalizeOptionalText(body.metaFormId);

    await ensureMetaFormUnique(metaFormId, req.params.id);

    const item = await prisma.adCampaign.update({
      where: { id: req.params.id },
      data: {
        title: body.title.trim(),
        metaPageId: normalizeOptionalText(body.metaPageId),
        metaPageName: normalizeOptionalText(body.metaPageName),
        metaFormId,
        metaFormName: normalizeOptionalText(body.metaFormName),
        isActive: body.isActive,
      },
      include: { _count: { select: { leads: true } } },
    });

    return res.json({ item: mapCampaign(item) });
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

router.post('/:id/subscribe', async (req, res, next) => {
  try {
    const instagramAccountId = await resolveAccountId();
    const campaign = await resolveCampaignOrThrow(req.params.id, instagramAccountId);
    if (!campaign.metaPageId) {
      throw new AppError('Avval kampaniyaga Meta Page ID kiriting', 400);
    }

    const account = await resolveConnectedAccount();
    const accessToken = getAccessToken(account);
    const subscribed = await subscribePageToLeadgen(accessToken, campaign.metaPageId);

    if (!subscribed) {
      throw new AppError('Page leadgen webhook ulanmadi. Meta permissions yoki tokenni tekshiring', 502);
    }

    return res.json({ ok: true, subscribed: true });
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
        metaLeadId: item.metaLeadId,
        metaPageId: item.metaPageId,
        metaFormId: item.metaFormId,
        fullName: item.fullName,
        phoneNumber: item.phoneNumber,
        email: item.email,
        comment: item.comment,
        rawFields: item.rawFields,
        leadCreatedAt: item.leadCreatedAt,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
    });
  } catch (err) {
    return next(err);
  }
});

export default router;
