import type { VercelRequest, VercelResponse } from '@vercel/node';
import Groq from 'groq-sdk';
import { readState, updateState, isCloudSyncConfigured, DEFAULT_STATE } from '../lib/state';
import { broadcastState } from '../lib/broadcast';
import { createGroqChat } from '../lib/groq';
import type { CalendarEvent, AppSyncState } from '../src/types';

// ---------------------------------------------------------------------------
// Inline schedule logic — mirrored from src/data/schedule.ts
// Kept here so the Vercel function bundle is fully self-contained.
// ---------------------------------------------------------------------------

const GRANDMA_ROTATION_SEQUENCE = ['KC', 'KG', 'KB'];
const GRANDMA_DAYS_PER_LOCATION = 14;
const GRANDMA_ANCHOR = '2026-05-07';
const JUNJIE_ANCHOR = '2026-06-15';

// 3-week flat roster (Mon=0 … Sun=6, repeated across 3 weeks)
const JUNJIE_ROSTER: { name: string; time: string }[] = [
  // Week 1
  { name: 'Night', time: '2200-0900' },       // Mon
  { name: 'Night', time: '2200-0900' },       // Tue
  { name: 'OFF Day', time: '' },              // Wed
  { name: 'REST DAY', time: '' },             // Thu
  { name: 'Morning', time: '0630-1530' },     // Fri
  { name: 'Morning', time: '0630-1530' },     // Sat
  { name: 'Morning', time: '0630-1530' },     // Sun
  // Week 2
  { name: 'Morning', time: '0630-1530' },       // Mon
  { name: 'OFF Day', time: '' },                // Tue
  { name: 'Afternoon 1', time: '1400-0100' },   // Wed
  { name: 'Afternoon 1', time: '1400-0100' },   // Thu
  { name: 'Afternoon 2', time: '1500-0200' },   // Fri
  { name: 'Afternoon 2', time: '1500-0200' },   // Sat
  { name: 'REST DAY', time: '' },               // Sun
  // Week 3
  { name: 'OFF Day', time: '' },                // Mon
  { name: 'Morning', time: '0630-1530' },       // Tue
  { name: 'Morning', time: '0630-1530' },       // Wed
  { name: 'Morning', time: '0630-1530' },       // Thu
  { name: 'REST DAY', time: '' },               // Fri
  { name: 'Afternoon 3', time: '1600-0100' },   // Sat
  { name: 'Afternoon 3', time: '1600-0100' },   // Sun
];

// CNY special arrangement: CNY Eve → CNY Day 2
const CNY_DATES: Record<number, { eve: string; day1: string; day2: string; code: string }> = {
  2026: { eve: '2026-02-16', day1: '2026-02-17', day2: '2026-02-18', code: 'KG' },
  2027: { eve: '2027-02-05', day1: '2027-02-06', day2: '2027-02-07', code: 'KB' },
  2028: { eve: '2028-01-25', day1: '2028-01-26', day2: '2028-01-27', code: 'KC' },
  2029: { eve: '2029-02-12', day1: '2029-02-13', day2: '2029-02-14', code: 'KG' },
};

const LOCATION_NAMES: Record<string, { en: string; zh: string }> = {
  KC: { en: 'Kay Cheow', zh: '启超' },
  KG: { en: 'Kay Guan', zh: '启源' },
  KB: { en: 'Kay Boon', zh: '启文' },
};

const SINGAPORE_PUBLIC_HOLIDAYS: Record<string, string> = {
  '2026-01-01': "New Year's Day",
  '2026-02-17': 'Chinese New Year (Day 1)',
  '2026-02-18': 'Chinese New Year (Day 2)',
  '2026-03-20': 'Hari Raya Puasa',
  '2026-04-03': 'Good Friday',
  '2026-05-01': 'Labour Day',
  '2026-05-27': 'Hari Raya Haji',
  '2026-05-31': 'Vesak Day',
  '2026-06-01': 'Vesak Day (In-Lieu)',
  '2026-08-09': 'National Day',
  '2026-08-10': 'National Day (In-Lieu)',
  '2026-11-08': 'Deepavali',
  '2026-11-09': 'Deepavali (In-Lieu)',
  '2026-12-25': 'Christmas Day',
};

function daysBetween(a: string, b: string): number {
  const [yA, mA, dA] = a.split('-').map(Number);
  const [yB, mB, dB] = b.split('-').map(Number);
  return Math.round((Date.UTC(yA, mA - 1, dA) - Date.UTC(yB, mB - 1, dB)) / 86400000);
}

function getAhmaLocation(dateStr: string) {
  const year = parseInt(dateStr.split('-')[0], 10);
  const cny = CNY_DATES[year];
  if (cny && (dateStr === cny.eve || dateStr === cny.day1 || dateStr === cny.day2)) {
    const stage = dateStr === cny.eve ? 'Eve' : dateStr === cny.day1 ? 'Day 1' : 'Day 2';
    const [y, m, d] = dateStr.split('-').map(Number);
    const nextDate = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().split('T')[0];
    return { code: cny.code, dayInStay: 1, daysLeft: 0, nextCode: 'resumes rotation', nextDate, isCny: true, cnyStage: stage };
  }
  const diff = daysBetween(dateStr, GRANDMA_ANCHOR);
  const total = GRANDMA_ROTATION_SEQUENCE.length * GRANDMA_DAYS_PER_LOCATION;
  const cycleDay = ((diff % total) + total) % total;
  const locIdx = Math.floor(cycleDay / GRANDMA_DAYS_PER_LOCATION);
  const code = GRANDMA_ROTATION_SEQUENCE[locIdx];
  const dayInStay = (cycleDay % GRANDMA_DAYS_PER_LOCATION) + 1;
  const daysLeft = GRANDMA_DAYS_PER_LOCATION - dayInStay;
  const nextCode = GRANDMA_ROTATION_SEQUENCE[(locIdx + 1) % GRANDMA_ROTATION_SEQUENCE.length];
  const [y, m, d] = dateStr.split('-').map(Number);
  const nextDate = new Date(Date.UTC(y, m - 1, d + daysLeft + 1)).toISOString().split('T')[0];
  return { code, dayInStay, daysLeft, nextCode, nextDate, isCny: false, cnyStage: '' };
}

