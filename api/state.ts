import type { VercelRequest, VercelResponse } from '@vercel/node';

function ghConfig() {
  return {
    token: (process.env.GITHUB_TOKEN ?? '').trim(),
    repo:  (process.env.GITHUB_REPO  ?? 'tanlt227/ahma-rotation').trim(),
    path:  (process.env.GITHUB_PATH  ?? 'data/calendar-data.json').trim(),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { token, repo, path } = ghConfig();
  const cloudSync = Boolean(token);

  if (!cloudSync) {
    return res.status(200).json({ events: [], overrides: [], familyMembers: [], settings: {}, lastUpdated: null, version: 0, _cloudSync: false });
  }

  try {
    const url = `https://api.github.com/repos/${repo}/contents/${path}`;
    const ghRes = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (ghRes.status === 404) {
      return res.status(200).json({ events: [], overrides: [], familyMembers: [], settings: {}, lastUpdated: null, version: 0, _cloudSync: true });
    }

    if (!ghRes.ok) {
      console.error('[state] GitHub GET failed:', ghRes.status);
      return res.status(200).json({ events: [], overrides: [], familyMembers: [], settings: {}, lastUpdated: null, version: 0, _cloudSync: false });
    }

    const file: any = await ghRes.json();
    const state = JSON.parse(Buffer.from(file.content, 'base64').toString('utf-8'));
    return res.status(200).json({ ...state, _cloudSync: true });
  } catch (err: any) {
    console.error('[state] Error:', err?.message);
    return res.status(200).json({ events: [], overrides: [], familyMembers: [], settings: {}, lastUpdated: null, version: 0, _cloudSync: false });
  }
}
