import type { VercelRequest, VercelResponse } from '@vercel/node';
import { updateState } from '../lib/state';
import { broadcastState } from '../lib/broadcast';
import type { CalendarAppSettings } from '../src/types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const patch = req.body as Partial<CalendarAppSettings>;
  if (!patch || typeof patch !== 'object') {
    return res.status(400).json({ error: 'Request body must be a settings object' });
  }

  const newState = await updateState((draft) => {
    draft.settings = { ...draft.settings, ...patch };
  });

  await broadcastState(newState);
  return res.status(200).json({ success: true });
}
