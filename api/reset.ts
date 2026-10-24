import type { VercelRequest, VercelResponse } from '@vercel/node';
import { writeStateGH, EMPTY_STATE, ghConfig } from '../lib/github';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const cloudSync = Boolean(ghConfig().token);
  try {
    const freshState = { ...EMPTY_STATE, version: 1, lastUpdated: new Date().toISOString() };
    await writeStateGH(freshState, null);
    return res.status(200).json({ success: true, cloudSync });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? 'Unknown error', cloudSync });
  }
}
