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
      title: 'Family Gathering Dinner @ Kay Cheow',
      startDate: '2026-05-10',
      category: 'family_gathering',
      memberId: 'all',
      time: '18:30',
      location: 'Kay Cheow',
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
      location: 'Polyclinic near Kay Guan',
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
    { id: 'layting', name: 'Lay Ting', relationship: 'Daughter / Sister', color: '#f43f5e' },
    { id: 'dad', name: 'Dad', relationship: 'Father', color: '#3b82f6' },
    { id: 'mom', name: 'Mom', relationship: 'Mother', color: '#ec4899' },
  ],
  settings: {
    grandmaAnchorDate: '2026-05-07',
    grandmaCycleDays: 14,
    grandmaSequence: ['KC', 'KG', 'KB'],
    grandmaLocations: {
      KC: { name: 'Kay Cheow', notes: 'Kay Cheow (KC)' },
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
app.delete('/api/events/:id', (req, res) => {
  const { id } = req.params;
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

  // Local rule-based intelligent resolver (works instantly even during API 503 spikes)
  const resolveLocalAnswer = () => {
    // 1. Check if asking about Ahma / Grandma
    if (query.includes('ahma') || query.includes('grandma') || query.includes('阿嬷') || query.includes('grandmother')) {
      // Check if a date is mentioned (e.g. 2026-05-07, 7 may, 15 jun, etc.)
      const dateMatch = message.match(/(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})/) || message.match(/(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|[一二三四五六七八九十]+月)/i);
      
      let targetDate = '2026-05-07';
      if (dateMatch) {
        if (dateMatch[1] && dateMatch[1].includes('-')) {
          targetDate = dateMatch[1];
        } else if (dateMatch[2]) {
          // Parse natural date like 7 May 2026
          const dNum = parseInt(dateMatch[1]);
          const mNames: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
          const mKey = dateMatch[2].slice(0, 3).toLowerCase();
          const mNum = mNames[mKey] || 5;
          targetDate = `2026-${String(mNum).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`;
        }
      }

      // Check Ahma anchor: 2026-05-07 cycle start @ Kay Cheow
      const anchor = appState.settings?.grandmaAnchorDate || '2026-05-07';
      const stayDays = appState.settings?.grandmaCycleDays || 14;
      const [yA, mA, dA] = targetDate.split('-').map(Number);
      const [yB, mB, dB] = anchor.split('-').map(Number);
      const diff = Math.round((Date.UTC(yA, mA - 1, dA) - Date.UTC(yB, mB - 1, dB)) / 86400000);
      const totalCycleDays = 3 * stayDays;
      const cycleDay = ((diff % totalCycleDays) + totalCycleDays) % totalCycleDays;
      const locIdx = Math.floor(cycleDay / stayDays);
      const seq = ['KC', 'KG', 'KB'];
      const code = seq[locIdx] || 'KC';
      const names: Record<string, { en: string; zh: string }> = {
        KC: { en: 'Kay Cheow (KC)', zh: '启超 (KC)' },
        KG: { en: 'Kay Guan (KG)', zh: '启源 (KG)' },
        KB: { en: 'Kay Boon (KB)', zh: '启文 (KB)' },
      };
      const dayInStay = (cycleDay % stayDays) + 1;

      if (isZh) {
        return `在 ${targetDate}，阿嬷住在 **${names[code].zh}**（第 ${dayInStay} 天）。\n阿嬷按 启超 (KC) > 启源 (KG) > 启文 (KB) 的次序每 ${stayDays} 天轮流一次。`;
      }
      return `On **${targetDate}**, Ahma is staying at **${names[code].en}** (Day ${dayInStay} of ${stayDays}).\nAhma rotates in sequence: Kay Cheow (KC) → Kay Guan (KG) → Kay Boon (KB) every ${stayDays} days.`;
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
        'Morning (0630-1530)', 'OFF Day', 'Afternoon 1 (1600-0100)', 'Afternoon 1 (1600-0100)', 'Afternoon 2 (1400-0100)', 'Afternoon 2 (1400-0100)', 'REST DAY',
        'OFF Day', 'Morning (0630-1530)', 'Morning (0630-1530)', 'Morning (0630-1530)', 'REST DAY', 'Afternoon 3 (1500-0200)', 'Afternoon 3 (1500-0200)'
      ];
      const shiftName = cycleShifts[dayIdx] || 'Off Day';

      if (isZh) {
        return `在 ${targetDate}，俊杰上 **${shiftName}**（第 ${weekNum} 周排班）。\n他的排班为3周一循环，从2026年6月15日（周一）开始。`;
      }
      return `On **${targetDate}**, Jun Jie is scheduled for **${shiftName}** (Week ${weekNum} of 3).\nHis schedule follows a 3-week repeating roster starting on 15 June 2026.`;
    }

    // 3. Check public holidays
    if (query.includes('holiday') || query.includes('假期') || query.includes('public holiday')) {
      if (isZh) {
        return `新加坡主要公共假期包括：\n• 5月1日：劳动节 (Labour Day)\n• 5月31日 - 6月1日：卫塞节及补假 (Vesak Day)\n• 8月9日 - 8月10日：国庆日及补假 (National Day)\n• 11月8日 - 11月9日：屠妖节及补假 (Deepavali)\n• 12月25日：圣诞节 (Christmas Day)`;
      }
      return `Key upcoming Singapore Public Holidays include:\n• 1 May: Labour Day\n• 31 May – 1 Jun: Vesak Day & In-Lieu\n• 9 Aug – 10 Aug: National Day & In-Lieu\n• 8 Nov – 9 Nov: Deepavali & In-Lieu\n• 25 Dec: Christmas Day`;
    }

    if (isZh) {
      return `您好！您可以向我询问：\n• 阿嬷在某天的居住安排（家超、家源、家文）\n• 俊杰某天的上下班班次\n• 新加坡公共假期日期`;
    }
    return `Hello! You can ask me:\n• Where Ahma is staying on any date (Kay Cheow, Kay Guan, Kay Boon)\n• Jun Jie's work shift on any date\n• Upcoming Singapore public holidays`;
  };

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.json({ reply: resolveLocalAnswer() });
    }

    const ai = new GoogleGenAI({ apiKey });
    const systemPrompt = `You are the friendly family calendar assistant for the "Ahma's Rotation" (阿嬷轮流表) web app.
Key facts:
- Elder: Ahma (阿嬷) rotates between Kay Cheow (启超/KC) -> Kay Guan (启源/KG) -> Kay Boon (启文/KB), default 14 days each (or user-configured stay duration).
- Ahma anchor: 7 May 2026 is at Kay Cheow (启超/KC).
- Jun Jie work schedule: repeats every 3 weeks starting Monday 15 June 2026.
  Week 1: Mon-Tue Night (2200-0900), Wed Off, Thu Rest, Fri-Sun Morning (0630-1530).
  Week 2: Mon Morning (0630-1530), Tue Off, Wed-Thu Afternoon 1 (1600-0100), Fri-Sat Afternoon 2 (1400-0100), Sun Rest.
  Week 3: Mon Off, Tue-Thu Morning (0630-1530), Fri Rest, Sat-Sun Afternoon 3 (1500-0200).
- Answer kindly and concisely in ${isZh ? 'Chinese / 简体中文' : 'English'}.`;

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
