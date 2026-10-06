import React from 'react';
import { useCalendar } from '../context/CalendarContext';
import { translations } from '../data/i18n';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  SlidersHorizontal,
  WifiOff,
  RefreshCw,
  Sparkles,
  Users,
  Heart,
  Bot,
  Globe,
} from 'lucide-react';

interface HeaderProps {
  onOpenEventModal: (date?: string) => void;
  onOpenOverrideModal: (date?: string) => void;
  onOpenSettingsModal: () => void;
  onOpenChatbotModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenEventModal,
  onOpenOverrideModal,
  onOpenSettingsModal,
  onOpenChatbotModal,
}) => {
  const {
    currentDate,
    setCurrentDate,
    selectedDate,
    setSelectedDate,
    viewMode,
    setViewMode,
    syncStatus,
    connectedDevices,
    showHolidays,
    setShowHolidays,
    showGrandma,
    setShowGrandma,
    showJunjie,
    setShowJunjie,
    filterMemberId,
    setFilterMemberId,
    familyMembers,
    language,
    setLanguage,
  } = useCalendar();

  const t = translations[language];

  const handlePrev = () => {
    const next = new Date(currentDate);
    if (viewMode === 'week') {
      next.setDate(next.getDate() - 7);
    } else {
      next.setMonth(next.getMonth() - 1);
    }
    setCurrentDate(next);
  };

  const handleNext = () => {
    const next = new Date(currentDate);
    if (viewMode === 'week') {
      next.setDate(next.getDate() + 7);
    } else {
      next.setMonth(next.getMonth() + 1);
    }
    setCurrentDate(next);
  };

  const handleJumpToDate = (targetDateStr: string) => {
    const [y, m, d] = targetDateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    setCurrentDate(date);
    setSelectedDate(targetDateStr);
  };

  const handleToday = () => {
    const now = new Date();
    setCurrentDate(now);
    const iso = now.toISOString().split('T')[0];
    setSelectedDate(iso);
  };

  return (
    <header className="bg-white border-b-2 border-zinc-200 sticky top-0 z-30 shadow-xs">
      {/* Top Banner */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3">
        <div className="flex items-center justify-between gap-2">
          {/* Logo & Title */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-rose-500 via-red-500 to-amber-500 flex items-center justify-center text-white shadow-sm ring-2 ring-rose-200 shrink-0">
              <Heart className="w-5 h-5 fill-current" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h1 className="text-base sm:text-xl font-black text-zinc-950 tracking-tight truncate">
                  {t.appName}
                </h1>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-3xs sm:text-xs font-black bg-rose-100 text-rose-900 border border-rose-300 shrink-0">
                  {t.sgBadge}
                </span>
              </div>
              <p className="text-3xs sm:text-xs text-zinc-600 font-semibold truncate hidden sm:block">
                {t.appSubtitle}
              </p>
            </div>
          </div>

          {/* Sync Status Badge, Language Switcher & Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Language Switcher Button (EN | 中文) */}
            <div className="flex items-center bg-zinc-100 border border-zinc-300 p-0.5 rounded-lg text-xs font-black">
              <button
                onClick={() => setLanguage('en')}
                className={`px-2 py-0.5 rounded-md transition-all ${
                  language === 'en'
                    ? 'bg-zinc-950 text-white shadow-2xs'
                    : 'text-zinc-600 hover:text-zinc-950'
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLanguage('zh')}
                className={`px-2 py-0.5 rounded-md transition-all ${
                  language === 'zh'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'text-zinc-600 hover:text-zinc-950'
                }`}
              >
                中文
              </button>
            </div>

            {/* Chatbot Launcher Button */}
            <button
              onClick={onOpenChatbotModal}
              className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-black bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 transition-colors shadow-2xs"
              title="Open Ahma's Assistant Chatbot"
            >
              <Bot className="w-4 h-4 text-rose-600" />
              <span className="hidden xs:inline">
                {language === 'zh' ? '小助手' : 'AI Assistant'}
              </span>
            </button>

            {/* Live Sync Badge */}
            <div className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-full text-3xs sm:text-xs font-bold border bg-zinc-50 border-zinc-300 text-zinc-800">
              {syncStatus === 'connected' ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
                  </span>
                  <span className="font-extrabold text-emerald-800">{t.live}</span>
                  <span className="text-zinc-400 hidden xs:inline">|</span>
                  <span className="text-zinc-700 hidden xs:inline">{connectedDevices} dev</span>
                </>
              ) : syncStatus === 'syncing' ? (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin text-blue-500" />
                  <span className="text-blue-700">{t.syncing}</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-amber-500" />
                  <span className="text-amber-700">{t.offline}</span>
                </>
              )}
            </div>

            {/* Desktop Quick Actions */}
            <div className="hidden sm:flex items-center gap-2">
              <button
                onClick={() => onOpenOverrideModal(selectedDate)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 transition-colors shadow-2xs"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                <span>{t.unusualArrangement}</span>
              </button>

              <button
                onClick={() => onOpenEventModal(selectedDate)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t.addPlan}</span>
              </button>
            </div>

            {/* Settings button */}
            <button
              onClick={onOpenSettingsModal}
              className="p-1.5 rounded-lg text-zinc-700 hover:text-zinc-950 hover:bg-zinc-100 border border-zinc-300 transition-colors"
              title={t.settings}
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Anchor Shortcuts & Filter Toggles */}
        <div className="mt-2 pt-2 border-t border-zinc-100 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar text-xs">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-zinc-500 text-2xs font-bold uppercase mr-0.5 hidden xs:inline">{t.jump}</span>
            <button
              onClick={() => handleJumpToDate('2026-02-16')}
              className={`px-2 py-0.5 rounded-md text-2xs sm:text-xs font-bold transition-all shrink-0 ${
                selectedDate === '2026-02-16' || selectedDate === '2026-02-17' || selectedDate === '2026-02-18'
                  ? 'bg-rose-700 text-white shadow-xs'
                  : 'bg-rose-50 text-rose-900 hover:bg-rose-100 border border-rose-300'
              }`}
              title="2026 CNY Eve - Day 2: Kay Guan (启源)"
            >
              🧧 2026 CNY ({language === 'zh' ? '启源' : 'KG'})
            </button>
            <button
              onClick={() => handleJumpToDate('2026-05-07')}
              className={`px-2 py-0.5 rounded-md text-2xs sm:text-xs font-bold transition-all shrink-0 ${
                selectedDate === '2026-05-07'
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'bg-teal-50 text-teal-900 hover:bg-teal-100 border border-teal-300'
              }`}
            >
              👵 7 May 2026 ({language === 'zh' ? '启超' : 'KC'})
            </button>
            <button
              onClick={() => handleJumpToDate('2026-06-15')}
              className={`px-2 py-0.5 rounded-md text-2xs sm:text-xs font-bold transition-all shrink-0 ${
                selectedDate === '2026-06-15'
                  ? 'bg-purple-700 text-white shadow-xs'
                  : 'bg-purple-50 text-purple-900 hover:bg-purple-100 border border-purple-300'
              }`}
            >
              💼 15 Jun 2026 (W1 Start)
            </button>
            <button
              onClick={handleToday}
              className="px-2 py-0.5 rounded-md text-2xs sm:text-xs font-bold bg-zinc-100 text-zinc-800 hover:bg-zinc-200 border border-zinc-300 shrink-0"
            >
              📅 {t.today}
            </button>
          </div>

          {/* Layer toggles */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setShowHolidays(!showHolidays)}
              className={`px-2 py-0.5 rounded-md text-2xs font-black transition-colors shrink-0 ${
                showHolidays
                  ? 'bg-rose-100 text-rose-950 border border-rose-300'
                  : 'bg-zinc-100 text-zinc-400 line-through'
              }`}
            >
              {t.holidays}
            </button>
            <button
              onClick={() => setShowGrandma(!showGrandma)}
              className={`px-2 py-0.5 rounded-md text-2xs font-black transition-colors shrink-0 ${
                showGrandma
                  ? 'bg-teal-100 text-teal-950 border border-teal-400'
                  : 'bg-zinc-100 text-zinc-400 line-through'
              }`}
            >
              {t.ahma}
            </button>
            <button
              onClick={() => setShowJunjie(!showJunjie)}
              className={`px-2 py-0.5 rounded-md text-2xs font-black transition-colors shrink-0 ${
                showJunjie
                  ? 'bg-purple-100 text-purple-950 border border-purple-300'
                  : 'bg-zinc-100 text-zinc-400 line-through'
              }`}
            >
              {t.junjie}
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Bar */}
      <div className="bg-zinc-50 border-t-2 border-zinc-200 px-3 sm:px-6 lg:px-8 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          {/* Month/Year Nav */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-white rounded-lg border-2 border-zinc-300 shadow-2xs p-0.5">
              <button
                onClick={handlePrev}
                className="p-1 sm:p-1.5 rounded-md text-zinc-700 hover:text-zinc-950 hover:bg-zinc-100 transition-colors"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={handleNext}
                className="p-1 sm:p-1.5 rounded-md text-zinc-700 hover:text-zinc-950 hover:bg-zinc-100 transition-colors"
                aria-label="Next month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="text-sm sm:text-base font-black text-zinc-950">
              {t.months[currentDate.getMonth()]} {currentDate.getFullYear()}
            </div>
          </div>

          {/* Family Member Filter */}
          <div className="hidden md:flex items-center gap-1.5">
            <Users className="w-4 h-4 text-zinc-500" />
            <select
              value={filterMemberId}
              onChange={(e) => setFilterMemberId(e.target.value)}
              className="text-xs bg-white border-2 border-zinc-300 rounded-lg px-2.5 py-1 text-zinc-800 font-bold focus:outline-rose-500 shadow-2xs"
            >
              <option value="all">{t.allFamily}</option>
              {familyMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.relationship})
                </option>
              ))}
            </select>
          </div>

          {/* Desktop View Mode Switcher */}
          <div className="hidden sm:flex items-center bg-zinc-200 p-0.5 rounded-lg text-xs font-black">
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1 rounded-md transition-all ${
                viewMode === 'month'
                  ? 'bg-white text-zinc-950 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-950'
              }`}
            >
              {t.monthView}
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1 rounded-md transition-all ${
                viewMode === 'week'
                  ? 'bg-white text-zinc-950 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-950'
              }`}
            >
              {t.weekView}
            </button>
            <button
              onClick={() => setViewMode('shift_matrix')}
              className={`px-3 py-1 rounded-md transition-all ${
                viewMode === 'shift_matrix'
                  ? 'bg-white text-purple-950 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-950'
              }`}
            >
              {t.shiftTable}
            </button>
            <button
              onClick={() => setViewMode('agenda')}
              className={`px-3 py-1 rounded-md transition-all ${
                viewMode === 'agenda'
                  ? 'bg-white text-zinc-950 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-950'
              }`}
            >
              {t.agenda}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
