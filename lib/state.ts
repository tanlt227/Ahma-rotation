/**
 * lib/state.ts
 *
 * Persistence layer using the GitHub Contents API.
 * State is stored as a single JSON file in a GitHub repository.
 *
 * Required env vars:
 *   GITHUB_TOKEN   — Personal Access Token with repo (read + write) scope
 *   GITHUB_REPO    — "owner/repo" e.g. "tanlt227/ahma-data"
 *   GITHUB_PATH    — path inside the repo e.g. "data/calendar-data.json"
 *                    (defaults to "data/calendar-data.json")
 */

import type { AppSyncState } from '../src/types';

// ─── config ──────────────────────────────────────────────────────────────────

// LOCAL_DATA_PATH is only used when GITHUB_TOKEN is not set (local dev only)
// Lazy-evaluated to avoid crashing on Vercel where process.cwd() may be read-only
function getLocalDataPath(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = require('path');
    return path.resolve(process.cwd(), 'data/calendar-data.json');
  } catch {
    return '/tmp/calendar-data.json';
  }
}

export function isCloudSyncConfigured(): boolean {
  return Boolean(process.env.GITHUB_TOKEN);
}

function ghConfig() {
  const token = process.env.GITHUB_TOKEN;
  const repo  = process.env.GITHUB_REPO || 'tanlt227/ahma-rotation';
  const ghPath = process.env.GITHUB_PATH || 'data/calendar-data.json';

  if (!token) {
    throw new Error(
      'GITHUB_TOKEN env var is required for multi-device cloud persistence.'
    );
  }
  return { token, repo, path: ghPath };
}

function apiUrl(repo: string, path: string) {
  return `https://api.github.com/repos/${repo}/contents/${path}`;
}

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept:        'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
}

// ─── default state ───────────────────────────────────────────────────────────

