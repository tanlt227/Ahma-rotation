import type { VercelRequest, VercelResponse } from '@vercel/node';
import { writeState, DEFAULT_STATE } from '../lib/state';
import { broadcastState } from '../lib/broadcast';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const freshState = await writeState({ ...DEFAULT_STATE, version: 1 });
  await broadcastState(freshState);
  return res.status(200).json({ success: true });
}
