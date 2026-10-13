import type { VercelRequest, VercelResponse } from '@vercel/node';
import { updateState, isCloudSyncConfigured } from '../lib/state';
import { broadcastState } from '../lib/broadcast';
import type { DayOverride } from '../src/types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // POST /api/overrides        — upsert an override
  // DELETE /api/overrides?id=  — delete an override by id
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
      const newState = await updateState((draft) => {
        // Replace any existing override for the same date+type, or same id
        draft.overrides = draft.overrides.filter(
          (o) => !(o.id === toSave.id || (o.date === toSave.date && o.type === toSave.type))
        );
        draft.overrides.push(toSave);
      });

      await broadcastState(newState);
      return res.status(200).json({
        success: true,
        override: toSave,
        cloudSync: isCloudSyncConfigured(),
      });
    } catch (err: any) {
      console.error('[overrides] Failed to save override:', err?.message || err);
      return res.status(500).json({
        error: 'Failed to save override: ' + (err?.message || 'Unknown error'),
        cloudSync: isCloudSyncConfigured(),
      });
    }
  }

  if (req.method === 'DELETE') {
    const id = req.query.id as string;
    if (!id) return res.status(400).json({ error: 'id query param is required' });

    try {
      const newState = await updateState((draft) => {
        draft.overrides = draft.overrides.filter((o) => o.id !== id);
      });

      await broadcastState(newState);
      return res.status(200).json({ success: true, cloudSync: isCloudSyncConfigured() });
    } catch (err: any) {
      console.error('[overrides] Failed to delete override:', err?.message || err);
      return res.status(500).json({
        error: 'Failed to delete override: ' + (err?.message || 'Unknown error'),
        cloudSync: isCloudSyncConfigured(),
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
