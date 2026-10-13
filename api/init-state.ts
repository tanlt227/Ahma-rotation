import type { VercelRequest, VercelResponse } from '@vercel/node';
import { writeState, readState, isCloudSyncConfigured } from '../lib/state';

/**
 * GET /api/init-state
 * One-time endpoint: reads current state and writes it back to GitHub,
 * creating the file if it doesn't exist yet.
 * Safe to call multiple times — it never overwrites existing event data.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isCloudSyncConfigured()) {
    return res.status(200).json({ error: 'GITHUB_TOKEN not set — cannot initialise cloud state' });
  }

  try {
    // readState() returns DEFAULT_STATE if file doesn't exist (sha: null)
    // writeState() will CREATE the file on GitHub since sha is null
    const current = await readState();
    const saved = await writeState(current);
    return res.status(200).json({
      success: true,
      message: 'GitHub state file created/verified successfully.',
      eventCount: saved.events?.length ?? 0,
      version: saved.version,
      lastUpdated: saved.lastUpdated,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? String(err) });
  }
}
