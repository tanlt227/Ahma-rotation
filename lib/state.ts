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

function ghConfig() {
  const token = process.env.GITHUB_TOKEN;
  const repo  = process.env.GITHUB_REPO;      // "owner/repo"
  const path  = process.env.GITHUB_PATH ?? 'data/calendar-data.json';

  if (!token || !repo) {
    throw new Error(
      'GITHUB_TOKEN and GITHUB_REPO env vars are required for persistence.'
    );
  }
  return { token, repo, path };
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

  const file: GhFileResponse = await res.json();
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

  const content = Buffer.from(JSON.stringify(state, null, 2)).toString('base64');
  const body: Record<string, unknown> = {
    message: `chore: update calendar state [${new Date().toISOString()}]`,
    content,
    committer: { name: 'Ahma Bot', email: 'ahma-bot@users.noreply.github.com' },
  };
  if (sha) body.sha = sha;   // required for updates; omit for creates

  const res = await fetch(url, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`[github] PUT ${url} → ${res.status}: ${err}`);
  }
}

// ─── public API (same shape as the old KV version) ───────────────────────────

/** Read the full app state from GitHub. Falls back to DEFAULT_STATE on first run. */
export async function readState(): Promise<AppSyncState> {
  try {
    const { state } = await fetchFromGitHub();
    return state;
  } catch (err) {
    console.error('[github] readState failed, using defaults:', err);
    return structuredClone(DEFAULT_STATE);
  }
}

/** Persist the full app state to GitHub and return it. */
export async function writeState(newState: AppSyncState): Promise<AppSyncState> {
  const state: AppSyncState = {
    ...newState,
    lastUpdated: new Date().toISOString(),
    version: (newState.version ?? 1) + 1,
  };

  try {
    // Always fetch the current sha before writing to avoid conflicts
    const { sha } = await fetchFromGitHub();
    await pushToGitHub(state, sha);
  } catch (err) {
    console.error('[github] writeState failed:', err);
  }

  return state;
}

/** Convenience: read → mutate → write. Returns the saved state. */
export async function updateState(
  mutate: (draft: AppSyncState) => AppSyncState | void
): Promise<AppSyncState> {
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
