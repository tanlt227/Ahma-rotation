import type { VercelRequest, VercelResponse } from '@vercel/node';
import { updateStateGH, ghConfig } from '../lib/github';
import type { DayOverride } from '../src/types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const cloudSync = Boolean(ghConfig().token);

  if (req.method === 'POST') {
    const override = req.body as Partial<DayOverride>;
    if (!override?.date || !override?.type) {
      return res.status(400).json({ error: 'date and type are required' });
    }
    const now = new Date().toISOString();
    const toSave: DayOverride = {
      id: override.id || `ov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      date: override.date,
      type: override.type,
      grandmaLocation: override.grandmaLocation,
      grandmaReason: override.grandmaReason,
      shiftCode: override.shiftCode,
      shiftName: override.shiftName,
      shiftTime: override.shiftTime,
      shiftReason: override.shiftReason,
      shiftColor: override.shiftColor,
      createdAt: override.createdAt || now,
      updatedAt: now,
    };
    try {
      await updateStateGH((draft) => {
        draft.overrides = draft.overrides.filter(
          (o) => !(o.id === toSave.id || (o.date === toSave.date && o.type === toSave.type))
        );
        draft.overrides.push(toSave);
      });
      return res.status(200).json({ success: true, override: toSave, cloudSync });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message ?? 'Unknown error', cloudSync });
    }
  }

  if (req.method === 'DELETE') {
    const id = req.query.id as string;
    if (!id) return res.status(400).json({ error: 'id query param is required' });
    try {
      await updateStateGH((draft) => {
        draft.overrides = draft.overrides.filter((o) => o.id !== id);
      });
      return res.status(200).json({ success: true, cloudSync });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message ?? 'Unknown error', cloudSync });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
