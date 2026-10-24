import type { VercelRequest, VercelResponse } from '@vercel/node';
import { updateStateGH, ghConfig } from '../lib/github';
import type { FamilyMember } from '../src/types';

const CORE_IDS = new Set(['all', 'grandma', 'junjie']);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const cloudSync = Boolean(ghConfig().token);

  if (req.method === 'POST') {
    const member = req.body as Partial<FamilyMember>;
    if (!member?.name) return res.status(400).json({ error: 'name is required' });
    const toSave: FamilyMember = {
      id: member.id || `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: member.name,
      relationship: member.relationship || 'Family',
      color: member.color || '#3b82f6',
      avatarIcon: member.avatarIcon,
    };
    try {
      await updateStateGH((draft) => {
        const idx = draft.familyMembers.findIndex((m) => m.id === toSave.id);
        if (idx >= 0) { draft.familyMembers[idx] = toSave; } else { draft.familyMembers.push(toSave); }
      });
      return res.status(200).json({ success: true, member: toSave, cloudSync });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message ?? 'Unknown error', cloudSync });
    }
  }

  if (req.method === 'DELETE') {
    const id = req.query.id as string;
    if (!id) return res.status(400).json({ error: 'id query param is required' });
    if (CORE_IDS.has(id)) return res.status(400).json({ error: 'Cannot delete a core family member' });
    try {
      await updateStateGH((draft) => {
        draft.familyMembers = draft.familyMembers.filter((m) => m.id !== id);
      });
      return res.status(200).json({ success: true, cloudSync });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message ?? 'Unknown error', cloudSync });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
