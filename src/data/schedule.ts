import { ShiftInfo, ShiftCode, GrandmaLocationMeta, DayOverride, ShiftRosterWeek } from '../types';

export const SHIFT_DEFINITIONS: Record<ShiftCode, ShiftInfo> = {
  NIGHT: {
    code: 'NIGHT',
    name: 'Night',
    time: '2200-0900',
    badgeBg: 'bg-purple-100 text-purple-950 border-purple-300 dark:bg-purple-950/60 dark:text-purple-200 dark:border-purple-800',
    badgeText: 'text-purple-950 dark:text-purple-200',
    badgeBorder: 'border-purple-300 dark:border-purple-800',
    description: 'Overnight shift (22:00 - 09:00 next day)',
  },
  MORNING: {
    code: 'MORNING',
    name: 'Morning',
    time: '0630-1530',
    badgeBg: 'bg-cyan-100 text-cyan-950 border-cyan-300 dark:bg-cyan-950/60 dark:text-cyan-200 dark:border-cyan-800',
    badgeText: 'text-cyan-950 dark:text-cyan-200',
    badgeBorder: 'border-cyan-300 dark:border-cyan-800',
    description: 'Morning shift (06:30 - 15:30)',
  },
  AFTERNOON_1: {
    code: 'AFTERNOON_1',
    name: 'Afternoon 1',
    time: '1600-0100',
    badgeBg: 'bg-amber-100 text-amber-950 border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800',
    badgeText: 'text-amber-950 dark:text-amber-200',
    badgeBorder: 'border-amber-300 dark:border-amber-800',
    description: 'Afternoon 1 shift (16:00 - 01:00)',
  },
  AFTERNOON_2: {
    code: 'AFTERNOON_2',
    name: 'Afternoon 2',
    time: '1400-0100',
    badgeBg: 'bg-emerald-100 text-emerald-950 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-800',
    badgeText: 'text-emerald-950 dark:text-emerald-200',
    badgeBorder: 'border-emerald-300 dark:border-emerald-800',
    description: 'Afternoon 2 shift (14:00 - 01:00)',
  },
  AFTERNOON_3: {
    code: 'AFTERNOON_3',
    name: 'Afternoon 3',
    time: '1500-0200',
    badgeBg: 'bg-rose-100 text-rose-950 border-rose-300 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-800',
    badgeText: 'text-rose-950 dark:text-rose-200',
    badgeBorder: 'border-rose-300 dark:border-rose-800',
    description: 'Afternoon 3 shift (15:00 - 02:00)',
  },
  OFF: {
    code: 'OFF',
    name: 'OFF Day',
    time: 'Off',
    badgeBg: 'bg-yellow-50 text-yellow-950 border-yellow-300 dark:bg-yellow-950/50 dark:text-yellow-200 dark:border-yellow-800',
    badgeText: 'text-yellow-950 dark:text-yellow-200',
    badgeBorder: 'border-yellow-300 dark:border-yellow-800',
    description: 'Scheduled off day',
  },
  REST: {
    code: 'REST',
    name: 'REST DAY',
    time: 'Rest',
    badgeBg: 'bg-yellow-100 text-yellow-950 border-yellow-300 dark:bg-yellow-950/60 dark:text-yellow-200 dark:border-yellow-800',
    badgeText: 'text-yellow-950 dark:text-yellow-200',
    badgeBorder: 'border-yellow-300 dark:border-yellow-800',
    description: 'Mandatory weekly rest day',
  },
  LEAVE: {
    code: 'LEAVE',
    name: 'Annual Leave / MC',
    time: 'Leave',
    badgeBg: 'bg-blue-100 text-blue-950 border-blue-300 dark:bg-blue-950/60 dark:text-blue-200 dark:border-blue-800',
    badgeText: 'text-blue-950 dark:text-blue-200',
    badgeBorder: 'border-blue-300 dark:border-blue-800',
    description: 'Leave / Medical Leave',
  },
  CUSTOM: {
    code: 'CUSTOM',
    name: 'Custom Shift',
    time: '',
    badgeBg: 'bg-indigo-100 text-indigo-950 border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-200 dark:border-indigo-800',
    badgeText: 'text-indigo-950 dark:text-indigo-200',
    badgeBorder: 'border-indigo-300 dark:border-indigo-800',
    description: 'Custom arrangement',
  },
};