function nextAhmaVisit(fromDate: string, targetCode: string) {
  const [yA, mA, dA] = fromDate.split('-').map(Number);
  for (let i = 1; i <= 42 * 3; i++) {
    const dStr = new Date(Date.UTC(yA, mA - 1, dA + i)).toISOString().split('T')[0];
    const info = getAhmaLocation(dStr);
    if (info.code === targetCode && info.dayInStay === 1 && !info.isCny) {
      const endStr = new Date(Date.UTC(yA, mA - 1, dA + i + GRANDMA_DAYS_PER_LOCATION - 1)).toISOString().split('T')[0];
      return { date: dStr, endDate: endStr, daysAway: i };
    }
  }
  return { date: '?', endDate: '?', daysAway: -1 };
}

function getJunjieShift(dateStr: string) {
  const diff = daysBetween(dateStr, JUNJIE_ANCHOR);
  const idx = ((diff % 21) + 21) % 21;
  return { ...JUNJIE_ROSTER[idx], weekNum: Math.floor(idx / 7) + 1 };
}

// ---------------------------------------------------------------------------
// Inline date parser — mirrored from src/data/chatbotSolver.ts
// ---------------------------------------------------------------------------

function todaySGT(): string {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().split('T')[0];
}

function addDaysSGT(n: number): string {
  return new Date(Date.now() + (8 * 60 * 60 * 1000) + (n * 86400000)).toISOString().split('T')[0];
}

function extractDate(message: string): string {
  const today = todaySGT();
  const q = message.toLowerCase();

  if (q.includes('today') || q.includes('今天') || q.includes('今日')) return today;
  if (q.includes('tomorrow') || q.includes('明天') || q.includes('明日')) return addDaysSGT(1);
  if (q.includes('day after tomorrow') || q.includes('后天')) return addDaysSGT(2);
  if (q.includes('next week') || q.includes('下周')) return addDaysSGT(7);

  const isoMatch = message.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
  }

  const zhMatch = message.match(/(?:(\d{4})年\s*)?(\d{1,2})月\s*(\d{1,2})[日号]?/);
  if (zhMatch) {
    const y = zhMatch[1] ? parseInt(zhMatch[1]) : 2026;
    return `${y}-${zhMatch[2].padStart(2, '0')}-${zhMatch[3].padStart(2, '0')}`;
  }

  const mNames: Record<string, number> = {
    jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
    apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
    aug: 8, august: 8, sep: 9, september: 9, oct: 10, october: 10,
    nov: 11, november: 11, dec: 12, december: 12,
  };
  const engMatch =
    message.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([a-zA-Z]+)(?:\s+(\d{4}))?/i) ||
    message.match(/([a-zA-Z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{4}))?/i);
  if (engMatch) {
    let d: number, mStr: string, y: number;
    if (isNaN(Number(engMatch[1]))) {
      mStr = engMatch[1].toLowerCase(); d = parseInt(engMatch[2]); y = engMatch[3] ? parseInt(engMatch[3]) : 2026;
    } else {
      d = parseInt(engMatch[1]); mStr = engMatch[2].toLowerCase(); y = engMatch[3] ? parseInt(engMatch[3]) : 2026;
    }
    const m = mNames[mStr];
    if (m) return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  return '';
}

// ---------------------------------------------------------------------------
// Date Range & Event Extraction Helpers
// ---------------------------------------------------------------------------

function extractDateRange(message: string): { start: string; end: string } | null {
  const mNames: Record<string, number> = {
    jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
    apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
    aug: 8, august: 8, sep: 9, september: 9, oct: 10, october: 10,
    nov: 11, november: 11, dec: 12, december: 12,
  };

  // e.g. "from 20 to 22 June 2026", "20 to 22 June", "20 - 22 June 2026"
  const engRange = message.match(/(?:from\s+)?(\d{1,2})(?:st|nd|rd|th)?\s*(?:to|–|-)\s*(\d{1,2})(?:st|nd|rd|th)?\s+([a-zA-Z]+)(?:\s+(\d{4}))?/i);
  if (engRange) {
    const d1 = parseInt(engRange[1]);
    const d2 = parseInt(engRange[2]);
    const m = mNames[engRange[3].toLowerCase()];
    const y = engRange[4] ? parseInt(engRange[4]) : 2026;
    if (m) {
      return {
        start: `${y}-${String(m).padStart(2, '0')}-${String(d1).padStart(2, '0')}`,
        end: `${y}-${String(m).padStart(2, '0')}-${String(d2).padStart(2, '0')}`,
      };
    }
  }

  // e.g. "2026-06-20 to 2026-06-22"
  const isoRange = message.match(/(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})\s*(?:to|–|-|至|到)\s*(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})/);
  if (isoRange) {
    const formatIso = (s: string) => {
      const parts = s.split(/[-/.]/);
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    };
    return {
      start: formatIso(isoRange[1]),
      end: formatIso(isoRange[2]),
    };
  }

  // e.g. "6月20日到22日" or "6月20日到6月22日"
  const zhRange = message.match(/(?:(\d{4})年\s*)?(\d{1,2})月\s*(\d{1,2})[日号]?\s*(?:到|至|–|-)\s*(?:(\d{1,2})月\s*)?(\d{1,2})[日号]?/);
  if (zhRange) {
    const y = zhRange[1] ? parseInt(zhRange[1]) : 2026;
    const m1 = zhRange[2].padStart(2, '0');
    const d1 = zhRange[3].padStart(2, '0');
    const m2 = (zhRange[4] ?? zhRange[2]).padStart(2, '0');
    const d2 = zhRange[5].padStart(2, '0');
    return {
      start: `${y}-${m1}-${d1}`,
      end: `${y}-${m2}-${d2}`,
    };
  }

  return null;
}

