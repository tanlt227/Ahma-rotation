import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

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
  { name: 'Morning', time: '0630-1530' },     // Mon
  { name: 'OFF Day', time: '' },              // Tue
  { name: 'Afternoon 1', time: '1600-0100' }, // Wed
  { name: 'Afternoon 1', time: '1600-0100' }, // Thu
  { name: 'Afternoon 2', time: '1400-0100' }, // Fri
  { name: 'Afternoon 2', time: '1400-0100' }, // Sat
  { name: 'REST DAY', time: '' },             // Sun
  // Week 3
  { name: 'OFF Day', time: '' },              // Mon
  { name: 'Morning', time: '0630-1530' },     // Tue
  { name: 'Morning', time: '0630-1530' },     // Wed
  { name: 'Morning', time: '0630-1530' },     // Thu
  { name: 'REST DAY', time: '' },             // Fri
  { name: 'Afternoon 3', time: '1500-0200' }, // Sat
  { name: 'Afternoon 3', time: '1500-0200' }, // Sun
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
    return { code: cny.code, isCny: true };
  }
  const diff = daysBetween(dateStr, GRANDMA_ANCHOR);
  const total = GRANDMA_ROTATION_SEQUENCE.length * GRANDMA_DAYS_PER_LOCATION;
  const cycleDay = ((diff % total) + total) % total;
  const code = GRANDMA_ROTATION_SEQUENCE[Math.floor(cycleDay / GRANDMA_DAYS_PER_LOCATION)];
  const dayInStay = (cycleDay % GRANDMA_DAYS_PER_LOCATION) + 1;
  return { code, dayInStay, isCny: false };
}

function getJunjieShift(dateStr: string) {
  const diff = daysBetween(dateStr, JUNJIE_ANCHOR);
  const idx = ((diff % 21) + 21) % 21;
  return { ...JUNJIE_ROSTER[idx], weekNum: Math.floor(idx / 7) + 1 };
}

// ---------------------------------------------------------------------------
// Inline date parser — mirrored from src/data/chatbotSolver.ts
// ---------------------------------------------------------------------------

