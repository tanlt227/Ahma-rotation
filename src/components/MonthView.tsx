import React, { useState } from 'react';
import { useCalendar } from '../context/CalendarContext';
import {
  getGrandmaLocation,
  getScheduledJunjieShift,
  formatISODate,
  getAhmaLocationName,
  getShiftColorClass,
  getAhmaLocationBgClass,
} from '../data/schedule';
import { getPublicHoliday } from '../data/holidays';
import { translations } from '../data/i18n';
import {
  Plus,
  Sparkles,
  Plane,
  Heart,
  LayoutGrid,
  List,
  ChevronRight,
} from 'lucide-react';

interface MonthViewProps {
  onSelectDate: (dateStr: string) => void;
  onOpenEventModal: (dateStr: string) => void;
  onOpenOverrideModal: (dateStr: string) => void;
}

export const MonthView: React.FC<MonthViewProps> = ({
  onSelectDate,
  onOpenEventModal,
  onOpenOverrideModal,
}) => {
  const {
    currentDate,
    selectedDate,
    setSelectedDate,
    events,
    overrides,
    settings,
    rosterWeeks,
    showHolidays,
    showGrandma,
    showJunjie,
    filterMemberId,
    language,
  } = useCalendar();

  const t = translations[language];
  const [mobileLayout, setMobileLayout] = useState<'grid' | 'list'>('grid');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  let firstDayCol = firstDayOfMonth.getDay() - 1;
  if (firstDayCol === -1) firstDayCol = 6;

  const daysInMonth = lastDayOfMonth.getDate();

  interface CalendarDayCell {
    dateStr: string;
    dayNum: number;
    isCurrentMonth: boolean;
    isToday: boolean;
    isSelected: boolean;
    dayOfWeek: number;
  }

  const cells: CalendarDayCell[] = [];

  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = firstDayCol - 1; i >= 0; i--) {
    const d = prevMonthLastDay - i;
    const prevDate = new Date(year, month - 1, d);
    const dateStr = formatISODate(prevDate);
    const dayOfWeek = (prevDate.getDay() + 6) % 7;
    cells.push({
      dateStr,
      dayNum: d,
      isCurrentMonth: false,
      isToday: dateStr === formatISODate(new Date()),
      isSelected: dateStr === selectedDate,
      dayOfWeek,
    });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const currDate = new Date(year, month, d);
    const dateStr = formatISODate(currDate);
    const dayOfWeek = (currDate.getDay() + 6) % 7;
    cells.push({
      dateStr,
      dayNum: d,
      isCurrentMonth: true,
      isToday: dateStr === formatISODate(new Date()),
      isSelected: dateStr === selectedDate,
      dayOfWeek,
    });
  }

  const remainingCells = (7 - (cells.length % 7)) % 7;
  for (let d = 1; d <= remainingCells; d++) {
    const nextDate = new Date(year, month + 1, d);
    const dateStr = formatISODate(nextDate);
    const dayOfWeek = (nextDate.getDay() + 6) % 7;
    cells.push({
      dateStr,
      dayNum: d,
      isCurrentMonth: false,
      isToday: dateStr === formatISODate(new Date()),
      isSelected: dateStr === selectedDate,
      dayOfWeek,
    });
  }

  const weekHeaders = t.days;

  const getAhmaDisplayName = (code: string) => {
    return getAhmaLocationName(code, language);
  };

  const weeks: CalendarDayCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 pt-2 pb-16 sm:pb-8">
      {/* Mobile view toggle */}
      <div className="flex sm:hidden items-center justify-between px-1 mb-2">
        <span className="text-2xs font-black text-zinc-600 uppercase tracking-wider">
          {language === 'zh' ? '视图切换' : 'Calendar View'}
        </span>
        <div className="flex items-center bg-zinc-200 p-0.5 rounded-lg text-2xs font-bold">
          <button
            onClick={() => setMobileLayout('grid')}
            className={`px-2.5 py-1 rounded-md flex items-center gap-1 transition-all ${
              mobileLayout === 'grid' ? 'bg-white text-zinc-950 shadow-2xs font-black' : 'text-zinc-600'
            }`}
          >
            <LayoutGrid className="w-3 h-3" />
            <span>{t.grid}</span>
          </button>
          <button
            onClick={() => setMobileLayout('list')}
            className={`px-2.5 py-1 rounded-md flex items-center gap-1 transition-all ${
              mobileLayout === 'list' ? 'bg-white text-zinc-950 shadow-2xs font-black' : 'text-zinc-600'
            }`}
          >
            <List className="w-3 h-3" />
            <span>{t.mobileCards}</span>
          </button>
        </div>
      </div>

      {/* MOBILE LIST MODE */}
      {mobileLayout === 'list' && (
        <div className="sm:hidden space-y-2">
          {cells.filter((c) => c.isCurrentMonth).map((cell) => {
            const holiday = showHolidays ? getPublicHoliday(cell.dateStr) : undefined;
            const grandma = showGrandma
              ? getGrandmaLocation(cell.dateStr, settings.grandmaAnchorDate, overrides, settings.grandmaCycleDays)
              : undefined;
            const junjie = showJunjie
              ? getScheduledJunjieShift(cell.dateStr, settings.junjieAnchorDate, overrides, rosterWeeks)
              : undefined;
            const dayEvents = events.filter(
              (e) => cell.dateStr >= e.startDate && cell.dateStr <= (e.endDate || e.startDate)
            );

            const isSelected = cell.dateStr === selectedDate;
            const [y, m, d] = cell.dateStr.split('-').map(Number);
            const dateObj = new Date(y, m - 1, d);
            const dayName = dateObj.toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-SG', { weekday: 'short' });

            return (
              <div
                key={cell.dateStr}
                onClick={() => {
                  setSelectedDate(cell.dateStr);
                  onSelectDate(cell.dateStr);
                }}
                className={`p-3 rounded-2xl border-2 bg-white shadow-xs transition-all ${
                  isSelected ? 'border-rose-500 ring-2 ring-rose-400 bg-rose-50/40' : 'border-zinc-200'
                }`}
              >
                <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-black ${
                        cell.isToday
                          ? 'bg-rose-600 text-white'
                          : isSelected
                          ? 'bg-zinc-950 text-white'
                          : 'bg-zinc-100 text-zinc-950'
                      }`}
                    >
                      {cell.dayNum}
                    </span>
                    <div>
                      <span className="text-sm font-black text-zinc-950">{dayName}</span>
                      <span className="text-xs text-zinc-500 font-medium ml-1.5">{cell.dateStr}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {holiday && (
                      <span className="text-2xs font-black bg-rose-100 text-rose-950 px-2 py-0.5 rounded-md border border-rose-300">
                        🇸🇬 {holiday.name}
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-zinc-400" />
                  </div>
                </div>

                <div className="mt-2.5 space-y-2 text-xs">
                  {/* Ahma - Bold black, lighter background, no dates beside name */}
                  {grandma && (
                    <div className={`flex items-center justify-between p-2 rounded-xl border ${getAhmaLocationBgClass(grandma.locationCode)}`}>
                      <span className="flex items-center gap-1.5 font-bold text-black">
                        <Heart className="w-3.5 h-3.5 fill-current text-teal-600 shrink-0" />
                        <span>{language === 'zh' ? '阿嬷:' : 'Ahma:'} {getAhmaDisplayName(grandma.locationCode)} ({grandma.locationCode})</span>
                      </span>
                    </div>
                  )}

                  {/* Jun Jie Shift - Shift in bold black, hours in normal black, matching shift table colors */}
                  {junjie && (
                    <div className={`p-2 rounded-xl border ${getShiftColorClass(junjie.shift.code)}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-black">
                          {language === 'zh' ? '俊杰:' : 'Jun Jie:'} {junjie.shift.name}
                        </span>
                        {junjie.shift.time && (
                          <span className="text-xs font-normal text-black bg-white/60 px-2 py-0.5 rounded border border-black/10">
                            {junjie.shift.time}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Events */}
                  {dayEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className="p-2 rounded-xl bg-zinc-50 border border-zinc-200 text-zinc-900 font-bold flex items-center justify-between"
                    >
                      <span className="truncate">{ev.title}</span>
                      {ev.time && <span className="text-3xs text-zinc-500 font-medium">{ev.time}</span>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FULL RESPONSIVE CALENDAR GRID */}
      <div className={`bg-white rounded-2xl border-2 border-zinc-300 shadow-sm overflow-hidden ${mobileLayout === 'list' ? 'hidden sm:block' : ''}`}>
        {/* Day-of-week header */}
        <div className="grid grid-cols-7 border-b-2 border-zinc-300 bg-zinc-100/90 text-center text-xs font-black text-zinc-900">
          {weekHeaders.map((day, idx) => (
            <div
              key={day}
              className={`py-3 uppercase tracking-wider ${
                idx >= 5 ? 'text-rose-900 bg-rose-50/60' : ''
              }`}
            >
              <span>{day}</span>
            </div>
          ))}
        </div>

        {/* Weeks rows */}
        <div className="divide-y-2 divide-zinc-200">
          {weeks.map((weekCells, weekIdx) => (
            <div key={weekIdx}>
              {/* 7 Days in Week Grid (Notice: Jun Jie Schedule header strip removed as requested!) */}
              <div className="grid grid-cols-7 divide-x-2 divide-zinc-200">
                {weekCells.map((cell) => {
                  const holiday = showHolidays ? getPublicHoliday(cell.dateStr) : undefined;
                  const grandma = showGrandma
                    ? getGrandmaLocation(cell.dateStr, settings.grandmaAnchorDate, overrides, settings.grandmaCycleDays)
                    : undefined;
                  const junjie = showJunjie
                    ? getScheduledJunjieShift(cell.dateStr, settings.junjieAnchorDate, overrides, rosterWeeks)
                    : undefined;

                  const dayEvents = events.filter((e) => {
                    const inRange =
                      cell.dateStr >= e.startDate &&
                      cell.dateStr <= (e.endDate || e.startDate);
                    if (!inRange) return false;
                    if (filterMemberId !== 'all' && e.memberId && e.memberId !== 'all') {
                      return e.memberId === filterMemberId;
                    }
                    return true;
                  });

                  const ahmaName = grandma ? getAhmaDisplayName(grandma.locationCode) : '';

                  return (
                    <div
                      key={cell.dateStr}
                      onClick={() => {
                        setSelectedDate(cell.dateStr);
                        onSelectDate(cell.dateStr);
                      }}
                      className={`min-h-[105px] sm:min-h-[135px] p-1.5 sm:p-2 flex flex-col justify-between transition-colors cursor-pointer group relative ${
                        cell.isCurrentMonth
                          ? cell.isSelected
                            ? 'bg-rose-50/70 ring-2 ring-inset ring-rose-500 z-10'
                            : 'bg-white hover:bg-zinc-50/90'
                          : 'bg-zinc-100/60 text-zinc-400'
                      }`}
                    >
                      {/* Day Header Row */}
                      <div className="flex items-center justify-between">
                        <span
                          className={`inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full text-xs sm:text-sm font-black ${
                            cell.isToday
                              ? 'bg-rose-600 text-white shadow-xs'
                              : cell.isSelected
                              ? 'bg-zinc-950 text-white shadow-xs'
                              : cell.isCurrentMonth
                              ? 'text-zinc-950'
                              : 'text-zinc-400'
                          }`}
                        >
                          {cell.dayNum}
                        </span>

                        {/* Quick Add on Hover (Desktop) */}
                        <div className="hidden group-hover:flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenOverrideModal(cell.dateStr);
                            }}
                            className="p-1 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 transition-colors shadow-2xs"
                            title={t.unusualArrangement}
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenEventModal(cell.dateStr);
                            }}
                            className="p-1 rounded bg-rose-100 hover:bg-rose-200 text-rose-900 transition-colors shadow-2xs"
                            title={t.addPlan}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Badges Stack with Enhanced High-Contrast Typography */}
                      <div className="mt-1 space-y-1 flex-1 overflow-hidden">
                        {/* 1. Singapore Public Holiday */}
                        {holiday && (
                          <div
                            className="text-3xs sm:text-2xs font-black px-1.5 py-0.5 rounded-md truncate flex items-center gap-1 bg-rose-100 text-rose-950 border border-rose-300 shadow-2xs"
                            title={`🇸🇬 ${holiday.name}`}
                          >
                            <span>🇸🇬</span>
                            <span className="truncate">{holiday.name}</span>
                          </div>
                        )}

                        {/* 2. Ahma Rotation: Bold black name, lighter background, NO dates beside name */}
                        {grandma && (filterMemberId === 'all' || filterMemberId === 'grandma') && (
                          <div
                            className={`text-3xs sm:text-2xs px-1.5 py-0.5 rounded-md border truncate shadow-2xs ${getAhmaLocationBgClass(grandma.locationCode)}`}
                            title={`Ahma: ${ahmaName} (${grandma.locationCode})`}
                          >
                            <span className="truncate flex items-center gap-1 font-bold text-black">
                              <Heart className="w-2.5 h-2.5 fill-current shrink-0 text-teal-600 hidden sm:inline" />
                              <span className="truncate">
                                {grandma.isOverridden ? '⚡ ' : ''}
                                <span className="sm:hidden">{grandma.locationCode}</span>
                                <span className="hidden sm:inline">{ahmaName} ({grandma.locationCode})</span>
                              </span>
                            </span>
                          </div>
                        )}

                        {/* 3. Jun Jie's Shift Badge: Matching Shift table colors, Shift name in bold black, Shift hours not bold but black */}
                        {junjie && (filterMemberId === 'all' || filterMemberId === 'junjie') && (
                          <div
                            className={`text-3xs sm:text-2xs px-1.5 py-0.5 rounded-md border shadow-2xs ${getShiftColorClass(junjie.shift.code)}`}
                            title={`Jun Jie: ${junjie.shift.name} ${junjie.shift.time ? `(${junjie.shift.time})` : ''}`}
                          >
                            <div className="flex items-center justify-between gap-1 leading-tight">
                              <span className="truncate font-bold text-black">
                                {junjie.isOverridden ? '⚡ ' : ''}
                                {junjie.shift.name}
                              </span>
                              {junjie.shift.time && (
                                <span className="font-normal text-black text-3xs shrink-0 whitespace-nowrap">
                                  {junjie.shift.time}
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* 4. Family Events */}
                        {dayEvents.slice(0, 2).map((ev) => (
                          <div
                            key={ev.id}
                            className={`text-3xs sm:text-2xs px-1.5 py-0.5 rounded-md border truncate font-bold flex items-center gap-1 shadow-2xs ${
                              ev.category === 'holiday_plan'
                                ? 'bg-blue-50 text-blue-950 border-blue-300'
                                : 'bg-emerald-50 text-emerald-950 border-emerald-300'
                            }`}
                            title={ev.title}
                          >
                            {ev.category === 'holiday_plan' ? (
                              <Plane className="w-2.5 h-2.5 shrink-0 text-blue-600 hidden xs:inline" />
                            ) : (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0 hidden xs:inline" />
                            )}
                            <span className="truncate">{ev.title}</span>
                          </div>
                        ))}

                        {dayEvents.length > 2 && (
                          <div className="text-3xs font-black text-zinc-600 pl-0.5">
                            +{dayEvents.length - 2} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
