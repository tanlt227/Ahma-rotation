import type { Express, Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';

interface ServerContext {
  getState: () => any;
  saveState: (newState: any) => void;
  saveNewEvent: (eventData: any) => any;
}

export function getTelegramBotToken(appState: any): string {
  return (process.env.TELEGRAM_BOT_TOKEN || appState.settings?.telegramBotToken || '').trim();
}

export async function sendTelegramMessage(token: string, chatId: number | string, text: string) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('[telegram] sendMessage failed:', data);
    }
    return data;
  } catch (err: any) {
    console.error('[telegram] Network error sending message:', err);
    return { ok: false, error: err?.message || String(err) };
  }
}

export function resolveLocalAnswer(message: string, isZh: boolean, appState: any): string {
  const query = message.toLowerCase();
  const today = new Date(Date.now() + 8 * 3600 * 1000).toISOString().split('T')[0];

  // 1. Ahma location query
  if (
    query.includes('ahma') || query.includes('grandma') || query.includes('阿嬷') ||
    query.includes('grandmother') || query.includes('kc') || query.includes('kg') || query.includes('kb') ||
    query.includes('kay cheow') || query.includes('kay guan') || query.includes('kay boon') ||
    query.includes('启超') || query.includes('启源') || query.includes('启文')
  ) {
    const anchor = appState.settings?.grandmaAnchorDate || '2026-05-07';
    const stayDays = appState.settings?.grandmaCycleDays || 14;
    const seq = ['KC', 'KG', 'KB'];
    const names: Record<string, { en: string; zh: string }> = {
      KC: { en: "Dad's place (KC / Kay Cheow)", zh: '爸爸家 / 启超 (KC)' },
      KG: { en: 'Kay Guan (KG)', zh: '启源 (KG)' },
      KB: { en: 'Kay Boon (KB)', zh: '启文 (KB)' },
    };

    const getLocInfo = (dStr: string) => {
      const [yA, mA, dA] = dStr.split('-').map(Number);
      const [yB, mB, dB] = anchor.split('-').map(Number);
      const diff = Math.round((Date.UTC(yA, mA - 1, dA) - Date.UTC(yB, mB - 1, dB)) / 86400000);
      const total = seq.length * stayDays;
      const cDay = ((diff % total) + total) % total;
      const idx = Math.floor(cDay / stayDays);
      const code = seq[idx] || 'KC';
      const dayInStay = (cDay % stayDays) + 1;
      const daysLeft = stayDays - dayInStay;
      const nextCode = seq[(idx + 1) % seq.length];
      const nextD = new Date(Date.UTC(yA, mA - 1, dA + daysLeft + 1)).toISOString().split('T')[0];
      return { code, dayInStay, daysLeft, nextCode, nextDate: nextD };
    };

    const targetCode =
      query.includes('kc') || query.includes('kay cheow') || query.includes('启超') || query.includes('dad') || query.includes('爸爸') ? 'KC' :
      query.includes('kg') || query.includes('kay guan') || query.includes('启源') ? 'KG' :
      query.includes('kb') || query.includes('kay boon') || query.includes('启文') ? 'KB' : null;

    const dateMatch = message.match(/(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})/) || message.match(/(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|[一二三四五六七八九十]+月)/i);
    let targetDate = '';
    if (dateMatch) {
      if (dateMatch[1] && dateMatch[1].includes('-')) {
        targetDate = dateMatch[1];
      } else if (dateMatch[2]) {
        const dNum = parseInt(dateMatch[1]);
        const mNames: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
        const mKey = dateMatch[2].slice(0, 3).toLowerCase();
        const mNum = mNames[mKey] || 5;
        targetDate = `2026-${String(mNum).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`;
      }
    }

    const asksWhen =
      query.includes('when') || query.includes('next') || query.includes('coming') || query.includes('come') ||
      query.includes('arrive') || query.includes('visit') || query.includes('turn') || query.includes('go') ||
      query.includes('几时') || query.includes('什么时候') || query.includes('何时') || query.includes('下次') ||
      query.includes('过来') || query.includes('去') || query.includes('来') || query.includes('到') || query.includes('轮到') ||
      (!targetDate && targetCode !== null);

    const cur = getLocInfo(today);

    if (asksWhen && targetCode) {
      const [yT, mT, dT] = today.split('-').map(Number);
      let nextArrival = '';
      let nextEndDate = '';
      let daysAway = 0;
      for (let i = 1; i <= seq.length * stayDays * 3; i++) {
        const checkD = new Date(Date.UTC(yT, mT - 1, dT + i)).toISOString().split('T')[0];
        const info = getLocInfo(checkD);
        if (info.code === targetCode && info.dayInStay === 1) {
          nextArrival = checkD;
          daysAway = i;
          nextEndDate = new Date(Date.UTC(yT, mT - 1, dT + i + stayDays - 1)).toISOString().split('T')[0];
          break;
        }
      }

      const locName = names[targetCode];
      if (cur.code === targetCode) {
        const nextLoc = names[cur.nextCode];
        return isZh
          ? `👵 阿嬷目前就在 ${locName.zh}！\n• 今天是第 ${cur.dayInStay} 天（共 ${stayDays} 天），还剩 ${cur.daysLeft} 天（直到 ${cur.nextDate} 前往 ${nextLoc.zh}）。\n• 下一次再轮到 ${locName.zh} 是 ${nextArrival}（${daysAway} 天后）。`
          : `👵 Ahma is currently at ${locName.en} right now!\n• Today is Day ${cur.dayInStay} of ${stayDays} (${cur.daysLeft} days remaining, until ${cur.nextDate} when she moves to ${nextLoc.en}).\n• Her next return visit to ${locName.en} will be on ${nextArrival} (in ${daysAway} days).`;
      }

      const curLoc = names[cur.code];
      return isZh
        ? `👵 阿嬷下次到 ${locName.zh} 是 ${nextArrival}（${daysAway} 天后，住到 ${nextEndDate}）。\n• 目前阿嬷在 ${curLoc.zh}，还剩 ${cur.daysLeft} 天（直到 ${cur.nextDate}）。`
        : `👵 Ahma will be coming over to ${locName.en} on ${nextArrival} (in ${daysAway} days, staying until ${nextEndDate}).\n• Currently, Ahma is staying at ${curLoc.en} (${cur.daysLeft} days remaining until ${cur.nextDate}).`;
    }

    const checkDate = targetDate || today;
    const isToday = checkDate === today;
    const info = getLocInfo(checkDate);
    const loc = names[info.code];
    const nextLoc = names[info.nextCode];

    if (isZh) {
      return `👵 ${isToday ? '今天' : `在 ${checkDate}`}，阿嬷住在 ${loc.zh}（第 ${info.dayInStay}/${stayDays} 天，还剩 ${info.daysLeft} 天，将于 ${info.nextDate} 前往 ${nextLoc.zh}）。`;
    }
    return `👵 ${isToday ? 'Today' : `On ${checkDate}`}, Ahma is staying at ${loc.en} (Day ${info.dayInStay} of ${stayDays}, ${info.daysLeft} days remaining until ${info.nextDate} when she moves to ${nextLoc.en}).`;
  }

  // 2. Jun Jie shift query
  if (query.includes('jun jie') || query.includes('junjie') || query.includes('俊杰') || query.includes('shift') || query.includes('班次') || query.includes('上班')) {
    let targetDate = '2026-06-15';
    const dateMatch = message.match(/(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})/);
    if (dateMatch) targetDate = dateMatch[1];

    const anchor = appState.settings?.junjieAnchorDate || '2026-06-15';
    const [yA, mA, dA] = targetDate.split('-').map(Number);
    const [yB, mB, dB] = anchor.split('-').map(Number);
    const diff = Math.round((Date.UTC(yA, mA - 1, dA) - Date.UTC(yB, mB - 1, dB)) / 86400000);
    const dayIdx = ((diff % 21) + 21) % 21;
    const weekNum = Math.floor(dayIdx / 7) + 1;

    const cycleShifts = [
      'Night (2200-0900)', 'Night (2200-0900)', 'OFF Day', 'REST DAY', 'Morning (0630-1530)', 'Morning (0630-1530)', 'Morning (0630-1530)',
      'Morning (0630-1530)', 'OFF Day', 'Afternoon 1 / 午1 (1400-0200)', 'Afternoon 1 / 午1 (1400-0200)', 'Afternoon 2 / 午2 (1500-0100)', 'Afternoon 2 / 午2 (1500-0100)', 'REST DAY',
      'OFF Day', 'Morning (0630-1530)', 'Morning (0630-1530)', 'Morning (0630-1530)', 'REST DAY', 'Afternoon 3 / 午3 (1600-0100)', 'Afternoon 3 / 午3 (1600-0100)'
    ];
    const shiftName = cycleShifts[dayIdx] || 'Off Day';

    if (isZh) {
      return `在 ${targetDate}，俊杰上 ${shiftName}（第 ${weekNum} 周排班）。\n他的排班为3周一循环，从2026年6月15日（周一）开始。`;
    }
    return `On ${targetDate}, Jun Jie is scheduled for ${shiftName} (Week ${weekNum} of 3).\nHis schedule follows a 3-week repeating roster starting on 15 June 2026.`;
  }

  // 3. Calendar events query
  if (
    query.includes('event') || query.includes('plan') || query.includes('trip') ||
    query.includes('holiday plan') || query.includes('staycation') || query.includes('gathering') ||
    query.includes('medical') || query.includes('appointment') ||
    query.includes('活动') || query.includes('计划') || query.includes('旅行') ||
    query.includes('聚餐') || query.includes('假期') || query.includes('行程')
  ) {
    const events: any[] = appState.events || [];
    if (events.length === 0) {
      return isZh ? `目前日历上还没有任何活动记录。` : `There are no events on the calendar yet.`;
    }
    const sorted = events.sort((a: any, b: any) => a.startDate.localeCompare(b.startDate));
    const lines = sorted.map((e: any) => {
      const dateRange = e.endDate && e.endDate !== e.startDate ? `${e.startDate} – ${e.endDate}` : e.startDate;
      const timePart = e.time ? ` ${e.time}` : '';
      const locPart = e.location ? ` @ ${e.location}` : '';
      return `• ${dateRange}${timePart}: ${e.title}${locPart}`;
    }).join('\n');
    return isZh ? `以下是日历上的活动：\n${lines}` : `Here are the events on the calendar:\n${lines}`;
  }

  // 4. Public holidays query
  if (query.includes('holiday') || query.includes('假期') || query.includes('public holiday')) {
    if (isZh) {
      return `新加坡主要公共假期包括：\n• 5月1日：劳动节 (Labour Day)\n• 5月31日 - 6月1日：卫塞节及补假 (Vesak Day)\n• 8月9日 - 8月10日：国庆日及补假 (National Day)\n• 11月8日 - 11月9日：屠妖节及补假 (Deepavali)\n• 12月25日：圣诞节 (Christmas Day)`;
    }
    return `Key upcoming Singapore Public Holidays include:\n• 1 May: Labour Day\n• 31 May – 1 Jun: Vesak Day & In-Lieu\n• 9 Aug – 10 Aug: National Day & In-Lieu\n• 8 Nov – 9 Nov: Deepavali & In-Lieu\n• 25 Dec: Christmas Day`;
  }

  if (isZh) {
    return `你好！我是阿嬷日程小助手 🌸\n\n我可以帮您解答：\n• 阿嬷某天住在谁家（爸爸家/启超、启源、启文）\n• 俊杰某天的上下班班次\n• 新加坡公共假期\n• 添加日历活动（例如：“添加 6月20日 晚上7点 爸爸家聚餐” 或 “/add 2026-06-20 聚餐”）`;
  }
  return `Hello! I'm Ahma Bot 🌸\n\nI can help you with:\n• Where Ahma is staying on any date (Dad's/KC, Kay Guan, Kay Boon)\n• Jun Jie's work shift on any date\n• Singapore public holidays\n• Add calendar events (e.g. "Add dinner at Dad's on 20 June 2026 at 7pm" or "/add 2026-06-20 Family dinner")`;
}

