import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import {
  CalendarEvent,
  DayOverride,
  FamilyMember,
  CalendarAppSettings,
  AppSyncState,
  ShiftRosterWeek,
} from '../types';
import { DEFAULT_GRANDMA_ANCHOR, DEFAULT_JUNJIE_ANCHOR, DEFAULT_ROSTER_WEEKS } from '../data/schedule';
import { Language } from '../data/i18n';

interface CalendarContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  events: CalendarEvent[];
  overrides: DayOverride[];
  familyMembers: FamilyMember[];
  settings: CalendarAppSettings;
  rosterWeeks: ShiftRosterWeek[];
  updateRosterWeeks: (weeks: ShiftRosterWeek[]) => Promise<void>;
  syncStatus: 'connected' | 'connecting' | 'disconnected' | 'syncing';
  connectedDevices: number;
  lastSyncTime: Date | null;
  currentDate: Date;
  selectedDate: string; // YYYY-MM-DD
  viewMode: 'month' | 'week' | 'agenda' | 'shift_matrix';
  filterMemberId: string;
  showHolidays: boolean;
  showGrandma: boolean;
  showJunjie: boolean;
  showSchoolHolidays: boolean;

  // Setters
  setCurrentDate: (date: Date) => void;
  setSelectedDate: (dateStr: string) => void;
  setViewMode: (mode: 'month' | 'week' | 'agenda' | 'shift_matrix') => void;
  setFilterMemberId: (id: string) => void;
  setShowHolidays: (val: boolean) => void;
  setShowGrandma: (val: boolean) => void;
  setShowJunjie: (val: boolean) => void;
  setShowSchoolHolidays: (val: boolean) => void;

  // Actions
  addOrUpdateEvent: (event: Partial<CalendarEvent>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  addOrUpdateOverride: (override: Partial<DayOverride>) => Promise<void>;
  deleteOverride: (id: string) => Promise<void>;
  addFamilyMember: (member: Partial<FamilyMember>) => Promise<void>;
  deleteFamilyMember: (id: string) => Promise<void>;
  updateSettings: (newSettings: Partial<CalendarAppSettings>) => Promise<void>;
  resetToDefaults: () => Promise<void>;
}

const DEFAULT_SETTINGS: CalendarAppSettings = {
  grandmaAnchorDate: DEFAULT_GRANDMA_ANCHOR,
  grandmaCycleDays: 14,
  grandmaSequence: ['KC', 'KG', 'KB'],
  grandmaLocations: {
    KC: { name: 'Kay Cheow', notes: 'Kay Cheow (KC)' },
    KG: { name: 'Kay Guan', notes: 'Kay Guan (KG)' },
    KB: { name: 'Kay Boon', notes: 'Kay Boon (KB)' },
  },
  junjieAnchorDate: DEFAULT_JUNJIE_ANCHOR,
  junjieCycleWeeks: 3,
  junjieRosterWeeks: DEFAULT_ROSTER_WEEKS,
};

const CalendarContext = createContext<CalendarContextValue | null>(null);

