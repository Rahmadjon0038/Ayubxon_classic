import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { getConnectedAccount } from '../services/accountService';

const router = Router();

router.use(requireAuth);

const MONTHS_BACK = 12;
const MONTH_KEY_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function monthKeyFromDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// "2026-01" korinishidagi kalitlar — `end` oyigacha (shu oyni ham qoshib) tugaydigan oxirgi `count` oy.
function lastMonthKeys(count: number, end: Date): string[] {
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(end.getFullYear(), end.getMonth() - i, 1);
    keys.push(monthKeyFromDate(d));
  }
  return keys;
}

router.get('/', async (req, res, next) => {
  try {
    const account = await getConnectedAccount();

    // ?month=YYYY-MM — sahifadagi oy filteri. Notogri/bosh bolsa joriy oyga tushadi.
    const rawMonth = typeof req.query.month === 'string' ? req.query.month : undefined;
    const selectedMonth = rawMonth && MONTH_KEY_RE.test(rawMonth) ? rawMonth : monthKeyFromDate(new Date());
    const [selYear, selMonthNum] = selectedMonth.split('-').map(Number);
    const monthStart = new Date(selYear, selMonthNum - 1, 1);
    const monthEnd = new Date(selYear, selMonthNum, 1);

    const months = lastMonthKeys(MONTHS_BACK, monthStart);
    const trendWindowStart = new Date(selYear, selMonthNum - 1 - (MONTHS_BACK - 1), 1);

    if (!account) {
      return res.json({
        selectedMonth,
        totals: { totalConversations: 0, totalProductInquiries: 0, totalMessages: 0, talkedCount: 0 },
        monthlyLeads: months.map((month) => ({ month, count: 0 })),
        monthlyMessages: months.map((month) => ({ month, contact: 0, admin: 0 })),
        leadTemperature: { HOT: 0, WARM: 0, COLD: 0 },
        topCourses: [],
      });
    }

    // Yuqoridagi 4 ta plitka va pastdagi kartalar — tanlangan oy uchun.
    const monthFilter = { createdAt: { gte: monthStart, lt: monthEnd } };

    const [totalConversations, totalProductInquiries, totalMessages, talkedCount] = await Promise.all([
      prisma.conversation.count({ where: { instagramAccountId: account.id, ...monthFilter } }),
      // Mijoz Instagramda ulashilgan/orqali yozgan bitta reel/postga moslashtirilgan
      // suhbatlar soni — "Bilimlar bazasi"dagi mahsulot postlariga qiziqish o'lchovi.
      prisma.conversation.count({
        where: { instagramAccountId: account.id, referencedGroupId: { not: null }, ...monthFilter },
      }),
      prisma.message.count({
        where: { conversation: { instagramAccountId: account.id }, sentAt: { gte: monthStart, lt: monthEnd } },
      }),
      prisma.conversation.count({
        where: { instagramAccountId: account.id, talkStatus: 'TALKED', ...monthFilter },
      }),
    ]);

    // Oylik trend grafiklari — tanlangan oy bilan tugaydigan oxirgi 12 oy.
    const conversationDates = await prisma.conversation.findMany({
      where: { instagramAccountId: account.id, createdAt: { gte: trendWindowStart, lt: monthEnd } },
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
        sentAt: { gte: trendWindowStart, lt: monthEnd },
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
      where: { instagramAccountId: account.id, ...monthFilter },
      _count: { _all: true },
    });
    const leadTemperature = { HOT: 0, WARM: 0, COLD: 0 };
    for (const g of leadTempGroups) leadTemperature[g.leadTemperature] = g._count._all;

    // interestedCourse erkin matn va bir nechta mahsulot vergul bilan yozilgan bolishi mumkin
    // (masalan "Kostyum, Shim") — shuning uchun JS tomonda ajratib sanaymiz.
    const courseRows = await prisma.conversation.findMany({
      where: { instagramAccountId: account.id, interestedCourse: { not: null }, ...monthFilter },
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
      selectedMonth,
      totals: { totalConversations, totalProductInquiries, totalMessages, talkedCount },
      monthlyLeads,
      monthlyMessages,
      leadTemperature,
      topCourses,
    });
  } catch (err) {
    return next(err);
  }
});

export default router;
