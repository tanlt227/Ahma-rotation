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
import { setupTelegramRoutes } from './lib/telegramServer.ts';

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

// Helper: save a new event locally and broadcast via WebSocket
function saveNewEvent(eventData: any) {
  const now = new Date().toISOString();
  const newEvent = {
    id: eventData.id || "ev-bot-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
    title: eventData.title || "New Event",
    startDate: eventData.startDate,
    endDate: eventData.endDate || undefined,
    category: eventData.category || "holiday_plan",
    memberId: eventData.memberId || "all",
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
}

// Setup unified Chatbot and Telegram Webhook routes
setupTelegramRoutes(app, {
  getState: () => appState,
  saveState,
  saveNewEvent,
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
