import React, { useState, useEffect } from 'react';
import { useCalendar } from '../context/CalendarContext';
import { SHIFT_DEFINITIONS, getGrandmaLocation, getScheduledJunjieShift, getAhmaLocationName } from '../data/schedule';
import { ShiftCode } from '../types';
import { X, Sparkles, MapPin, Clock, Trash2, CheckCircle2 } from 'lucide-react';

interface OverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetDate: string;
  initialTab?: 'grandma_location' | 'junjie_shift';
}

export const OverrideModal: React.FC<OverrideModalProps> = ({
  isOpen,
  onClose,
  targetDate,
  initialTab = 'grandma_location',
}) => {
  const { overrides, addOrUpdateOverride, deleteOverride, settings, language } = useCalendar();

  const [activeTab, setActiveTab] = useState<'grandma_location' | 'junjie_shift'>(initialTab);
  const [date, setDate] = useState(targetDate);

  // Grandma form state
  const [grandmaLocation, setGrandmaLocation] = useState('KG');
  const [grandmaReason, setGrandmaReason] = useState('');

  // Jun Jie form state
  const [shiftCode, setShiftCode] = useState<ShiftCode>('OFF');
  const [shiftName, setShiftName] = useState('OFF Day');
  const [shiftTime, setShiftTime] = useState('');
  const [shiftReason, setShiftReason] = useState('');
  const [shiftColor, setShiftColor] = useState('bg-amber-100');

  useEffect(() => {
    setDate(targetDate);
    setActiveTab(initialTab);
  }, [targetDate, initialTab]);

  // Load existing override for this date if present
  const existingGrandmaOvr = overrides.find(
    (o) => o.date === date && o.type === 'grandma_location'
  );
  const existingJunjieOvr = overrides.find(
    (o) => o.date === date && o.type === 'junjie_shift'
  );

  useEffect(() => {
    if (existingGrandmaOvr) {
      setGrandmaLocation(existingGrandmaOvr.grandmaLocation || 'KC');
      setGrandmaReason(existingGrandmaOvr.grandmaReason || '');
    } else {
      // Default to next location or KC
      setGrandmaLocation('KG');
      setGrandmaReason('');
    }
  }, [existingGrandmaOvr, date]);

  useEffect(() => {
    if (existingJunjieOvr) {
      setShiftCode(existingJunjieOvr.shiftCode || 'OFF');
      setShiftName(existingJunjieOvr.shiftName || 'OFF Day');
      setShiftTime(existingJunjieOvr.shiftTime || '');
      setShiftReason(existingJunjieOvr.shiftReason || '');
    } else {
      setShiftCode('LEAVE');
      setShiftName('Annual Leave / Off');
      setShiftTime('');
      setShiftReason('');
    }
  }, [existingJunjieOvr, date]);

  if (!isOpen) return null;

  // Normal scheduled status for context
  const scheduledGrandma = getGrandmaLocation(date, settings.grandmaAnchorDate, undefined, settings.grandmaCycleDays);
  const scheduledJunjie = getScheduledJunjieShift(date, settings.junjieAnchorDate);

  const handleSaveGrandma = async (e: React.FormEvent) => {
    e.preventDefault();
    await addOrUpdateOverride({
      date,
      type: 'grandma_location',
      grandmaLocation,
      grandmaReason: grandmaReason.trim() || 'Unusual arrangement',
    });
    onClose();
  };

  const handleSaveJunjie = async (e: React.FormEvent) => {
    e.preventDefault();
    const info = SHIFT_DEFINITIONS[shiftCode] || SHIFT_DEFINITIONS.CUSTOM;
    await addOrUpdateOverride({
      date,
      type: 'junjie_shift',
      shiftCode,
      shiftName: shiftName || info.name,
      shiftTime: shiftTime !== undefined ? shiftTime : info.time,
      shiftReason: shiftReason.trim() || 'Manual shift swap/leave',
      shiftColor: info.badgeBg,
    });
    onClose();
  };

  const handleRevertGrandma = async () => {
    if (existingGrandmaOvr) {
      await deleteOverride(existingGrandmaOvr.id);
      onClose();
    }
  };

  const handleRevertJunjie = async () => {
    if (existingJunjieOvr) {
      await deleteOverride(existingJunjieOvr.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden border border-zinc-200">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-zinc-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/20 rounded-xl text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg">Unusual Arrangement / Override</h3>
              <p className="text-xs text-zinc-400">
                Manually update the schedule for special events, swaps, or holiday plans
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Date Selector */}
        <div className="px-5 pt-4 pb-2 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between gap-3">
          <label className="text-xs font-bold text-zinc-700 flex items-center gap-1.5">
            <span>Target Date:</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="px-2.5 py-1 bg-white border border-zinc-300 rounded-md text-xs font-semibold focus:outline-rose-500 shadow-2xs"
            />
          </label>

          {/* Tab buttons */}
          <div className="flex bg-zinc-200 p-0.5 rounded-lg text-xs font-semibold">
            <button
              onClick={() => setActiveTab('grandma_location')}
              className={`px-3 py-1 rounded-md transition-all ${
                activeTab === 'grandma_location'
                  ? 'bg-teal-700 text-white shadow-2xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              👵 Ahma
            </button>
            <button
              onClick={() => setActiveTab('junjie_shift')}
              className={`px-3 py-1 rounded-md transition-all ${
                activeTab === 'junjie_shift'
                  ? 'bg-purple-700 text-white shadow-2xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              💼 Jun Jie
            </button>
          </div>
        </div>

        {/* Tab Content: Ahma Arrangement */}
        {activeTab === 'grandma_location' && (
          <form onSubmit={handleSaveGrandma} className="p-4 sm:p-5 space-y-4">
            <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-xs text-teal-900">
              <span className="font-bold">{language === 'zh' ? '原定排期:' : 'Scheduled by default:'}</span> Ahma is scheduled at{' '}
              <strong>
                {getAhmaLocationName(scheduledGrandma.locationCode, language)}{' '}
                ({scheduledGrandma.locationCode})
              </strong>{' '}
              ({scheduledGrandma.formattedStayRange}).
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                {language === 'zh' ? '选择特殊安排所在地点' : "Select Ahma's Stay Arrangement"}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { code: 'KC', name: getAhmaLocationName('KC', language) },
                  { code: 'KG', name: getAhmaLocationName('KG', language) },
                  { code: 'KB', name: getAhmaLocationName('KB', language) },
                ].map((loc) => (
                  <button
                    type="button"
                    key={loc.code}
                    onClick={() => setGrandmaLocation(loc.code)}
                    className={`py-2 px-2 rounded-xl border text-xs font-bold flex flex-col items-center gap-0.5 transition-all ${
                      grandmaLocation === loc.code
                        ? 'bg-teal-700 text-white border-teal-700 shadow-xs'
                        : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50'
                    }`}
                  >
                    <span>{loc.name}</span>
                    <span className="text-3xs opacity-80">({loc.code})</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1">
                Or Custom Location / Hospital / Overseas:
              </label>
              <input
                type="text"
                placeholder="e.g. SGH Hospital, Respite Care, Overseas Trip..."
                value={['KC', 'KG', 'KB'].includes(grandmaLocation) ? '' : grandmaLocation}
                onChange={(e) => setGrandmaLocation(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs focus:outline-teal-600 shadow-2xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1">
                Reason / Note for Family
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Staying extra week at KG for cousin wedding; routine check-up..."
                value={grandmaReason}
                onChange={(e) => setGrandmaReason(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs focus:outline-teal-600 shadow-2xs"
              />
            </div>

            <div className="pt-2 flex items-center justify-between">
              {existingGrandmaOvr ? (
                <button
                  type="button"
                  onClick={handleRevertGrandma}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 border border-red-200 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Revert to Scheduled ({scheduledGrandma.locationCode})</span>
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 hover:bg-zinc-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white shadow-xs transition-colors"
                >
                  Save Grandmother Arrangement
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Tab Content: Jun Jie Shift */}
        {activeTab === 'junjie_shift' && (
          <form onSubmit={handleSaveJunjie} className="p-5 space-y-4">
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-900">
              <span className="font-bold">Scheduled by default:</span>{' '}
              <strong>{scheduledJunjie.shift.name}</strong>{' '}
              {scheduledJunjie.shift.time ? `(${scheduledJunjie.shift.time})` : ''} • Week{' '}
              {scheduledJunjie.weekNumber} of 3.
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                Arranged Shift Type
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {[
                  { code: 'NIGHT', name: 'Night', time: '2200-0900' },
                  { code: 'MORNING', name: 'Morning', time: '0630-1530' },
                  { code: 'AFTERNOON_1', name: 'Afternoon 1', time: '1600-0100' },
                  { code: 'AFTERNOON_2', name: 'Afternoon 2', time: '1400-0100' },
                  { code: 'AFTERNOON_3', name: 'Afternoon 3', time: '1500-0200' },
                  { code: 'OFF', name: 'OFF Day', time: '' },
                  { code: 'REST', name: 'REST DAY', time: '' },
                  { code: 'LEAVE', name: 'Annual Leave', time: 'Leave' },
                ].map((s) => (
                  <button
                    type="button"
                    key={s.code}
                    onClick={() => {
                      setShiftCode(s.code as ShiftCode);
                      setShiftName(s.name);
                      setShiftTime(s.time);
                    }}
                    className={`py-2 px-2 rounded-xl border text-2xs font-bold flex flex-col items-center justify-center transition-all ${
                      shiftCode === s.code
                        ? 'bg-purple-700 text-white border-purple-700 shadow-xs'
                        : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50'
                    }`}
                  >
                    <span>{s.name}</span>
                    {s.time && <span className="opacity-80 text-3xs font-normal">{s.time}</span>}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Custom Shift Name
                </label>
                <input
                  type="text"
                  value={shiftName}
                  onChange={(e) => setShiftName(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs focus:outline-purple-600 shadow-2xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Working Hours / Time
                </label>
                <input
                  type="text"
                  placeholder="e.g. 0800-1700 or Off"
                  value={shiftTime}
                  onChange={(e) => setShiftTime(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs focus:outline-purple-600 shadow-2xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1">
                Reason / Swap Details
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Swapped with colleague; Annual leave for family holiday; Medical leave..."
                value={shiftReason}
                onChange={(e) => setShiftReason(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs focus:outline-purple-600 shadow-2xs"
              />
            </div>

            <div className="pt-2 flex items-center justify-between">
              {existingJunjieOvr ? (
                <button
                  type="button"
                  onClick={handleRevertJunjie}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 border border-red-200 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Revert to Scheduled Shift</span>
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 hover:bg-zinc-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-purple-700 hover:bg-purple-800 text-white shadow-xs transition-colors"
                >
                  Save Shift Override
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
