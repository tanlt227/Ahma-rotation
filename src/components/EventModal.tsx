import React, { useState, useEffect } from 'react';
import { useCalendar } from '../context/CalendarContext';
import { CalendarEvent, EventCategory } from '../types';
import { X, Calendar, Clock, MapPin, Users, Trash2, Heart, Plane, Tag } from 'lucide-react';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetDate: string;
  editingEvent?: CalendarEvent | null;
}

const CATEGORY_LABELS: Record<EventCategory, { en: string; zh: string }> = {
  holiday_plan:         { en: '✈️ Holiday / Vacation Plan',       zh: '✈️ 旅行 / 假期计划' },
  family_gathering:     { en: '🍲 Family Gathering / Dinner',     zh: '🍲 家庭聚餐 / 聚会' },
  medical:              { en: '🏥 Medical / Polyclinic Appt',     zh: '🏥 医疗 / 诊所预约' },
  leave:                { en: '🏖️ Leave / Rest Plan',             zh: '🏖️ 休假 / 休息计划' },
  unusual_arrangement:  { en: '⚡ Unusual Arrangement',           zh: '⚡ 特殊安排' },
  general:              { en: '📌 General Note',                  zh: '📌 一般备注' },
};

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetDate: string;
  editingEvent?: CalendarEvent | null;
}

export const EventModal: React.FC<EventModalProps> = ({
  isOpen,
  onClose,
  targetDate,
  editingEvent,
}) => {
  const { addOrUpdateEvent, deleteEvent, familyMembers, language, isSyncing } = useCalendar();

  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState(targetDate);
  const [endDate, setEndDate] = useState('');
  const [category, setCategory] = useState<EventCategory>('holiday_plan');
  const [memberId, setMemberId] = useState('all');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (editingEvent) {
      // Show the title in the current language if translated, else original
      const displayTitle = language === 'zh'
        ? (editingEvent.titleZh || editingEvent.title)
        : (editingEvent.titleEn || editingEvent.title);
      setTitle(displayTitle);
      setStartDate(editingEvent.startDate);
      setEndDate(editingEvent.endDate || '');
      setCategory(editingEvent.category);
      setMemberId(editingEvent.memberId || 'all');
      setTime(editingEvent.time || '');
      setLocation(editingEvent.location || '');
      const displayNotes = language === 'zh'
        ? (editingEvent.notesZh || editingEvent.notes || '')
        : (editingEvent.notesEn || editingEvent.notes || '');
      setNotes(displayNotes);
    } else {
      setTitle('');
      setStartDate(targetDate);
      setEndDate('');
      setCategory('holiday_plan');
      setMemberId('all');
      setTime('');
      setLocation('');
      setNotes('');
    }
  }, [editingEvent, targetDate, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startDate) return;

    const stableId = editingEvent?.id || `ev-${Date.now()}`;
    const titleText = title.trim();
    const notesText = notes.trim() || undefined;

    // Block polling immediately — before translation starts
    isSyncing.current = true;

    // Translate first (before saving) so one write contains everything
    let titleEn: string | undefined;
    let titleZh: string | undefined;
    let notesEn: string | undefined;
    let notesZh: string | undefined;

    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: titleText, notes: notesText }),
      });
      if (res.ok) {
        const data = await res.json();
        titleEn = data.en || titleText;
        titleZh = data.zh || titleText;
        notesEn = data.notesEn || undefined;
        notesZh = data.notesZh || undefined;
      }
    } catch {
      // Translation failed — save without bilingual fields
    }

    await addOrUpdateEvent({
      id: stableId,
      title: titleText,
      titleEn,
      titleZh,
      startDate,
      endDate: endDate || undefined,
      category,
      memberId,
      time: time.trim() || undefined,
      location: location.trim() || undefined,
      notes: notesText,
      notesEn,
      notesZh,
    });
    onClose();
  };

  const handleDelete = async () => {
    if (editingEvent?.id) {
      await deleteEvent(editingEvent.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden border border-zinc-200">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-rose-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/20 rounded-xl">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg">
                {editingEvent
                  ? (language === 'zh' ? '修改家庭计划' : 'Edit Family Plan')
                  : (language === 'zh' ? '添加家庭计划 / 假期' : 'Add Family Plan / Holiday')}
              </h3>
              <p className="text-xs text-rose-100">
                {language === 'zh' ? '实时同步至所有家庭成员的设备' : 'Syncs in real-time across all family members\' devices'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-rose-100 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-zinc-700 mb-1">
              {language === 'zh' ? '活动标题 / 假期计划 *' : 'Event Title / Holiday Plan *'}
            </label>
            <input
              type="text"
              required
              placeholder={language === 'zh' ? '例如：圣淘沙度假、家庭聚餐、阿嬷复诊...' : 'e.g. Sentosa Staycation, Family Reunion Dinner, Grandma Checkup...'}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm font-semibold focus:outline-rose-500 shadow-2xs"
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1">
                {language === 'zh' ? '开始日期 *' : 'Start Date *'}
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs font-medium focus:outline-rose-500 shadow-2xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1">
                {language === 'zh' ? '结束日期（多天活动）' : 'End Date (Multi-day)'}
              </label>
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs font-medium focus:outline-rose-500 shadow-2xs"
              />
            </div>
          </div>

          {/* Category & Member */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1">
                {language === 'zh' ? '活动类别' : 'Category'}
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as EventCategory)}
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs font-semibold focus:outline-rose-500 shadow-2xs bg-white"
              >
                {(Object.keys(CATEGORY_LABELS) as EventCategory[]).map((cat) => (
                  <option key={cat} value={cat}>
                    {CATEGORY_LABELS[cat][language]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1">
                {language === 'zh' ? '家庭成员' : 'Family Member'}
              </label>
              <select
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs font-semibold focus:outline-rose-500 shadow-2xs bg-white"
              >
                <option value="all">{language === 'zh' ? '👨‍👩‍👧‍👦 全家人' : '👨‍👩‍👧‍👦 Whole Family'}</option>
                {familyMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.relationship})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Time & Location */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1">
                {language === 'zh' ? '时间（可选）' : 'Time (Optional)'}
              </label>
              <input
                type="text"
                placeholder={language === 'zh' ? '例如：18:30 或 全天' : 'e.g. 18:30 or All Day'}
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs focus:outline-rose-500 shadow-2xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1">
                {language === 'zh' ? '地点（可选）' : 'Location (Optional)'}
              </label>
              <input
                type="text"
                placeholder={language === 'zh' ? '例如：启超家、圣淘沙、诊所...' : 'e.g. KC House, Sentosa, Polyclinic...'}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs focus:outline-rose-500 shadow-2xs"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-zinc-700 mb-1">
              {language === 'zh' ? '备注与详情' : 'Notes & Details'}
            </label>
            <textarea
              rows={2}
              placeholder={language === 'zh' ? '给家人的任何备注...' : 'Any details for the family...'}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs focus:outline-rose-500 shadow-2xs"
            />
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex items-center justify-between">
            {editingEvent ? (
              <button
                type="button"
                onClick={handleDelete}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 border border-red-200 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{language === 'zh' ? '删除活动' : 'Delete Event'}</span>
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
                {language === 'zh' ? '取消' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-colors"
              >
                {editingEvent
                  ? (language === 'zh' ? '保存修改' : 'Save Changes')
                  : (language === 'zh' ? '添加到日历' : 'Add to Calendar')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