export const DEFAULT_ROSTER_WEEKS: ShiftRosterWeek[] = [
  {
    weekNum: 1,
    title: 'Week 1',
    days: [
      { dayOfWeek: 0, code: 'NIGHT', name: 'Night', time: '2200-0900' },
      { dayOfWeek: 1, code: 'NIGHT', name: 'Night', time: '2200-0900' },
      { dayOfWeek: 2, code: 'OFF', name: 'OFF Day', time: '' },
      { dayOfWeek: 3, code: 'REST', name: 'REST DAY', time: '' },
      { dayOfWeek: 4, code: 'MORNING', name: 'Morning', time: '0630-1530' },
      { dayOfWeek: 5, code: 'MORNING', name: 'Morning', time: '0630-1530' },
      { dayOfWeek: 6, code: 'MORNING', name: 'Morning', time: '0630-1530' },
    ],
  },
  {
    weekNum: 2,
    title: 'Week 2',
    days: [
      { dayOfWeek: 0, code: 'MORNING', name: 'Morning', time: '0630-1530' },
      { dayOfWeek: 1, code: 'OFF', name: 'OFF Day', time: '' },
      { dayOfWeek: 2, code: 'AFTERNOON_1', name: 'Afternoon 1', time: '1600-0100' },
      { dayOfWeek: 3, code: 'AFTERNOON_1', name: 'Afternoon 1', time: '1600-0100' },
      { dayOfWeek: 4, code: 'AFTERNOON_2', name: 'Afternoon 2', time: '1400-0100' },
      { dayOfWeek: 5, code: 'AFTERNOON_2', name: 'Afternoon 2', time: '1400-0100' },
      { dayOfWeek: 6, code: 'REST', name: 'REST DAY', time: '' },
    ],
  },
  {
    weekNum: 3,
    title: 'Week 3',
    days: [
      { dayOfWeek: 0, code: 'OFF', name: 'OFF Day', time: '' },
      { dayOfWeek: 1, code: 'MORNING', name: 'Morning', time: '0630-1530' },
      { dayOfWeek: 2, code: 'MORNING', name: 'Morning', time: '0630-1530' },
      { dayOfWeek: 3, code: 'MORNING', name: 'Morning', time: '0630-1530' },
      { dayOfWeek: 4, code: 'REST', name: 'REST DAY', time: '' },
      { dayOfWeek: 5, code: 'AFTERNOON_3', name: 'Afternoon 3', time: '1500-0200' },
      { dayOfWeek: 6, code: 'AFTERNOON_3', name: 'Afternoon 3', time: '1500-0200' },
    ],
  },
];

export const DEFAULT_JUNJIE_ANCHOR = '2026-06-15'; // Monday

export const GRANDMA_LOCATIONS_META: Record<string, GrandmaLocationMeta> = {
  KC: {
    code: 'KC',
    name: 'Kay Cheow',
    description: 'Kay Cheow',
    bgColor: 'bg-teal-50 dark:bg-teal-950/40',
    textColor: 'text-teal-950 dark:text-teal-200',
    borderColor: 'border-teal-300 dark:border-teal-700',
    dotColor: 'bg-teal-500',
  },
  KG: {
    code: 'KG',
    name: 'Kay Guan',
    description: 'Kay Guan',
    bgColor: 'bg-indigo-50 dark:bg-indigo-950/40',
    textColor: 'text-indigo-950 dark:text-indigo-200',
    borderColor: 'border-indigo-300 dark:border-indigo-700',
    dotColor: 'bg-indigo-500',
  },
  KB: {
    code: 'KB',
    name: 'Kay Boon',
    description: 'Kay Boon',
    bgColor: 'bg-amber-50 dark:bg-amber-950/40',
    textColor: 'text-amber-950 dark:text-amber-200',
    borderColor: 'border-amber-300 dark:border-amber-700',
    dotColor: 'bg-amber-500',
  },
};

