import type { VercelRequest, VercelResponse } from '@vercel/node';
import Groq from 'groq-sdk';
import { readState, updateState } from '../lib/state';
import { createGroqChat } from '../lib/groq';

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

const SG_PUBLIC_HOLIDAYS_BY_YEAR: Record<number, string[]> = {
  2026: [
    "2026-01-01: New Year's Day",
    '2026-02-17: Chinese New Year Day 1',
    '2026-02-18: Chinese New Year Day 2',
    '2026-03-20: Hari Raya Puasa',
    '2026-04-03: Good Friday',
    '2026-05-01: Labour Day',
    '2026-05-27: Hari Raya Haji',
    '2026-05-31: Vesak Day (Sun)',
    '2026-06-01: Vesak Day In-Lieu',
    '2026-08-09: National Day (Sun)',
    '2026-08-10: National Day In-Lieu',
    '2026-11-08: Deepavali (Sun)',
    '2026-11-09: Deepavali In-Lieu',
    '2026-12-25: Christmas Day',
  ],
  2027: [
    "2027-01-01: New Year's Day",
    '2027-02-06: Chinese New Year Day 1',
    '2027-02-07: Chinese New Year Day 2 (Sun)',
    '2027-02-08: Chinese New Year In-Lieu',
    '2027-03-10: Hari Raya Puasa',
    '2027-03-26: Good Friday',
    '2027-05-01: Labour Day',
    '2027-05-16: Hari Raya Haji (Sun)',
    '2027-05-17: Hari Raya Haji In-Lieu',
    '2027-05-20: Vesak Day',
    '2027-08-09: National Day',
    '2027-10-29: Deepavali',
    '2027-12-25: Christmas Day',
  ],
  2028: [
    "2028-01-01: New Year's Day",
    '2028-01-26: Chinese New Year Day 1',
    '2028-01-27: Chinese New Year Day 2',
    '2028-02-27: Hari Raya Puasa',
    '2028-04-14: Good Friday',
    '2028-05-01: Labour Day',
    '2028-05-05: Hari Raya Haji',
    '2028-05-08: Vesak Day',
    '2028-08-09: National Day',
    '2028-10-17: Deepavali',
    '2028-12-25: Christmas Day',
  ],
};

// Flat map for quick lookups
const SG_PUBLIC_HOLIDAYS: Record<string, string> = {};
Object.values(SG_PUBLIC_HOLIDAYS_BY_YEAR).flat().forEach((entry) => {
  const [date] = entry.split(': ');
  SG_PUBLIC_HOLIDAYS[date] = entry.split(': ').slice(1).join(': ');
});

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

  const holidayLists = [2026, 2027, 2028].map((yr) =>
    `  ${yr}: ${(SG_PUBLIC_HOLIDAYS_BY_YEAR[yr] ?? []).join(' | ')}`
  ).join('\n');

  return `=== LIVE CALENDAR DATA (Singapore Time) ===
Today: ${today}
Ahma NOW: ${loc.en} (${ahma.code}), Day ${ahma.dayInStay}/${GRANDMA_DAYS}, ${ahma.daysLeft} days remaining, then moves to ${LOCATION_NAMES[ahma.nextCode]?.en ?? ahma.nextCode} (${ahma.nextCode}) on ${ahma.nextDate}
Jun Jie TODAY: ${jj.time ? `${jj.name} (${jj.time})` : jj.name} (Week ${jj.week}/3)

USE THESE EXACT DATES (do not calculate yourself):
  Next time Ahma arrives at KC (Kay Cheow/Dad's): ${nextKC.date} — that is in ${nextKC.daysAway} days
  Next time Ahma arrives at KG (Kay Guan): ${nextKG.date} — that is in ${nextKG.daysAway} days
  Next time Ahma arrives at KB (Kay Boon): ${nextKB.date} — that is in ${nextKB.daysAway} days
Next public holiday: ${nextHoliday}

Singapore Public Holidays by year (for year-specific queries):
${holidayLists}

Next 7 days schedule:
${weekSnap}

CNY special stays (Ahma stays Eve 5pm → Day 2 8pm at):
${cnySummary}
===========================================`;
}

// ---------------------------------------------------------------------------
// Fetch live events from state (GitHub or local)
// ---------------------------------------------------------------------------

