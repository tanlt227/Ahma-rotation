import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

// ---------------------------------------------------------------------------
// Schedule constants (mirrored from src/data/schedule.ts)
// ---------------------------------------------------------------------------

const GRANDMA_ANCHOR = '2026-05-07';
const GRANDMA_SEQUENCE = ['KC', 'KG', 'KB'];
const GRANDMA_DAYS = 14;

const CNY_SCHEDULE: Record<number, { eve: string; day1: string; day2: string; code: string }> = {
  2026: { eve: '2026-02-16', day1: '2026-02-17', day2: '2026-02-18', code: 'KG' },
  2027: { eve: '2027-02-05', day1: '2027-02-06', day2: '2027-02-07', code: 'KB' },
  2028: { eve: '2028-01-25', day1: '2028-01-26', day2: '2028-01-27', code: 'KC' },
  2029: { eve: '2029-02-12', day1: '2029-02-13', day2: '2029-02-14', code: 'KG' },
  2030: { eve: '2030-02-02', day1: '2030-02-03', day2: '2030-02-04', code: 'KB' },
};

const LOCATION_NAMES: Record<string, { en: string; zh: string }> = {
  KC: { en: "Kay Cheow (Dad's place)", zh: '启超 (爸爸家)' },
  KG: { en: 'Kay Guan',                zh: '启源' },
  KB: { en: 'Kay Boon',                zh: '启文' },
};

