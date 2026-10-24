import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { CalendarEvent, AppSyncState } from '../src/types';

// ---------------------------------------------------------------------------
// Direct GitHub Contents API helpers — no lib/state import to avoid fs crash
// ---------------------------------------------------------------------------

function ghConfig() {
  const token = (process.env.GITHUB_TOKEN ?? '').trim();
  const repo  = (process.env.GITHUB_REPO  ?? 'tanlt227/ahma-rotation').trim();
  const path  = (process.env.GITHUB_PATH  ?? 'data/calendar-data.json').trim();
  return { token, repo, path };
}

function ghUrl(repo: string, path: string) {
  return `https://api.github.com/repos/${repo}/contents/${path}`;
}

function ghHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
}

async function readState(): Promise<{ state: AppSyncState; sha: string | null }> {
  const { token, repo, path } = ghConfig();
  const res = await fetch(ghUrl(repo, path), { headers: ghHeaders(token) });

  if (res.status === 404) {
    return {
      sha: null,
      state: {
        events: [], overrides: [], familyMembers: [], settings: {} as any,
        lastUpdated: new Date().toISOString(), version: 1,
      },
    };
  }

  if (!res.ok) throw new Error(`GitHub GET failed: ${res.status} ${await res.text()}`);

  const file: any = await res.json();
  const state: AppSyncState = JSON.parse(Buffer.from(file.content, 'base64').toString('utf-8'));
  return { state, sha: file.sha };
}

async function writeState(state: AppSyncState, sha: string | null): Promise<void> {
  const { token, repo, path } = ghConfig();
  const url = ghUrl(repo, path);
  const headers = ghHeaders(token);

  for (let attempt = 0; attempt < 3; attempt++) {
    const currentSha = sha;
    const body: Record<string, unknown> = {
      message: `chore: update calendar state [${new Date().toISOString()}]`,
      content: Buffer.from(JSON.stringify(state, null, 2)).toString('base64'),
      committer: { name: 'Ahma Bot', email: 'ahma-bot@users.noreply.github.com' },
    };
    if (currentSha) body.sha = currentSha;

    const res = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(body) });
    if (res.ok) return;

    if (res.status === 409 || res.status === 422) {
      // SHA conflict — re-fetch SHA and retry
      const latest = await fetch(url, { headers });
      if (latest.ok) { const f: any = await latest.json(); sha = f.sha; }
      await new Promise((r) => setTimeout(r, 200 * Math.pow(2, attempt)));
      continue;
    }

    throw new Error(`GitHub PUT failed: ${res.status} ${await res.text()}`);
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { token } = ghConfig();
  const cloudSync = Boolean(token);

  if (req.method === 'POST') {
    const event = req.body as Partial<CalendarEvent>;
    if (!event?.title || !event?.startDate) {
      return res.status(400).json({ error: 'title and startDate are required' });
    }

    const now = new Date().toISOString();
    const toSave: CalendarEvent = {
      id: event.id || `ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: event.title,
      titleEn: event.titleEn,
      titleZh: event.titleZh,
      startDate: event.startDate,
      endDate: event.endDate,
      category: event.category || 'general',
      memberId: event.memberId || 'all',
      time: event.time,
      location: event.location,
      notes: event.notes,
      notesEn: event.notesEn,
      notesZh: event.notesZh,
      createdAt: event.createdAt || now,
      updatedAt: now,
    };

    try {
      const { state, sha } = await readState();
      const idx = state.events.findIndex((e) => e.id === toSave.id);
      if (idx >= 0) { state.events[idx] = toSave; } else { state.events.push(toSave); }
      state.lastUpdated = now;
      state.version = (state.version ?? 1) + 1;
      await writeState(state, sha);
      return res.status(200).json({ success: true, event: toSave, cloudSync });
    } catch (err: any) {
      console.error('[events] POST failed:', err?.message ?? err);
      return res.status(500).json({ error: err?.message ?? 'Unknown error', cloudSync });
    }
  }

  if (req.method === 'DELETE') {
    const id = req.query.id as string;
    if (!id) return res.status(400).json({ error: 'id query param is required' });

    try {
      const { state, sha } = await readState();
      state.events = state.events.filter((e) => e.id !== id);
      state.lastUpdated = new Date().toISOString();
      state.version = (state.version ?? 1) + 1;
      await writeState(state, sha);
      return res.status(200).json({ success: true, cloudSync });
    } catch (err: any) {
      console.error('[events] DELETE failed:', err?.message ?? err);
      return res.status(500).json({ error: err?.message ?? 'Unknown error', cloudSync });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
