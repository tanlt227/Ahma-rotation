/**
 * lib/github.ts
 *
 * Pure GitHub Contents API helpers with NO fs/path imports.
 * Safe to use in all Vercel serverless functions.
 */

import type { AppSyncState } from '../src/types';

export function ghConfig() {
  return {
    token: (process.env.GITHUB_TOKEN ?? '').trim(),
    repo:  (process.env.GITHUB_REPO  ?? 'tanlt227/ahma-rotation').trim(),
    path:  (process.env.GITHUB_PATH  ?? 'data/calendar-data.json').trim(),
  };
}

export function ghHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
}

export const EMPTY_STATE: AppSyncState = {
  events: [],
  overrides: [],
  familyMembers: [
    { id: 'all',     name: 'Whole Family',           relationship: 'Family',            color: '#10b981' },
    { id: 'grandma', name: 'Grandmother (阿嬷)',      relationship: 'Elder',             color: '#0d9488' },
    { id: 'junjie',  name: 'Jun Jie',                relationship: 'Son / Brother',     color: '#8b5cf6' },
    { id: 'layting', name: 'Lay Ting',               relationship: 'Daughter / Sister', color: '#f43f5e' },
    { id: 'dad',     name: 'Dad',                    relationship: 'Father',            color: '#3b82f6' },
    { id: 'mom',     name: 'Mom',                    relationship: 'Mother',            color: '#ec4899' },
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

export async function readStateGH(): Promise<{ state: AppSyncState; sha: string | null }> {
  const { token, repo, path } = ghConfig();
  if (!token) return { state: { ...EMPTY_STATE }, sha: null };

  const url = `https://api.github.com/repos/${repo}/contents/${path}`;
  const res = await fetch(url, { headers: ghHeaders(token) });

  if (res.status === 404) return { state: { ...EMPTY_STATE }, sha: null };
  if (!res.ok) throw new Error(`GitHub GET ${res.status}: ${await res.text()}`);

  const file: any = await res.json();
  const state: AppSyncState = JSON.parse(Buffer.from(file.content, 'base64').toString('utf-8'));
  return { state, sha: file.sha };
}

export async function writeStateGH(state: AppSyncState, sha: string | null): Promise<void> {
  const { token, repo, path } = ghConfig();
  if (!token) throw new Error('GITHUB_TOKEN not set');

  const url = `https://api.github.com/repos/${repo}/contents/${path}`;
  const headers = ghHeaders(token);

  let currentSha = sha;
  for (let attempt = 0; attempt < 3; attempt++) {
    const body: Record<string, unknown> = {
      message: `chore: update calendar state [${new Date().toISOString()}]`,
      content: Buffer.from(JSON.stringify(state, null, 2)).toString('base64'),
      committer: { name: 'Ahma Bot', email: 'ahma-bot@users.noreply.github.com' },
    };
    if (currentSha) body.sha = currentSha;

    const res = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(body) });
    if (res.ok) return;

    if (res.status === 409 || res.status === 422) {
      const latest = await fetch(url, { headers });
      if (latest.ok) { const f: any = await latest.json(); currentSha = f.sha; }
      await new Promise((r) => setTimeout(r, 200 * Math.pow(2, attempt)));
      continue;
    }
    throw new Error(`GitHub PUT ${res.status}: ${await res.text()}`);
  }
  throw new Error('GitHub write failed after 3 attempts');
}

export async function updateStateGH(
  mutate: (draft: AppSyncState) => void
): Promise<AppSyncState> {
  const { state, sha } = await readStateGH();
  mutate(state);
  state.lastUpdated = new Date().toISOString();
  state.version = (state.version ?? 1) + 1;
  await writeStateGH(state, sha);
  return state;
}
