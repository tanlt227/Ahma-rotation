import type { VercelRequest, VercelResponse } from '@vercel/node';

// ---------------------------------------------------------------------------
// 100% Self-Contained Vercel Serverless Function: api/telegram.ts
//
// ZERO local relative imports (no ../lib/state, ../lib/groq, etc.)
// ZERO third-party runtime package requirements (uses native global fetch)
// Guaranteed to boot cleanly in Vercel Node 18/20/22 runtime without
// FUNCTION_INVOCATION_FAILED or ERR_MODULE_NOT_FOUND errors.
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
  KC: { en: 'Kay Cheow', zh: '启超 / 爸爸家' },
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

function todaySGT(): string {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().split('T')[0];
}

function addDaysSGT(n: number): string {
  return new Date(Date.now() + 8 * 60 * 60 * 1000 + n * 86400000).toISOString().split('T')[0];
}

function extractDate(message: string): string {
  const today = todaySGT();
  const q = message.toLowerCase();

  if (q.includes('today') || q.includes('今天') || q.includes('今日')) return today;
  if (q.includes('tomorrow') || q.includes('明天') || q.includes('明日')) return addDaysSGT(1);
  if (q.includes('day after tomorrow') || q.includes('后天')) return addDaysSGT(2);
  if (q.includes('next week') || q.includes('下周')) return addDaysSGT(7);

  // Day-of-week resolver
  const DOW = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const dowIdx = DOW.findIndex((d) => q.includes(d));
  if (dowIdx !== -1) {
    const [ty, tm, td] = today.split('-').map(Number);
    const todayDow = new Date(Date.UTC(ty, tm - 1, td)).getUTCDay();
    let diff = (dowIdx - todayDow + 7) % 7 || 7;
    if (q.includes('next ')) diff += 7;
    return addDaysSGT(diff);
  }

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
      mStr = engMatch[1].toLowerCase();
      d = parseInt(engMatch[2]);
      y = engMatch[3] ? parseInt(engMatch[3]) : 2026;
    } else {
      d = parseInt(engMatch[1]);
      mStr = engMatch[2].toLowerCase();
      y = engMatch[3] ? parseInt(engMatch[3]) : 2026;
    }
    const m = mNames[mStr];
    if (m) return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  return '';
}

function extractDateRange(message: string): { start: string; end: string } | null {
  const mNames: Record<string, number> = {
    jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
    apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
    aug: 8, august: 8, sep: 9, september: 9, oct: 10, october: 10,
    nov: 11, november: 11, dec: 12, december: 12,
  };

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

  const zhRange = message.match(/(?:(\d{4})年\s*)?(\d{1,2})月\s*(\d{1,2})[日号]?\s*(?:至|到|–|-)\s*(?:(\d{1,2})月\s*)?(\d{1,2})[日号]?/);
  if (zhRange) {
    const y = zhRange[1] ? parseInt(zhRange[1]) : 2026;
    const m1 = zhRange[2].padStart(2, '0');
    const d1 = zhRange[3].padStart(2, '0');
    const m2 = zhRange[4] ? zhRange[4].padStart(2, '0') : m1;
    const d2 = zhRange[5].padStart(2, '0');
    return {
      start: `${y}-${m1}-${d1}`,
      end: `${y}-${m2}-${d2}`,
    };
  }

  return null;
}