export async function processChatMessage(
  message: string,
  language: string = 'en',
  appState: any,
  saveNewEvent: (eventData: any) => any
): Promise<{ reply: string; newEvent?: any }> {
  const rawText = (message || '').trim();
  const isZh = language === 'zh' || /[\u4e00-\u9fa5]/.test(rawText);

  // Fast path: /add
  if (rawText.startsWith('/add ') || rawText.startsWith('/add:')) {
    const rest = rawText.replace(/^\/add[:\s]+/, '').trim();
    const dateMatch = rest.match(/^(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})\s*(.*)$/);
    if (dateMatch) {
      const startDate = dateMatch[1].replace(/[/.]/g, '-');
      const title = dateMatch[2].trim() || 'New Event';
      const created = saveNewEvent({ title, startDate, category: 'family_gathering', memberId: 'all' });
      const confirm = isZh
        ? `好的！已为您添加活动到日历：\n📅 ${created.title}\n🗓 ${created.startDate}`
        : `Done! Added to calendar:\n📅 ${created.title}\n🗓 ${created.startDate}`;
      return { reply: confirm, newEvent: created };
    }
  }

  // Fast path: /today
  if (rawText === '/today' || rawText === '今天') {
    const today = new Date(Date.now() + 8 * 3600 * 1000).toISOString().split('T')[0];
    const ahmaReply = resolveLocalAnswer(`where is ahma on ${today}`, isZh, appState);
    const jjReply = resolveLocalAnswer(`what is junjie shift on ${today}`, isZh, appState);
    return { reply: `${ahmaReply}\n\n${jjReply}` };
  }

  // Fast path: /events
  if (rawText === '/events' || rawText === '活动') {
    return { reply: resolveLocalAnswer('events list', isZh, appState) };
  }

  // Gemini AI with live calendar context
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      const events: any[] = appState.events || [];
      const overrides: any[] = appState.overrides || [];
      const familyMembers: any[] = appState.familyMembers || [];

      const memberName = (id: string) => {
        const m = familyMembers.find((fm: any) => fm.id === id);
        return m ? m.name : id;
      };

      const eventLines = events
        .slice(0, 30)
        .sort((a: any, b: any) => a.startDate.localeCompare(b.startDate))
        .map((e: any) => {
          const dateRange = e.endDate && e.endDate !== e.startDate ? `${e.startDate} to ${e.endDate}` : e.startDate;
          const timePart = e.time ? ` at ${e.time}` : '';
          const locPart = e.location ? ` @ ${e.location}` : '';
          const who = memberName(e.memberId);
          return `- [${e.category}] ${e.title} | ${dateRange}${timePart}${locPart} | Who: ${who}`;
        })
        .join('\n');

      const overrideLines = overrides
        .slice(0, 15)
        .sort((a: any, b: any) => a.date.localeCompare(b.date))
        .map((o: any) => {
          if (o.type === 'grandma_location') {
            return `- ${o.date}: Ahma override → ${o.grandmaLocation}${o.grandmaReason ? ` (${o.grandmaReason})` : ''}`;
          }
          if (o.type === 'junjie_shift') {
            return `- ${o.date}: Jun Jie override → ${o.shiftName || o.shiftCode}`;
          }
          return `- ${o.date}: ${o.type} override`;
        })
        .join('\n');

      const ai = new GoogleGenAI({ apiKey });

      const intentPrompt = `You are a smart assistant for a family calendar app (FamilySync SG / Ahma's Rotation).
Classify the user message: "${rawText}".
Today is Singapore date: ${new Date(Date.now() + 8 * 3600 * 1000).toISOString().split('T')[0]}.
Respond ONLY with valid JSON:
{
  "intent": "add_event" | "query" | "chat",
  "event": {
    "title": string,
    "startDate": "YYYY-MM-DD",
    "endDate": "YYYY-MM-DD or null",
    "category": "holiday_plan" | "family_gathering" | "medical" | "leave" | "general",
    "memberId": "all" | "grandma" | "junjie" | "layting" | "dad" | "mom",
    "time": "HH:MM or null",
    "location": "string or null",
    "notes": "string or null"
  }
}`;

      let intent = 'query';
      let extractedEvent: any = null;

      try {
        const intentRes = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: [{ role: 'user', parts: [{ text: intentPrompt }] }],
        });
        const raw = intentRes.text?.trim() ?? '';
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          intent = parsed.intent ?? 'query';
          extractedEvent = parsed.event ?? null;
        }
      } catch (err) {
        console.warn('[chat] Intent parsing failed, continuing as query:', err);
      }

      if (intent === 'add_event' && extractedEvent?.title && extractedEvent?.startDate) {
        const created = saveNewEvent(extractedEvent);
        const dateRange = created.endDate ? `${created.startDate} – ${created.endDate}` : created.startDate;
        const locPart = created.location ? ` @ ${created.location}` : '';
        const confirmText = isZh
          ? `好的！我已把以下活动添加到日历：\n\n📅 ${created.title}\n🗓 ${dateRange}${locPart}${created.time ? `\n⏰ ${created.time}` : ''}\n\n所有家庭成员的日历已实时同步！`
          : `Done! I've added this to the calendar:\n\n📅 ${created.title}\n🗓 ${dateRange}${locPart}${created.time ? `\n⏰ ${created.time}` : ''}\n\nLive-synced across all family devices!`;
        return { reply: confirmText, newEvent: created };
      }

      const today = new Date(Date.now() + 8 * 3600 * 1000).toISOString().split('T')[0];
      const systemPrompt = `You are Ahma Bot 🌸, a warm and friendly family assistant for the "FamilySync SG Calendar / Ahma's Rotation" app.
TODAY IS ${today} (Singapore Time, SGT UTC+8).
Calendar Context:
- Ahma rotates: Dad's place (爸爸家/KC) → Kay Guan (启源/KG) → Kay Boon (启文/KB), 14 days each. Anchor: 7 May 2026 @ Dad's place.
- CNY Special: 2026 KG, 2027 KB, 2028 KC, 2029 KG.
- Jun Jie work schedule repeats every 3 weeks starting Monday 15 June 2026.
  Week 1: Mon-Tue Night (2200-0900), Wed OFF, Thu REST, Fri-Sun Morning (0630-1530).
  Week 2: Mon Morning (0630-1530), Tue OFF, Wed-Thu Afternoon 1 (1400-0200), Fri-Sat Afternoon 2 (1500-0100), Sun REST.
  Week 3: Mon OFF, Tue-Thu Morning (0630-1530), Fri REST, Sat-Sun Afternoon 3 (1600-0100).
- Scheduled events:
${eventLines || '(no events yet)'}
${overrideLines ? `\nOverrides:\n${overrideLines}` : ''}

Answer clearly, kindly, and concisely in ${isZh ? 'Chinese / 简体中文' : 'English'}. Keep tone warm and helpful.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\nUser Question: ${rawText}` }],
          },
        ],
      });

      if (response.text?.trim()) {
        return { reply: response.text.trim() };
      }
    } catch (err: any) {
      console.warn('[chat] Gemini API failed, using fallback solver:', err?.message || err);
    }
  }

  return { reply: resolveLocalAnswer(rawText, isZh, appState) };
}

