export type ShiftCode =
  | 'NIGHT'
  | 'MORNING'
  | 'AFTERNOON_1'
  | 'AFTERNOON_2'
  | 'AFTERNOON_3'
  | 'OFF'
  | 'REST'
  | 'LEAVE'
  | 'CUSTOM';

export interface ShiftInfo {
  code: ShiftCode;
  name: string;
  time: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  description?: string;
}

export type GrandmaLocationCode = 'KC' | 'KG' | 'KB' | string;

export interface GrandmaLocationMeta {
  code: string;
  name: string;
  description: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  dotColor: string;
}

export interface PublicHoliday {
  date: string; // YYYY-MM-DD
  name: string;
  type: 'gazetted' | 'in_lieu' | 'school' | 'observance';
  notes?: string;
  year: number;
}

export type EventCategory =
  | 'holiday_plan'
  | 'family_gathering'
  | 'medical'
  | 'leave'
  | 'unusual_arrangement'
  | 'general';

export interface CalendarEvent {
  id: string;
  title: string;
  startDate: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  category: EventCategory;
  memberId?: string; // 'all' | 'grandma' | 'junjie' | member id
  time?: string;
  location?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DayOverride {
  id: string;
  date: string; // YYYY-MM-DD
  type: 'grandma_location' | 'junjie_shift';
  // If grandma_location override:
  grandmaLocation?: string;
  grandmaReason?: string;
  // If junjie_shift override:
  shiftCode?: ShiftCode;
  shiftName?: string;
  shiftTime?: string;
  shiftReason?: string;
  shiftColor?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FamilyMember {
  id: string;
  name: string;
  relationship: string;
  color: string;
  avatarIcon?: string;
}

export interface ShiftRosterDay {
  dayOfWeek: number;
  code: ShiftCode;
  name: string;
  time: string;
}

export interface ShiftRosterWeek {
  weekNum: number;
  title: string;
  days: ShiftRosterDay[];
}

export interface CalendarAppSettings {
  grandmaAnchorDate: string; // '2026-05-04' (Mon) or '2026-05-07'
  grandmaCycleDays: number; // 14 days per location
  grandmaSequence: string[]; // ['KC', 'KG', 'KB']
  grandmaLocations: Record<string, { name: string; notes: string; address?: string }>;
  junjieAnchorDate: string; // '2026-06-15' (Week 1 start)
  junjieCycleWeeks: number; // 3
  junjieRosterWeeks?: ShiftRosterWeek[];
}

export interface AppSyncState {
  events: CalendarEvent[];
  overrides: DayOverride[];
  familyMembers: FamilyMember[];
  settings: CalendarAppSettings;
  lastUpdated: string;
  version: number;
}
