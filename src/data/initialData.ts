import { CalendarEvent, DayOverride, FamilyMember, CalendarAppSettings } from './types';
import { DEFAULT_GRANDMA_ANCHOR, DEFAULT_JUNJIE_ANCHOR, DEFAULT_ROSTER_WEEKS } from './schedule';

export const INITIAL_SEED_EVENTS: CalendarEvent[] = [
  {
    id: 'seed-event-1',
    title: 'Family Gathering Dinner @ Kay Cheow',
    startDate: '2026-05-10',
    category: 'family_gathering',
    memberId: 'all',
    time: '18:30',
    location: 'Kay Cheow',
    notes: 'Mother’s Day family dinner celebration with Ahma',
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
  },
  {
    id: 'seed-event-2',
    title: 'Ahma Polyclinic Routine Check-up',
    startDate: '2026-05-22',
    category: 'medical',
    memberId: 'grandma',
    time: '09:30',
    location: 'Polyclinic near Kay Guan',
    notes: 'Blood pressure & medication top-up check',
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
  },
  {
    id: 'seed-event-3',
    title: 'June Family Staycation / Holiday',
    startDate: '2026-06-20',
    endDate: '2026-06-22',
    category: 'holiday_plan',
    memberId: 'all',
    location: 'Sentosa Resort',
    notes: 'Weekend family getaway during school holidays',
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
  },
];

export const INITIAL_FAMILY_MEMBERS: FamilyMember[] = [
  { id: 'all', name: 'Whole Family', relationship: 'Family', color: '#10b981' },
  { id: 'grandma', name: 'Grandmother (阿嬷)', relationship: 'Elder', color: '#0d9488' },
  { id: 'junjie', name: 'Jun Jie', relationship: 'Son / Brother', color: '#8b5cf6' },
  { id: 'layting', name: 'Lay Ting', relationship: 'Daughter / Sister', color: '#f43f5e' },
  { id: 'dad', name: 'Dad', relationship: 'Father', color: '#3b82f6' },
  { id: 'mom', name: 'Mom', relationship: 'Mother', color: '#ec4899' },
];

export const INITIAL_SETTINGS: CalendarAppSettings = {
  grandmaAnchorDate: DEFAULT_GRANDMA_ANCHOR,
  grandmaCycleDays: 14,
  grandmaSequence: ['KC', 'KG', 'KB'],
  grandmaLocations: {
    KC: { name: 'Kay Cheow', notes: 'Kay Cheow (KC)' },
    KG: { name: 'Kay Guan', notes: 'Kay Guan (KG)' },
    KB: { name: 'Kay Boon', notes: 'Kay Boon (KB)' },
  },
  junjieAnchorDate: DEFAULT_JUNJIE_ANCHOR,
  junjieCycleWeeks: 3,
  junjieRosterWeeks: DEFAULT_ROSTER_WEEKS,
};