const SG_PUBLIC_HOLIDAYS: Record<string, string> = {
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

// Jun Jie 3-week roster anchored Mon 15 Jun 2026
const JUNJIE_ANCHOR = '2026-06-15';
const JUNJIE_ROSTER: { name: string; time: string }[] = [
  // Week 1
  { name: 'Night',       time: '2200-0900' }, // Mon
  { name: 'Night',       time: '2200-0900' }, // Tue
  { name: 'OFF Day',     time: ''          }, // Wed
  { name: 'REST DAY',    time: ''          }, // Thu
  { name: 'Morning',     time: '0630-1530' }, // Fri
  { name: 'Morning',     time: '0630-1530' }, // Sat
  { name: 'Morning',     time: '0630-1530' }, // Sun
  // Week 2
  { name: 'Morning',     time: '0630-1530' }, // Mon
  { name: 'OFF Day',     time: ''          }, // Tue
  { name: 'Afternoon 1', time: '1400-0100' }, // Wed
  { name: 'Afternoon 1', time: '1400-0100' }, // Thu
  { name: 'Afternoon 2', time: '1500-0200' }, // Fri
  { name: 'Afternoon 2', time: '1500-0200' }, // Sat
  { name: 'REST DAY',    time: ''          }, // Sun
  // Week 3
  { name: 'OFF Day',     time: ''          }, // Mon
  { name: 'Morning',     time: '0630-1530' }, // Tue
  { name: 'Morning',     time: '0630-1530' }, // Wed
  { name: 'Morning',     time: '0630-1530' }, // Thu
  { name: 'REST DAY',    time: ''          }, // Fri
  { name: 'Afternoon 3', time: '1600-0100' }, // Sat
  { name: 'Afternoon 3', time: '1600-0100' }, // Sun
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysBetween(a: string, b: string): number {
  const [yA, mA, dA] = a.split('-').map(Number);
  const [yB, mB, dB] = b.split('-').map(Number);
  return Math.round((Date.UTC(yA, mA - 1, dA) - Date.UTC(yB, mB - 1, dB)) / 86400000);
}

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  // Use UTC arithmetic to avoid DST shifts
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().split('T')[0];
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-SG', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
}

function getAhmaInfo(dateStr: string) {
  // Check CNY override first
  const year = parseInt(dateStr.split('-')[0]);
  const cny = CNY_SCHEDULE[year];
  if (cny && (dateStr === cny.eve || dateStr === cny.day1 || dateStr === cny.day2)) {
    const stage = dateStr === cny.eve ? 'Eve' : dateStr === cny.day1 ? 'Day 1' : 'Day 2';
    return { code: cny.code, dayInStay: 1, daysLeft: 0, nextCode: 'Regular rotation', nextDate: addDays(dateStr, 1), isCny: true, cnyStage: stage };
  }
  const diff = daysBetween(dateStr, GRANDMA_ANCHOR);
  const total = GRANDMA_SEQUENCE.length * GRANDMA_DAYS;
  const cycleDay = ((diff % total) + total) % total;
  const locIdx = Math.floor(cycleDay / GRANDMA_DAYS);
  const code = GRANDMA_SEQUENCE[locIdx];
  const dayInStay = (cycleDay % GRANDMA_DAYS) + 1;
  const daysLeft = GRANDMA_DAYS - dayInStay;
  const nextCode = GRANDMA_SEQUENCE[(locIdx + 1) % GRANDMA_SEQUENCE.length];
  const nextDate = addDays(dateStr, daysLeft + 1);
  return { code, dayInStay, daysLeft, nextCode, nextDate, isCny: false, cnyStage: '' };
}

function getJunjieShift(dateStr: string) {
  const diff = daysBetween(dateStr, JUNJIE_ANCHOR);
  const idx = ((diff % 21) + 21) % 21;
  const week = Math.floor(idx / 7) + 1;
  return { ...JUNJIE_ROSTER[idx], week };
}

function nextAhmaVisit(fromDate: string, targetCode: string): { date: string; daysAway: number } {
  for (let i = 1; i <= GRANDMA_DAYS * GRANDMA_SEQUENCE.length * 2; i++) {
    const d = addDays(fromDate, i);
    const info = getAhmaInfo(d);
    if (info.code === targetCode && info.dayInStay === 1 && !info.isCny) {
      return { date: d, daysAway: i };
    }
  }
  return { date: '?', daysAway: -1 };
}

function detectLanguage(text: string): 'en' | 'zh' {
  return /[\u4e00-\u9fa5]/.test(text) ? 'zh' : 'en';
}

// ---------------------------------------------------------------------------
// Build rich calendar context for Gemini
// ---------------------------------------------------------------------------

function buildCalendarContext(today: string): string {
  const ahmaToday = getAhmaInfo(today);
  const locToday = LOCATION_NAMES[ahmaToday.code] ?? { en: ahmaToday.code, zh: ahmaToday.code };
  const junjieToday = getJunjieShift(today);

  const nextKC = nextAhmaVisit(today, 'KC');
  const nextKG = nextAhmaVisit(today, 'KG');
  const nextKB = nextAhmaVisit(today, 'KB');

  // Next 7 days snapshot
  const weekSnapshot = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(today, i);
    const a = getAhmaInfo(d);
    const j = getJunjieShift(d);
    const h = SG_PUBLIC_HOLIDAYS[d] ? ` 🇸🇬 ${SG_PUBLIC_HOLIDAYS[d]}` : '';
    const aName = LOCATION_NAMES[a.code]?.en ?? a.code;
    const jStr = j.time ? `${j.name} (${j.time})` : j.name;
    return `  ${d}: Ahma@${aName}(Day${a.dayInCurrentStay??a.dayInStay}/${GRANDMA_DAYS})${a.isCny?` [CNY ${a.cnyStage}]`:''} | JJ:${jStr}${h}`;
  }).join('\n');

  // CNY summary for next few years
  const cnySummary = Object.entries(CNY_SCHEDULE)
    .map(([yr, c]) => `  ${yr}: Eve=${c.eve}, Day1=${c.day1}, Day2=${c.day2} → ${LOCATION_NAMES[c.code]?.en} (${c.code})`)
    .join('\n');

  // Next public holiday
  let nextHoliday = '';
  for (let i = 0; i <= 365; i++) {
    const d = addDays(today, i);
    if (SG_PUBLIC_HOLIDAYS[d]) { nextHoliday = `${d} — ${SG_PUBLIC_HOLIDAYS[d]} (in ${i} days)`; break; }
  }

  const [ty, tm, td] = today.split('-').map(Number);
  const todayWeekday = new Date(Date.UTC(ty, tm - 1, td)).toLocaleDateString('en-SG', { weekday: 'long', timeZone: 'UTC' });
  return `=== LIVE CALENDAR DATA ===
Today: ${today} (${todayWeekday})

AHMA NOW: ${locToday.en} (${ahmaToday.code}), Day ${ahmaToday.dayInStay} of ${GRANDMA_DAYS}
  ${ahmaToday.daysLeft} days left, then → ${LOCATION_NAMES[ahmaToday.nextCode]?.en ?? ahmaToday.nextCode} (${ahmaToday.nextCode}) on ${ahmaToday.nextDate}

NEXT ARRIVALS (first day of each stay):
  Next KC (${LOCATION_NAMES.KC.en}): ${nextKC.date} — ${formatDate(nextKC.date)} (in ${nextKC.daysAway} days)
  Next KG (${LOCATION_NAMES.KG.en}): ${nextKG.date} — ${formatDate(nextKG.date)} (in ${nextKG.daysAway} days)
  Next KB (${LOCATION_NAMES.KB.en}): ${nextKB.date} — ${formatDate(nextKB.date)} (in ${nextKB.daysAway} days)

JUN JIE TODAY: ${junjieToday.time ? `${junjieToday.name} (${junjieToday.time})` : junjieToday.name} — Week ${junjieToday.week} of 3

NEXT 7 DAYS:
${weekSnapshot}

CNY SPECIAL ARRANGEMENT (Eve 5pm → Day 2 8pm, Ahma stays at:):
${cnySummary}

NEXT PUBLIC HOLIDAY: ${nextHoliday}
========================`;
}