export function setupTelegramRoutes(app: Express, ctx: ServerContext) {
  // GET /api/telegram/status — detailed diagnostic check for the UI
  app.get('/api/telegram/status', async (req: Request, res: Response) => {
    const appState = ctx.getState();
    const token = getTelegramBotToken(appState);
    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    const appUrl = (process.env.APP_URL || `${protocol}://${host}`).replace(/\/$/, '');
    const suggestedWebhookUrl = `${appUrl}/api/telegram`;

    if (!token) {
      return res.json({
        configured: false,
        hasToken: false,
        tokenSource: null,
        suggestedWebhookUrl,
        error: 'TELEGRAM_BOT_TOKEN is not configured in environment or calendar settings.',
      });
    }

    try {
      const [meRes, whRes] = await Promise.all([
        fetch(`https://api.telegram.org/bot${token}/getMe`).then((r) => r.json()).catch((e) => ({ ok: false, error: String(e) })),
        fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`).then((r) => r.json()).catch((e) => ({ ok: false, error: String(e) })),
      ]);

      const currentWebhookUrl = whRes.ok ? whRes.result?.url || '' : '';
      const isWebhookMatching = Boolean(
        currentWebhookUrl &&
        (currentWebhookUrl === suggestedWebhookUrl ||
         currentWebhookUrl.endsWith('/api/telegram') ||
         currentWebhookUrl.endsWith('/telegram/webhook'))
      );

      return res.json({
        configured: true,
        hasToken: true,
        tokenSource: process.env.TELEGRAM_BOT_TOKEN ? 'env' : 'settings',
        tokenMasked: token.length > 8 ? `...${token.slice(-6)}` : 'configured',
        botInfo: meRes.ok ? meRes.result : null,
        botError: !meRes.ok ? (meRes.description || meRes.error) : null,
        webhookInfo: whRes.ok ? whRes.result : null,
        currentWebhookUrl,
        suggestedWebhookUrl,
        isWebhookMatching,
      });
    } catch (err: any) {
      return res.json({
        configured: true,
        hasToken: true,
        error: err?.message || 'Failed to connect to Telegram API',
        suggestedWebhookUrl,
      });
    }
  });

  // POST /api/telegram/set-webhook — register webhook with Telegram
  app.post('/api/telegram/set-webhook', async (req: Request, res: Response) => {
    const appState = ctx.getState();
    let token = (req.body?.token || '').trim() || getTelegramBotToken(appState);
    if (req.body?.token && req.body.token.trim()) {
      appState.settings = { ...appState.settings, telegramBotToken: req.body.token.trim() };
      ctx.saveState(appState);
      token = req.body.token.trim();
    }

    if (!token) {
      return res.status(400).json({ success: false, error: 'No Telegram bot token provided or found.' });
    }

    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    const appUrl = (process.env.APP_URL || `${protocol}://${host}`).replace(/\/$/, '');
    const targetWebhookUrl = (req.body?.url || `${appUrl}/api/telegram`).trim();

    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(targetWebhookUrl)}`);
      const data: any = await response.json();
      if (data.ok) {
        return res.json({ success: true, description: data.description, webhookUrl: targetWebhookUrl });
      } else {
        return res.status(400).json({ success: false, error: data.description || 'Failed to register webhook with Telegram' });
      }
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Network error calling Telegram API' });
    }
  });

  // POST /api/telegram/test-send
  app.post('/api/telegram/test-send', async (req: Request, res: Response) => {
    const appState = ctx.getState();
    const token = getTelegramBotToken(appState);
    if (!token) {
      return res.status(400).json({ success: false, error: 'Telegram bot token is not configured.' });
    }
    const { chatId, text = '🌸 Test message from FamilySync SG Calendar Telegram Bot! All systems operating normally.' } = req.body;
    if (!chatId) {
      return res.status(400).json({ success: false, error: 'chatId is required.' });
    }
    const result = await sendTelegramMessage(token, chatId, text);
    return res.json(result);
  });

  // Webhook handler for Telegram updates
  const handleTelegramWebhook = async (req: Request, res: Response) => {
    // Immediate acknowledgement
    res.status(200).json({ ok: true });

    const appState = ctx.getState();
    const token = getTelegramBotToken(appState);
    if (!token) {
      console.warn('[telegram] Webhook received but TELEGRAM_BOT_TOKEN is not configured.');
      return;
    }

    const update = req.body;
    const msg = update?.message || update?.edited_message;
    if (!msg || !msg.text) return;

    const chatId: number = msg.chat?.id;
    const userText: string = msg.text.trim();
    if (!chatId || !userText) return;

    const isZh = /[\u4e00-\u9fa5]/.test(userText);

    if (userText === '/start') {
      const welcome = isZh
        ? '您好！我是阿嬷日程小助手 🌸\n\n您可以问我：\n• 某一天阿嬷住在谁家（例如：“阿嬷几时来爸爸家？”）\n• 俊杰的上下班班次（例如：“6月15日俊杰上什么班？”）\n• 日历上的活动和假期计划\n• 新加坡公共假期\n• 添加活动（例如：“添加 6月20日 晚上7点 爸爸家聚餐” 或 “/add 2026-06-20 聚餐”）\n• 或者聊任何日常话题！'
        : "Hello! I'm Ahma Bot 🌸\n\nYou can ask me:\n• Where Ahma is staying on any date (e.g. \"When is Ahma next at Dad's place / KC?\")\n• Jun Jie's work shift on any date (e.g. \"What is Jun Jie's shift on 15 June 2026?\")\n• Events and holiday plans on the calendar\n• Singapore public holidays\n• Add calendar events (e.g. \"Add dinner on 20 June 2026 at 7pm\" or \"/add 2026-06-20 Family dinner\")\n• Or just have a casual chat!";
      await sendTelegramMessage(token, chatId, welcome);
      return;
    }

    if (userText === '/help') {
      const help = isZh
        ? '📖 阿嬷日历助手常用指令：\n\n• /start — 开始对话与简介\n• /today — 查看今天阿嬷在哪里及俊杰班次\n• /events — 查看近期家庭活动\n• /add [日期] [活动名称] — 快速添加活动\n\n您也可以直接用自然语言向我提问！'
        : "📖 Ahma Calendar Bot Commands:\n\n• /start — Welcome & intro\n• /today — See where Ahma is today & Jun Jie's shift\n• /events — View upcoming calendar events\n• /add [date] [title] — Quickly add a new event\n\nOr ask naturally in English or Chinese!";
      await sendTelegramMessage(token, chatId, help);
      return;
    }

    try {
      const { reply } = await processChatMessage(userText, isZh ? 'zh' : 'en', appState, ctx.saveNewEvent);
      await sendTelegramMessage(token, chatId, reply);
    } catch (err) {
      console.error('[telegram] Error processing message:', err);
      const errReply = isZh
        ? '抱歉，处理您的消息时出现异常，请稍后再试。'
        : 'Sorry, an error occurred while processing your message. Please try again.';
      await sendTelegramMessage(token, chatId, errReply);
    }
  };

  app.post('/api/telegram', handleTelegramWebhook);
  app.post('/telegram/webhook', handleTelegramWebhook);

  // Browser status GET check
  const handleTelegramGet = async (req: Request, res: Response) => {
    const appState = ctx.getState();
    const token = getTelegramBotToken(appState);
    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    const appUrl = (process.env.APP_URL || `${protocol}://${host}`).replace(/\/$/, '');
    const suggestedWebhookUrl = `${appUrl}/api/telegram`;

    res.json({
      status: 'active',
      service: 'FamilySync SG Calendar — Telegram Webhook Service',
      time: new Date().toISOString(),
      tokenConfigured: Boolean(token),
      tokenSource: token ? (process.env.TELEGRAM_BOT_TOKEN ? 'env' : 'settings') : 'none',
      suggestedWebhookUrl,
      quickSetUrl: token ? `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(suggestedWebhookUrl)}` : null,
      tip: 'If your bot is not responding on Telegram, make sure you configure your token and register the webhook URL above.',
    });
  };

  app.get('/api/telegram', handleTelegramGet);
  app.get('/telegram/webhook', handleTelegramGet);

  // Chatbot endpoint for web UI
  app.post('/api/chat', async (req: Request, res: Response) => {
    const { message, language = 'en' } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    const appState = ctx.getState();
    const result = await processChatMessage(message, language, appState, ctx.saveNewEvent);
    res.json(result);
  });
}
