import type { VercelRequest, VercelResponse } from '@vercel/node';
import { updateState } from '../lib/state';
import { broadcastState } from '../lib/broadcast';
import type { CalendarEvent } from '../src/types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // POST /api/events        — upsert an event
  // DELETE /api/events?id=  — delete an event by id
  if (req.method === 'POST') {
    const event = req.body as Partial<CalendarEvent>;

    if (!event?.title || !event?.startDate) {
      return res.status(400).json({ error: 'title and startDate are required' });
    }

    const now = new Date().toISOString();
    const toSave: CalendarEvent = {
      id: event.id || `ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: event.title,
      titleEn: event.titleEn,
      titleZh: event.titleZh,
      startDate: event.startDate,
      endDate: event.endDate,
      category: event.category || 'general',
      memberId: event.memberId || 'all',
      time: event.time,
      location: event.location,
      notes: event.notes,
      notesEn: event.notesEn,
      notesZh: event.notesZh,
      createdAt: event.createdAt || now,
      updatedAt: now,
    };

    const newState = await updateState((draft) => {
      const idx = draft.events.findIndex((e) => e.id === toSave.id);
      if (idx >= 0) {
        draft.events[idx] = toSave;
      } else {
        draft.events.push(toSave);
      }
    });

    await broadcastState(newState);
    return res.status(200).json({ success: true, event: toSave });
  }

  if (req.method === 'DELETE') {
    const id = req.query.id as string;
    if (!id) return res.status(400).json({ error: 'id query param is required' });

    const newState = await updateState((draft) => {
      draft.events = draft.events.filter((e) => e.id !== id);
    });

    await broadcastState(newState);
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