function inferCategory(text: string): CalendarEvent['category'] {
  const low = text.toLowerCase();
  if (
    low.includes('staycation') || low.includes('holiday') || low.includes('trip') ||
    low.includes('vacation') || low.includes('sentosa') || low.includes('resort') ||
    low.includes('hotel') || low.includes('旅行') || low.includes('假期') || low.includes('度假')
  ) {
    return 'holiday_plan';
  }
  if (
    low.includes('dinner') || low.includes('lunch') || low.includes('gathering') ||
    low.includes('meal') || low.includes('reunion') || low.includes('makan') ||
    low.includes('聚餐') || low.includes('吃饭') || low.includes('聚会')
  ) {
    return 'family_gathering';
  }
  if (
    low.includes('doctor') || low.includes('medical') || low.includes('clinic') ||
    low.includes('hospital') || low.includes('checkup') || low.includes('appointment') ||
    low.includes('polyclinic') || low.includes('医生') || low.includes('看病') ||
    low.includes('检查') || low.includes('诊所')
  ) {
    return 'medical';
  }
  if (low.includes('leave') || low.includes('mc') || low.includes('off') || low.includes('请假') || low.includes('休假')) {
    return 'leave';
  }
  return 'general';
}

function extractLocation(text: string): string | undefined {
  const locMatch =
    text.match(/\bat\s+([A-Za-z0-9'\s]+?)(?=\s+(?:from|on|at\s+\d|\d{1,2}|2026|$|[,.]))/i) ||
    text.match(/@\s*([A-Za-z0-9\u4e00-\u9fa5\s]+)/) ||
    text.match(/在\s*([^,.\s]+(?:家|诊所|医院|酒店|度假村|中心|餐馆|饭店)?)/);
  if (locMatch && locMatch[1]) {
    const loc = locMatch[1].trim();
    if (loc && !/^\d+$/.test(loc) && !/^(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(loc)) {
      return loc;
    }
  }
  return undefined;
}

function extractTime(text: string): string | undefined {
  const timeMatch = text.match(/\b([012]?\d:[0-5]\d)\b/) || text.match(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM))\b/);
  if (timeMatch) return timeMatch[1].trim();
  const zhTime = text.match(/(早上|上午|中午|下午|晚上|夜间)?\s*(\d{1,2})点(?:(\d{1,2})分|半)?/);
  if (zhTime) return zhTime[0].trim();
  return undefined;
}

function extractCleanTitle(message: string, isZh: boolean): string {
  let cleaned = message
    .replace(/^\/add\s*/i, '')
    .replace(/^(?:please\s+)?(?:add|create|schedule|plan|put|book)\s+(?:a\s+)?/i, '')
    .replace(/^(?:请|帮我)?(?:添加|加入|安排|记一下|记录)\s*/, '')
    .replace(/(?:from\s+)?\d{1,2}(?:st|nd|rd|th)?\s*(?:to|–|-)\s*\d{1,2}(?:st|nd|rd|th)?\s+[a-zA-Z]+(?:\s+\d{4})?/gi, '')
    .replace(/\d{4}[-/.]\d{1,2}[-/.]\d{1,2}(?:\s*(?:to|–|-|至|到)\s*\d{4}[-/.]\d{1,2}[-/.]\d{1,2})?/g, '')
    .replace(/(?:\d{4}年\s*)?\d{1,2}月\s*\d{1,2}[日号]?(?:\s*(?:到|至|–|-)\s*(?:\d{1,2}月\s*)?\d{1,2}[日号]?)?/g, '')
    .replace(/\bon\s+\w+\s+\d{1,2}(?:\s+\d{4})?/gi, '')
    .replace(/\bon\s+\d{1,2}(?:st|nd|rd|th)?\s+\w+(?:\s+\d{4})?/gi, '')
    .replace(/\bnext\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|week)\b/gi, '')
    .replace(/(?:早上|上午|中午|下午|晚上|夜间)?\s*\d{1,2}点(?:\d{1,2}分|半)?/g, '')
    .replace(/\bat\s+[012]?\d(?::[0-5]\d)?\s*(?:am|pm)?/gi, '')
    .replace(/\bat\s+[012]?\d:[0-5]\d/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned || cleaned.length < 2) {
    return isZh ? '家庭活动' : 'Family Event';
  }
  return cleaned;
}

async function saveCalendarEvent(eventData: {
  title: string;
  startDate: string;
  endDate?: string;
  category?: CalendarEvent['category'];
  memberId?: string;
  time?: string;
  location?: string;
  notes?: string;
}): Promise<{ event: CalendarEvent; cloudSync: boolean }> {
  const now = new Date().toISOString();
  const payload: CalendarEvent = {
    id: `ev-tg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    title: eventData.title,
    startDate: eventData.startDate,
    endDate: eventData.endDate || undefined,
    category: eventData.category || 'general',
    memberId: eventData.memberId || 'all',
    time: eventData.time || undefined,
    location: eventData.location || undefined,
    notes: eventData.notes || undefined,
    createdAt: now,
    updatedAt: now,
  };

  try {
    const newState = await updateState((draft) => {
      draft.events.push(payload);
    });
    await broadcastState(newState);
  } catch (err) {
    console.warn('[telegram] Error saving event via updateState:', err);
  }

  return {
    event: payload,
    cloudSync: isCloudSyncConfigured(),
  };
}

function formatCalendarContext(calendarState: AppSyncState): string {
  let eventContext = '';
  const events = calendarState.events ?? [];
  const overrides = calendarState.overrides ?? [];
  const members = calendarState.familyMembers ?? [];

  const memberName = (id: string) => {
    const m = members.find((fm) => fm.id === id);
    return m ? m.name : id;
  };

  if (events.length > 0) {
    const lines = events
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .map((e) => {
        const dateRange = e.endDate && e.endDate !== e.startDate
          ? `${e.startDate} to ${e.endDate}` : e.startDate;
        const timePart = e.time ? ` at ${e.time}` : '';
        const locPart = e.location ? ` @ ${e.location}` : '';
        const notesPart = e.notes ? ` (${e.notes})` : '';
        return `- [${e.category}] ${e.title} | ${dateRange}${timePart}${locPart} | Who: ${memberName(e.memberId ?? 'all')}${notesPart}`;
      })
      .join('\n');
    eventContext += `\nCurrent calendar events:\n${lines}`;
  }

  if (overrides.length > 0) {
    const oLines = overrides
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((o) => {
        if (o.type === 'grandma_location')
          return `- ${o.date}: Ahma override → ${o.grandmaLocation}${o.grandmaReason ? ` (${o.grandmaReason})` : ''}`;
        if (o.type === 'junjie_shift')
          return `- ${o.date}: Jun Jie override → ${o.shiftName || o.shiftCode}${o.shiftTime ? ` ${o.shiftTime}` : ''}${o.shiftReason ? ` (${o.shiftReason})` : ''}`;
        return `- ${o.date}: ${o.type} override`;
      })
      .join('\n');
    eventContext += `\n\nSpecial schedule overrides:\n${oLines}`;
  }

  return eventContext;
}

// ---------------------------------------------------------------------------
// Core chat resolver (self-contained, no src/ imports)
// ---------------------------------------------------------------------------

async function resolveAnswer(
  message: string,
  isZh: boolean,
  calendarState?: AppSyncState
): Promise<string> {
  const q = message.toLowerCase();

  // --- Add event handling (serverless direct storage, no external server required) ---
  const addKeywords = ['add', 'create', 'schedule', 'plan', 'book', 'put', '记', '添加', '加入', '安排', '计划', '/add'];
  const eventKeywords = ['event', 'trip', 'holiday', 'plan', 'gathering', 'appointment', 'staycation', 'dinner', 'lunch', '活动', '旅行', '假期', '聚餐', '行程', '聚会', '门诊', '看病', '复诊'];
  const wantsAdd = (addKeywords.some((k) => q.includes(k)) && (eventKeywords.some((k) => q.includes(k)) || q.startsWith('/add'))) || q.startsWith('/add');

  if (wantsAdd) {
    const range = extractDateRange(message);
    const singleDate = extractDate(message);
    const startDate = range?.start || singleDate;
    const endDate = range?.end;

    if (startDate) {
      const cleanTitle = extractCleanTitle(message, isZh);
      const cat = inferCategory(message);
      const loc = extractLocation(message);
      const tm = extractTime(message);

      const { event: ev, cloudSync } = await saveCalendarEvent({
        title: cleanTitle,
        startDate,
        endDate,
        category: cat,
        location: loc,
        time: tm,
      });

      const dateRange = ev.endDate ? `${ev.startDate} – ${ev.endDate}` : ev.startDate;
      const locPart = ev.location ? ` @ ${ev.location}` : '';
      const syncNote = cloudSync
        ? (isZh ? '☁️ 已实时同步至家庭日历。' : '☁️ Live-synced to family calendar.')
        : (isZh ? '⚠️ 提示：Vercel 尚未配置 GITHUB_TOKEN，此活动仅临时保存在本地。配置 GITHUB_TOKEN 后即可全家自动同步。' : '⚠️ Note: GITHUB_TOKEN is not configured in Vercel. Add GITHUB_TOKEN in your Vercel project settings to sync across all family devices.');

      return isZh
        ? `好的！我已把活动添加到日历：\n\n📅 ${ev.title}\n🗓 ${dateRange}${locPart}${ev.time ? `\n⏰ ${ev.time}` : ''}\n\n${syncNote}\n您可以在日历网页上查看！`
        : `Done! I've added this to the calendar:\n\n📅 ${ev.title}\n🗓 ${dateRange}${locPart}${ev.time ? `\n⏰ ${ev.time}` : ''}\n\n${syncNote}\nYou can check it on the calendar web app!`;
    }

    return isZh
      ? `要添加活动，请提供活动名称和日期（例如：“6月20日晚上7点在爸爸家聚餐” 或 “添加 2026-06-20 聚餐”）。我会直接为您记录到家庭日历中！`
      : `To add an event, please tell me the event name and date (e.g. "Add a family staycation at Sentosa from 20 to 22 June 2026" or "Add dinner on 20 June 2026 at 7pm"). I will save it directly to the calendar!`;
  }

  const dateStr = extractDate(message);

  // --- Check calendar events in fallback mode ---
  const asksEvent =
    q.includes('event') || q.includes('plan') || q.includes('schedule') || q.includes('trip') ||
    q.includes('staycation') || q.includes('gathering') || q.includes('dinner') || q.includes('lunch') ||
    q.includes('活动') || q.includes('安排') || q.includes('计划') || q.includes('聚餐') || q.includes('聚会');

  if (asksEvent && calendarState?.events && calendarState.events.length > 0) {
    const today = todaySGT();
    const targetDate = dateStr || today;
    const matching = dateStr
      ? calendarState.events.filter((e) => (e.startDate <= targetDate && (e.endDate || e.startDate) >= targetDate) || e.startDate === targetDate)
      : calendarState.events
          .filter((e) => (e.endDate || e.startDate) >= today)
          .sort((a, b) => a.startDate.localeCompare(b.startDate))
          .slice(0, 5);

    if (matching.length > 0) {
      const list = matching.map((e) => {
        const dRange = e.endDate && e.endDate !== e.startDate ? `${e.startDate} ~ ${e.endDate}` : e.startDate;
        const loc = e.location ? ` @ ${e.location}` : '';
        const time = e.time ? ` ${e.time}` : '';
        return `• [${e.title}] ${dRange}${time}${loc}`;
      }).join('\n');

      return isZh
        ? `📅 ${dateStr ? `${dateStr} 的` : '近期'}日历活动：\n${list}`
        : `📅 ${dateStr ? `Events on ${dateStr}` : 'Upcoming family calendar events'}:\n${list}`;
    }
  }

  const asksAhma =
    q.includes('ahma') || q.includes('grandma') || q.includes('grandmother') ||
    q.includes('阿嬷') || q.includes('外婆') || q.includes('奶奶') ||
    q.includes('kay cheow') || q.includes('kay guan') || q.includes('kay boon') ||
    q.includes('启超') || q.includes('启源') || q.includes('启文');

  const asksShift =
    q.includes('jun jie') || q.includes('junjie') || q.includes('俊杰') ||
    q.includes('shift') || q.includes('work') || q.includes('班次') ||
    q.includes('上班') || q.includes('工作');

  const asksHoliday =
    q.includes('holiday') || q.includes('假期') || q.includes('public holiday') ||
    q.includes('公假') || q.includes('national day') || q.includes('cny') ||
    q.includes('chinese new year') || q.includes('新年');

  // --- Ahma location ---
  if (asksAhma) {
    const today = todaySGT();
    const current = getAhmaLocation(today);
    const targetCode =
      q.includes('kc') || q.includes('kay cheow') || q.includes('启超') || q.includes('dad') || q.includes('爸爸') ? 'KC' :
      q.includes('kg') || q.includes('kay guan') || q.includes('启源') ? 'KG' :
      q.includes('kb') || q.includes('kay boon') || q.includes('启文') ? 'KB' : null;

    const asksWhen =
      q.includes('when') || q.includes('next') || q.includes('coming') || q.includes('come') ||
      q.includes('arrive') || q.includes('visit') || q.includes('visiting') || q.includes('turn') ||
      q.includes('go') || q.includes('reach') || q.includes('几时') || q.includes('什么时候') ||
      q.includes('何时') || q.includes('下次') || q.includes('过来') || q.includes('去') ||
      q.includes('来') || q.includes('到') || q.includes('轮到') ||
      (!dateStr && targetCode !== null);

    if (asksWhen) {
      if (targetCode) {
        const locName = LOCATION_NAMES[targetCode] ?? { en: targetCode, zh: targetCode };
        const isCurrentlyThere = current.code === targetCode;
        const nextVisit = nextAhmaVisit(today, targetCode);

        if (isCurrentlyThere) {
          const nextName = LOCATION_NAMES[current.nextCode] ?? { en: current.nextCode, zh: current.nextCode };
          return isZh
            ? `👵 阿嬷目前就在 ${locName.zh} (${targetCode})！\n• 今天是第 ${current.dayInStay} 天（共 ${GRANDMA_DAYS_PER_LOCATION} 天），还剩 ${current.daysLeft} 天（直到 ${current.nextDate} 前往 ${nextName.zh}）。\n• 下一次再轮到 ${locName.zh} 是 ${nextVisit.date}（${nextVisit.daysAway} 天后）。`
            : `👵 Ahma is currently at ${locName.en} (${targetCode}) right now!\n• Today is Day ${current.dayInStay} of ${GRANDMA_DAYS_PER_LOCATION} (${current.daysLeft} days remaining, until ${current.nextDate} when she moves to ${nextName.en}).\n• Her next return visit to ${locName.en} is on ${nextVisit.date} (in ${nextVisit.daysAway} days).`;
        }

        if (nextVisit.daysAway >= 0) {
          const curName = LOCATION_NAMES[current.code] ?? { en: current.code, zh: current.code };
          return isZh
            ? `👵 阿嬷下次到 ${locName.zh} (${targetCode}) 是 ${nextVisit.date}（${nextVisit.daysAway} 天后，住到 ${nextVisit.endDate}）。\n• 目前阿嬷在 ${curName.zh}，还剩 ${current.daysLeft} 天（直到 ${current.nextDate}）。`
            : `👵 Ahma will be coming over to ${locName.en} (${targetCode}) on ${nextVisit.date} (in ${nextVisit.daysAway} days, staying until ${nextVisit.endDate}).\n• Currently, Ahma is staying at ${curName.en} (${current.daysLeft} days left until ${current.nextDate}).`;
        }
      } else {
        // No target code mentioned — tell where Ahma is today and when she moves next
        const curName = LOCATION_NAMES[current.code] ?? { en: current.code, zh: current.code };
        const nextName = LOCATION_NAMES[current.nextCode] ?? { en: current.nextCode, zh: current.nextCode };
        return isZh
          ? `👵 阿嬷目前在 ${curName.zh} (${current.code})，还剩 ${current.daysLeft} 天，将于 ${current.nextDate} 前往 ${nextName.zh} (${current.nextCode})。`
          : `👵 Ahma is currently at ${curName.en} (${current.code}) with ${current.daysLeft} days left, then moves to ${nextName.en} (${current.nextCode}) on ${current.nextDate}.`;
      }
    }

    const check = dateStr || today;
    const isToday = check === today;
    const loc = getAhmaLocation(check);
    const name = LOCATION_NAMES[loc.code] ?? { en: loc.code, zh: loc.code };
    if (loc.isCny) {
      return isZh
        ? `🧧 在 ${check}，适逢农历新年特殊安排，阿嬷住在 ${name.zh}（${loc.code}）。`
        : `🧧 On ${check}, it's the CNY special arrangement — Ahma is at ${name.en} (${loc.code}).`;
    }
    const nextName = LOCATION_NAMES[loc.nextCode] ?? { en: loc.nextCode, zh: loc.nextCode };
    return isZh
      ? `👵 ${isToday ? '今天' : `在 ${check}`}，阿嬷住在 ${name.zh}（${loc.code}）。\n• 当前周期居住第 ${loc.dayInStay} 天（共 ${GRANDMA_DAYS_PER_LOCATION} 天，还剩 ${loc.daysLeft} 天，将于 ${loc.nextDate} 前往 ${nextName.zh}）。`
      : `👵 ${isToday ? 'Today' : `On ${check}`}, Ahma is staying at ${name.en} (${loc.code}).\n• Day ${loc.dayInStay} of ${GRANDMA_DAYS_PER_LOCATION} in this stay (${loc.daysLeft} days left, moving to ${nextName.en} on ${loc.nextDate}).`;
  }

  // --- Jun Jie shift ---
  if (asksShift) {
    const check = dateStr || '2026-06-15';
    const shift = getJunjieShift(check);
    const ZH_SHIFT: Record<string, string> = {
      'Night': '晚班', 'Morning': '早班',
      'Afternoon 1': '午1班', 'Afternoon 2': '午2班', 'Afternoon 3': '午3班',
      'OFF Day': '休息', 'REST DAY': '休息',
    };
    const shiftLabelEn = shift.time ? `${shift.name} (${shift.time})` : shift.name;
    const shiftLabelZh = shift.time
      ? `${ZH_SHIFT[shift.name] ?? shift.name} (${shift.time})`
      : (ZH_SHIFT[shift.name] ?? shift.name);
    return isZh
      ? `在 ${check}，俊杰上 ${shiftLabelZh}（第 ${shift.weekNum} 周排班）。\n他的排班为3周一循环，从 2026年6月15日（周一）开始。`
      : `On ${check}, Jun Jie is on ${shiftLabelEn} (Week ${shift.weekNum} of 3).\nHis roster repeats every 3 weeks, starting Monday 15 June 2026.`;
  }

  // --- Public holidays ---
  if (asksHoliday) {
    if (dateStr && SINGAPORE_PUBLIC_HOLIDAYS[dateStr]) {
      const name = SINGAPORE_PUBLIC_HOLIDAYS[dateStr];
      return isZh
        ? `${dateStr} 是新加坡公共假期：${name}。`
        : `${dateStr} is a Singapore Public Holiday: ${name}.`;
    }
    return isZh
      ? `新加坡 2026 年主要公共假期：\n• 5月1日：劳动节\n• 5月31日 - 6月1日：卫塞节及补假\n• 8月9日 - 8月10日：国庆日及补假\n• 11月8日 - 11月9日：屠妖节及补假\n• 12月25日：圣诞节`
      : `Singapore 2026 Public Holidays:\n• 1 May: Labour Day\n• 31 May – 1 Jun: Vesak Day & In-Lieu\n• 9 Aug – 10 Aug: National Day & In-Lieu\n• 8 Nov – 9 Nov: Deepavali & In-Lieu\n• 25 Dec: Christmas Day`;
  }

  // --- Default ---
  return isZh
    ? `你好！有什么我可以帮你的吗？😊\n\n我也很擅长回答：\n• 阿嬷在某天住在哪里（例如："2026年6月15日阿嬷在哪里？"）\n• 俊杰某天的班次（例如："6月15日俊杰上什么班？"）\n• 新加坡公共假期\n• 添加家庭活动（例如："添加 6月20日 晚上7点 爸爸家聚餐"）`
    : `Hey there! What's on your mind? 😊\n\nI'm also great with:\n• Where Ahma is staying on any date (e.g. "Where is Ahma on 15 June 2026?")\n• Jun Jie's shift on any date (e.g. "What is Jun Jie's shift on 15 June?")\n• Singapore public holidays\n• Add calendar events (e.g. "Add dinner on 20 June 2026 at 7pm")`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function detectLanguage(text: string): 'en' | 'zh' {
  return /[\u4e00-\u9fa5]/.test(text) ? 'zh' : 'en';
}

async function sendTelegramMessage(token: string, chatId: number, text: string) {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error('Telegram sendMessage failed:', err);
  }
}

