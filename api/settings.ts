import type { VercelRequest, VercelResponse } from '@vercel/node';
import { updateStateGH, ghConfig } from '../lib/github';
import type { CalendarAppSettings } from '../src/types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const patch = req.body as Partial<CalendarAppSettings>;
  if (!patch || typeof patch !== 'object') {
    return res.status(400).json({ error: 'Request body must be a settings object' });
  }

  const cloudSync = Boolean(ghConfig().token);
  try {
    await updateStateGH((draft) => {
      draft.settings = { ...draft.settings, ...patch };
    });
    return res.status(200).json({ success: true, cloudSync });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? 'Unknown error', cloudSync });
  }
}
