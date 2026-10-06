import React, { useState } from 'react';
import { CalendarProvider, useCalendar } from './context/CalendarContext';
import { Header } from './components/Header';
import { SummaryCards } from './components/SummaryCards';
import { MonthView } from './components/MonthView';
import { WeekView } from './components/WeekView';
import { ShiftMatrixView } from './components/ShiftMatrixView';
import { AgendaView } from './components/AgendaView';
import { EventModal } from './components/EventModal';
import { OverrideModal } from './components/OverrideModal';
import { SettingsModal } from './components/SettingsModal';
import { DayDetailDrawer } from './components/DayDetailDrawer';
import { ChatbotModal } from './components/ChatbotModal';
import { CalendarEvent } from './types';
import { translations } from './data/i18n';
import { Calendar, Clock, List, LayoutGrid, Plus, Bot, Heart } from 'lucide-react';

function CalendarApp() {
  const { viewMode, setViewMode, selectedDate, setSelectedDate, language } = useCalendar();
  const t = translations[language];

  // Modals state
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [eventTargetDate, setEventTargetDate] = useState<string>(selectedDate);

  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [overrideTargetDate, setOverrideTargetDate] = useState<string>(selectedDate);
  const [overrideInitialTab, setOverrideInitialTab] = useState<'grandma_location' | 'junjie_shift'>('grandma_location');

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isChatbotModalOpen, setIsChatbotModalOpen] = useState(false);

  // Handlers
  const handleOpenEventModal = (dateStr?: string, event?: CalendarEvent) => {
    setEventTargetDate(dateStr || selectedDate);
    setEditingEvent(event || null);
    setIsEventModalOpen(true);
  };

  const handleOpenOverrideModal = (
    dateStr?: string,
    initialTab: 'grandma_location' | 'junjie_shift' = 'grandma_location'
  ) => {
    setOverrideTargetDate(dateStr || selectedDate);
    setOverrideInitialTab(initialTab);
    setIsOverrideModalOpen(true);
  };

  const handleSelectDate = (dateStr: string) => {
    setSelectedDate(dateStr);
    setIsDrawerOpen(true);
  };

  return (
    <div className="min-h-screen bg-zinc-100/70 text-zinc-900 flex flex-col font-sans selection:bg-rose-500 selection:text-white pb-16 sm:pb-0">
      {/* Top Header */}
      <Header
        onOpenEventModal={handleOpenEventModal}
        onOpenOverrideModal={handleOpenOverrideModal}
        onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
        onOpenChatbotModal={() => setIsChatbotModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {/* Top Summary: AHMA's current rotation only */}
        <SummaryCards />

        {/* Dynamic View rendering */}
        {viewMode === 'month' && (
          <MonthView
            onSelectDate={handleSelectDate}
            onOpenEventModal={handleOpenEventModal}
            onOpenOverrideModal={handleOpenOverrideModal}
          />
        )}

        {viewMode === 'week' && (
          <WeekView
            onSelectDate={handleSelectDate}
            onOpenEventModal={handleOpenEventModal}
            onOpenOverrideModal={handleOpenOverrideModal}
          />
        )}

        {viewMode === 'shift_matrix' && (
          <ShiftMatrixView
            onOpenOverrideModal={handleOpenOverrideModal}
          />
        )}

        {viewMode === 'agenda' && (
          <AgendaView
            onSelectDate={handleSelectDate}
            onOpenEventModal={handleOpenEventModal}
            onOpenOverrideModal={handleOpenOverrideModal}
          />
        )}
      </main>

      {/* Floating Chatbot Assistant Button (Desktop) */}
      <button
        onClick={() => setIsChatbotModalOpen(true)}
        className="hidden sm:flex fixed bottom-6 right-6 z-40 p-3.5 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all items-center gap-2 font-black text-xs hover:scale-105 border-2 border-white"
        title="Open Ahma's Assistant Chatbot"
      >
        <Bot className="w-5 h-5" />
        <span>{language === 'zh' ? '阿嬷小助手' : "Ahma's Assistant"}</span>
      </button>

      {/* Mobile Sticky Bottom Navigation Bar */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t-2 border-zinc-200 px-3 py-1.5 flex items-center justify-around shadow-lg">
        <button
          onClick={() => setViewMode('month')}
          className={`flex flex-col items-center py-1 px-2 rounded-lg text-3xs font-black transition-colors ${
            viewMode === 'month' ? 'text-rose-600' : 'text-zinc-500 hover:text-zinc-800'
          }`}
        >
          <Calendar className="w-4 h-4 mb-0.5" />
          <span>{t.monthView}</span>
        </button>

        <button
          onClick={() => setViewMode('week')}
          className={`flex flex-col items-center py-1 px-2 rounded-lg text-3xs font-black transition-colors ${
            viewMode === 'week' ? 'text-rose-600' : 'text-zinc-500 hover:text-zinc-800'
          }`}
        >
          <LayoutGrid className="w-4 h-4 mb-0.5" />
          <span>{t.weekView}</span>
        </button>

        {/* Central Floating Button for AI Assistant or Plan */}
        <button
          onClick={() => setIsChatbotModalOpen(true)}
          className="w-11 h-11 rounded-full bg-gradient-to-r from-rose-600 to-amber-600 text-white flex items-center justify-center shadow-md active:scale-95 transition-transform -mt-5 border-2 border-white"
          title="Open AI Chatbot"
        >
          <Bot className="w-5 h-5" />
        </button>

        <button
          onClick={() => setViewMode('shift_matrix')}
          className={`flex flex-col items-center py-1 px-2 rounded-lg text-3xs font-black transition-colors ${
            viewMode === 'shift_matrix' ? 'text-purple-600' : 'text-zinc-500 hover:text-zinc-800'
          }`}
        >
          <Clock className="w-4 h-4 mb-0.5" />
          <span>{t.shiftTable}</span>
        </button>

        <button
          onClick={() => setViewMode('agenda')}
          className={`flex flex-col items-center py-1 px-2 rounded-lg text-3xs font-black transition-colors ${
            viewMode === 'agenda' ? 'text-rose-600' : 'text-zinc-500 hover:text-zinc-800'
          }`}
        >
          <List className="w-4 h-4 mb-0.5" />
          <span>{t.agenda}</span>
        </button>
      </div>

      {/* Modals & Drawers */}
      <ChatbotModal
        isOpen={isChatbotModalOpen}
        onClose={() => setIsChatbotModalOpen(false)}
      />

      <EventModal
        isOpen={isEventModalOpen}
        onClose={() => setIsEventModalOpen(false)}
        targetDate={eventTargetDate}
        editingEvent={editingEvent}
      />

      <OverrideModal
        isOpen={isOverrideModalOpen}
        onClose={() => setIsOverrideModalOpen(false)}
        targetDate={overrideTargetDate}
        initialTab={overrideInitialTab}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
      />

      <DayDetailDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        dateStr={selectedDate}
        onOpenEventModal={handleOpenEventModal}
        onOpenOverrideModal={handleOpenOverrideModal}
      />

      {/* Footer */}
      <footer className="border-t border-zinc-200 bg-white py-4 text-center text-xs text-zinc-500 hidden sm:block">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 font-bold">
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-current" />
            <span className="text-zinc-900">{t.appName}</span>
            <span>• 🇸🇬 Singapore</span>
          </div>
          <div className="text-zinc-500 font-medium">
            {language === 'zh'
              ? '启超 (KC) > 启源 (KG) > 启文 (KB) 轮流 • 俊杰轮班表'
              : 'Kay Cheow (KC) > Kay Guan (KG) > Kay Boon (KB) • Jun Jie Shift Schedule'}
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <CalendarProvider>
      <CalendarApp />
    </CalendarProvider>
  );
}