async function getAiReply(
  message: string,
  language: 'en' | 'zh',
  apiKey: string,
  calendarState: AppSyncState
): Promise<string> {
  const groq = new Groq({ apiKey });
  const q = message.toLowerCase();

  // If the user clearly wants to add an event, extract details and save
  const addKeywords = ['add', 'create', 'schedule', 'plan', 'book', 'put', '记', '添加', '加入', '安排', '计划', '/add'];
  const eventKeywords = ['event', 'trip', 'holiday', 'plan', 'gathering', 'appointment', 'staycation', 'dinner', 'lunch', '活动', '旅行', '假期', '聚餐', '行程', '聚会', '门诊', '看病', '复诊'];
  const wantsAdd = (addKeywords.some((k) => q.includes(k)) && (eventKeywords.some((k) => q.includes(k)) || q.startsWith('/add'))) || q.startsWith('/add');

  if (wantsAdd) {
    const intentPrompt = `You are an assistant for a family calendar app.
Extract event details from this message: "${message}".
Today is ${todaySGT()}.
Respond ONLY with JSON:
{
  "title": string,
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD or null",
  "category": "holiday_plan" | "family_gathering" | "medical" | "leave" | "general",
  "memberId": "all" | "grandma" | "junjie" | "layting" | "dad" | "mom",
  "time": "HH:MM or null",
  "location": "string or null",
  "notes": "string or null"
}`;

    try {
      const { completion: intentCompletion } = await createGroqChat(groq, {
        messages: [{ role: 'user', content: intentPrompt }],
        temperature: 0.1,
        max_tokens: 256,
      });
      const raw = intentCompletion.choices[0]?.message?.content?.trim() ?? '';
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const extractedEvent = JSON.parse(jsonMatch[0]);
        if (extractedEvent?.title && extractedEvent?.startDate) {
          const { event: ev, cloudSync } = await saveCalendarEvent({
            title: extractedEvent.title,
            startDate: extractedEvent.startDate,
            endDate: extractedEvent.endDate || undefined,
            category: extractedEvent.category || 'general',
            memberId: extractedEvent.memberId || 'all',
            time: extractedEvent.time || undefined,
            location: extractedEvent.location || undefined,
            notes: extractedEvent.notes || undefined,
          });

          const dateRange = ev.endDate ? `${ev.startDate} – ${ev.endDate}` : ev.startDate;
          const locPart = ev.location ? ` @ ${ev.location}` : '';
          const syncNote = cloudSync
            ? (language === 'zh' ? '☁️ 已实时同步至家庭日历。' : '☁️ Live-synced to family calendar.')
            : (language === 'zh' ? '⚠️ 提示：Vercel 尚未配置 GITHUB_TOKEN，此活动仅保存在本地。配置 GITHUB_TOKEN 后即可全家自动同步。' : '⚠️ Note: GITHUB_TOKEN is not configured in Vercel. Add GITHUB_TOKEN in your Vercel project settings to sync across all devices.');

          return language === 'zh'
            ? `好的！我已把活动添加到日历：\n\n📅 ${ev.title}\n🗓 ${dateRange}${locPart}${ev.time ? `\n⏰ ${ev.time}` : ''}\n\n${syncNote}\n您可以在日历网页上查看！`
            : `Done! I've added this to the calendar:\n\n📅 ${ev.title}\n🗓 ${dateRange}${locPart}${ev.time ? `\n⏰ ${ev.time}` : ''}\n\n${syncNote}\nYou can check it on the calendar web app!`;
        }
      }
    } catch (err) {
      console.warn('[telegram] AI event extraction failed, falling back to regex parser:', err);
    }
  }

  // Live calendar state context (events + overrides)
  const eventContext = formatCalendarContext(calendarState);
  const today = todaySGT();
  const ahmaNow = getAhmaLocation(today);
  const locNow = LOCATION_NAMES[ahmaNow.code] ?? { en: ahmaNow.code, zh: ahmaNow.code };
  const nextKC = nextAhmaVisit(today, 'KC');
  const nextKG = nextAhmaVisit(today, 'KG');
  const nextKB = nextAhmaVisit(today, 'KB');
  const jjToday = getJunjieShift(today);
  const nextLocNow = LOCATION_NAMES[ahmaNow.nextCode] ?? { en: ahmaNow.nextCode, zh: ahmaNow.nextCode };

  const systemPrompt = `TODAY IS ${today} (Singapore Time, SGT UTC+8). Use this as the current date for ALL answers.

You are Ahma Bot 🌸, a warm and friendly family assistant for the "Ahma's Rotation" app. You love chatting with the family and can talk about anything — daily life, food, feelings, general questions, or casual conversation. You are helpful, cheerful, and feel like a family member.

CRITICAL LIVE CALENDAR DATA (USE DIRECTLY — DO NOT CALCULATE OR COUNT CYCLES FROM MAY 2026):
- Ahma is CURRENTLY at: ${locNow.en} (${ahmaNow.code}), Day ${ahmaNow.dayInStay}/${GRANDMA_DAYS_PER_LOCATION}, ${ahmaNow.daysLeft} days remaining. Moves to ${nextLocNow.en} on ${ahmaNow.nextDate}.
- Next time Ahma arrives at KC (Kay Cheow / Dad's place / 爸爸家): ${nextKC.date} (in ${nextKC.daysAway} days, staying until ${nextKC.endDate}).
- Next time Ahma arrives at KG (Kay Guan / 启源): ${nextKG.date} (in ${nextKG.daysAway} days, staying until ${nextKG.endDate}).
- Next time Ahma arrives at KB (Kay Boon / 启文): ${nextKB.date} (in ${nextKB.daysAway} days, staying until ${nextKB.endDate}).
- Jun Jie TODAY: ${jjToday.name}${jjToday.time ? ` (${jjToday.time})` : ''} (Week ${jjToday.weekNum} of 3).
- CNY special (Eve 5pm → Day 2 8pm): 2026 KG, 2027 KB, 2028 KC (Dad's), 2029 KG, repeating.
- Rotation sequence: Dad's place (KC) → Kay Guan (KG) → Kay Boon (KB), 14 days each.
${eventContext || '\n(No calendar events loaded)'}

ANSWER RULES:
- When asked "When is Ahma coming over / next at KC / Dad's place / 爸爸家" → ANSWER DIRECTLY: ${nextKC.date} (in ${nextKC.daysAway} days). If she is currently there, state that she is already at KC right now!
- When asked "When is Ahma next at KG / 启源" → ANSWER DIRECTLY: ${nextKG.date} (in ${nextKG.daysAway} days).
- When asked "When is Ahma next at KB / 启文" → ANSWER DIRECTLY: ${nextKB.date} (in ${nextKB.daysAway} days).
- When asked "Where is Ahma today / now" → ANSWER DIRECTLY: ${locNow.en} (${ahmaNow.code}), Day ${ahmaNow.dayInStay} of 14, with ${ahmaNow.daysLeft} days remaining.
- CRITICAL: DO NOT start by reciting cycle history or counting cycles from 7 May 2026! Answer the user's question directly in the very first sentence.
- When answering about events or plans, translate event titles and details into Chinese if the user is speaking Chinese, or keep in English otherwise.
- For casual chat, just be natural and warm. For calendar questions, be accurate and concise.
Answer in ${language === 'zh' ? 'Chinese (中文)' : 'English'}. Plain text only, no Markdown.`;

  const { completion } = await createGroqChat(groq, {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: message },
    ],
    temperature: 0.7,
    max_tokens: 512,
  });
  return completion.choices[0]?.message?.content?.trim() ?? '';
}

