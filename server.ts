/**
 * server.ts — LOCAL DEVELOPMENT ONLY
 *
 * This file runs a local Express + WebSocket dev server for working offline.
 * It is NOT used in production. The Vercel deployment uses api/*.ts functions.
 *
 * State is persisted locally to data/calendar-data.json (gitignored).
 * Production state lives in the GitHub Contents API (see lib/state.ts).
 *
 * Run with:  npm run dev
 */
import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'calendar-data.json');

// Ensure data folder exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DEFAULT_STATE = {
  events: [
    {
      id: 'seed-event-1',
      title: "Family Gathering Dinner @ Dad's",
      startDate: '2026-05-10',
      category: 'family_gathering',
      memberId: 'all',
      time: '18:30',
      location: "Dad's Place (KC)",
      notes: 'Mother’s Day family dinner celebration with Ahma',
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
    },
    {
      id: 'seed-event-2',
      title: 'Ahma Polyclinic Routine Check-up',
      startDate: '2026-05-22',
      category: 'medical',
      memberId: 'grandma',
      time: '09:30',
      location: 'Polyclinic near Kay Guan (KG)',
      notes: 'Blood pressure & medication top-up check',
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
    },
    {
      id: 'seed-event-3',
      title: 'June Family Staycation / Holiday',
      startDate: '2026-06-20',
      endDate: '2026-06-22',
      category: 'holiday_plan',
      memberId: 'all',
      location: 'Sentosa Resort',
      notes: 'Weekend family getaway during school holidays',
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
    },
  ],
  overrides: [
    // Empty by default, users can freely add unusual arrangements
  ],
  familyMembers: [
    { id: 'all', name: 'Whole Family', relationship: 'Family', color: '#10b981' },
    { id: 'grandma', name: 'Grandmother (阿嬷)', relationship: 'Elder', color: '#0d9488' },
    { id: 'junjie', name: 'Jun Jie', relationship: 'Son / Brother', color: '#8b5cf6' },
    { id: 'layting', name: '丽婷 (Lay Ting)', relationship: 'Daughter / Sister', color: '#f43f5e' },
    { id: 'dad', name: 'Dad', relationship: 'Father', color: '#3b82f6' },
    { id: 'mom', name: 'Mom', relationship: 'Mother', color: '#ec4899' },
  ],
  settings: {
    grandmaAnchorDate: '2026-05-07',
    grandmaCycleDays: 14,
    grandmaSequence: ['KC', 'KG', 'KB'],
    grandmaLocations: {
      KC: { name: 'Dad', notes: 'Dad (Kay Cheow / KC)' },
      KG: { name: 'Kay Guan', notes: 'Kay Guan (KG)' },
      KB: { name: 'Kay Boon', notes: 'Kay Boon (KB)' },
    },
    junjieAnchorDate: '2026-06-15',
    junjieCycleWeeks: 3,
  },
  lastUpdated: new Date().toISOString(),
  version: 1,
};

function loadState() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Failed to load state from disk:', err);
  }
  return { ...DEFAULT_STATE };
}

let appState = loadState();

function saveState(newState: typeof DEFAULT_STATE) {
  appState = {
    ...newState,
    lastUpdated: new Date().toISOString(),
    version: (appState.version || 1) + 1,
  };
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(appState, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save state to disk:', err);
  }
  broadcast({
    type: 'STATE_UPDATED',
    payload: appState,
  });
}

const app = express();
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

function broadcast(message: object, excludeClient?: WebSocket) {
  const str = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client !== excludeClient && client.readyState === WebSocket.OPEN) {
      client.send(str);
    }
  });
}

function broadcastPresence() {
  const count = wss.clients.size;
  const presenceMsg = JSON.stringify({ type: 'PRESENCE', count });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(presenceMsg);
    }
  });
}

wss.on('connection', (ws) => {
  // Send current state on connection
  ws.send(JSON.stringify({ type: 'INIT', payload: appState }));
  broadcastPresence();

  ws.on('message', (data) => {
    try {
      const parsed = JSON.parse(data.toString());
      if (parsed.type === 'UPDATE_STATE') {
        saveState(parsed.payload);
      } else if (parsed.type === 'PING') {
        ws.send(JSON.stringify({ type: 'PONG' }));
      }
    } catch (e) {
      console.error('Invalid WS message', e);
    }
  });

  ws.on('close', () => {
    broadcastPresence();
  });
});

// REST API Endpoints
app.get('/api/state', (req, res) => {
  res.json(appState);
});