export function CalendarProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('ahma_calendar_lang');
      return saved === 'zh' || saved === 'en' ? saved : 'en';
    } catch {
      return 'en';
    }
  });

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang);
    try {
      localStorage.setItem('ahma_calendar_lang', lang);
    } catch {}
  };

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [overrides, setOverrides] = useState<DayOverride[]>([]);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [settings, setSettings] = useState<CalendarAppSettings>(DEFAULT_SETTINGS);

  const [syncStatus, setSyncStatus] = useState<'connected' | 'connecting' | 'disconnected' | 'syncing'>('connecting');
  const [connectedDevices, setConnectedDevices] = useState(1);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  const [currentDate, setCurrentDate] = useState<Date>(() => new Date('2026-05-01T00:00:00'));
  const [selectedDate, setSelectedDate] = useState<string>('2026-05-07');
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'agenda' | 'shift_matrix'>('month');

  const [filterMemberId, setFilterMemberId] = useState<string>('all');
  const [showHolidays, setShowHolidays] = useState(true);
  const [showGrandma, setShowGrandma] = useState(true);
  const [showJunjie, setShowJunjie] = useState(true);
  const [showSchoolHolidays, setShowSchoolHolidays] = useState(true);

  const socketRef = useRef<WebSocket | null>(null);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch('/api/state');
      if (res.ok) {
        const data: AppSyncState = await res.json();
        setEvents(data.events || []);
        setOverrides(data.overrides || []);
        setFamilyMembers(data.familyMembers || []);
        if (data.settings) setSettings(data.settings);
        setLastSyncTime(new Date());
      }
    } catch (e) {
      console.warn('Initial state fetch error:', e);
    }
  }, []);

  useEffect(() => {
    fetchState();

    let isMounted = true;
    let ws: WebSocket | null = null;
    let reconnectTimer: NodeJS.Timeout;

    function connect() {
      if (!isMounted) return;
      setSyncStatus('connecting');

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      try {
        ws = new WebSocket(wsUrl);
        socketRef.current = ws;

        ws.onopen = () => {
          if (!isMounted) return;
          setSyncStatus('connected');
        };

        ws.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'INIT' || data.type === 'STATE_UPDATED') {
              const payload: AppSyncState = data.payload;
              if (payload) {
                setEvents(payload.events || []);
                setOverrides(payload.overrides || []);
                setFamilyMembers(payload.familyMembers || []);
                if (payload.settings) setSettings(payload.settings);
                setLastSyncTime(new Date());
              }
            } else if (data.type === 'PRESENCE') {
              setConnectedDevices(Math.max(1, data.count || 1));
            }
          } catch (err) {
            console.error('Error handling WS message:', err);
          }
        };

        ws.onclose = () => {
          if (!isMounted) return;
          setSyncStatus('disconnected');
          reconnectTimer = setTimeout(connect, 3000);
        };

        ws.onerror = () => {
          if (!isMounted) return;
          setSyncStatus('disconnected');
        };
      } catch (err) {
        console.warn('WS creation error:', err);
        setSyncStatus('disconnected');
        reconnectTimer = setTimeout(connect, 3000);
      }
    }

    connect();

    const pingInterval = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'PING' }));
      }
    }, 20000);

    return () => {
      isMounted = false;
      clearInterval(pingInterval);
      clearTimeout(reconnectTimer);
      if (ws) {
        ws.close();
      }
    };
  }, [fetchState]);

  const addOrUpdateEvent = useCallback(async (event: Partial<CalendarEvent>) => {
    setSyncStatus('syncing');
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      });
      if (res.ok) {
        const result = await res.json();
        setEvents((prev) => {
          const idx = prev.findIndex((e) => e.id === result.event.id);
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = result.event;
            return copy;
          }
          return [...prev, result.event];
        });
        setLastSyncTime(new Date());
      }
    } catch (err) {
      console.error('Failed to save event:', err);
    } finally {
      setSyncStatus('connected');
    }
  }, []);

  const deleteEvent = useCallback(async (id: string) => {
    setSyncStatus('syncing');
    try {
      const res = await fetch(`/api/events/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setEvents((prev) => prev.filter((e) => e.id !== id));
        setLastSyncTime(new Date());
      }
    } catch (err) {
      console.error('Failed to delete event:', err);
    } finally {
      setSyncStatus('connected');
    }
  }, []);

  const addOrUpdateOverride = useCallback(async (override: Partial<DayOverride>) => {
    setSyncStatus('syncing');
    try {
      const res = await fetch('/api/overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(override),
      });
      if (res.ok) {
        const result = await res.json();
        setOverrides((prev) => {
          const filtered = prev.filter(
            (o) => !(o.id === result.override.id || (o.date === result.override.date && o.type === result.override.type))
          );
          return [...filtered, result.override];
        });
        setLastSyncTime(new Date());
      }
    } catch (err) {
      console.error('Failed to save override:', err);
    } finally {
      setSyncStatus('connected');
    }
  }, []);

  const deleteOverride = useCallback(async (id: string) => {
    setSyncStatus('syncing');
    try {
      const res = await fetch(`/api/overrides/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setOverrides((prev) => prev.filter((o) => o.id !== id));
        setLastSyncTime(new Date());
      }
    } catch (err) {
      console.error('Failed to delete override:', err);
    } finally {
      setSyncStatus('connected');
    }
  }, []);

  const addFamilyMember = useCallback(async (member: Partial<FamilyMember>) => {
    setSyncStatus('syncing');
    try {
      const res = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(member),
      });
      if (res.ok) {
        const result = await res.json();
        setFamilyMembers((prev) => {
          const idx = prev.findIndex((m) => m.id === result.member.id);
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = result.member;
            return copy;
          }
          return [...prev, result.member];
        });
        setLastSyncTime(new Date());
      }
    } catch (err) {
      console.error('Failed to save member:', err);
    } finally {
      setSyncStatus('connected');
    }
  }, []);

  const deleteFamilyMember = useCallback(async (id: string) => {
    setSyncStatus('syncing');
    try {
      const res = await fetch(`/api/members/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setFamilyMembers((prev) => prev.filter((m) => m.id !== id));
        setLastSyncTime(new Date());
      }
    } catch (err) {
      console.error('Failed to delete member:', err);
    } finally {
      setSyncStatus('connected');
    }
  }, []);

  const updateSettings = useCallback(async (newSettings: Partial<CalendarAppSettings>) => {
    setSyncStatus('syncing');
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });
      if (res.ok) {
        setSettings((prev) => ({ ...prev, ...newSettings }));
        setLastSyncTime(new Date());
      }
    } catch (err) {
      console.error('Failed to update settings:', err);
    } finally {
      setSyncStatus('connected');
    }
  }, []);

  const rosterWeeks = settings.junjieRosterWeeks || DEFAULT_ROSTER_WEEKS;

  const updateRosterWeeks = useCallback(async (newWeeks: ShiftRosterWeek[]) => {
    await updateSettings({
      junjieRosterWeeks: newWeeks,
      junjieCycleWeeks: newWeeks.length,
    });
  }, [updateSettings]);

  const resetToDefaults = useCallback(async () => {
    setSyncStatus('syncing');
    try {
      const res = await fetch('/api/reset', { method: 'POST' });
      if (res.ok) {
        await fetchState();
      }
    } catch (err) {
      console.error('Failed to reset:', err);
    } finally {
      setSyncStatus('connected');
    }
  }, [fetchState]);

  return (
    <CalendarContext.Provider
      value={{
        language,
        setLanguage: handleSetLanguage,
        events,
        overrides,
        familyMembers,
        settings,
        rosterWeeks,
        updateRosterWeeks,
        syncStatus,
        connectedDevices,
        lastSyncTime,
        currentDate,
        selectedDate,
        viewMode,
        filterMemberId,
        showHolidays,
        showGrandma,
        showJunjie,
        showSchoolHolidays,
        setCurrentDate,
        setSelectedDate,
        setViewMode,
        setFilterMemberId,
        setShowHolidays,
        setShowGrandma,
        setShowJunjie,
        setShowSchoolHolidays,
        addOrUpdateEvent,
        deleteEvent,
        addOrUpdateOverride,
        deleteOverride,
        addFamilyMember,
        deleteFamilyMember,
        updateSettings,
        resetToDefaults,
      }}
    >
      {children}
    </CalendarContext.Provider>
  );
}

export function useCalendar() {
  const context = useContext(CalendarContext);
  if (!context) {
    throw new Error('useCalendar must be used within a CalendarProvider');
  }
  return context;
}
