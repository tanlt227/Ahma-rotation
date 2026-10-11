import type { VercelRequest, VercelResponse } from '@vercel/node';
import { updateState } from '../lib/state';
import { broadcastState } from '../lib/broadcast';
import type { FamilyMember } from '../src/types';

const CORE_IDS = new Set(['all', 'grandma', 'junjie']);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // POST /api/members        — upsert a family member
  // DELETE /api/members?id=  — delete a member by id
  if (req.method === 'POST') {
    const member = req.body as Partial<FamilyMember>;

    if (!member?.name) {
      return res.status(400).json({ error: 'name is required' });
    }

    const toSave: FamilyMember = {
      id: member.id || `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: member.name,
      relationship: member.relationship || 'Family',
      color: member.color || '#3b82f6',
      avatarIcon: member.avatarIcon,
    };

    const newState = await updateState((draft) => {
      const idx = draft.familyMembers.findIndex((m) => m.id === toSave.id);
      if (idx >= 0) {
        draft.familyMembers[idx] = toSave;
      } else {
        draft.familyMembers.push(toSave);
      }
    });

    await broadcastState(newState);
    return res.status(200).json({ success: true, member: toSave });
  }

  if (req.method === 'DELETE') {
    const id = req.query.id as string;
    if (!id) return res.status(400).json({ error: 'id query param is required' });

    if (CORE_IDS.has(id)) {
      return res.status(400).json({ error: 'Cannot delete a core family member' });
    }

    const newState = await updateState((draft) => {
      draft.familyMembers = draft.familyMembers.filter((m) => m.id !== id);
    });

    await broadcastState(newState);
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