export const DEFAULT_GRANDMA_ANCHOR = '2026-05-07'; // Fortnightly cycle start date = 7th May 2026 @ Kay Cheow (can be any day of the week)
export const GRANDMA_ROTATION_SEQUENCE = ['KC', 'KG', 'KB'];
export const GRANDMA_DAYS_PER_LOCATION = 14; // Default 14 days per stay

export function getAhmaLocationName(code: string, lang: 'en' | 'zh' = 'en'): string {
  if (code === 'KC') return lang === 'zh' ? '启超' : 'Kay Cheow';
  if (code === 'KG') return lang === 'zh' ? '启源' : 'Kay Guan';
  if (code === 'KB') return lang === 'zh' ? '启文' : 'Kay Boon';
  return code;
}

export function getAhmaLocationBgClass(code: string): string {
  switch (code) {
    case 'KC':
      return 'bg-[#e6f7f5] border-[#b2e5df] text-black';
    case 'KG':
      return 'bg-[#edf2fd] border-[#c7d7fa] text-black';
    case 'KB':
      return 'bg-[#fef8e7] border-[#fae6b2] text-black';
    default:
      return 'bg-[#f4f4f5] border-[#e4e4e7] text-black';
  }
}

export function getShiftColorClass(code: ShiftCode): string {
  switch (code) {
    case 'NIGHT':
      return 'bg-[#bfb6e0] border-[#9c90c7] text-black';
    case 'MORNING':
      return 'bg-[#cbeae6] border-[#96d2cb] text-black';
    case 'AFTERNOON_1':
      return 'bg-[#f4ccaa] border-[#e4a877] text-black';
    case 'AFTERNOON_2':
      return 'bg-[#c5e4c2] border-[#99ca95] text-black';
    case 'AFTERNOON_3':
      return 'bg-[#f7c0ca] border-[#e890a2] text-black';
    case 'OFF':
    case 'REST':
      return 'bg-[#fcf3cf] border-[#f0df8e] text-black';
    case 'LEAVE':
      return 'bg-[#dbeafe] border-[#93c5fd] text-black';
    case 'CUSTOM':
    default:
      return 'bg-[#e0e7ff] border-[#a5b4fc] text-black';
  }
}

// Helper to compute day difference safely between YYYY-MM-DD
export function daysBetween(dateStrA: string, dateStrB: string): number {
  const [yA, mA, dA] = dateStrA.split('-').map(Number);
  const [yB, mB, dB] = dateStrB.split('-').map(Number);
  const utcA = Date.UTC(yA, mA - 1, dA);
  const utcB = Date.UTC(yB, mB - 1, dB);
  return Math.round((utcA - utcB) / (1000 * 60 * 60 * 24));
}

export function formatISODate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().split('T')[0];
}

export function formatShortDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-SG', { day: 'numeric', month: 'short' });
}

export function formatFullDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Calculates start and end dates for Jun Jie's work schedule
 */
export function getJunjieScheduleRange(
  dateStr: string,
  anchorDate = DEFAULT_JUNJIE_ANCHOR,
  rosterWeeks: ShiftRosterWeek[] = DEFAULT_ROSTER_WEEKS
) {
  const totalWeeks = Math.max(1, rosterWeeks.length);
  const cycleLength = totalWeeks * 7;
  const diff = daysBetween(dateStr, anchorDate);
  const dayIndexInCycle = ((diff % cycleLength) + cycleLength) % cycleLength;
  const cycleOffset = diff - dayIndexInCycle;

  const cycleStartDate = addDays(anchorDate, cycleOffset);
  const cycleEndDate = addDays(cycleStartDate, cycleLength - 1);

  const weekNumber = Math.floor(dayIndexInCycle / 7) + 1;
  const weekStartOffset = (weekNumber - 1) * 7;
  const weekStartDate = addDays(cycleStartDate, weekStartOffset);
  const weekEndDate = addDays(weekStartDate, 6);

  return {
    cycleStartDate,
    cycleEndDate,
    weekNumber,
    weekStartDate,
    weekEndDate,
    formattedWeekRange: `${formatShortDate(weekStartDate)} – ${formatShortDate(weekEndDate)}`,
    formattedCycleRange: `${formatShortDate(cycleStartDate)} – ${formatShortDate(cycleEndDate)}`,
  };
}