// ---------------------------------------------------------------------------
// Vercel Serverless Handler
// ---------------------------------------------------------------------------

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const TELEGRAM_TOKEN = (process.env.TELEGRAM_BOT_TOKEN ?? '').trim();

  // If accessed via GET in browser, provide live health & configuration check
  if (req.method !== 'POST') {
    const hasToken = Boolean(TELEGRAM_TOKEN);
    const hasGroq = Boolean((process.env.GROQ_API_KEY ?? '').trim());
    const hasGithub = isCloudSyncConfigured();
    return res.status(200).json({
      status: 'active',
      service: 'Ahma Rotation Telegram Webhook',
      time: new Date().toISOString(),
      env: {
        TELEGRAM_BOT_TOKEN: hasToken ? `set (ends ...${TELEGRAM_TOKEN.slice(-4)}) ✅` : 'MISSING ❌ — Add TELEGRAM_BOT_TOKEN to Vercel Environment Variables',
        GROQ_API_KEY: hasGroq ? 'configured ✅' : 'MISSING ❌ — Add GROQ_API_KEY to Vercel Environment Variables',
        GITHUB_TOKEN: hasGithub ? 'configured ✅ (multi-device cloud sync active)' : 'NOT SET ⚠️ (local memory only)',
      },
      webhookHelp: 'If bot is not responding on Telegram, make sure you set the webhook by opening in your browser: https://api.telegram.org/bot<YOUR_TOKEN>/setWebhook?url=https://<YOUR_APP_DOMAIN>/telegram/webhook',
    });
  }

  // Handle Telegram POST Webhook update
  if (!TELEGRAM_TOKEN) {
    console.error('[telegram] TELEGRAM_BOT_TOKEN is not set in Vercel environment variables.');
    // Always return HTTP 200 so Telegram does not get stuck in a webhook retry storm
    return res.status(200).json({ error: 'TELEGRAM_BOT_TOKEN is not set in Vercel environment variables.' });
  }

  const body = req.body;
  const msg = body?.message ?? body?.edited_message;

  if (!msg?.text) {
    return res.status(200).end();
  }

  const chatId: number = msg.chat.id;
  const userText: string = msg.text.trim();
  const language = detectLanguage(userText);

  let replyText = '';

  try {
    if (userText === '/start') {
      replyText =
        language === 'zh'
          ? '您好！我是阿嬷日程小助手 🌸\n\n您可以问我：\n• 某一天阿嬷住在谁家（例如：“阿嬷几时来爸爸家？”）\n• 俊杰的上下班班次（例如：“6月15日俊杰上什么班？”）\n• 日历上的活动和假期计划\n• 新加坡公共假期\n• 添加活动（例如：“添加 6月20日 晚上7点 爸爸家聚餐” 或 “/add 2026-06-20 聚餐”）\n• 或者聊任何话题！\n\n例如：「2026年6月15日阿嬷住在哪里？」'
          : "Hello! I'm Ahma Bot 🌸\n\nYou can ask me:\n• Where Ahma is staying on any date (e.g. \"When is Ahma coming over to KC house?\")\n• Jun Jie's work shift on any date\n• Events and holiday plans on the calendar\n• Singapore public holidays\n• Add calendar events (e.g. \"Add dinner on 20 June 2026 at 7pm\" or \"/add 2026-06-20 Family gathering\")\n• Or just have a chat!\n\nExample: \"Where is Ahma on 15 June 2026?\"";
    } else {
      let calendarState: AppSyncState;
      try {
        calendarState = await readState();
      } catch {
        calendarState = structuredClone(DEFAULT_STATE);
      }

      const groqKey = (process.env.GROQ_API_KEY ?? '').trim();
      if (groqKey) {
        try {
          replyText = await getAiReply(userText, language, groqKey, calendarState);
        } catch (err: any) {
          console.warn('[telegram] Groq failed, using local solver:', err?.message ?? err);
        }
      }

      if (!replyText) {
        replyText = await resolveAnswer(userText, language === 'zh', calendarState);
      }
    }

    if (!replyText) {
      replyText = language === 'zh' ? '抱歉，我未能理解，请再试一次。' : 'Sorry, I could not process that. Please try again.';
    }

    await sendTelegramMessage(TELEGRAM_TOKEN, chatId, replyText);
  } catch (err) {
    console.error('[telegram] Webhook handler error:', err);
    try {
      await sendTelegramMessage(
        TELEGRAM_TOKEN,
        chatId,
        language === 'zh'
          ? '抱歉，处理您的消息时出现异常，请稍后再试。'
          : 'Sorry, an error occurred while processing your message. Please try again shortly.'
      );
    } catch {}
  }

  // Always return HTTP 200 to acknowledge receipt to Telegram
  return res.status(200).end();
}