export const DEFAULT_STATE: AppSyncState = {
  events: [
    {
      id: 'seed-event-1',
      title: 'Family Gathering Dinner @ Kay Cheow',
      startDate: '2026-05-10',
      category: 'family_gathering',
      memberId: 'all',
      time: '18:30',
      location: 'Kay Cheow',
      notes: 'Mother\u2019s Day family dinner celebration with Ahma',
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
  overrides: [],
  familyMembers: [
    { id: 'all',     name: 'Whole Family',               relationship: 'Family',             color: '#10b981' },
    { id: 'grandma', name: 'Grandmother (\u963f\u5b6a)', relationship: 'Elder',              color: '#0d9488' },
    { id: 'junjie',  name: 'Jun Jie',                    relationship: 'Son / Brother',      color: '#8b5cf6' },
    { id: 'layting', name: 'Lay Ting',                   relationship: 'Daughter / Sister',  color: '#f43f5e' },
    { id: 'dad',     name: 'Dad',                        relationship: 'Father',             color: '#3b82f6' },
    { id: 'mom',     name: 'Mom',                        relationship: 'Mother',             color: '#ec4899' },
  ],
  settings: {
    grandmaAnchorDate: '2026-05-07',
    grandmaCycleDays: 14,
    grandmaSequence: ['KC', 'KG', 'KB'],
    grandmaLocations: {
      KC: { name: 'Kay Cheow', notes: 'Kay Cheow (KC)' },
      KG: { name: 'Kay Guan',  notes: 'Kay Guan (KG)'  },
      KB: { name: 'Kay Boon',  notes: 'Kay Boon (KB)'  },
    },
    junjieAnchorDate: '2026-06-15',
    junjieCycleWeeks: 3,
  },
  lastUpdated: new Date().toISOString(),
  version: 1,
};

// ─── GitHub Contents API helpers ─────────────────────────────────────────────

interface GhFileResponse {
  sha: string;
  content: string;        // base64-encoded
  encoding: string;
}

/**
 * Fetch the current file from GitHub.
 * Returns { state, sha } — sha is needed for the PUT (update) call.
 * Returns { state: DEFAULT_STATE, sha: null } when the file doesn't exist yet.
 */
async function fetchFromGitHub(): Promise<{ state: AppSyncState; sha: string | null }> {
  const { token, repo, path } = ghConfig();
  const url = apiUrl(repo, path);

  const res = await fetch(url, { headers: authHeaders(token) });

  if (res.status === 404) {
    // File doesn't exist yet — first run
    return { state: structuredClone(DEFAULT_STATE), sha: null };
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[github] GET ${url} → ${res.status}: ${body}`);
  }

  const file = (await res.json()) as GhFileResponse;
  // GitHub wraps content in base64 with newlines
  const json = Buffer.from(file.content, 'base64').toString('utf-8');
  const state: AppSyncState = JSON.parse(json);
  return { state, sha: file.sha };
}

/**
 * Write state to GitHub as a JSON file.
 * Creates the file if sha is null, updates it otherwise.
 */
async function pushToGitHub(state: AppSyncState, sha: string | null): Promise<void> {
  const { token, repo, path } = ghConfig();
  const url = apiUrl(repo, path);

  const MAX_RETRIES = 3;
  let currentSha = sha;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const content = Buffer.from(JSON.stringify(state, null, 2)).toString('base64');
    const body: Record<string, unknown> = {
      message: `chore: update calendar state [${new Date().toISOString()}]`,
      content,
      committer: { name: 'Ahma Bot', email: 'ahma-bot@users.noreply.github.com' },
    };
    if (currentSha) body.sha = currentSha;

    const res = await fetch(url, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify(body),
    });

    if (res.ok) return;

    if (res.status === 409 || res.status === 422) {
      // SHA conflict — re-fetch the latest SHA and retry
      console.warn(`[github] SHA conflict on attempt ${attempt + 1}, re-fetching SHA...`);
      try {
        const latest = await fetch(url, { headers: authHeaders(token) });
        if (latest.ok) {
          const file = (await latest.json()) as GhFileResponse;
          currentSha = file.sha;
        }
      } catch {}
      // Brief backoff before retry: 200ms, 400ms, 800ms
      await new Promise((r) => setTimeout(r, 200 * Math.pow(2, attempt)));
      continue;
    }

    const err = await res.text();
    throw new Error(`[github] PUT ${url} → ${res.status}: ${err}`);
  }

  throw new Error(`[github] Failed to push after ${MAX_RETRIES} attempts (persistent SHA conflict)`);
}

// ─── Local file helpers (used when running locally without GITHUB_TOKEN) ──────────

let memoryCache: AppSyncState | null = null;

function readFromLocalFile(): AppSyncState {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs');
    const localPath = getLocalDataPath();
    if (fs.existsSync(localPath)) {
      const raw = fs.readFileSync(localPath, 'utf-8');
      const parsed = JSON.parse(raw);
      memoryCache = parsed;
      return parsed;
    }
  } catch (err) {
    console.warn('[state] Could not read local file:', err);
  }
  return memoryCache ? structuredClone(memoryCache) : structuredClone(DEFAULT_STATE);
}

function writeToLocalFile(state: AppSyncState): void {
  memoryCache = structuredClone(state);
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = require('path');
    const localPath = getLocalDataPath();
    const dir = path.dirname(localPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(localPath, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[state] Could not write to local file (e.g. read-only serverless filesystem):', err);
  }
}

// ─── public API ──────────────────────────────────────────────────────────────

/** Read the full app state from GitHub or local storage. */
export async function readState(): Promise<AppSyncState> {
  if (isCloudSyncConfigured()) {
    try {
      const { state } = await fetchFromGitHub();
      return state;
    } catch (err) {
      console.error('[github] readState failed, falling back:', err);
    }
  }
  return readFromLocalFile();
}

/** Persist the full app state to GitHub or local storage and return it. */
export async function writeState(newState: AppSyncState): Promise<AppSyncState> {
  const state: AppSyncState = {
    ...newState,
    lastUpdated: new Date().toISOString(),
    version: (newState.version ?? 1) + 1,
  };

  if (isCloudSyncConfigured()) {
    try {
      const { sha } = await fetchFromGitHub();
      await pushToGitHub(state, sha);
      return state;
    } catch (err) {
      console.error('[github] writeState failed:', err);
      throw err;
    }
  }

  writeToLocalFile(state);
  return state;
}

/** Convenience: read → mutate → write. Returns the saved state. */
export async function updateState(
  mutate: (draft: AppSyncState) => AppSyncState | void
): Promise<AppSyncState> {
  if (isCloudSyncConfigured()) {
    const { state: current, sha } = await fetchFromGitHub();
    const result = mutate(current);
    const next: AppSyncState = {
      ...(result !== undefined ? result : current),
      lastUpdated: new Date().toISOString(),
      version: (current.version ?? 1) + 1,
    };
    await pushToGitHub(next, sha);
    return next;
  }

  const current = readFromLocalFile();
  const result = mutate(current);
  const next: AppSyncState = {
    ...(result !== undefined ? result : current),
    lastUpdated: new Date().toISOString(),
    version: (current.version ?? 1) + 1,
  };
  writeToLocalFile(next);
  return next;
}
