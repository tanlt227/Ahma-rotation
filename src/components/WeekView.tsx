import React from 'react';
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
  Heart,
  Clock,
  Plus,
  Sparkles,
  Plane,
  Calendar,
} from 'lucide-react';

interface WeekViewProps {
  onSelectDate: (dateStr: string) => void;
  onOpenEventModal: (dateStr: string) => void;
  onOpenOverrideModal: (dateStr: string) => void;
}

export const WeekView: React.FC<WeekViewProps> = ({
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

  // Find Monday of the current week
  const curr = new Date(currentDate);
  const dayOfWeek = curr.getDay();
  const distanceToMonday = (dayOfWeek + 6) % 7;
  const monday = new Date(curr);
  monday.setDate(curr.getDate() - distanceToMonday);

  // Generate 7 days
  const weekDays = Array.from({ length: 7 }).map((_, idx) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + idx);
    const dateStr = formatISODate(d);
    return {
      date: d,
      dateStr,
      dayNum: d.getDate(),
      dayName: d.toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-SG', { weekday: 'short' }),
      isToday: dateStr === formatISODate(new Date()),
      isSelected: dateStr === selectedDate,
    };
  });

  const getAhmaDisplayName = (code: string) => {
    return getAhmaLocationName(code, language);
  };

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 pb-16 sm:pb-10 space-y-3">
      <div className="bg-white rounded-2xl border-2 border-zinc-300 shadow-sm overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-7 divide-y-2 md:divide-y-0 md:divide-x-2 divide-zinc-200">
          {weekDays.map((cell) => {
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
                className={`min-h-[200px] md:min-h-[360px] p-2.5 sm:p-3 flex flex-col justify-between cursor-pointer transition-colors ${
                  cell.isSelected
                    ? 'bg-rose-50/70 ring-2 ring-inset ring-rose-500'
                    : 'bg-white hover:bg-zinc-50'
                }`}
              >
                <div>
                  {/* Day header */}
                  <div className="flex items-center justify-between pb-2 border-b-2 border-zinc-100">
                    <div>
                      <span className="text-xs font-black uppercase tracking-wider text-zinc-600">
                        {cell.dayName}
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span
                          className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-black ${
                            cell.isToday
                              ? 'bg-rose-600 text-white shadow-xs'
                              : cell.isSelected
                              ? 'bg-zinc-950 text-white shadow-xs'
                              : 'text-zinc-950'
                          }`}
                        >
                          {cell.dayNum}
                        </span>
                        <span className="text-2xs text-zinc-500 font-bold">
                          {cell.date.toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-SG', { month: 'short' })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenOverrideModal(cell.dateStr);
                        }}
                        className="p-1 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 transition-colors"
                        title={t.unusualArrangement}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenEventModal(cell.dateStr);
                        }}
                        className="p-1 rounded bg-rose-100 hover:bg-rose-200 text-rose-900 transition-colors"
                        title={t.addPlan}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Public Holiday */}
                  {holiday && (
                    <div className="mt-2 p-2 rounded-xl bg-rose-100 border border-rose-300 text-rose-950 text-xs">
                      <div className="font-black flex items-center gap-1">
                        <span>🇸🇬</span>
                        <span>{holiday.name}</span>
                      </div>
                    </div>
                  )}

                  {/* Jun Jie's Shift - Match shift table colors, Shift name in bold black, Shift hours not bold but black */}
                  {junjie && (
                    <div className={`mt-2 p-2.5 rounded-xl border-2 text-xs ${getShiftColorClass(junjie.shift.code)}`}>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-black">
                          {language === 'zh' ? '俊杰' : 'Jun Jie'}
                        </span>
                      </div>
                      <div className="font-bold text-sm mt-0.5 text-black">
                        {junjie.shift.name}
                      </div>
                      {junjie.shift.time && (
                        <div className="text-xs font-normal text-black flex items-center gap-1 mt-0.5">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{junjie.shift.time}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Ahma Rotation: Bold black name, lighter background, NO dates beside name */}
                  {grandma && (
                    <div
                      className={`mt-2 p-2.5 rounded-xl border-2 text-xs ${getAhmaLocationBgClass(grandma.locationCode)}`}
                    >
                      <div className="flex items-center justify-between font-bold text-black">
                        <span className="flex items-center gap-1">
                          <Heart className="w-3.5 h-3.5 fill-current text-teal-600" />
                          <span>{language === 'zh' ? '阿嬷' : 'Ahma'}</span>
                        </span>
                      </div>
                      <div className="font-bold text-sm mt-0.5 text-black">
                        {ahmaName} ({grandma.locationCode})
                      </div>
                    </div>
                  )}

                  {/* Family Events */}
                  {dayEvents.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {dayEvents.map((ev) => (
                        <div
                          key={ev.id}
                          className="p-2 rounded-xl border border-zinc-200 bg-zinc-50 text-xs text-zinc-900 font-bold"
                        >
                          <div className="truncate flex items-center gap-1">
                            {ev.category === 'holiday_plan' ? (
                              <Plane className="w-3.5 h-3.5 text-blue-600" />
                            ) : (
                              <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                            )}
                            <span className="truncate">{ev.title}</span>
                          </div>
                          {ev.time && (
                            <div className="text-3xs text-zinc-500 font-medium">{ev.time}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-2 text-center text-3xs font-medium text-zinc-400">
                  {cell.dateStr}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