// ---------------------------------------------------------------------------
// Vercel handler
// ---------------------------------------------------------------------------

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message } = req.body || {};
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message is required' });
  }

  const lang = detectLanguage(message);
  // Use Singapore Time (UTC+8) for today's date
  const now = new Date();
  const today = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().split('T')[0];
  const calendarContext = buildCalendarContext(today);

  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });

      const systemPrompt = `You are Ahma Bot 🌸 — a warm, cheerful family assistant for a Singapore Chinese family's "Ahma's Rotation" app. You're like a trusted family member: friendly, helpful, and happy to chat about anything at all — food, daily life, feelings, plans, or just casual conversation.

CRITICAL RULE: Always respond in the EXACT SAME LANGUAGE as the user's message.
- English message → English response (even if the app is in Chinese mode)
- Chinese message → Chinese response
- Mixed → match the dominant language
Never switch languages unless explicitly asked.

${calendarContext}

ROTATION RULES (use the live data above for calculations, not these rules directly):
- Ahma rotates KC → KG → KB, 14 days each, starting 7 May 2026 at KC
- KC = Kay Cheow = Dad's place (爸爸家). All three are the same: KC, Kay Cheow, Dad's place
- CNY special: Ahma stays at the CNY location from Eve 5pm until Day 2 8pm
- Jun Jie (JJ) 3-week roster: anchored Monday 15 Jun 2026 (see NEXT 7 DAYS for upcoming shifts)

QUERY HANDLING — answer these naturally using the live data:
- "where is Ahma" / "who has Ahma" → use AHMA NOW
- "when is Ahma coming to KC/KG/KB" / "when is Ahma next at Dad's" → use NEXT ARRIVALS
- "where is Ahma during CNY [year]" → use CNY SPECIAL ARRANGEMENT table
- "is Ahma at KC this week" → check NEXT 7 DAYS
- "when does Ahma move next" → use "days left" and nextDate from AHMA NOW
- "what shift is JJ working" / "is JJ working tomorrow" → use JUN JIE TODAY or NEXT 7 DAYS
- "any public holidays soon" / "is [date] a holiday" → use NEXT PUBLIC HOLIDAY
- "what's happening this week" → summarise the NEXT 7 DAYS nicely
- Casual chat (greetings, feelings, food, weather, anything) → just be warm and natural, no need to mention the calendar

RESPONSE STYLE:
- Be conversational and warm, like texting a family member
- For calendar answers: be direct and specific (give the actual date, not just "in X days")
- For casual chat: just chat naturally, keep it short and friendly
- No markdown headers or bullet overload — plain flowing text is fine
- Keep responses concise (2-4 sentences for most answers)`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\nUser: ${message}` }] }],
      });

      if (response.text?.trim()) {
        return res.status(200).json({ reply: response.text.trim() });
      }
    } catch (err: any) {
      console.warn('[chat] Gemini failed:', err?.message ?? err);
    }
  }

  return res.status(200).json({ reply: '' });
}