// Add or update an event
app.post('/api/events', (req, res) => {
  const event = req.body;
  if (!event || !event.title || !event.startDate) {
    return res.status(400).json({ error: 'Title and startDate are required' });
  }

  const existingIndex = appState.events.findIndex((e: any) => e.id === event.id);
  let updatedEvents = [...appState.events];

  const now = new Date().toISOString();
  const eventToSave = {
    ...event,
    id: event.id || `event-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    updatedAt: now,
    createdAt: event.createdAt || now,
  };

  if (existingIndex >= 0) {
    updatedEvents[existingIndex] = eventToSave;
  } else {
    updatedEvents.push(eventToSave);
  }

  saveState({
    ...appState,
    events: updatedEvents,
  });

  res.json({ success: true, event: eventToSave });
});

// Delete an event
app.delete(['/api/events', '/api/events/:id'], (req, res) => {
  const id = req.params.id || (req.query.id as string);
  if (!id) return res.status(400).json({ error: 'id is required' });
  const updatedEvents = appState.events.filter((e: any) => e.id !== id);

  saveState({
    ...appState,
    events: updatedEvents,
  });

  res.json({ success: true });
});

// Add or update an override (for Grandma location or Jun Jie shift)
app.post('/api/overrides', (req, res) => {
  const override = req.body;
  if (!override || !override.date || !override.type) {
    return res.status(400).json({ error: 'Date and type are required' });
  }

  const now = new Date().toISOString();
  const overrideToSave = {
    ...override,
    id: override.id || `ovr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    updatedAt: now,
    createdAt: override.createdAt || now,
  };

  // Replace any existing override of the same type for this date, or by id
  const filtered = appState.overrides.filter(
    (o: any) => !(o.id === overrideToSave.id || (o.date === overrideToSave.date && o.type === overrideToSave.type))
  );

  saveState({
    ...appState,
    overrides: [...filtered, overrideToSave],
  });

  res.json({ success: true, override: overrideToSave });
});

// Delete an override
app.delete('/api/overrides/:id', (req, res) => {
  const { id } = req.params;
  const updatedOverrides = appState.overrides.filter((o: any) => o.id !== id);

  saveState({
    ...appState,
    overrides: updatedOverrides,
  });

  res.json({ success: true });
});

