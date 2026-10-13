import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * GET /api/init-state
 * Creates the GitHub state file if it doesn't exist yet.
 * Uses raw fetch — no lib/state imports to avoid Node.js fs/path issues.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const token = (process.env.GITHUB_TOKEN ?? '').trim();
    const repo  = (process.env.GITHUB_REPO  ?? 'tanlt227/ahma-rotation').trim();
    const path  = (process.env.GITHUB_PATH  ?? 'data/calendar-data.json').trim();

    if (!token) {
      return res.status(200).json({ error: 'GITHUB_TOKEN not set' });
    }

    const url = `https://api.github.com/repos/${repo}/contents/${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    };

    // Check if file exists
    const getRes = await fetch(url, { headers });

    if (getRes.ok) {
      const file: any = await getRes.json();
      const state = JSON.parse(Buffer.from(file.content, 'base64').toString('utf-8'));
      return res.status(200).json({
        success: true,
        message: 'GitHub state file already exists — no action needed.',
        eventCount: state.events?.length ?? 0,
        version: state.version,
        lastUpdated: state.lastUpdated,
      });
    }

    if (getRes.status !== 404) {
      const body = await getRes.text();
      return res.status(200).json({ error: `GitHub GET failed: ${getRes.status}`, body });
    }

    // File doesn't exist — create it with seed state
    const seedState = {
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

    const content = Buffer.from(JSON.stringify(seedState, null, 2)).toString('base64');
    const putRes = await fetch(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        message: 'chore: initialise calendar state file',
        content,
        committer: { name: 'Ahma Bot', email: 'ahma-bot@users.noreply.github.com' },
      }),
    });

    if (putRes.ok) {
      return res.status(200).json({
        success: true,
        message: 'GitHub state file created successfully! Cross-device sync is now active.',
        eventCount: 0,
        version: 1,
      });
    }

    const errBody = await putRes.text();
    return res.status(200).json({ error: `GitHub PUT failed: ${putRes.status}`, body: errBody });

  } catch (err: any) {
    return res.status(500).json({ error: 'init-state crashed', detail: err?.message ?? String(err) });
  }
}
