import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { getConnectedAccount } from '../services/accountService';

const router = Router();

router.use(requireAuth);

const MONTHS_BACK = 12;

// "2026-01" korinishidagi kalitlar — eng eskisidan eng yangisiga qarab, oxirgi 12 oy.
function lastMonthKeys(count: number): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
}

function monthKeyFromDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

router.get('/', async (_req, res, next) => {
  try {
    const account = await getConnectedAccount();
    const months = lastMonthKeys(MONTHS_BACK);

    if (!account) {
      return res.json({
        totals: { totalConversations: 0, totalWithPhone: 0, totalMessages: 0, talkedCount: 0 },
        monthlyLeads: months.map((month) => ({ month, count: 0 })),
        monthlyMessages: months.map((month) => ({ month, contact: 0, admin: 0 })),
        leadTemperature: { HOT: 0, WARM: 0, COLD: 0 },
        callStatus: { NEW: 0, TALKED: 0, NOT_ANSWERED: 0 },
        topCourses: [],
      });
    }

    const [totalConversations, totalWithPhone, totalMessages, talkedCount] = await Promise.all([
      prisma.conversation.count({ where: { instagramAccountId: account.id } }),
      prisma.contact.count({
        where: { phoneNumber: { not: null }, conversations: { some: { instagramAccountId: account.id } } },
      }),
      prisma.message.count({ where: { conversation: { instagramAccountId: account.id } } }),
      prisma.conversation.count({ where: { instagramAccountId: account.id, talkStatus: 'TALKED' } }),
    ]);

    const conversationDates = await prisma.conversation.findMany({
      where: { instagramAccountId: account.id, createdAt: { gte: new Date(Date.now() - 366 * 24 * 60 * 60 * 1000) } },
      select: { createdAt: true },
    });
    const leadsByMonth = new Map<string, number>();
    for (const c of conversationDates) {
      const key = monthKeyFromDate(c.createdAt);
      leadsByMonth.set(key, (leadsByMonth.get(key) ?? 0) + 1);
    }
    const monthlyLeads = months.map((month) => ({ month, count: leadsByMonth.get(month) ?? 0 }));

    const messageDates = await prisma.message.findMany({
      where: {
        conversation: { instagramAccountId: account.id },
        sentAt: { gte: new Date(Date.now() - 366 * 24 * 60 * 60 * 1000) },
      },
      select: { sentAt: true, senderType: true },
    });
    const messagesByMonth = new Map<string, { contact: number; admin: number }>();
    for (const m of messageDates) {
      const key = monthKeyFromDate(m.sentAt);
      const entry = messagesByMonth.get(key) ?? { contact: 0, admin: 0 };
      if (m.senderType === 'CONTACT') entry.contact += 1;
      else entry.admin += 1;
      messagesByMonth.set(key, entry);
    }
    const monthlyMessages = months.map((month) => ({
      month,
      contact: messagesByMonth.get(month)?.contact ?? 0,
      admin: messagesByMonth.get(month)?.admin ?? 0,
    }));

    const leadTempGroups = await prisma.conversation.groupBy({
      by: ['leadTemperature'],
      where: { instagramAccountId: account.id },
      _count: { _all: true },
    });
    const leadTemperature = { HOT: 0, WARM: 0, COLD: 0 };
    for (const g of leadTempGroups) leadTemperature[g.leadTemperature] = g._count._all;

    const callStatusGroups = await prisma.conversation.groupBy({
      by: ['callStatus'],
      where: { instagramAccountId: account.id, contact: { phoneNumber: { not: null } } },
      _count: { _all: true },
    });
    const callStatus = { NEW: 0, TALKED: 0, NOT_ANSWERED: 0 };
    for (const g of callStatusGroups) callStatus[g.callStatus] = g._count._all;

    // interestedCourse erkin matn va bir nechta kurs vergul bilan yozilgan bolishi mumkin
    // (masalan "Matematika, Ingliz tili") — shuning uchun JS tomonda ajratib sanaymiz.
    const courseRows = await prisma.conversation.findMany({
      where: { instagramAccountId: account.id, interestedCourse: { not: null } },
      select: { interestedCourse: true },
    });
    const courseCounts = new Map<string, number>();
    for (const row of courseRows) {
      const parts = (row.interestedCourse ?? '').split(',').map((p) => p.trim()).filter(Boolean);
      for (const part of parts) {
        courseCounts.set(part, (courseCounts.get(part) ?? 0) + 1);
      }
    }
    const topCourses = Array.from(courseCounts.entries())
      .map(([course, count]) => ({ course, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    return res.json({
      totals: { totalConversations, totalWithPhone, totalMessages, talkedCount },
      monthlyLeads,
      monthlyMessages,
      leadTemperature,
      callStatus,
      topCourses,
    });
  } catch (err) {
    return next(err);
  }
});

export default router;