/**
 * Calculates Ahma's stay window for the given date
 */
export function getGrandmaFortnightRange(
  dateStr: string,
  anchorDate = DEFAULT_GRANDMA_ANCHOR,
  cycleDays = GRANDMA_DAYS_PER_LOCATION
) {
  const stayDuration = Math.max(1, cycleDays);
  const diff = daysBetween(dateStr, anchorDate);
  const totalCycleDays = GRANDMA_ROTATION_SEQUENCE.length * stayDuration;
  const cycleDay = ((diff % totalCycleDays) + totalCycleDays) % totalCycleDays;
  const locIndex = Math.floor(cycleDay / stayDuration);
  const locationCode = GRANDMA_ROTATION_SEQUENCE[locIndex];
  const dayInStay = (cycleDay % stayDuration) + 1;

  const stayStartOffset = diff - (dayInStay - 1);
  const stayStartDate = addDays(anchorDate, stayStartOffset);
  const stayEndDate = addDays(stayStartDate, stayDuration - 1);

  return {
    locationCode,
    stayStartDate,
    stayEndDate,
    dayInStay,
    stayDuration,
    formattedStayRange: `${formatShortDate(stayStartDate)} – ${formatShortDate(stayEndDate)}`,
  };
}

/**
 * Get Jun Jie's scheduled shift for any date
 */
export function getScheduledJunjieShift(
  dateStr: string,
  anchorDate = DEFAULT_JUNJIE_ANCHOR,
  overrides?: DayOverride[],
  rosterWeeks: ShiftRosterWeek[] = DEFAULT_ROSTER_WEEKS
): {
  shift: ShiftInfo;
  weekNumber: number;
  dayIndexInCycle: number;
  isOverridden: boolean;
  overrideReason?: string;
  weekStartDate: string;
  weekEndDate: string;
  formattedWeekRange: string;
  cycleStartDate: string;
  cycleEndDate: string;
  formattedCycleRange: string;
} {
  const range = getJunjieScheduleRange(dateStr, anchorDate, rosterWeeks);

  if (overrides) {
    const override = overrides.find(
      (o) => o.date === dateStr && o.type === 'junjie_shift'
    );
    if (override && override.shiftCode) {
      const baseInfo = SHIFT_DEFINITIONS[override.shiftCode] || SHIFT_DEFINITIONS.CUSTOM;
      const customShift: ShiftInfo = {
        ...baseInfo,
        name: override.shiftName || baseInfo.name,
        time: override.shiftTime !== undefined ? override.shiftTime : baseInfo.time,
        badgeBg: override.shiftColor
          ? `${override.shiftColor} text-zinc-900 border-zinc-300`
          : baseInfo.badgeBg,
      };
      return {
        shift: customShift,
        weekNumber: range.weekNumber,
        dayIndexInCycle: 0,
        isOverridden: true,
        overrideReason: override.shiftReason,
        weekStartDate: range.weekStartDate,
        weekEndDate: range.weekEndDate,
        formattedWeekRange: range.formattedWeekRange,
        cycleStartDate: range.cycleStartDate,
        cycleEndDate: range.cycleEndDate,
        formattedCycleRange: range.formattedCycleRange,
      };
    }
  }

  const totalWeeks = Math.max(1, rosterWeeks.length);
  const cycleLength = totalWeeks * 7;
  const diff = daysBetween(dateStr, anchorDate);
  const dayIndexInCycle = ((diff % cycleLength) + cycleLength) % cycleLength;
  const weekIdx = Math.floor(dayIndexInCycle / 7);
  const dayInWeek = dayIndexInCycle % 7;

  const currentWeek = rosterWeeks[weekIdx] || rosterWeeks[0];
  const dayData = currentWeek?.days?.[dayInWeek];

  const shiftCode = (dayData?.code || 'OFF') as ShiftCode;
  const baseShift = SHIFT_DEFINITIONS[shiftCode] || SHIFT_DEFINITIONS.OFF;
  const shift: ShiftInfo = {
    ...baseShift,
    name: dayData?.name || baseShift.name,
    time: dayData?.time !== undefined ? dayData.time : baseShift.time,
  };

  return {
    shift,
    weekNumber: range.weekNumber,
    dayIndexInCycle,
    isOverridden: false,
    weekStartDate: range.weekStartDate,
    weekEndDate: range.weekEndDate,
    formattedWeekRange: range.formattedWeekRange,
    cycleStartDate: range.cycleStartDate,
    cycleEndDate: range.cycleEndDate,
    formattedCycleRange: range.formattedCycleRange,
  };
}