// Add / update family member
app.post('/api/members', (req, res) => {
  const member = req.body;
  if (!member || !member.name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  const existingIndex = appState.familyMembers.findIndex((m: any) => m.id === member.id);
  let updatedMembers = [...appState.familyMembers];

  const memberToSave = {
    ...member,
    id: member.id || `member-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
  };

  if (existingIndex >= 0) {
    updatedMembers[existingIndex] = memberToSave;
  } else {
    updatedMembers.push(memberToSave);
  }

  saveState({
    ...appState,
    familyMembers: updatedMembers,
  });

  res.json({ success: true, member: memberToSave });
});

// Delete family member
app.delete('/api/members/:id', (req, res) => {
  const { id } = req.params;
  // Don't allow deleting core members
  if (id === 'all' || id === 'grandma' || id === 'junjie') {
    return res.status(400).json({ error: 'Cannot delete core family member' });
  }

  const updatedMembers = appState.familyMembers.filter((m: any) => m.id !== id);
  saveState({
    ...appState,
    familyMembers: updatedMembers,
  });

  res.json({ success: true });
});

// Update settings
app.post('/api/settings', (req, res) => {
  const settings = req.body;
  saveState({
    ...appState,
    settings: { ...appState.settings, ...settings },
  });
  res.json({ success: true });
});

// Reset data
app.post('/api/reset', (req, res) => {
  saveState({ ...DEFAULT_STATE, version: (appState.version || 1) + 1 });
  res.json({ success: true });
});

// Simple Chatbot endpoint using Gemini API with intelligent local calendar fallback
app.post('/api/chat', async (req, res) => {
  const { message, language = 'en' } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const query = message.toLowerCase();
  const isZh = language === 'zh' || /[\u4e00-\u9fa5]/.test(message);

  // Helper: save a new event locally and return it
  const saveNewEvent = (eventData: any) => {
    const now = new Date().toISOString();
    const newEvent = {
      id: `ev-chat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: eventData.title || 'New Event',
      startDate: eventData.startDate,
      endDate: eventData.endDate || undefined,
      category: eventData.category || 'holiday_plan',
      memberId: eventData.memberId || 'all',
      time: eventData.time || undefined,
      location: eventData.location || undefined,
      notes: eventData.notes || undefined,
      createdAt: now,
      updatedAt: now,
    };
    const idx = appState.events.findIndex((e: any) => e.id === newEvent.id);
    if (idx >= 0) {
      appState.events[idx] = newEvent;
    } else {
      appState.events = [...appState.events, newEvent];
    }
    saveState({ ...appState, events: appState.events });
    return newEvent;
  };

  // Local rule-based intelligent resolver (works instantly even during API 503 spikes)
  const resolveLocalAnswer = () => {
    // 0. Simple add-event keyword detection (no AI available)
    const addKeywords = ['add', 'create', 'schedule', 'plan', 'book', 'put', '记', '添加', '加入', '安排', '计划'];
    const eventKeywords = ['event', 'trip', 'holiday', 'plan', 'gathering', 'appointment', 'staycation', '活动', '旅行', '假期', '聚餐', '行程', '计划'];
    const wantsAdd = addKeywords.some((k) => query.includes(k)) && eventKeywords.some((k) => query.includes(k));
    if (wantsAdd) {
      return isZh
        ? `要添加活动，请提供：\n• 活动名称\n• 日期（例如：2026年6月20日）\n• 地点（可选）\n• 备注（可选）\n\n例如："帮我添加：6月20日至22日全家到圣淘沙度假"`
        : `To add an event, please tell me:\n• Event title\n• Date (e.g. 20 June 2026)\n• Location (optional)\n• Notes (optional)\n\nExample: "Add a family staycation at Sentosa from 20 to 22 June 2026"`;
    }
    if (
      query.includes('ahma') || query.includes('grandma') || query.includes('阿嬷') ||
      query.includes('grandmother') || query.includes('kc') || query.includes('kg') || query.includes('kb') ||
      query.includes('kay cheow') || query.includes('kay guan') || query.includes('kay boon') ||
      query.includes('启超') || query.includes('启源') || query.includes('启文')
    ) {
      const today = new Date(Date.now() + 8 * 3600 * 1000).toISOString().split('T')[0];
      const anchor = appState.settings?.grandmaAnchorDate || '2026-05-07';
      const stayDays = appState.settings?.grandmaCycleDays || 14;
      const seq = ['KC', 'KG', 'KB'];
      const names: Record<string, { en: string; zh: string }> = {
        KC: { en: "Kay Cheow / Dad's place (KC)", zh: '启超 / 爸爸家 (KC)' },
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
            ? `👵 阿嬷目前就在 **${locName.zh}**！\n• 今天是第 ${cur.dayInStay} 天（共 ${stayDays} 天），还剩 **${cur.daysLeft}** 天（直到 ${cur.nextDate} 前往 ${nextLoc.zh}）。\n• 下一次再轮到 ${locName.zh} 是 **${nextArrival}**（${daysAway} 天后）。`
            : `👵 **Ahma is currently at ${locName.en} right now!**\n• Today is Day ${cur.dayInStay} of ${stayDays} (${cur.daysLeft} days remaining, until ${cur.nextDate} when she moves to ${nextLoc.en}).\n• Her next return visit to ${locName.en} will be on **${nextArrival}** (in ${daysAway} days).`;
        }

        const curLoc = names[cur.code];
        return isZh
          ? `👵 阿嬷下次到 **${locName.zh}** 是 **${nextArrival}**（${daysAway} 天后，住到 ${nextEndDate}）。\n• 目前阿嬷在 **${curLoc.zh}**，还剩 ${cur.daysLeft} 天（直到 ${cur.nextDate}）。`
          : `👵 Ahma will be coming over to **${locName.en}** on **${nextArrival}** (in ${daysAway} days, staying until ${nextEndDate}).\n• Currently, Ahma is staying at **${curLoc.en}** (${cur.daysLeft} days remaining until ${cur.nextDate}).`;
      }

      const checkDate = targetDate || today;
      const isToday = checkDate === today;
      const info = getLocInfo(checkDate);
      const loc = names[info.code];
      const nextLoc = names[info.nextCode];

      if (isZh) {
        return `👵 ${isToday ? '今天' : `在 **${checkDate}**`}，阿嬷住在 **${loc.zh}**（第 ${info.dayInStay}/${stayDays} 天，还剩 ${info.daysLeft} 天，将于 ${info.nextDate} 前往 ${nextLoc.zh}）。`;
      }
      return `👵 ${isToday ? 'Today' : `On **${checkDate}**`}, Ahma is staying at **${loc.en}** (Day ${info.dayInStay} of ${stayDays}, ${info.daysLeft} days remaining until ${info.nextDate} when she moves to ${nextLoc.en}).`;
    }

    // 2. Check if asking about Jun Jie / shift
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
        return `在 ${targetDate}，俊杰上 **${shiftName}**（第 ${weekNum} 周排班）。\n他的排班为3周一循环，从2026年6月15日（周一）开始。`;
      }
      return `On **${targetDate}**, Jun Jie is scheduled for **${shiftName}** (Week ${weekNum} of 3).\nHis schedule follows a 3-week repeating roster starting on 15 June 2026.`;
    }

    // 3. Check calendar events (holiday plans, gatherings, medical, etc.)
    if (
      query.includes('event') || query.includes('plan') || query.includes('trip') ||
      query.includes('holiday plan') || query.includes('staycation') || query.includes('gathering') ||
      query.includes('medical') || query.includes('appointment') ||
      query.includes('活动') || query.includes('计划') || query.includes('旅行') ||
      query.includes('聚餐') || query.includes('假期') || query.includes('行程')
    ) {
      const events: any[] = appState.events || [];
      if (events.length === 0) {
        return isZh
          ? `目前日历上还没有任何活动记录。`
          : `There are no events on the calendar yet.`;
      }
      const sorted = events.sort((a: any, b: any) => a.startDate.localeCompare(b.startDate));
      const lines = sorted.map((e: any) => {
        const dateRange = e.endDate && e.endDate !== e.startDate ? `${e.startDate} – ${e.endDate}` : e.startDate;
        const timePart = e.time ? ` ${e.time}` : '';
        const locPart = e.location ? ` @ ${e.location}` : '';
        return `• ${dateRange}${timePart}: ${e.title}${locPart}`;
      }).join('\n');
      return isZh
        ? `以下是日历上的活动：\n${lines}`
        : `Here are the events on the calendar:\n${lines}`;
    }

    // 4. Check public holidays
    if (query.includes('holiday') || query.includes('假期') || query.includes('public holiday')) {
      if (isZh) {
        return `新加坡主要公共假期包括：\n• 5月1日：劳动节 (Labour Day)\n• 5月31日 - 6月1日：卫塞节及补假 (Vesak Day)\n• 8月9日 - 8月10日：国庆日及补假 (National Day)\n• 11月8日 - 11月9日：屠妖节及补假 (Deepavali)\n• 12月25日：圣诞节 (Christmas Day)`;
      }
      return `Key upcoming Singapore Public Holidays include:\n• 1 May: Labour Day\n• 31 May – 1 Jun: Vesak Day & In-Lieu\n• 9 Aug – 10 Aug: National Day & In-Lieu\n• 8 Nov – 9 Nov: Deepavali & In-Lieu\n• 25 Dec: Christmas Day`;
    }

    if (isZh) {
      return `你好！有什么我可以帮你的吗？😊\n\n我也很擅长回答家庭日历相关的问题，比如：\n• 阿嬷在某天住在谁家（启超、启源、启文）\n• 俊杰某天的上下班班次\n• 新加坡公共假期日期`;
    }
    return `Hey there! What's on your mind? 😊\n\nI'm also great with family calendar stuff like:\n• Where Ahma is staying on any date (Kay Cheow, Kay Guan, Kay Boon)\n• Jun Jie's work shift on any date\n• Upcoming Singapore public holidays`;
  };

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.json({ reply: resolveLocalAnswer() });
    }

    // Build a concise snapshot of calendar events for context
    const events: any[] = appState.events || [];
    const overrides: any[] = appState.overrides || [];
    const familyMembers: any[] = appState.familyMembers || [];

    const memberName = (id: string) => {
      const m = familyMembers.find((fm: any) => fm.id === id);
      return m ? m.name : id;
    };

    const eventLines = events
      .sort((a: any, b: any) => a.startDate.localeCompare(b.startDate))
      .map((e: any) => {
        const dateRange = e.endDate && e.endDate !== e.startDate
          ? `${e.startDate} to ${e.endDate}`
          : e.startDate;
        const timePart = e.time ? ` at ${e.time}` : '';
        const locPart = e.location ? ` @ ${e.location}` : '';
        const notesPart = e.notes ? ` (${e.notes})` : '';
        const who = memberName(e.memberId);
        return `- [${e.category}] ${e.title} | ${dateRange}${timePart}${locPart} | Who: ${who}${notesPart}`;
      })
      .join('\n');

    const overrideLines = overrides
      .sort((a: any, b: any) => a.date.localeCompare(b.date))
      .map((o: any) => {
        if (o.type === 'grandma_location') {
          return `- ${o.date}: Ahma override → ${o.grandmaLocation}${o.grandmaReason ? ` (${o.grandmaReason})` : ''}`;
        }
        if (o.type === 'junjie_shift') {
          return `- ${o.date}: Jun Jie override → ${o.shiftName || o.shiftCode}${o.shiftTime ? ` ${o.shiftTime}` : ''}${o.shiftReason ? ` (${o.shiftReason})` : ''}`;
        }
        return `- ${o.date}: ${o.type} override`;
      })
      .join('\n');

    const ai = new GoogleGenAI({ apiKey });

    // -----------------------------------------------------------------------
    // Step 1: Intent detection — classify + extract event fields as JSON
    // -----------------------------------------------------------------------
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

