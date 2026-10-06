import React from 'react';
import { useCalendar } from '../context/CalendarContext';
import { getGrandmaLocation, getScheduledJunjieShift, getAhmaLocationName, getShiftColorClass, getAhmaLocationBgClass } from '../data/schedule';
import { getPublicHoliday } from '../data/holidays';
import { CalendarEvent } from '../types';
import {
  X,
  Heart,
  Clock,
  Calendar,
  Sparkles,
  Plus,
  Trash2,
  Edit2,
  Plane,
  ArrowRight,
} from 'lucide-react';

interface DayDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  dateStr: string;
  onOpenEventModal: (dateStr: string, event?: CalendarEvent) => void;
  onOpenOverrideModal: (dateStr: string, tab?: 'grandma_location' | 'junjie_shift') => void;
}

export const DayDetailDrawer: React.FC<DayDetailDrawerProps> = ({
  isOpen,
  onClose,
  dateStr,
  onOpenEventModal,
  onOpenOverrideModal,
}) => {
  const { events, overrides, settings, deleteEvent, familyMembers, language } = useCalendar();

  if (!isOpen) return null;

  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const formattedDayStr = dateObj.toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-SG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const holiday = getPublicHoliday(dateStr);
  const grandma = getGrandmaLocation(dateStr, settings.grandmaAnchorDate, overrides, settings.grandmaCycleDays);
  const junjie = getScheduledJunjieShift(dateStr, settings.junjieAnchorDate, overrides);

  const dayEvents = events.filter(
    (e) => dateStr >= e.startDate && dateStr <= (e.endDate || e.startDate)
  );

  const currentAhmaName = getAhmaLocationName(grandma.locationCode, language);
  const nextAhmaName = getAhmaLocationName(grandma.nextLocationCode, language);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-stretch sm:justify-end bg-black/50 backdrop-blur-2xs">
      <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-none h-[88vh] sm:h-full shadow-2xl flex flex-col justify-between overflow-hidden animate-in slide-in-from-bottom sm:slide-in-from-right duration-200">
        <div className="overflow-y-auto flex-1">
          {/* Drawer Top Drag Bar for Mobile */}
          <div className="sm:hidden pt-2.5 pb-1 flex justify-center bg-zinc-900">
            <div className="w-10 h-1 rounded-full bg-zinc-600" />
          </div>

          {/* Drawer Top Header */}
          <div className="p-4 sm:p-5 bg-zinc-900 text-white flex items-center justify-between sticky top-0 z-10">
            <div>
              <span className="text-3xs font-bold uppercase tracking-wider text-rose-400">
                Daily Schedule Breakdown
              </span>
              <h2 className="text-base sm:text-lg font-black mt-0.5">{formattedDayStr}</h2>
              <div className="text-3xs text-zinc-400">{dateStr}</div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 sm:p-5 space-y-4">
            {/* 1. Singapore Public Holiday Alert */}
            {holiday ? (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-300">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🇸🇬</span>
                  <div>
                    <h4 className="text-sm font-black text-rose-950">
                      {holiday.name}
                    </h4>
                    <span className="text-3xs font-semibold text-rose-700">
                      {holiday.type === 'in_lieu' ? 'Public Holiday in-lieu' : 'Gazetted Singapore Public Holiday'}
                    </span>
                  </div>
                </div>
                {holiday.notes && (
                  <p className="text-xs text-rose-800 mt-2 bg-white/70 p-2 rounded-lg border border-rose-200">
                    ℹ️ {holiday.notes}
                  </p>
                )}
              </div>
            ) : (
              <div className="text-xs text-zinc-400 bg-zinc-50 p-2.5 rounded-lg border border-zinc-200 flex items-center justify-between">
                <span>🇸🇬 Regular Day</span>
                <span className="text-zinc-500 font-medium text-3xs">No Public Holiday</span>
              </div>
            )}

            {/* 2. Ahma's Location Details */}
            <div className="p-3.5 sm:p-4 rounded-xl border border-teal-200 bg-teal-50/50">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-black text-teal-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Heart className="w-3.5 h-3.5 fill-current text-teal-600" />
                  <span>Ahma's Rotation</span>
                </span>
                {grandma.isOverridden ? (
                  <span className="text-3xs font-black uppercase bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded border border-amber-300">
                    Arrangement
                  </span>
                ) : (
                  <span className="text-3xs font-bold bg-teal-100 text-teal-900 px-1.5 py-0.5 rounded">
                    Day {grandma.dayInCurrentStay} of 14
                  </span>
                )}
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-xl font-black text-teal-950">
                  {currentAhmaName}
                </span>
                <span className="text-xs font-bold text-teal-700 bg-teal-100 px-1.5 py-0.2 rounded">
                  ({grandma.locationCode})
                </span>
              </div>

              {/* Stay Start and End Dates */}
              <div className="mt-1 text-xs text-teal-800 flex items-center gap-1">
                <span className="font-medium text-teal-600">Fortnight stay period:</span>
                <span className="font-bold">{grandma.formattedStayRange}</span>
              </div>

              {grandma.overrideReason && (
                <div className="mt-2 p-2 bg-amber-50 rounded-lg text-xs text-amber-900 border border-amber-200">
                  <strong>Arrangement details:</strong> {grandma.overrideReason}
                </div>
              )}

              {!grandma.isOverridden && (
                <div className="mt-2.5 pt-2 border-t border-teal-200/60 text-2xs text-zinc-600 flex items-center justify-between">
                  <span>Next Rotation:</span>
                  <span className="font-bold text-teal-900 flex items-center gap-1">
                    <span>{nextAhmaName} ({grandma.nextLocationCode})</span>
                    <ArrowRight className="w-3 h-3 text-zinc-400" />
                    <span>{grandma.nextMoveDate}</span>
                  </span>
                </div>
              )}

              <div className="mt-2.5 pt-2 border-t border-teal-200/60 flex justify-end">
                <button
                  onClick={() => onOpenOverrideModal(dateStr, 'grandma_location')}
                  className="text-xs font-bold text-teal-800 hover:text-teal-950 hover:underline"
                >
                  {grandma.isOverridden ? 'Edit Arrangement' : '⚡ Change Ahma Arrangement'}
                </button>
              </div>
            </div>

            {/* 3. Jun Jie's Shift Schedule Details (Without Week X of 3, cycle window, or week start/end; With shift hours) */}
            <div className={`p-3.5 sm:p-4 rounded-xl border ${getShiftColorClass(junjie.shift.code)}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-black uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{language === 'zh' ? '俊杰工作排班' : "Jun Jie's Work Schedule"}</span>
                </span>
                {junjie.isOverridden && (
                  <span className="text-3xs font-bold uppercase bg-amber-100 text-black px-1.5 py-0.5 rounded border border-amber-300">
                    {language === 'zh' ? '已调班 / 请假' : 'Swapped / Leave'}
                  </span>
                )}
              </div>

              <div className="flex items-baseline gap-2.5">
                <span className="text-xl font-bold text-black">
                  {junjie.shift.name}
                </span>
              </div>

              {/* Show shift hours */}
              {junjie.shift.time ? (
                <div className="mt-1.5 flex items-center gap-1 text-sm font-normal text-black">
                  <span className="text-xs text-zinc-700">{language === 'zh' ? '工作时间:' : 'Shift hours:'}</span>
                  <span className="font-normal text-black">{junjie.shift.time}</span>
                </div>
              ) : (
                <div className="mt-1 text-xs text-zinc-700 font-normal">
                  {language === 'zh' ? '非工作时间 / 休息日' : 'No shift hours (Off/Rest day)'}
                </div>
              )}

              {junjie.overrideReason && (
                <div className="mt-2 p-2 bg-amber-50 rounded-lg text-xs text-amber-900 border border-amber-200">
                  <strong>{language === 'zh' ? '安排原因:' : 'Arrangement details:'}</strong> {junjie.overrideReason}
                </div>
              )}

              <div className="mt-2.5 pt-2 border-t border-black/15 flex justify-end">
                <button
                  onClick={() => onOpenOverrideModal(dateStr, 'junjie_shift')}
                  className="text-xs font-bold text-black hover:underline"
                >
                  {junjie.isOverridden
                    ? (language === 'zh' ? '修改调班' : 'Edit Shift Override')
                    : (language === 'zh' ? '⚡ 调班或请假' : '⚡ Swap Shift or Take Leave')}
                </button>
              </div>
            </div>

            {/* 4. Family Events */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-zinc-700 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Family Plans ({dayEvents.length})</span>
                </h4>
                <button
                  onClick={() => onOpenEventModal(dateStr)}
                  className="text-xs font-black text-rose-600 hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Plan</span>
                </button>
              </div>

              {dayEvents.length === 0 ? (
                <div className="p-3 rounded-xl border border-dashed border-zinc-200 text-center text-xs text-zinc-400">
                  No custom events scheduled for this day.
                </div>
              ) : (
                <div className="space-y-2">
                  {dayEvents.map((ev) => {
                    const member = familyMembers.find((m) => m.id === ev.memberId);
                    return (
                      <div
                        key={ev.id}
                        className="p-3 rounded-xl border border-zinc-200 bg-white shadow-2xs flex items-start justify-between gap-2"
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            {ev.category === 'holiday_plan' ? (
                              <Plane className="w-3.5 h-3.5 text-blue-600" />
                            ) : (
                              <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            )}
                            <h5 className="font-bold text-sm text-zinc-900">{ev.title}</h5>
                          </div>
                          {ev.time && (
                            <div className="text-xs text-zinc-500 mt-0.5">Time: {ev.time}</div>
                          )}
                          {member && (
                            <div className="text-xs font-medium text-zinc-600 mt-0.5">
                              For: {member.name}
                            </div>
                          )}
                          {ev.notes && (
                            <p className="text-xs text-zinc-600 mt-1 p-2 bg-zinc-50 rounded-lg border border-zinc-100">
                              {ev.notes}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => onOpenEventModal(dateStr, ev)}
                            className="p-1 rounded text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => deleteEvent(ev.id)}
                            className="p-1 rounded text-red-400 hover:text-red-700 hover:bg-red-50"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="p-3 sm:p-4 bg-zinc-50 border-t border-zinc-200 flex items-center gap-2 shrink-0">
          <button
            onClick={() => onOpenOverrideModal(dateStr)}
            className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Unusual Arrangement</span>
          </button>
          <button
            onClick={() => onOpenEventModal(dateStr)}
            className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-rose-600 hover:bg-rose-700 text-white transition-colors flex items-center justify-center gap-1.5 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Plan</span>
          </button>
        </div>
      </div>
    </div>
  );
};