/**
 * Get Ahma's location for any date
 */
export function getGrandmaLocation(
  dateStr: string,
  anchorDate = DEFAULT_GRANDMA_ANCHOR,
  overrides?: DayOverride[],
  cycleDays = GRANDMA_DAYS_PER_LOCATION
): {
  locationCode: string;
  meta: GrandmaLocationMeta;
  dayInCurrentStay: number;
  daysRemainingInStay: number;
  stayDuration: number;
  nextLocationCode: string;
  nextMoveDate: string;
  isOverridden: boolean;
  overrideReason?: string;
  stayStartDate: string;
  stayEndDate: string;
  formattedStayRange: string;
} {
  const stayDuration = Math.max(1, cycleDays);
  const fortnight = getGrandmaFortnightRange(dateStr, anchorDate, stayDuration);

  if (overrides) {
    const override = overrides.find(
      (o) => o.date === dateStr && o.type === 'grandma_location'
    );
    if (override && override.grandmaLocation) {
      const locCode = override.grandmaLocation;
      const meta = GRANDMA_LOCATIONS_META[locCode] || {
        code: locCode,
        name: locCode === 'KC' ? 'Kay Cheow' : locCode === 'KG' ? 'Kay Guan' : locCode === 'KB' ? 'Kay Boon' : locCode,
        description: locCode,
        bgColor: getAhmaLocationBgClass(locCode),
        textColor: 'text-black',
        borderColor: 'border-zinc-300',
        dotColor: 'bg-purple-500',
      };
      return {
        locationCode: locCode,
        meta,
        dayInCurrentStay: 1,
        daysRemainingInStay: 0,
        stayDuration,
        nextLocationCode: 'Scheduled sequence',
        nextMoveDate: '',
        isOverridden: true,
        overrideReason: override.grandmaReason,
        stayStartDate: fortnight.stayStartDate,
        stayEndDate: fortnight.stayEndDate,
        formattedStayRange: fortnight.formattedStayRange,
      };
    }
  }

  const diff = daysBetween(dateStr, anchorDate);
  const totalCycleDays = GRANDMA_ROTATION_SEQUENCE.length * stayDuration;
  const cycleDay = ((diff % totalCycleDays) + totalCycleDays) % totalCycleDays;
  const locIndex = Math.floor(cycleDay / stayDuration);
  const locationCode = GRANDMA_ROTATION_SEQUENCE[locIndex];
  const dayInStay = (cycleDay % stayDuration) + 1;
  const daysRemaining = stayDuration - dayInStay;

  const nextLocIndex = (locIndex + 1) % GRANDMA_ROTATION_SEQUENCE.length;
  const nextLocationCode = GRANDMA_ROTATION_SEQUENCE[nextLocIndex];
  const nextMoveDate = addDays(dateStr, daysRemaining + 1);

  const meta = GRANDMA_LOCATIONS_META[locationCode] || {
    code: locationCode,
    name: locationCode === 'KC' ? 'Kay Cheow' : locationCode === 'KG' ? 'Kay Guan' : 'Kay Boon',
    description: locationCode,
    bgColor: getAhmaLocationBgClass(locationCode),
    textColor: 'text-black',
    borderColor: 'border-teal-300',
    dotColor: 'bg-teal-500',
  };

  return {
    locationCode,
    meta,
    dayInCurrentStay: dayInStay,
    daysRemainingInStay: daysRemaining,
    stayDuration,
    nextLocationCode,
    nextMoveDate,
    isOverridden: false,
    stayStartDate: fortnight.stayStartDate,
    stayEndDate: fortnight.stayEndDate,
    formattedStayRange: fortnight.formattedStayRange,
  };
}
