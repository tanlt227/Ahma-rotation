import type { VercelRequest, VercelResponse } from '@vercel/node';
import Groq from 'groq-sdk';

// ---------------------------------------------------------------------------
// Schedule constants
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
  '2027-01-01': "New Year's Day",
  '2027-02-06': 'Chinese New Year (Day 1)',
  '2027-02-07': 'Chinese New Year (Day 2)',
  '2027-03-10': 'Hari Raya Puasa',
  '2027-03-26': 'Good Friday',
  '2027-05-01': 'Labour Day',
  '2027-05-16': 'Hari Raya Haji',
  '2027-05-20': 'Vesak Day',
  '2027-08-09': 'National Day',
  '2027-10-29': 'Deepavali',
  '2027-12-25': 'Christmas Day',
};

const JUNJIE_ROSTER: { name: string; time: string }[] = [
  { name: 'Night',       time: '2200-0900' },
  { name: 'Night',       time: '2200-0900' },
  { name: 'OFF Day',     time: ''          },
  { name: 'REST DAY',    time: ''          },
  { name: 'Morning',     time: '0630-1530' },
  { name: 'Morning',     time: '0630-1530' },
  { name: 'Morning',     time: '0630-1530' },
  { name: 'Morning',     time: '0630-1530' },
  { name: 'OFF Day',     time: ''          },
  { name: 'Afternoon 1', time: '1400-0100' },
  { name: 'Afternoon 1', time: '1400-0100' },
  { name: 'Afternoon 2', time: '1500-0200' },
  { name: 'Afternoon 2', time: '1500-0200' },
  { name: 'REST DAY',    time: ''          },
  { name: 'OFF Day',     time: ''          },
  { name: 'Morning',     time: '0630-1530' },
  { name: 'Morning',     time: '0630-1530' },
  { name: 'Morning',     time: '0630-1530' },
  { name: 'REST DAY',    time: ''          },
  { name: 'Afternoon 3', time: '1600-0100' },
  { name: 'Afternoon 3', time: '1600-0100' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todaySGT(): string {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().split('T')[0];
}

function addDaysToDate(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().split('T')[0];
}

function getAhmaInfo(dateStr: string) {
  const year = parseInt(dateStr.split('-')[0]);
  const cny = CNY_SCHEDULE[year];
  if (cny && (dateStr === cny.eve || dateStr === cny.day1 || dateStr === cny.day2)) {
    const stage = dateStr === cny.eve ? 'Eve' : dateStr === cny.day1 ? 'Day 1' : 'Day 2';
    return { code: cny.code, dayInStay: 1, daysLeft: 0, nextCode: 'resumes rotation', nextDate: addDaysToDate(dateStr, 1), isCny: true, cnyStage: stage };
  }
  const [yA, mA, dA] = dateStr.split('-').map(Number);
  const [yB, mB, dB] = GRANDMA_ANCHOR.split('-').map(Number);
  const diff = Math.round((Date.UTC(yA, mA - 1, dA) - Date.UTC(yB, mB - 1, dB)) / 86400000);
  const total = GRANDMA_SEQUENCE.length * GRANDMA_DAYS;
  const cycleDay = ((diff % total) + total) % total;
  const locIdx = Math.floor(cycleDay / GRANDMA_DAYS);
  const code = GRANDMA_SEQUENCE[locIdx];
  const dayInStay = (cycleDay % GRANDMA_DAYS) + 1;
  const daysLeft = GRANDMA_DAYS - dayInStay;
  const nextCode = GRANDMA_SEQUENCE[(locIdx + 1) % GRANDMA_SEQUENCE.length];
  const nextDate = addDaysToDate(dateStr, daysLeft + 1);
  return { code, dayInStay, daysLeft, nextCode, nextDate, isCny: false, cnyStage: '' };
}

function getJunjieShift(dateStr: string) {
  const [yA, mA, dA] = '2026-06-15'.split('-').map(Number);
  const [yB, mB, dB] = dateStr.split('-').map(Number);
  const diff = Math.round((Date.UTC(yB, mB - 1, dB) - Date.UTC(yA, mA - 1, dA)) / 86400000);
  const idx = ((diff % 21) + 21) % 21;
  return { ...JUNJIE_ROSTER[idx], week: Math.floor(idx / 7) + 1 };
}

function nextAhmaVisit(fromDate: string, targetCode: string) {
  for (let i = 1; i <= 42 * 3; i++) {
    const d = addDaysToDate(fromDate, i);
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

function buildCalendarContext(today: string): string {
  const ahma = getAhmaInfo(today);
  const loc = LOCATION_NAMES[ahma.code] ?? { en: ahma.code, zh: ahma.code };
  const jj = getJunjieShift(today);

  const nextKC = nextAhmaVisit(today, 'KC');
  const nextKG = nextAhmaVisit(today, 'KG');
  const nextKB = nextAhmaVisit(today, 'KB');

  const weekSnap = Array.from({ length: 7 }, (_, i) => {
    const d = addDaysToDate(today, i);
    const a = getAhmaInfo(d);
    const j = getJunjieShift(d);
    const h = SG_PUBLIC_HOLIDAYS[d] ? ` [PH: ${SG_PUBLIC_HOLIDAYS[d]}]` : '';
    const aName = LOCATION_NAMES[a.code]?.en ?? a.code;
    const jStr = j.time ? `${j.name} (${j.time})` : j.name;
    return `  ${d}: Ahma@${aName}(Day${a.dayInStay}/${GRANDMA_DAYS})${a.isCny ? ` [CNY ${a.cnyStage}]` : ''} | JJ:${jStr}${h}`;
  }).join('\n');

  const cnySummary = Object.entries(CNY_SCHEDULE)
    .map(([yr, c]) => `  ${yr}: ${LOCATION_NAMES[c.code]?.en} (${c.code}), Eve=${c.eve}`)
    .join('\n');

  let nextHoliday = 'none found in data';
  for (let i = 0; i <= 365; i++) {
    const d = addDaysToDate(today, i);
    if (SG_PUBLIC_HOLIDAYS[d]) { nextHoliday = `${d} — ${SG_PUBLIC_HOLIDAYS[d]} (in ${i} days)`; break; }
  }

  return `=== LIVE CALENDAR DATA (Singapore Time) ===
Today: ${today}
Ahma: ${loc.en} (${ahma.code}), Day ${ahma.dayInStay}/${GRANDMA_DAYS}, ${ahma.daysLeft} days left then → ${LOCATION_NAMES[ahma.nextCode]?.en ?? ahma.nextCode} on ${ahma.nextDate}
Jun Jie today: ${jj.time ? `${jj.name} (${jj.time})` : jj.name} (Week ${jj.week}/3)
Next KC visit: ${nextKC.date} (in ${nextKC.daysAway} days)
Next KG visit: ${nextKG.date} (in ${nextKG.daysAway} days)
Next KB visit: ${nextKB.date} (in ${nextKB.daysAway} days)
Next public holiday: ${nextHoliday}

Next 7 days:
${weekSnap}

CNY special stays (Eve 5pm → Day 2 8pm):
${cnySummary}
===========================================`;
}

// ---------------------------------------------------------------------------
// Groq call helper with retry
// ---------------------------------------------------------------------------

async function callGroq(groq: Groq, messages: Groq.Chat.ChatCompletionMessageParam[]): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages,
        temperature: 0.7,
        max_tokens: 512,
      });
      return completion.choices[0]?.message?.content?.trim() ?? '';
    } catch (err: any) {
      const isRetryable = String(err?.message ?? err).includes('503') ||
                          String(err?.message ?? err).includes('429') ||
                          String(err?.message ?? err).includes('overloaded');
      if (isRetryable && attempt < 2) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  return '';
}

// ---------------------------------------------------------------------------
// Vercel handler
// ---------------------------------------------------------------------------

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message } = req.body || {};
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message is required' });
  }

  const lang = detectLanguage(message);
  const today = todaySGT();
  const calendarContext = buildCalendarContext(today);
  const apiKey = process.env.GROQ_API_KEY;

  if (apiKey) {
    try {
      const groq = new Groq({ apiKey });

      const systemPrompt = `You are Ahma Bot 🌸 — a warm, cheerful assistant for a Singapore Chinese family's "Ahma's Rotation" app. You're like a trusted family member: friendly, helpful, and happy to chat about anything — food, daily life, feelings, plans, or just casual conversation.

CRITICAL: Always respond in the EXACT SAME LANGUAGE as the user's message.
- English message → English response
- Chinese/中文 message → Chinese response
Never switch languages unless explicitly asked.

${calendarContext}

KEY FACTS:
- KC = Kay Cheow = Dad's place (爸爸家) — all three mean the same place
- Ahma rotates KC → KG → KB, 14 days each, anchor 7 May 2026 at KC
- Jun Jie (JJ) has a 3-week repeating shift roster anchored Mon 15 Jun 2026
- For "where is Ahma tomorrow/next week" — check the Next 7 days table above
- For "when is Ahma next at KC/KG/KB" — use the Next KC/KG/KB visit dates above
- For "where is Ahma during CNY [year]" — use the CNY special stays table above
- For "2027 public holidays" or similar — list the SG public holidays for that year
- For casual chat — just be warm and natural

STYLE: Conversational, like texting a family member. Direct and specific. 2-4 sentences max.`;

      const reply = await callGroq(groq, [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: message },
      ]);

      if (reply) return res.status(200).json({ reply });
    } catch (err: any) {
      console.warn('[chat] Groq failed:', err?.message ?? err);
    }
  }

  return res.status(200).json({ reply: '' });
}
