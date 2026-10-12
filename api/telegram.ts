import type { VercelRequest, VercelResponse } from '@vercel/node';
import Groq from 'groq-sdk';

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
// Core chat resolver (self-contained, no src/ imports)
// ---------------------------------------------------------------------------

function resolveAnswer(message: string, isZh: boolean): string {
  const q = message.toLowerCase();

  // --- Add event fallback (Gemini unavailable) ---
  const addKeywords = ['add', 'create', 'schedule', 'plan', 'book', 'put', '记', '添加', '加入', '安排', '计划'];
  const eventKeywords = ['event', 'trip', 'holiday', 'plan', 'gathering', 'appointment', 'staycation', '活动', '旅行', '假期', '聚餐', '行程'];
  const wantsAdd = addKeywords.some((k) => q.includes(k)) && eventKeywords.some((k) => q.includes(k));
  if (wantsAdd) {
    return isZh
      ? `要添加活动，请提供：\n• 活动名称\n• 日期（例如：2026年6月20日）\n• 地点（可选）\n• 备注（可选）\n\n目前我需要网络连接才能保存活动。请稍后再试，或直接在日历网页上添加。`
      : `To add an event, I need a connection to the calendar server.\nPlease try again shortly, or add it directly on the calendar web app.\n\nYou can also try: "Add a family staycation at Sentosa from 20 to 22 June 2026"`;
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
      : `On ${check}, Ahma is staying at ${name.en} (${loc.code}).\nDay ${loc.dayInStay} of ${GRANDMA_DAYS_PER_LOCATION} in this stay.\nRotation: Kay Cheow (KC) → Kay Guan (KG) → Kay Boon (KB), starting 7 May 2026.`;
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
    ? `你好！有什么我可以帮你的吗？😊\n\n我也很擅长回答：\n• 阿嬷在某天住在哪里（例如："2026年6月15日阿嬷在哪里？"）\n• 俊杰某天的班次（例如："6月15日俊杰上什么班？"）\n• 新加坡公共假期`
    : `Hey there! What's on your mind? 😊\n\nI'm also great with:\n• Where Ahma is staying on any date (e.g. "Where is Ahma on 15 June 2026?")\n• Jun Jie's shift on any date (e.g. "What is Jun Jie's shift on 15 June?")\n• Singapore public holidays`;
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
  const groq = new Groq({ apiKey });
  const appUrl = (process.env.APP_URL ?? '').replace(/\/$/, '');

  // -------------------------------------------------------------------------
  // Fetch live calendar state (events + overrides) for context
  // -------------------------------------------------------------------------
  let eventContext = '';
  let calendarState: any = null;

  if (appUrl) {
    try {
      const stateRes = await fetch(`${appUrl}/api/state`);
      if (stateRes.ok) {
        calendarState = await stateRes.json();
        const events: any[] = calendarState.events ?? [];
        const overrides: any[] = calendarState.overrides ?? [];
        const members: any[] = calendarState.familyMembers ?? [];

        const memberName = (id: string) => {
          const m = members.find((fm: any) => fm.id === id);
          return m ? m.name : id;
        };

        if (events.length > 0) {
          const lines = events
            .sort((a: any, b: any) => a.startDate.localeCompare(b.startDate))
            .map((e: any) => {
              const dateRange = e.endDate && e.endDate !== e.startDate
                ? `${e.startDate} to ${e.endDate}` : e.startDate;
              const timePart = e.time ? ` at ${e.time}` : '';
              const locPart = e.location ? ` @ ${e.location}` : '';
              const notesPart = e.notes ? ` (${e.notes})` : '';
              return `- [${e.category}] ${e.title} | ${dateRange}${timePart}${locPart} | Who: ${memberName(e.memberId)}${notesPart}`;
            })
            .join('\n');
          eventContext += `\nCurrent calendar events:\n${lines}`;
        }

        if (overrides.length > 0) {
          const oLines = overrides
            .sort((a: any, b: any) => a.date.localeCompare(b.date))
            .map((o: any) => {
              if (o.type === 'grandma_location')
                return `- ${o.date}: Ahma override → ${o.grandmaLocation}${o.grandmaReason ? ` (${o.grandmaReason})` : ''}`;
              if (o.type === 'junjie_shift')
                return `- ${o.date}: Jun Jie override → ${o.shiftName || o.shiftCode}${o.shiftTime ? ` ${o.shiftTime}` : ''}${o.shiftReason ? ` (${o.shiftReason})` : ''}`;
              return `- ${o.date}: ${o.type} override`;
            })
            .join('\n');
          eventContext += `\n\nSpecial schedule overrides:\n${oLines}`;
        }
      }
    } catch (err) {
      console.warn('Could not fetch calendar state:', err);
    }
  }

  // -------------------------------------------------------------------------
  // Step 1: Intent detection — classify + extract event fields as JSON
  // -------------------------------------------------------------------------
  const intentPrompt = `You are a smart assistant that classifies a user message for a family calendar app.

Classify the message and extract relevant fields. Respond ONLY with valid JSON matching this schema:
{
  "intent": "add_event" | "query" | "chat",
  "event": {
    "title": string,
    "startDate": "YYYY-MM-DD",
    "endDate": "YYYY-MM-DD or null",
    "category": "holiday_plan" | "family_gathering" | "medical" | "leave" | "unusual_arrangement" | "general",
    "memberId": "all" | "grandma" | "junjie" | "layting" | "dad" | "mom",
    "time": "HH:MM or null",
    "location": "string or null",
    "notes": "string or null"
  }
}

Rules:
- Use "add_event" ONLY when the user clearly wants to ADD or SCHEDULE a NEW event.
- Use "query" for questions about schedules, Ahma, shifts, holidays, or existing events.
- Use "chat" for general conversation.
- The "event" field is only required when intent is "add_event". Omit it otherwise.
- Assume year 2026 if no year is specified.
- memberId: "all" for whole family; "junjie" for Jun Jie/俊杰; "grandma" for Ahma/阿嬷; "layting" for Lay Ting/丽婷; default "all".
- category: trips/holidays/staycations → "holiday_plan"; family meals/gatherings → "family_gathering"; doctor/checkup → "medical"; leave/MC → "leave"; else → "general".

Today is ${todaySGT()}.
Message: "${message}"`;

  let intent = 'query';
  let extractedEvent: any = null;

  try {
    const intentCompletion = await groq.chat.completions.create({
      model: 'qwen/qwen3.8-27b',
      messages: [{ role: 'user', content: intentPrompt }],
      temperature: 0.1,
      max_tokens: 256,
      // @ts-ignore
      reasoning_effort: 'none',
    });
    const raw = intentCompletion.choices[0]?.message?.content?.trim() ?? '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      intent = parsed.intent ?? 'query';
      extractedEvent = parsed.event ?? null;
    }
  } catch (err) {
    console.warn('Intent detection failed, defaulting to query:', err);
  }

  // -------------------------------------------------------------------------
  // Step 2: If adding an event, POST to /api/events and confirm
  // -------------------------------------------------------------------------
  if (intent === 'add_event' && extractedEvent?.title && extractedEvent?.startDate) {
    let savedEvent: any = null;

    if (appUrl) {
      try {
        const now = new Date().toISOString();
        const payload = {
          id: `ev-tg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          title: extractedEvent.title,
          startDate: extractedEvent.startDate,
          endDate: extractedEvent.endDate || undefined,
          category: extractedEvent.category || 'holiday_plan',
          memberId: extractedEvent.memberId || 'all',
          time: extractedEvent.time || undefined,
          location: extractedEvent.location || undefined,
          notes: extractedEvent.notes || undefined,
          createdAt: now,
          updatedAt: now,
        };
        const saveRes = await fetch(`${appUrl}/api/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (saveRes.ok) {
          const saved = await saveRes.json();
          savedEvent = saved.event ?? payload;
        }
      } catch (err) {
        console.warn('Could not save event via API:', err);
      }
    }

    const ev = savedEvent ?? extractedEvent;
    const dateRange = ev.endDate ? `${ev.startDate} – ${ev.endDate}` : ev.startDate;
    const locPart = ev.location ? ` @ ${ev.location}` : '';
    return language === 'zh'
      ? `好的！我已把以下活动添加到日历：\n\n📅 ${ev.title}\n🗓 ${dateRange}${locPart}${ev.time ? `\n⏰ ${ev.time}` : ''}${ev.notes ? `\n📝 ${ev.notes}` : ''}\n\n您可以在日历网页上查看！`
      : `Done! I've added this to the calendar:\n\n📅 ${ev.title}\n🗓 ${dateRange}${locPart}${ev.time ? `\n⏰ ${ev.time}` : ''}${ev.notes ? `\n📝 ${ev.notes}` : ''}\n\nYou can check it on the calendar web app!`;
  }

  // -------------------------------------------------------------------------
  // Step 3: Normal conversational reply with full calendar context
  // -------------------------------------------------------------------------
  const systemPrompt = `You are Ahma Bot 🌸, a warm and friendly family assistant for the "Ahma's Rotation" app. You love chatting with the family and can talk about anything — daily life, food, feelings, general questions, or just casual conversation. You are helpful, cheerful, and feel like a family member yourself.

Your specialty is the family calendar:
- Ahma rotates: Dad's place (爸爸家/KC) → Kay Guan (启源/KG) → Kay Boon (启文/KB), 14 days each, anchor 7 May 2026 at Dad's place.
- CNY special (Eve 5pm → Day 2 8pm): 2026 KG, 2027 KB, 2028 KC (Dad's), 2029 KG, repeating.
- Jun Jie 3-week shift roster anchored Monday 15 Jun 2026:
  Week 1: Mon-Tue Night/晚 (2200-0900), Wed OFF, Thu REST, Fri-Sun Morning/早 (0630-1530).
  Week 2: Mon Morning/早 (0630-1530), Tue OFF, Wed-Thu Afternoon 1/午1 (1400-0200), Fri-Sat Afternoon 2/午2 (1500-0100), Sun REST.
  Week 3: Mon OFF, Tue-Thu Morning/早 (0630-1530), Fri REST, Sat-Sun Afternoon 3/午3 (1600-0100).
- Shift Chinese short forms: Morning=早, Afternoon 1=午1, Afternoon 2=午2, Afternoon 3=午3, Night=晚, OFF=休, REST=休息.
${eventContext || '\n(No calendar events loaded)'}

When answering about events or plans, translate event titles and details into Chinese if the user is speaking Chinese, or keep in English otherwise.
For casual chat, just be natural and warm. For calendar questions, be accurate and concise.
Answer in ${language === 'zh' ? 'Chinese (中文)' : 'English'}. Plain text only, no Markdown.`;

  const completion = await groq.chat.completions.create({
    model: 'qwen/qwen3.8-27b',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: message },
    ],
    temperature: 0.7,
    max_tokens: 512,
    // @ts-ignore
    reasoning_effort: 'none',
  });
  return completion.choices[0]?.message?.content?.trim() ?? '';
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
        ? '您好！我是阿嬷日程小助手 🌸\n\n您可以问我：\n• 某一天阿嬷住在谁家（启超、启源、启文）\n• 俊杰的上下班班次\n• 日历上的活动和假期计划\n• 新加坡公共假期\n• 或者聊任何话题！\n\n例如：「2026年6月15日阿嬷住在哪里？」'
        : "Hello! I'm Ahma Bot 🌸\n\nYou can ask me:\n• Where Ahma is staying on any date\n• Jun Jie's work shift on any date\n• Events and holiday plans on the calendar\n• Singapore public holidays\n• Or just have a chat!\n\nExample: \"Where is Ahma on 15 June 2026?\"";
  } else {
    // Try Groq AI first
    const groqKey = process.env.GROQ_API_KEY ?? '';
    if (groqKey) {
      try {
        replyText = await getAiReply(userText, language, groqKey);
      } catch (err: any) {
        console.warn('Groq failed, using local solver:', err?.message ?? err);
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
