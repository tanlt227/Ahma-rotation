import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readState } from '../lib/state';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const state = await readState();
  return res.status(200).json(state);
}