function extractDate(message: string): string {
  const today = new Date().toISOString().split('T')[0];
  const q = message.toLowerCase();

  if (q.includes('today') || q.includes('今天')) return today;

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
// Core chat resolver (self-contained, no src/ imports)
// ---------------------------------------------------------------------------

function resolveAnswer(message: string, isZh: boolean): string {
  const q = message.toLowerCase();

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

  const dateStr = extractDate(message);

  // --- Ahma location ---
  if (asksAhma) {
    const check = dateStr || '2026-05-07';
    const loc = getAhmaLocation(check);
    const name = LOCATION_NAMES[loc.code] ?? { en: loc.code, zh: loc.code };
    if (loc.isCny) {
      return isZh
        ? `在 ${check}，适逢农历新年特殊安排，阿嬷住在 ${name.zh}（${loc.code}）。`
        : `On ${check}, it's the CNY special arrangement — Ahma is at ${name.en} (${loc.code}).`;
    }
    return isZh
      ? `在 ${check}，阿嬷住在 ${name.zh}（${loc.code}）。\n当前周期居住第 ${loc.dayInStay} 天（共 ${GRANDMA_DAYS_PER_LOCATION} 天）。\n轮流顺序：启超 → 启源 → 启文，从 2026年5月7日 开始。`
      : `On ${check}, Ahma is staying at ${name.en} (${loc.code}).\nDay ${loc.dayInStay} of ${GRANDMA_DAYS_PER_LOCATION} in this stay.\nRotation: Kay Cheow → Kay Guan → Kay Boon, starting 7 May 2026.`;
  }

  // --- Jun Jie shift ---
  if (asksShift) {
    const check = dateStr || '2026-06-15';
    const shift = getJunjieShift(check);
    const shiftLabel = shift.time ? `${shift.name} (${shift.time})` : shift.name;
    return isZh
      ? `在 ${check}，俊杰上 ${shiftLabel}（第 ${shift.weekNum} 周排班）。\n他的排班为3周一循环，从 2026年6月15日（周一）开始。`
      : `On ${check}, Jun Jie is on ${shiftLabel} (Week ${shift.weekNum} of 3).\nHis roster repeats every 3 weeks, starting Monday 15 June 2026.`;
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
    ? `您好！您可以问我：\n• 阿嬷在某天住在哪里（例如："2026年6月15日阿嬷在哪里？"）\n• 俊杰某天的班次（例如："6月15日俊杰上什么班？"）\n• 新加坡公共假期`
    : `Hello! You can ask me:\n• Where Ahma is staying on any date (e.g. "Where is Ahma on 15 June 2026?")\n• Jun Jie's shift on any date (e.g. "What is Jun Jie's shift on 15 June?")\n• Singapore public holidays`;
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

async function getAiReply(message: string, language: 'en' | 'zh', apiKey: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });
  const systemPrompt = `You are the friendly family calendar assistant for the "Ahma's Rotation" app.
Key facts:
- Ahma rotates: Kay Cheow (KC) → Kay Guan (KG) → Kay Boon (KB), 14 days each, anchor 7 May 2026 at Kay Cheow.
- CNY special (Eve 5pm → Day 2 8pm): 2026 KG, 2027 KB, 2028 KC, 2029 KG, repeating.
- Jun Jie 3-week shift roster anchored Monday 15 Jun 2026:
  Week 1: Mon-Tue Night (2200-0900), Wed Off, Thu Rest, Fri-Sun Morning (0630-1530).
  Week 2: Mon Morning (0630-1530), Tue Off, Wed-Thu Afternoon 1 (1600-0100), Fri-Sat Afternoon 2 (1400-0100), Sun Rest.
  Week 3: Mon Off, Tue-Thu Morning (0630-1530), Fri Rest, Sat-Sun Afternoon 3 (1500-0200).
Answer in ${language === 'zh' ? 'Chinese (中文)' : 'English'}. Be concise and warm. Plain text only, no Markdown.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\nQuestion: ${message}` }] }],
  });
  return response.text?.trim() ?? '';
}

// ---------------------------------------------------------------------------
// Vercel Serverless Handler
// ---------------------------------------------------------------------------

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(200).send('Ahma Rotation Telegram Webhook is active.');
  }

  const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';
  if (!TELEGRAM_TOKEN) {
    console.error('TELEGRAM_BOT_TOKEN is not set.');
    return res.status(500).json({ error: 'Bot token not configured.' });
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

  if (userText === '/start') {
    replyText =
      language === 'zh'
        ? '您好！我是阿嬷日程小助手 🌸\n\n您可以问我：\n• 某一天阿嬷住在谁家（启超、启源、启文）\n• 俊杰的上下班班次\n• 新加坡公共假期\n\n例如：「2026年6月15日阿嬷住在哪里？」'
        : "Hello! I'm Ahma's Rotation Assistant 🌸\n\nYou can ask me:\n• Where Ahma is staying on any date (Kay Cheow, Kay Guan, Kay Boon)\n• Jun Jie's work shift on any date\n• Upcoming Singapore public holidays\n\nExample: \"Where is Ahma on 15 June 2026?\"";
  } else {
    // Try Gemini AI first
    const geminiKey = process.env.GEMINI_API_KEY ?? process.env.VITE_GEMINI_API_KEY ?? '';
    if (geminiKey) {
      try {
        replyText = await getAiReply(userText, language, geminiKey);
      } catch (err: any) {
        console.warn('Gemini failed, using local solver:', err?.message ?? err);
      }
    }

    // Fall back to inline rule-based solver
    if (!replyText) {
      replyText = resolveAnswer(userText, language === 'zh');
    }
  }

  // Send reply first, then ACK Vercel — ensures function isn't frozen mid-fetch
  await sendTelegramMessage(TELEGRAM_TOKEN, chatId, replyText);
  return res.status(200).end();
}