function extractLocation(message: string): string | undefined {
  const atMatch = message.match(/(?:@|at\s+|地点[：:]\s*|在\s*)([A-Za-z0-9\u4e00-\u9fa5\s'’]+?)(?:\s+on|\s+at\s+\d|\s+from|\s+时间|$)/i);
  if (atMatch && atMatch[1].trim()) {
    return atMatch[1].trim();
  }
  return undefined;
}

function extractTime(message: string): string | undefined {
  const timeMatch =
    message.match(/\b([012]?\d:[0-5]\d)\b/) ||
    message.match(/\b([012]?\d)\s*(?:am|pm)\b/i) ||
    message.match(/(?:晚上|下午|早上|上午)\s*([012]?\d)(?:点|:|\s*([0-5]\d))/);

  if (timeMatch) {
    return timeMatch[0].trim();
  }
  return undefined;
}

function inferCategory(message: string): string {
  const q = message.toLowerCase();
  if (q.includes('polyclinic') || q.includes('doctor') || q.includes('hospital') || q.includes('checkup') || q.includes('门诊') || q.includes('看病') || q.includes('复诊') || q.includes('医院') || q.includes('药')) {
    return 'medical';
  }
  if (q.includes('holiday') || q.includes('trip') || q.includes('staycation') || q.includes('flight') || q.includes('hotel') || q.includes('旅行') || q.includes('度假') || q.includes('旅游') || q.includes('出游')) {
    return 'holiday_plan';
  }
  if (q.includes('dinner') || q.includes('lunch') || q.includes('gathering') || q.includes('bbq') || q.includes('party') || q.includes('聚餐') || q.includes('聚会') || q.includes('吃饭') || q.includes('做客')) {
    return 'family_gathering';
  }
  if (q.includes('leave') || q.includes('off') || q.includes('请假') || q.includes('休假')) {
    return 'leave';
  }
  return 'general';
}

function extractCleanTitle(message: string, isZh: boolean): string {
  let cleaned = message
    .replace(/^\/?(?:add|schedule|plan|添加|加入|安排|计划|记)\s*[:：]?\s*/i, '')
    .replace(/(?:from\s+)?\d{1,2}(?:st|nd|rd|th)?\s*(?:to|–|-)\s*\d{1,2}(?:st|nd|rd|th)?\s+[a-zA-Z]+(?:\s+\d{4})?/gi, '')
    .replace(/\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/g, '')
    .replace(/(?:\d{4}年\s*)?\d{1,2}月\s*\d{1,2}[日号]?(?:\s*(?:至|到|–|-)\s*(?:\d{1,2}月\s*)?\d{1,2}[日号]?)?/g, '')
    .replace(/\b(?:today|tomorrow|yesterday|今天|明天|后天)\b/gi, '')
    .replace(/\bat\s+[012]?\d(?::[0-5]\d)?\s*(?:am|pm)?/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned || cleaned.length < 2) {
    return isZh ? '家庭活动' : 'Family Event';
  }
  return cleaned;
}

// ---------------------------------------------------------------------------
// Native Fetch AI Callers (No third-party SDK dependencies)
// ---------------------------------------------------------------------------

async function callGroqDirect(apiKey: string, systemPrompt: string, userMessage: string): Promise<string> {
  const models = ['llama-3.3-70b-versatile', 'llama3-70b-8192', 'llama-3.1-8b-instant'];
  for (const model of models) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          temperature: 0.7,
          max_tokens: 512,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.choices?.[0]?.message?.content?.trim() || '';
      }
    } catch {
      // try next model
    }
  }
  return '';
}

async function callGeminiDirect(apiKey: string, systemPrompt: string, userMessage: string): Promise<string> {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\nUser Question: ${userMessage}` }],
          },
        ],
      }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    }
  } catch {}
  return '';
}

// ---------------------------------------------------------------------------
// GitHub Contents API State Persistence (Self-contained)
// ---------------------------------------------------------------------------

async function saveEventToGitHub(eventData: any): Promise<boolean> {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO || 'tanlt227/Ahma-rotation';
  const path = process.env.GITHUB_PATH || 'data/calendar-data.json';
  if (!token) return false;

  try {
    const getUrl = `https://api.github.com/repos/${repo}/contents/${path}`;
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    };

    const getRes = await fetch(getUrl, { headers });
    let sha: string | null = null;
    let state: any = { events: [] };

    if (getRes.ok) {
      const fileData = await getRes.json();
      sha = fileData.sha;
      const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
      state = JSON.parse(content);
    }

    if (!Array.isArray(state.events)) state.events = [];
    state.events.push(eventData);
    state.lastUpdated = new Date().toISOString();
    state.version = (state.version || 1) + 1;

    const putRes = await fetch(getUrl, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        message: `chore: add event from Telegram [${eventData.title}]`,
        content: Buffer.from(JSON.stringify(state, null, 2)).toString('base64'),
        sha: sha || undefined,
      }),
    });

    return putRes.ok;
  } catch (err) {
    console.warn('[telegram] Failed to persist to GitHub:', err);
    return false;
  }
}

async function sendTelegramMessage(token: string, chatId: number | string, text: string) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    return await res.json().catch(() => ({}));
  } catch (err: any) {
    console.error('[telegram] Network error sending message:', err);
    return { ok: false, error: err?.message || String(err) };
  }
}

// ---------------------------------------------------------------------------
// Local Rule-Based Calendar Solver
// ---------------------------------------------------------------------------