async function fetchLiveEvents(): Promise<string> {
  try {
    const state = await readState();
    const events = state.events ?? [];

    if (events.length === 0) return '(no family events saved)';

    const today = todaySGT();
    // Show upcoming events within 90 days, sorted by date
    const upcoming = events
      .filter((e: any) => (e.endDate ?? e.startDate) >= today)
      .sort((a: any, b: any) => a.startDate.localeCompare(b.startDate))
      .slice(0, 15)
      .map((e: any) => {
        const dateRange = e.endDate && e.endDate !== e.startDate
          ? `${e.startDate} to ${e.endDate}` : e.startDate;
        const title = e.titleEn || e.title;
        const titleZh = e.titleZh ? ` (${e.titleZh})` : '';
        const loc = e.location ? ` @ ${e.location}` : '';
        const time = e.time ? ` ${e.time}` : '';
        return `  • ${dateRange}${time}: ${title}${titleZh}${loc} [${e.category}]`;
      })
      .join('\n');

    return upcoming || '(no upcoming family events)';
  } catch (err) {
    console.warn('[chat] Could not load calendar events:', err);
    return '(could not load calendar events)';
  }
}

// ---------------------------------------------------------------------------
// Groq call helper with retry
// ---------------------------------------------------------------------------

async function callGroq(groq: Groq, messages: Groq.Chat.ChatCompletionMessageParam[]): Promise<string> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { completion } = await createGroqChat(groq, {
        messages,
        temperature: 0.7,
        max_tokens: 512,
      });
      const content = completion.choices[0]?.message?.content?.trim()
        || (completion.choices[0]?.message as any)?.reasoning_content?.trim()
        || '';
      return content;
    } catch (err: any) {
      const isRetryable = String(err?.message ?? err).includes('503') ||
                          String(err?.message ?? err).includes('429') ||
                          String(err?.message ?? err).includes('overloaded');
      if (isRetryable && attempt < 1) {
        await new Promise((r) => setTimeout(r, 1000));
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

function resolveLocalReply(message: string, lang: 'en' | 'zh', today: string): string {
  const isZh = lang === 'zh' || /[\u4e00-\u9fa5]/.test(message);
  const q = message.toLowerCase();
  const ahma = getAhmaInfo(today);
  const nextKC = nextAhmaVisit(today, 'KC');
  const nextKG = nextAhmaVisit(today, 'KG');
  const nextKB = nextAhmaVisit(today, 'KB');
  const jj = getJunjieShift(today);

  const asksAhma =
    q.includes('ahma') || q.includes('grandma') || q.includes('grandmother') ||
    q.includes('阿嬷') || q.includes('外婆') || q.includes('奶奶') ||
    q.includes('kay cheow') || q.includes('kay guan') || q.includes('kay boon') ||
    q.includes('启超') || q.includes('启源') || q.includes('启文') ||
    q.includes('kc') || q.includes('kg') || q.includes('kb');

  if (asksAhma) {
    const targetCode =
      q.includes('kc') || q.includes('kay cheow') || q.includes('启超') || q.includes('dad') || q.includes('爸爸') ? 'KC' :
      q.includes('kg') || q.includes('kay guan') || q.includes('启源') ? 'KG' :
      q.includes('kb') || q.includes('kay boon') || q.includes('启文') ? 'KB' : null;

    const asksWhen =
      q.includes('when') || q.includes('next') || q.includes('coming') || q.includes('come') ||
      q.includes('arrive') || q.includes('visit') || q.includes('turn') || q.includes('go') ||
      q.includes('几时') || q.includes('什么时候') || q.includes('何时') || q.includes('下次') ||
      q.includes('过来') || q.includes('去') || q.includes('来') || q.includes('到') || q.includes('轮到') ||
      targetCode !== null;

    if (asksWhen && targetCode) {
      const loc = LOCATION_NAMES[targetCode] ?? { en: targetCode, zh: targetCode };
      const visit = targetCode === 'KC' ? nextKC : targetCode === 'KG' ? nextKG : nextKB;
      const curLoc = LOCATION_NAMES[ahma.code] ?? { en: ahma.code, zh: ahma.code };

      if (ahma.code === targetCode) {
        return isZh
          ? `👵 阿嬷目前就在 ${loc.zh} (${targetCode})！\n• 今天是第 ${ahma.dayInStay} 天（共 ${GRANDMA_DAYS} 天），还剩 ${ahma.daysLeft} 天（直到 ${ahma.nextDate}）。\n• 下次再轮到 ${loc.zh} 是 ${visit.date}（${visit.daysAway} 天后）。`
          : `👵 Ahma is currently at ${loc.en} (${targetCode}) right now!\n• Today is Day ${ahma.dayInStay} of ${GRANDMA_DAYS} (${ahma.daysLeft} days remaining until ${ahma.nextDate}).\n• Her next return visit to ${loc.en} is on ${visit.date} (in ${visit.daysAway} days).`;
      }
      return isZh
        ? `👵 阿嬷下次到 **${loc.zh} (${targetCode})** 是 **${visit.date}**（${visit.daysAway} 天后）。\n• 目前阿嬷在 ${curLoc.zh}，还剩 ${ahma.daysLeft} 天（直到 ${ahma.nextDate}）。`
        : `👵 Ahma will be coming over to **${loc.en} (${targetCode})** on **${visit.date}** (in ${visit.daysAway} days).\n• Currently, Ahma is staying at ${curLoc.en} (${ahma.daysLeft} days left until ${ahma.nextDate}).`;
    }

    const curLoc = LOCATION_NAMES[ahma.code] ?? { en: ahma.code, zh: ahma.code };
    const nextLoc = LOCATION_NAMES[ahma.nextCode] ?? { en: ahma.nextCode, zh: ahma.nextCode };
    return isZh
      ? `👵 今天阿嬷住在 **${curLoc.zh} (${ahma.code})**（第 ${ahma.dayInStay}/${GRANDMA_DAYS} 天，还剩 ${ahma.daysLeft} 天，将于 ${ahma.nextDate} 前往 ${nextLoc.zh}）。`
      : `👵 Today Ahma is staying at **${curLoc.en} (${ahma.code})** (Day ${ahma.dayInStay}/${GRANDMA_DAYS}, ${ahma.daysLeft} days remaining until ${ahma.nextDate} when she moves to ${nextLoc.en}).`;
  }

  const asksJJ = q.includes('junjie') || q.includes('jun jie') || q.includes('俊杰') || q.includes('jj') || q.includes('shift') || q.includes('班次') || q.includes('上班');
  if (asksJJ) {
    // Resolve day-of-week if mentioned (e.g. "friday", "next monday")
    let checkDate = today;
    const DOW = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    const dowIdx = DOW.findIndex((d) => q.includes(d));
    if (dowIdx !== -1) {
      const [ty, tm, td] = today.split('-').map(Number);
      const todayDow = new Date(Date.UTC(ty, tm - 1, td)).getUTCDay();
      let diff = (dowIdx - todayDow + 7) % 7 || 7;
      if (q.includes('next ')) diff += 7;
      checkDate = addDaysToDate(today, diff);
    } else if (q.includes('tomorrow') || q.includes('明天')) {
      checkDate = addDaysToDate(today, 1);
    }
    const jj = getJunjieShift(checkDate);
    const shiftStr = jj.time ? `${jj.name} (${jj.time})` : jj.name;
    const dayLabel = checkDate === today ? (isZh ? '今天' : 'today') :
                     checkDate === addDaysToDate(today, 1) ? (isZh ? '明天' : 'tomorrow') : checkDate;
    return isZh
      ? `${dayLabel}俊杰上 **${shiftStr}**（第 ${jj.week}/3 周排班）。`
      : `${dayLabel === 'today' || dayLabel === 'tomorrow' ? `On ${dayLabel}` : `On ${checkDate}`}, Jun Jie is on **${shiftStr}** (Week ${jj.week} of 3).`;
  }

  return isZh
    ? `您好！我可以帮您查询阿嬷轮流日程（例如："阿嬷几时来爸爸家？"）、俊杰排班或家庭活动！或者也可以帮您添加活动哦 😊`
    : `Hey there! 😊 I can help with Ahma's rotation schedule, Jun Jie's shifts, family calendar events, or just have a chat! Try asking "When is Ahma next at Dad's?" or "Add a family dinner on 20 Oct 2026".`;
}

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
  const ahmaToday = getAhmaInfo(today);
  const nextKC = nextAhmaVisit(today, 'KC');
  const nextKG = nextAhmaVisit(today, 'KG');
  const nextKB = nextAhmaVisit(today, 'KB');
  const calendarContext = buildCalendarContext(today);
  const liveEvents = await fetchLiveEvents();
  const apiKey = process.env.GROQ_API_KEY;

  if (apiKey) {
    try {
      const groq = new Groq({ apiKey });

      const systemPrompt = `TODAY IS ${today} (Singapore Time, SGT UTC+8). Use this as the current date for ALL answers.

You are Ahma Bot 🌸 — a warm family assistant for a Singapore Chinese family. You are friendly and happy to chat about anything.

LANGUAGE RULE: Always reply in the SAME language as the user's message. English → English. Chinese → Chinese.

CRITICAL — USE ONLY THE DATA BELOW, DO NOT RECALCULATE:
${calendarContext}

FAMILY CALENDAR EVENTS:
${liveEvents}

ANSWER RULES:
- "When is Ahma coming over / next at KC / Dad's place / 爸爸家" → answer directly: ${nextKC.date} (in ${nextKC.daysAway} days from today). If she is currently there, state she is already at KC right now!
- "When is Ahma next at KG / 启源" → answer directly: ${nextKG.date} (in ${nextKG.daysAway} days).
- "When is Ahma next at KB / 启文" → answer directly: ${nextKB.date} (in ${nextKB.daysAway} days).
- "Where is Ahma today/now" → she is at ${ahmaToday.code} (${LOCATION_NAMES[ahmaToday.code]?.en}), Day ${ahmaToday.dayInStay}/${GRANDMA_DAYS}, ${ahmaToday.daysLeft} days remaining.
- "Where is Ahma tomorrow" → check the Next 7 days table above for ${addDaysToDate(today, 1)}
- "JJ shift today/tomorrow" → check the Next 7 days table above. "jj" = "jun jie" = "junjie" = same person
- "is jj/jun jie working on friday/monday/saturday" → find that day in the Next 7 days table and report his shift
- For CNY questions → use the CNY special stays table above
- For family events/plans → use FAMILY CALENDAR EVENTS above
- For casual chat → just chat naturally, no calendar needed. You can talk about anything.
- "add [event] on [date]" → respond with JSON on a SINGLE line at the END: EVENT_JSON:{"title":"...","startDate":"YYYY-MM-DD","category":"holiday_plan|family_gathering|medical|leave|general","memberId":"all"}
- CRITICAL: Answer directly in the very first sentence. NEVER recite rotation history or count cycles from 7 May 2026.

Keep answers short and direct (2-3 sentences). Plain text only.`;

      const reply = await callGroq(groq, [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: message },
      ]);

      if (reply) {
        // Check if the AI included an event to add (EVENT_JSON: marker)
        const eventMarker = reply.match(/EVENT_JSON:(\{[^\n]+\})/);
        if (eventMarker) {
          const cleanReply = reply.replace(/EVENT_JSON:[^\n]+/, '').trim();
          try {
            const eventData = JSON.parse(eventMarker[1]);
            if (eventData.title && eventData.startDate) {
              const newEvent = {
                id: `ev-chat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                title: eventData.title,
                startDate: eventData.startDate,
                endDate: eventData.endDate,
                category: eventData.category || 'general',
                memberId: eventData.memberId || 'all',
                time: eventData.time,
                location: eventData.location,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
              // Save via updateState directly (avoids needing APP_URL)
              await updateState((draft) => {
                draft.events.push(newEvent);
              });
              return res.status(200).json({ reply: cleanReply || `Done! Added "${newEvent.title}" on ${newEvent.startDate} to the calendar.`, newEvent });
            }
          } catch { /* ignore parse errors */ }
        }
        return res.status(200).json({ reply });
      }
    } catch (err: any) {
      console.warn('[chat] Groq failed:', err?.message ?? err);
    }
  }

  // Fallback to local resolver if Groq is unavailable or returns empty
  const localReply = resolveLocalReply(message, lang, today);
  return res.status(200).json({ reply: localReply });
}
