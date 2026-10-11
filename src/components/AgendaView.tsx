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
import {
  Calendar,
  Heart,
  Clock,
  Search,
  Sparkles,
  Plane,
  Plus,
} from 'lucide-react';

interface AgendaViewProps {
  onSelectDate: (dateStr: string) => void;
  onOpenEventModal: (dateStr: string) => void;
  onOpenOverrideModal: (dateStr: string) => void;
}

export const AgendaView: React.FC<AgendaViewProps> = ({
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
    language,
  } = useCalendar();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'holidays' | 'grandma' | 'junjie' | 'events'>('all');

  const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const items: any[] = [];

  const getAhmaDisplayName = (code: string) => {
    return getAhmaLocationName(code, language);
  };

  for (let i = 0; i < 60; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const dateStr = formatISODate(d);

    const holiday = getPublicHoliday(dateStr);
    const grandma = getGrandmaLocation(dateStr, settings.grandmaAnchorDate, overrides, settings.grandmaCycleDays);
    const junjie = getScheduledJunjieShift(dateStr, settings.junjieAnchorDate, overrides);
    const dayEvents = events.filter(
      (e) => dateStr >= e.startDate && dateStr <= (e.endDate || e.startDate)
    );
    const dayOverrides = overrides.filter((o) => o.date === dateStr);

    const isGrandmaMoveDay = grandma.dayInCurrentStay === 1;

    let matches = true;
    if (filterType === 'holidays' && !holiday) matches = false;
    if (filterType === 'grandma' && !isGrandmaMoveDay && !dayOverrides.some(o => o.type === 'grandma_location')) matches = false;
    if (filterType === 'junjie' && !dayOverrides.some(o => o.type === 'junjie_shift') && junjie.shift.code !== 'NIGHT') matches = false;
    if (filterType === 'events' && dayEvents.length === 0 && dayOverrides.length === 0) matches = false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const text = `${dateStr} ${holiday?.name || ''} ${getAhmaDisplayName(grandma.locationCode)} ${grandma.locationCode} ${junjie.shift.name} ${dayEvents.map(e => e.title).join(' ')}`.toLowerCase();
      if (!text.includes(q)) matches = false;
    }

    if (matches) {
      items.push({
        date: d,
        dateStr,
        holiday,
        grandma,
        junjie,
        isGrandmaMoveDay,
        events: dayEvents,
        overrides: dayOverrides,
      });
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 pb-16 sm:pb-12 space-y-3 sm:space-y-4">
      {/* Search and Filters */}
      <div className="bg-white rounded-xl border border-zinc-200 p-3 sm:p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-2.5">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search dates, holidays, Ahma, shifts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 border border-zinc-300 rounded-lg text-xs sm:text-sm focus:outline-rose-500 shadow-2xs"
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar w-full sm:w-auto text-2xs sm:text-xs font-bold">
          <button
            onClick={() => setFilterType('all')}
            className={`px-2.5 py-1 rounded-lg shrink-0 transition-colors ${
              filterType === 'all' ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterType('holidays')}
            className={`px-2.5 py-1 rounded-lg shrink-0 transition-colors ${
              filterType === 'holidays' ? 'bg-rose-700 text-white' : 'bg-rose-50 text-rose-800'
            }`}
          >
            🇸🇬 Holidays
          </button>
          <button
            onClick={() => setFilterType('grandma')}
            className={`px-2.5 py-1 rounded-lg shrink-0 transition-colors ${
              filterType === 'grandma' ? 'bg-teal-700 text-white' : 'bg-teal-50 text-teal-800'
            }`}
          >
            👵 Ahma Rotations
          </button>
          <button
            onClick={() => setFilterType('events')}
            className={`px-2.5 py-1 rounded-lg shrink-0 transition-colors ${
              filterType === 'events' ? 'bg-blue-700 text-white' : 'bg-blue-50 text-blue-800'
            }`}
          >
            ✈️ Plans
          </button>
        </div>
      </div>

      {/* Timeline items */}
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden divide-y divide-zinc-200">
        {items.length === 0 ? (
          <div className="p-8 text-center text-zinc-500 text-xs sm:text-sm">
            No events found matching your criteria.
          </div>
        ) : (
          items.map((item) => {
            const isSelected = item.dateStr === selectedDate;
            const weekday = item.date.toLocaleDateString('en-SG', { weekday: 'short' });
            const dayNum = item.date.getDate();
            const monthName = item.date.toLocaleDateString('en-SG', { month: 'short' });
            const ahmaName = getAhmaDisplayName(item.grandma.locationCode);

            return (
              <div
                key={item.dateStr}
                onClick={() => {
                  setSelectedDate(item.dateStr);
                  onSelectDate(item.dateStr);
                }}
                className={`p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-4 transition-colors cursor-pointer ${
                  isSelected ? 'bg-rose-50/60' : 'hover:bg-zinc-50'
                }`}
              >
                {/* Date Col */}
                <div className="flex items-center gap-2.5 min-w-[150px]">
                  <div
                    className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex flex-col items-center justify-center border font-black ${
                      item.holiday
                        ? 'bg-rose-50 border-rose-300 text-rose-700'
                        : 'bg-zinc-50 border-zinc-200 text-zinc-800'
                    }`}
                  >
                    <span className="text-3xs uppercase tracking-wider">{weekday}</span>
                    <span className="text-sm leading-none">{dayNum}</span>
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-black text-zinc-900">
                      {monthName} {dayNum}, {item.date.getFullYear()}
                    </div>
                    <div className="text-3xs text-zinc-400">{item.dateStr}</div>
                  </div>
                </div>

                {/* Badges Stack */}
                <div className="flex-1 flex flex-wrap items-center gap-1.5 sm:gap-2 text-2xs sm:text-xs">
                  {/* Public Holiday */}
                  {item.holiday && (
                    <div className="px-2.5 py-0.5 rounded-lg font-black bg-rose-100 text-rose-900 border border-rose-300 flex items-center gap-1">
                      <span>🇸🇬</span>
                      <span>{item.holiday.name}</span>
                    </div>
                  )}

                  {/* Ahma */}
                  {item.isGrandmaMoveDay ? (
                    <div className="px-2.5 py-0.5 rounded-lg font-bold bg-[#e6f7f5] text-black border border-[#b2e5df] flex items-center gap-1">
                      <Heart className="w-3 h-3 fill-current text-teal-700" />
                      <span>{language === 'zh' ? '👵 阿嬷开始入住' : '👵 Ahma begins stay at'} {ahmaName} ({item.grandma.locationCode})</span>
                    </div>
                  ) : (
                    <div className={`px-2 py-0.5 rounded-md font-bold text-black border ${getAhmaLocationBgClass(item.grandma.locationCode)}`}>
                      <span>{language === 'zh' ? '阿嬷在' : 'Ahma @'} {ahmaName} ({item.grandma.locationCode})</span>
                    </div>
                  )}

                  {/* Jun Jie Shift */}
                  <div className={`px-2 py-0.5 rounded-md border ${getShiftColorClass(item.junjie.shift.code)}`}>
                    <span className="font-bold text-black">{language === 'zh' ? '俊杰:' : 'Jun Jie:'} {item.junjie.shift.name}</span>
                    {item.junjie.shift.time && (
                      <span className="text-3xs ml-1 font-normal text-black bg-white/50 px-1 py-0.2 rounded border border-black/10">
                        {item.junjie.shift.time}
                      </span>
                    )}
                  </div>

                  {/* Overrides */}
                  {item.overrides.map((ovr: any) => (
                    <div
                      key={ovr.id}
                      className="px-2 py-0.5 rounded-md font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3 text-amber-600" />
                      <span>Arrangement: {ovr.shiftReason || ovr.grandmaReason || 'Custom'}</span>
                    </div>
                  ))}

                  {/* Events */}
                  {item.events.map((ev: any) => (
                    <div
                      key={ev.id}
                      className="px-2 py-0.5 rounded-md font-semibold bg-blue-50 text-blue-900 border border-blue-200 flex items-center gap-1"
                    >
                      <Plane className="w-3 h-3 text-blue-600" />
                      <span>{ev.title}</span>
                    </div>
                  ))}
                </div>

                {/* Quick Action buttons */}
                <div className="flex items-center gap-1.5 shrink-0 self-end md:self-auto">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenOverrideModal(item.dateStr);
                    }}
                    className="p-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700"
                    title="Unusual arrangement"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenEventModal(item.dateStr);
                    }}
                    className="p-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700"
                    title="Add plan"
                  >
                    <Plus className="w-3.5 h-3.5 text-rose-600" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