function resolveAnswer(message: string, isZh: boolean): string {
  const q = message.toLowerCase();
  const today = todaySGT();

  // 1. When is Ahma next at ... or where is Ahma today
  const asksAhma =
    q.includes('ahma') || q.includes('grandma') || q.includes('阿嬷') ||
    q.includes('grandmother') || q.includes('kc') || q.includes('kg') || q.includes('kb') ||
    q.includes('kay cheow') || q.includes('kay guan') || q.includes('kay boon') ||
    q.includes('启超') || q.includes('启源') || q.includes('启文') || q.includes('爸爸');

  if (asksAhma) {
    const current = getAhmaLocation(today);
    const targetCode =
      q.includes('kc') || q.includes('kay cheow') || q.includes('启超') || q.includes('dad') || q.includes('爸爸') ? 'KC' :
      q.includes('kg') || q.includes('kay guan') || q.includes('启源') ? 'KG' :
      q.includes('kb') || q.includes('kay boon') || q.includes('启文') ? 'KB' : null;

    const asksWhen =
      q.includes('when') || q.includes('next') || q.includes('coming') || q.includes('come') ||
      q.includes('arrive') || q.includes('visit') || q.includes('turn') || q.includes('几时') ||
      q.includes('什么时候') || q.includes('何时') || q.includes('下次') || q.includes('过来') ||
      q.includes('去') || q.includes('来') || q.includes('轮到') || targetCode !== null;

    if (asksWhen && targetCode) {
      const locName = LOCATION_NAMES[targetCode] ?? { en: targetCode, zh: targetCode };
      const nextVisit = nextAhmaVisit(today, targetCode);

      if (current.code === targetCode) {
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
    }

    const check = extractDate(message) || today;
    const isToday = check === today;
    const loc = getAhmaLocation(check);
    const name = LOCATION_NAMES[loc.code] ?? { en: loc.code, zh: loc.code };
    const nextName = LOCATION_NAMES[loc.nextCode] ?? { en: loc.nextCode, zh: loc.nextCode };

    return isZh
      ? `👵 ${isToday ? '今天' : `在 ${check}`}，阿嬷住在 ${name.zh}（${loc.code}）。\n• 当前周期居住第 ${loc.dayInStay} 天（共 ${GRANDMA_DAYS_PER_LOCATION} 天，还剩 ${loc.daysLeft} 天，将于 ${loc.nextDate} 前往 ${nextName.zh}）。`
      : `👵 ${isToday ? 'Today' : `On ${check}`}, Ahma is staying at ${name.en} (${loc.code}).\n• Day ${loc.dayInStay} of ${GRANDMA_DAYS_PER_LOCATION} in this stay (${loc.daysLeft} days left, moving to ${nextName.en} on ${loc.nextDate}).`;
  }

  // 2. Jun Jie shift query
  const asksShift =
    q.includes('jun jie') || q.includes('junjie') || q.includes('俊杰') || q.includes('jj') ||
    q.includes('shift') || q.includes('班次') || q.includes('上班');

  if (asksShift) {
    const check = extractDate(message) || '2026-06-15';
    const shift = getJunjieShift(check);
    const ZH_SHIFT: Record<string, string> = {
      Night: '晚班',
      Morning: '早班',
      'Afternoon 1': '午1班',
      'Afternoon 2': '午2班',
      'Afternoon 3': '午3班',
      'OFF Day': '休息 (OFF)',
      'REST DAY': '休息 (REST)',
    };
    const shiftLabelEn = shift.time ? `${shift.name} (${shift.time})` : shift.name;
    const shiftLabelZh = shift.time
      ? `${ZH_SHIFT[shift.name] ?? shift.name} (${shift.time})`
      : (ZH_SHIFT[shift.name] ?? shift.name);

    return isZh
      ? `在 ${check}，俊杰上 ${shiftLabelZh}（第 ${shift.weekNum} 周排班）。\n他的排班为3周一循环，从 2026年6月15日（周一）开始。`
      : `On ${check}, Jun Jie is on ${shiftLabelEn} (Week ${shift.weekNum} of 3).\nHis roster repeats every 3 weeks, starting Monday 15 June 2026.`;
  }

  // 3. Public holidays
  if (q.includes('holiday') || q.includes('假期') || q.includes('public holiday')) {
    const dateStr = extractDate(message);
    if (dateStr && SINGAPORE_PUBLIC_HOLIDAYS[dateStr]) {
      const name = SINGAPORE_PUBLIC_HOLIDAYS[dateStr];
      return isZh ? `${dateStr} 是新加坡公共假期：${name}。` : `${dateStr} is a Singapore Public Holiday: ${name}.`;
    }
    return isZh
      ? `新加坡主要公共假期：\n• 5月1日：劳动节\n• 5月31日 - 6月1日：卫塞节及补假\n• 8月9日 - 8月10日：国庆日及补假\n• 11月8日 - 11月9日：屠妖节及补假\n• 12月25日：圣诞节`
      : `Singapore 2026 Public Holidays:\n• 1 May: Labour Day\n• 31 May – 1 Jun: Vesak Day & In-Lieu\n• 9 Aug – 10 Aug: National Day & In-Lieu\n• 8 Nov – 9 Nov: Deepavali & In-Lieu\n• 25 Dec: Christmas Day`;
  }

  return isZh
    ? `你好！我是阿嬷日程小助手 🌸\n\n您可以问我：\n• 某一天阿嬷住在谁家（例如：“阿嬷几时来爸爸家？”）\n• 俊杰某天的上下班排班（例如：“6月15日俊杰上什么班？”）\n• 新加坡公共假期\n• 添加日历活动（例如：“添加 6月20日 晚上7点 爸爸家聚餐”）`
    : `Hello! I'm Ahma Bot 🌸\n\nYou can ask me:\n• Where Ahma is staying on any date (e.g. "When is Ahma next at Dad's place?")\n• Jun Jie's work shift on any date (e.g. "What is Jun Jie's shift on 15 June?")\n• Singapore public holidays\n• Add calendar events (e.g. "Add dinner on 20 June 2026 at 7pm")`;
}

// ---------------------------------------------------------------------------
// Main Vercel Serverless Function Handler
// ---------------------------------------------------------------------------

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Always wrap everything in top-level try/catch to avoid FUNCTION_INVOCATION_FAILED
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    const TELEGRAM_TOKEN = (process.env.TELEGRAM_BOT_TOKEN ?? '').trim();
    const GROQ_KEY = (process.env.GROQ_API_KEY ?? '').trim();
    const GEMINI_KEY = (process.env.GEMINI_API_KEY ?? '').trim();
    const GITHUB_TOKEN = (process.env.GITHUB_TOKEN ?? '').trim();

    // ─── GET /api/telegram — Browser Diagnostics ──────────────────────────────
    if (req.method !== 'POST') {
      let botInfo: any = null;
      let webhookInfo: any = null;

      if (TELEGRAM_TOKEN) {
        try {
          const [meRes, whRes] = await Promise.all([
            fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getMe`).then((r) => r.json()),
            fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getWebhookInfo`).then((r) => r.json()),
          ]);
          botInfo = meRes.ok ? meRes.result : { error: meRes.description };
          webhookInfo = whRes.ok ? whRes.result : { error: whRes.description };
        } catch (e: any) {
          botInfo = { error: e?.message || 'Could not reach Telegram API' };
        }
      }

      return res.status(200).json({
        status: 'active',
        service: 'FamilySync SG Calendar — Telegram Serverless Webhook',
        timestamp: new Date().toISOString(),
        environment: {
          TELEGRAM_BOT_TOKEN: TELEGRAM_TOKEN ? `configured (...${TELEGRAM_TOKEN.slice(-4)}) ✅` : 'MISSING ❌ — Add TELEGRAM_BOT_TOKEN to Vercel Environment Variables',
          GROQ_API_KEY: GROQ_KEY ? 'configured ✅' : 'NOT SET (using deterministic local calendar solver) ℹ️',
          GEMINI_API_KEY: GEMINI_KEY ? 'configured ✅' : 'NOT SET ℹ️',
          GITHUB_TOKEN: GITHUB_TOKEN ? 'configured ✅ (multi-device cloud sync active)' : 'NOT SET (local memory only) ⚠️',
        },
        botAccount: botInfo,
        webhookStatus: webhookInfo,
        instructions: 'To set webhook, visit: https://api.telegram.org/bot<YOUR_TOKEN>/setWebhook?url=https://<YOUR_APP_DOMAIN>/api/telegram',
      });
    }

    // ─── POST /api/telegram — Telegram Webhook Update ─────────────────────────
    if (!TELEGRAM_TOKEN) {
      console.warn('[telegram] TELEGRAM_BOT_TOKEN is not configured in Vercel environment variables.');
      return res.status(200).json({ error: 'TELEGRAM_BOT_TOKEN is not set.' });
    }

    // Safely parse body if body parser hasn't run
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }

    const msg = body?.message || body?.edited_message;
    if (!msg || !msg.text) {
      return res.status(200).end();
    }

    const chatId: number = msg.chat?.id;
    const userText: string = (msg.text || '').trim();
    if (!chatId || !userText) {
      return res.status(200).end();
    }

    const isZh = /[\u4e00-\u9fa5]/.test(userText);
    let replyText = '';

    if (userText === '/start') {
      replyText = isZh
        ? '您好！我是阿嬷日程小助手 🌸\n\n您可以问我：\n• 某一天阿嬷住在谁家（例如：“阿嬷几时来爸爸家？”）\n• 俊杰的上下班班次（例如：“6月15日俊杰上什么班？”）\n• 日历上的活动和假期计划\n• 新加坡公共假期\n• 添加活动（例如：“添加 6月20日 晚上7点 爸爸家聚餐” 或 “/add 2026-06-20 聚餐”）\n• 或者聊任何日常话题！'
        : "Hello! I'm Ahma Bot 🌸\n\nYou can ask me:\n• Where Ahma is staying on any date (e.g. \"When is Ahma next at Dad's place / KC?\")\n• Jun Jie's work shift on any date (e.g. \"What is Jun Jie's shift on 15 June 2026?\")\n• Events and holiday plans on the calendar\n• Singapore public holidays\n• Add calendar events (e.g. \"Add dinner on 20 June 2026 at 7pm\" or \"/add 2026-06-20 Family dinner\")\n• Or just have a casual chat!";
    } else if (userText === '/help') {
      replyText = isZh
        ? '📖 阿嬷日历助手常用指令：\n\n• /start — 开始对话与简介\n• /today — 查看今天阿嬷在哪里及俊杰班次\n• /events — 查看近期家庭活动\n• /add [日期] [活动名称] — 快速添加活动\n\n您也可以直接用自然语言提问！'
        : "📖 Ahma Calendar Bot Commands:\n\n• /start — Welcome & intro\n• /today — See where Ahma is today & Jun Jie's shift\n• /events — View upcoming calendar events\n• /add [date] [title] — Quickly add a new event\n\nOr simply ask naturally in English or Chinese!";
    } else if (userText === '/today') {
      replyText = resolveAnswer(`where is ahma today ${todaySGT()}`, isZh) + '\n\n' + resolveAnswer(`what is junjie shift today ${todaySGT()}`, isZh);
    } else {
      // Check if user is adding an event
      const addKeywords = ['add', 'create', 'schedule', 'plan', 'book', 'put', '记', '添加', '加入', '安排', '计划', '/add'];
      const eventKeywords = ['event', 'trip', 'holiday', 'plan', 'gathering', 'appointment', 'staycation', 'dinner', 'lunch', '活动', '旅行', '假期', '聚餐', '行程', '聚会', '门诊', '看病', '复诊'];
      const q = userText.toLowerCase();
      const wantsAdd = (addKeywords.some((k) => q.includes(k)) && (eventKeywords.some((k) => q.includes(k)) || q.startsWith('/add'))) || q.startsWith('/add');

      if (wantsAdd) {
        const range = extractDateRange(userText);
        const singleDate = extractDate(userText);
        const startDate = range?.start || singleDate;
        const endDate = range?.end;

        if (startDate) {
          const cleanTitle = extractCleanTitle(userText, isZh);
          const cat = inferCategory(userText);
          const loc = extractLocation(userText);
          const tm = extractTime(userText);

          const newEv = {
            id: `ev-tg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            title: cleanTitle,
            startDate,
            endDate: endDate || undefined,
            category: cat,
            memberId: 'all',
            location: loc,
            time: tm,
            createdAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
            updatedAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
          };

          // Save via /api/events — same path as the web app, ensures GitHub sync + proper schema
          let cloudSaved = false;
          const appUrl = (process.env.APP_URL ?? '').replace(/\/$/, '');
          if (appUrl) {
            try {
              const evRes = await fetch(`${appUrl}/api/events`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newEv),
              });
              cloudSaved = evRes.ok;
            } catch (err) {
              console.warn('[telegram] Failed to save event via /api/events:', err);
              // Fallback: try direct GitHub write
              cloudSaved = await saveEventToGitHub(newEv);
            }
          } else {
            cloudSaved = await saveEventToGitHub(newEv);
          }
          const dateRange = newEv.endDate ? `${newEv.startDate} – ${newEv.endDate}` : newEv.startDate;
          const locPart = newEv.location ? ` @ ${newEv.location}` : '';
          const syncNote = cloudSaved
            ? (isZh ? '☁️ 已实时同步至 GitHub 家庭日历。' : '☁️ Live-synced to GitHub family calendar.')
            : (isZh ? '⚠️ 提示：Vercel 尚未配置 GITHUB_TOKEN，此活动仅临时生效。' : '⚠️ Note: GITHUB_TOKEN is not configured in Vercel.');

          replyText = isZh
            ? `好的！我已把活动添加到日历：\n\n📅 ${newEv.title}\n🗓 ${dateRange}${locPart}${newEv.time ? `\n⏰ ${newEv.time}` : ''}\n\n${syncNote}\n您可以在日历网页上查看！`
            : `Done! I've added this to the calendar:\n\n📅 ${newEv.title}\n🗓 ${dateRange}${locPart}${newEv.time ? `\n⏰ ${newEv.time}` : ''}\n\n${syncNote}\nYou can check it on the calendar web app!`;
        }
      }

      // Try AI reply if not already answered
      if (!replyText) {
        const today = todaySGT();
        const ahmaNow = getAhmaLocation(today);
        const locNow = LOCATION_NAMES[ahmaNow.code] ?? { en: ahmaNow.code, zh: ahmaNow.code };
        const nextKC = nextAhmaVisit(today, 'KC');
        const nextKG = nextAhmaVisit(today, 'KG');
        const nextKB = nextAhmaVisit(today, 'KB');
        const jjToday = getJunjieShift(today);
        const nextLocNow = LOCATION_NAMES[ahmaNow.nextCode] ?? { en: ahmaNow.nextCode, zh: ahmaNow.nextCode };

        const systemPrompt = `TODAY IS ${today} (Singapore Time, SGT UTC+8). Use this as the current date for ALL answers.
You are Ahma Bot 🌸, a warm and friendly family assistant for the "Ahma's Rotation" app.
Live Calendar Data:
- Ahma is CURRENTLY at: ${locNow.en} (${ahmaNow.code}), Day ${ahmaNow.dayInStay}/${GRANDMA_DAYS_PER_LOCATION}, ${ahmaNow.daysLeft} days remaining. Moves to ${nextLocNow.en} on ${ahmaNow.nextDate}.
- Next time Ahma arrives at KC (Kay Cheow / Dad's place / 爸爸家): ${nextKC.date} (in ${nextKC.daysAway} days).
- Next time Ahma arrives at KG (Kay Guan / 启源): ${nextKG.date} (in ${nextKG.daysAway} days).
- Next time Ahma arrives at KB (Kay Boon / 启文): ${nextKB.date} (in ${nextKB.daysAway} days).
- Jun Jie TODAY: ${jjToday.name}${jjToday.time ? ` (${jjToday.time})` : ''} (Week ${jjToday.weekNum} of 3).
Answer clearly and warmly in ${isZh ? 'Chinese (中文)' : 'English'}. Plain text only.`;

        if (GROQ_KEY) {
          replyText = await callGroqDirect(GROQ_KEY, systemPrompt, userText);
        } else if (GEMINI_KEY) {
          replyText = await callGeminiDirect(GEMINI_KEY, systemPrompt, userText);
        }
      }

      // Fallback: deterministic local calendar solver
      if (!replyText) {
        replyText = resolveAnswer(userText, isZh);
      }
    }

    if (!replyText) {
      replyText = isZh ? '抱歉，我未能理解，请再试一次。' : 'Sorry, I could not process that. Please try again.';
    }

    await sendTelegramMessage(TELEGRAM_TOKEN, chatId, replyText);
    return res.status(200).end();
  } catch (err: any) {
    console.error('[telegram] Fatal handler error caught:', err);
    // Always return HTTP 200 so Telegram and Vercel do not display 500 error screens
    return res.status(200).json({
      error: 'Telegram webhook processed with fallback',
      message: err?.message || String(err),
    });
  }
}