Today is ${new Date().toISOString().split('T')[0]}.
Message: "${message}"`;

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
      console.warn('Intent detection failed, defaulting to query:', err);
    }

    // -----------------------------------------------------------------------
    // Step 2: If adding an event, save it and return a confirmation
    // -----------------------------------------------------------------------
    if (intent === 'add_event' && extractedEvent?.title && extractedEvent?.startDate) {
      const newEvent = saveNewEvent(extractedEvent);
      const dateRange = newEvent.endDate ? `${newEvent.startDate} – ${newEvent.endDate}` : newEvent.startDate;
      const locPart = newEvent.location ? ` @ ${newEvent.location}` : '';
      const confirmText = isZh
        ? `好的！我已把以下活动添加到日历：\n\n📅 ${newEvent.title}\n🗓 ${dateRange}${locPart}${newEvent.time ? `\n⏰ ${newEvent.time}` : ''}${newEvent.notes ? `\n📝 ${newEvent.notes}` : ''}\n\n您可以在日历上查看！`
        : `Done! I've added this to the calendar:\n\n📅 ${newEvent.title}\n🗓 ${dateRange}${locPart}${newEvent.time ? `\n⏰ ${newEvent.time}` : ''}${newEvent.notes ? `\n📝 ${newEvent.notes}` : ''}\n\nYou can see it on the calendar now!`;
      return res.json({ reply: confirmText, newEvent });
    }

    // -----------------------------------------------------------------------
    // Step 3: Normal conversational reply with calendar context
    // -----------------------------------------------------------------------
    const systemPrompt = `You are Ahma Bot 🌸, a warm and friendly family assistant for the "Ahma's Rotation" (阿嬷轮流表) web app. You love chatting with the family and can talk about anything — daily life, food, feelings, general questions, or just casual conversation. You are helpful, cheerful, and feel like a family member yourself.

Your specialty is the family calendar:
- Ahma (阿嬷) rotates: Dad's place (爸爸家/KC) → Kay Guan (启源/KG) → Kay Boon (启文/KB), 14 days each. Anchor: 7 May 2026 @ Dad's place.
- CNY Special (Eve 5pm → Day 2 8pm): 2026 KG, 2027 KB, 2028 KC (Dad's), 2029 KG, repeating.
- Jun Jie work schedule repeats every 3 weeks starting Monday 15 June 2026.
  Week 1: Mon-Tue Night/晚 (2200-0900), Wed OFF, Thu REST, Fri-Sun Morning/早 (0630-1530).
  Week 2: Mon Morning/早 (0630-1530), Tue OFF, Wed-Thu Afternoon 1/午1 (1400-0200), Fri-Sat Afternoon 2/午2 (1500-0100), Sun REST.
  Week 3: Mon OFF, Tue-Thu Morning/早 (0630-1530), Fri REST, Sat-Sun Afternoon 3/午3 (1600-0100).
- Shift Chinese short forms: Morning=早, Afternoon 1=午1, Afternoon 2=午2, Afternoon 3=午3, Night=晚.

Current calendar events:
${eventLines || '(no events yet)'}

${overrideLines ? `Special schedule overrides:\n${overrideLines}` : ''}

When answering about events or plans, translate event titles and details into Chinese if the user is speaking Chinese, or keep in English otherwise. For casual chat, just be natural and warm. For calendar questions, be accurate and concise.
Answer kindly in ${isZh ? 'Chinese / 简体中文' : 'English'}.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        {
          role: 'user',
          parts: [{ text: `${systemPrompt}\n\nQuestion: ${message}` }],
        },
      ],
    });

    if (response.text) {
      return res.json({ reply: response.text });
    }
  } catch (err: any) {
    console.warn('Gemini API call failed, using intelligent local solver:', err?.message || err);
  }

  // Graceful instantaneous local solver fallback
  return res.json({ reply: resolveLocalAnswer() });
});

// Attach Vite middleware in dev or static files in production
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server running on port ${PORT} (dev: ${!isProduction})`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
