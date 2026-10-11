import { PublicHoliday } from '../types';

export const SINGAPORE_PUBLIC_HOLIDAYS: PublicHoliday[] = [
  // 2025
  { date: '2025-01-01', name: "New Year's Day", type: 'gazetted', year: 2025 },
  { date: '2025-01-29', name: 'Chinese New Year (Day 1)', type: 'gazetted', year: 2025 },
  { date: '2025-01-30', name: 'Chinese New Year (Day 2)', type: 'gazetted', year: 2025 },
  { date: '2025-03-31', name: 'Hari Raya Puasa', type: 'gazetted', year: 2025 },
  { date: '2025-04-18', name: 'Good Friday', type: 'gazetted', year: 2025 },
  { date: '2025-05-01', name: 'Labour Day', type: 'gazetted', year: 2025 },
  { date: '2025-05-12', name: 'Vesak Day', type: 'gazetted', year: 2025 },
  { date: '2025-06-07', name: 'Hari Raya Haji', type: 'gazetted', year: 2025 },
  { date: '2025-08-09', name: 'National Day', type: 'gazetted', year: 2025 },
  { date: '2025-10-20', name: 'Deepavali', type: 'gazetted', year: 2025 },
  { date: '2025-12-25', name: 'Christmas Day', type: 'gazetted', year: 2025 },

  // 2026 (Anchor year)
  { date: '2026-01-01', name: "New Year's Day", type: 'gazetted', year: 2026 },
  { date: '2026-02-17', name: 'Chinese New Year (Day 1)', type: 'gazetted', year: 2026 },
  { date: '2026-02-18', name: 'Chinese New Year (Day 2)', type: 'gazetted', year: 2026 },
  { date: '2026-03-20', name: 'Hari Raya Puasa', type: 'gazetted', notes: 'Subject to moon sighting', year: 2026 },
  { date: '2026-04-03', name: 'Good Friday', type: 'gazetted', year: 2026 },
  { date: '2026-05-01', name: 'Labour Day', type: 'gazetted', year: 2026 },
  { date: '2026-05-27', name: 'Hari Raya Haji', type: 'gazetted', year: 2026 },
  { date: '2026-05-31', name: 'Vesak Day', type: 'gazetted', notes: 'Falls on Sunday', year: 2026 },
  { date: '2026-06-01', name: 'Vesak Day (In-Lieu)', type: 'in_lieu', notes: 'Public Holiday in-lieu for Sunday', year: 2026 },
  { date: '2026-08-09', name: 'National Day (Singapore 61st)', type: 'gazetted', notes: 'Falls on Sunday', year: 2026 },
  { date: '2026-08-10', name: 'National Day (In-Lieu)', type: 'in_lieu', notes: 'Public Holiday in-lieu for Sunday', year: 2026 },
  { date: '2026-11-08', name: 'Deepavali', type: 'gazetted', notes: 'Falls on Sunday', year: 2026 },
  { date: '2026-11-09', name: 'Deepavali (In-Lieu)', type: 'in_lieu', notes: 'Public Holiday in-lieu for Sunday', year: 2026 },
  { date: '2026-12-25', name: 'Christmas Day', type: 'gazetted', year: 2026 },

  // 2027
  { date: '2027-01-01', name: "New Year's Day", type: 'gazetted', year: 2027 },
  { date: '2027-02-06', name: 'Chinese New Year (Day 1)', type: 'gazetted', year: 2027 },
  { date: '2027-02-07', name: 'Chinese New Year (Day 2)', type: 'gazetted', notes: 'Falls on Sunday', year: 2027 },
  { date: '2027-02-08', name: 'Chinese New Year (In-Lieu)', type: 'in_lieu', notes: 'Public Holiday in-lieu for Sunday', year: 2027 },
  { date: '2027-03-10', name: 'Hari Raya Puasa', type: 'gazetted', year: 2027 },
  { date: '2027-03-26', name: 'Good Friday', type: 'gazetted', year: 2027 },
  { date: '2027-05-01', name: 'Labour Day', type: 'gazetted', year: 2027 },
  { date: '2027-05-16', name: 'Hari Raya Haji', type: 'gazetted', notes: 'Falls on Sunday', year: 2027 },
  { date: '2027-05-17', name: 'Hari Raya Haji (In-Lieu)', type: 'in_lieu', year: 2027 },
  { date: '2027-05-20', name: 'Vesak Day', type: 'gazetted', year: 2027 },
  { date: '2027-08-09', name: 'National Day', type: 'gazetted', year: 2027 },
  { date: '2027-10-29', name: 'Deepavali', type: 'gazetted', year: 2027 },
  { date: '2027-12-25', name: 'Christmas Day', type: 'gazetted', year: 2027 },

  // 2028
  { date: '2028-01-01', name: "New Year's Day", type: 'gazetted', year: 2028 },
  { date: '2028-01-26', name: 'Chinese New Year (Day 1)', type: 'gazetted', year: 2028 },
  { date: '2028-01-27', name: 'Chinese New Year (Day 2)', type: 'gazetted', year: 2028 },
  { date: '2028-02-27', name: 'Hari Raya Puasa', type: 'gazetted', year: 2028 },
  { date: '2028-04-14', name: 'Good Friday', type: 'gazetted', year: 2028 },
  { date: '2028-05-01', name: 'Labour Day', type: 'gazetted', year: 2028 },
  { date: '2028-05-05', name: 'Hari Raya Haji', type: 'gazetted', year: 2028 },
  { date: '2028-05-08', name: 'Vesak Day', type: 'gazetted', year: 2028 },
  { date: '2028-08-09', name: 'National Day', type: 'gazetted', year: 2028 },
  { date: '2028-10-17', name: 'Deepavali', type: 'gazetted', year: 2028 },
  { date: '2028-12-25', name: 'Christmas Day', type: 'gazetted', year: 2028 },
];

export const SINGAPORE_SCHOOL_HOLIDAYS_2026: { name: string; start: string; end: string }[] = [
  { name: 'Term 1 Break', start: '2026-03-14', end: '2026-03-22' },
  { name: 'Mid-Year (June) Holidays', start: '2026-05-30', end: '2026-06-28' },
  { name: 'Term 3 Break', start: '2026-09-05', end: '2026-09-13' },
  { name: 'Year-End Holidays', start: '2026-11-21', end: '2026-12-31' },
];

const holidayMap = new Map<string, PublicHoliday>();
SINGAPORE_PUBLIC_HOLIDAYS.forEach((h) => {
  holidayMap.set(h.date, h);
});

export function getPublicHoliday(dateStr: string): PublicHoliday | undefined {
  return holidayMap.get(dateStr);
}

export function isSingaporePublicHoliday(dateStr: string): boolean {
  return holidayMap.has(dateStr);
}
