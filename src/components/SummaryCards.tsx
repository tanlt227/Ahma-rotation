import React from 'react';
import { useCalendar } from '../context/CalendarContext';
import { getGrandmaLocation, getAhmaLocationName } from '../data/schedule';
import { translations } from '../data/i18n';
import { Heart, ArrowRight } from 'lucide-react';

export const SummaryCards: React.FC = () => {
  const { selectedDate, overrides, settings, language } = useCalendar();
  const t = translations[language];

  // Selected date info for Ahma
  const grandmaInfo = getGrandmaLocation(
    selectedDate,
    settings.grandmaAnchorDate,
    overrides,
    settings.grandmaCycleDays
  );

  const getAhmaDisplayName = (code: string) => {
    const name = getAhmaLocationName(code, language);
    return `${name} (${code})`;
  };

  const currentLocationName = getAhmaDisplayName(grandmaInfo.locationCode);
  const nextLocationName = getAhmaDisplayName(grandmaInfo.nextLocationCode);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-3 pb-1">
      {/* AHMA's Current Rotation Card */}
      <div className="bg-white rounded-2xl border-2 border-teal-200 p-4 sm:p-5 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-teal-50 rounded-bl-full -z-0 opacity-70" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Heart className="w-6 h-6 fill-current" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-teal-800">
                  {t.ahmaCurrentRotation}
                </span>
                {grandmaInfo.isOverridden ? (
                  <span className="text-3xs font-extrabold uppercase bg-amber-100 text-amber-900 px-2 py-0.5 rounded border border-amber-300">
                    {language === 'zh' ? '特殊安排' : 'Special Arrangement'}
                  </span>
                ) : (
                  <span className="text-xs font-black bg-teal-100 text-teal-950 px-2.5 py-0.5 rounded-full border border-teal-300">
                    {language === 'zh'
                      ? `第 ${grandmaInfo.dayInCurrentStay} / ${grandmaInfo.stayDuration} 天`
                      : `Day ${grandmaInfo.dayInCurrentStay} of ${grandmaInfo.stayDuration}`}
                  </span>
                )}
              </div>

              <div className="mt-1 flex items-baseline gap-2.5">
                <h2 className="text-2xl sm:text-3xl font-black text-teal-950 tracking-tight">
                  {currentLocationName}
                </h2>
              </div>

              {/* Stay Period */}
              <div className="mt-1 text-xs font-semibold text-teal-900 flex items-center gap-1.5">
                <span className="text-zinc-500 font-medium">{t.stayPeriod}</span>
                <span className="bg-teal-50 px-2 py-0.5 rounded border border-teal-200 text-teal-950 font-bold">
                  {grandmaInfo.formattedStayRange}
                </span>
              </div>

              {grandmaInfo.overrideReason && (
                <div className="mt-2 p-2 bg-amber-50 rounded-lg text-xs text-amber-900 border border-amber-200">
                  <strong>{language === 'zh' ? '安排原因:' : 'Note:'}</strong> {grandmaInfo.overrideReason}
                </div>
              )}
            </div>
          </div>

          {!grandmaInfo.isOverridden && (
            <div className="sm:border-l sm:border-zinc-200 sm:pl-6 text-xs text-zinc-700 shrink-0">
              <span className="text-zinc-500 font-medium block mb-0.5">{t.nextRotation}</span>
              <div className="font-black text-sm text-teal-950 flex items-center gap-1.5">
                <span>{nextLocationName}</span>
                <ArrowRight className="w-4 h-4 text-teal-600" />
                <span className="text-zinc-600 font-bold bg-zinc-100 px-2 py-0.5 rounded">
                  {grandmaInfo.nextMoveDate}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
