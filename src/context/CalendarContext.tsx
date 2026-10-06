import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import {
  CalendarEvent,
  DayOverride,
  FamilyMember,
  CalendarAppSettings,
  AppSyncState,
  ShiftRosterWeek,
} from '../types';
import { DEFAULT_GRANDMA_ANCHOR, DEFAULT_ROSTER_WEEKS, formatISODate } from '../data/schedule';
import { INITIAL_SEED_EVENTS, INITIAL_FAMILY_MEMBERS, INITIAL_SETTINGS } from '../data/initialData';
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

const STORAGE_KEYS = {
  EVENTS: 'ahma_events_v2',
  OVERRIDES: 'ahma_overrides_v2',
  MEMBERS: 'ahma_members_v2',
  SETTINGS: 'ahma_settings_v2',
  LANG: 'ahma_calendar_lang',
};

const CalendarContext = createContext<CalendarContextValue | null>(null);

export function CalendarProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.LANG);
      return saved === 'zh' || saved === 'en' ? saved : 'en';
    } catch {
      return 'en';
    }
  });

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang);
    try {
      localStorage.setItem(STORAGE_KEYS.LANG, lang);
    } catch {}
  };

  // Safe localStorage loader helpers
  const [events, setEvents] = useState<CalendarEvent[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.EVENTS);
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_SEED_EVENTS;
  });

  const [overrides, setOverrides] = useState<DayOverride[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.OVERRIDES);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.MEMBERS);
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_FAMILY_MEMBERS;
  });

  const [settings, setSettings] = useState<CalendarAppSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_SETTINGS;
  });

  // Always default current date and selected date to the current date (today)
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string>(() => formatISODate(new Date()));

  const [viewMode, setViewMode] = useState<'month' | 'week' | 'agenda' | 'shift_matrix'>('month');
  const [filterMemberId, setFilterMemberId] = useState<string>('all');
  const [showHolidays, setShowHolidays] = useState(true);
  const [showGrandma, setShowGrandma] = useState(true);
  const [showJunjie, setShowJunjie] = useState(true);
  const [showSchoolHolidays, setShowSchoolHolidays] = useState(true);

  // Sync state & devices
  const [syncStatus, setSyncStatus] = useState<'connected' | 'connecting' | 'disconnected' | 'syncing'>('connected');
  const [connectedDevices, setConnectedDevices] = useState(1);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(new Date());

  const socketRef = useRef<WebSocket | null>(null);

  // Persist to localStorage whenever state changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));
    } catch {}
  }, [events]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.OVERRIDES, JSON.stringify(overrides));
    } catch {}
  }, [overrides]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(familyMembers));
    } catch {}
  }, [familyMembers]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch {}
  }, [settings]);

  // Optional backend sync: if running with Node server, sync; if serverless (Vercel), graceful fallback
  const fetchState = useCallback(async () => {
    try {
      const res = await fetch('/api/state');
      if (res.ok) {
        const data: AppSyncState = await res.json();
        if (data.events) setEvents(data.events);
        if (data.overrides) setOverrides(data.overrides);
        if (data.familyMembers) setFamilyMembers(data.familyMembers);
        if (data.settings) setSettings(data.settings);
        setLastSyncTime(new Date());
        setSyncStatus('connected');
      }
    } catch {
      // In serverless / offline environment, localStorage provides persistence
    }
  }, []);

  useEffect(() => {
    fetchState();

    // Check if WebSocket is available (optional live real-time when running server.ts)
    let isMounted = true;
    let ws: WebSocket | null = null;
    let reconnectTimer: NodeJS.Timeout;

    // Only attempt WS if protocol and host are typical full-stack environment
    const isVercelOrStatic = window.location.hostname.includes('vercel.app') || window.location.hostname.includes('github.io');

    if (!isVercelOrStatic) {
      function connect() {
        if (!isMounted) return;
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
                  if (payload.events) setEvents(payload.events);
                  if (payload.overrides) setOverrides(payload.overrides);
                  if (payload.familyMembers) setFamilyMembers(payload.familyMembers);
                  if (payload.settings) setSettings(payload.settings);
                  setLastSyncTime(new Date());
                }
              } else if (data.type === 'PONG') {
                if (data.clients) setConnectedDevices(data.clients);
              }
            } catch (err) {
              console.error('WS parse error:', err);
            }
          };

          ws.onclose = () => {
            if (!isMounted) return;
            reconnectTimer = setTimeout(connect, 5000);
          };

          ws.onerror = () => {
            if (!isMounted) return;
          };
        } catch {
          // Ignore
        }
      }

      connect();
    } else {
      setSyncStatus('connected');
    }

    return () => {
      isMounted = false;
      clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, [fetchState]);

  // Actions with local-first instant update and optimistic server call
  const addOrUpdateEvent = useCallback(async (event: Partial<CalendarEvent>) => {
    const newId = event.id || `ev-${Date.now()}`;
    const fullEvent: CalendarEvent = {
      id: newId,
      title: event.title || 'Family Event',
      startDate: event.startDate || formatISODate(new Date()),
      endDate: event.endDate,
      category: event.category || 'family_gathering',
      memberId: event.memberId || 'all',
      time: event.time,
      location: event.location,
      notes: event.notes,
      createdAt: event.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setEvents((prev) => {
      const idx = prev.findIndex((e) => e.id === fullEvent.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = fullEvent;
        return copy;
      }
      return [...prev, fullEvent];
    });
    setLastSyncTime(new Date());

    try {
      await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullEvent),
      });
    } catch {}
  }, []);

  const deleteEvent = useCallback(async (id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
    setLastSyncTime(new Date());

    try {
      await fetch(`/api/events/${id}`, { method: 'DELETE' });
    } catch {}
  }, []);

  const addOrUpdateOverride = useCallback(async (override: Partial<DayOverride>) => {
    const newId = override.id || `ov-${Date.now()}`;
    const fullOverride: DayOverride = {
      id: newId,
      date: override.date || formatISODate(new Date()),
      type: override.type || 'grandma_location',
      value: override.value || 'KC',
      customName: override.customName,
      customTime: override.customTime,
      reason: override.reason,
      createdAt: override.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setOverrides((prev) => {
      const filtered = prev.filter(
        (o) => !(o.id === fullOverride.id || (o.date === fullOverride.date && o.type === fullOverride.type))
      );
      return [...filtered, fullOverride];
    });
    setLastSyncTime(new Date());

    try {
      await fetch('/api/overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullOverride),
      });
    } catch {}
  }, []);

  const deleteOverride = useCallback(async (id: string) => {
    setOverrides((prev) => prev.filter((o) => o.id !== id));
    setLastSyncTime(new Date());

    try {
      await fetch(`/api/overrides/${id}`, { method: 'DELETE' });
    } catch {}
  }, []);

  const addFamilyMember = useCallback(async (member: Partial<FamilyMember>) => {
    const newMember: FamilyMember = {
      id: member.id || `mem-${Date.now()}`,
      name: member.name || 'Member',
      relationship: member.relationship || 'Family',
      color: member.color || '#3b82f6',
    };

    setFamilyMembers((prev) => [...prev, newMember]);
    setLastSyncTime(new Date());

    try {
      await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMember),
      });
    } catch {}
  }, []);

  const deleteFamilyMember = useCallback(async (id: string) => {
    setFamilyMembers((prev) => prev.filter((m) => m.id !== id));
    setLastSyncTime(new Date());

    try {
      await fetch(`/api/members/${id}`, { method: 'DELETE' });
    } catch {}
  }, []);

  const updateSettings = useCallback(async (newSettings: Partial<CalendarAppSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
    setLastSyncTime(new Date());

    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });
    } catch {}
  }, []);

  const rosterWeeks = settings.junjieRosterWeeks || DEFAULT_ROSTER_WEEKS;

  const updateRosterWeeks = useCallback(async (newWeeks: ShiftRosterWeek[]) => {
    await updateSettings({
      junjieRosterWeeks: newWeeks,
      junjieCycleWeeks: newWeeks.length,
    });
  }, [updateSettings]);

  const resetToDefaults = useCallback(async () => {
    setEvents(INITIAL_SEED_EVENTS);
    setOverrides([]);
    setFamilyMembers(INITIAL_FAMILY_MEMBERS);
    setSettings(INITIAL_SETTINGS);
    setLastSyncTime(new Date());

    try {
      localStorage.removeItem(STORAGE_KEYS.EVENTS);
      localStorage.removeItem(STORAGE_KEYS.OVERRIDES);
      localStorage.removeItem(STORAGE_KEYS.MEMBERS);
      localStorage.removeItem(STORAGE_KEYS.SETTINGS);
      await fetch('/api/reset', { method: 'POST' });
    } catch {}
  }, []);

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
