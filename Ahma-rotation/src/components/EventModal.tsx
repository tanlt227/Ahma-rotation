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

export const EventModal: React.FC<EventModalProps> = ({
  isOpen,
  onClose,
  targetDate,
  editingEvent,
}) => {
  const { addOrUpdateEvent, deleteEvent, familyMembers } = useCalendar();

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
      setTitle(editingEvent.title);
      setStartDate(editingEvent.startDate);
      setEndDate(editingEvent.endDate || '');
      setCategory(editingEvent.category);
      setMemberId(editingEvent.memberId || 'all');
      setTime(editingEvent.time || '');
      setLocation(editingEvent.location || '');
      setNotes(editingEvent.notes || '');
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

    await addOrUpdateEvent({
      id: editingEvent?.id,
      title: title.trim(),
      startDate,
      endDate: endDate || undefined,
      category,
      memberId,
      time: time.trim() || undefined,
      location: location.trim() || undefined,
      notes: notes.trim() || undefined,
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
                {editingEvent ? 'Edit Family Plan' : 'Add Family Plan / Holiday'}
              </h3>
              <p className="text-xs text-rose-100">
                Syncs in real-time across all family members' devices
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
              Event Title / Holiday Plan *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Sentosa Staycation, Family Reunion Dinner, Grandma Checkup..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm font-semibold focus:outline-rose-500 shadow-2xs"
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1">
                Start Date *
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
                End Date (Multi-day)
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
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as EventCategory)}
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs font-semibold focus:outline-rose-500 shadow-2xs bg-white"
              >
                <option value="holiday_plan">✈️ Holiday / Vacation Plan</option>
                <option value="family_gathering">🍲 Family Gathering / Dinner</option>
                <option value="medical">🏥 Medical / Polyclinic Appt</option>
                <option value="leave">🏖️ Leave / Rest Plan</option>
                <option value="unusual_arrangement">⚡ Unusual Arrangement</option>
                <option value="general">📌 General Note</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1">
                Family Member
              </label>
              <select
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs font-semibold focus:outline-rose-500 shadow-2xs bg-white"
              >
                <option value="all">👨‍👩‍👧‍👦 Whole Family</option>
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
                Time (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. 18:30 or All Day"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs focus:outline-rose-500 shadow-2xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1">
                Location (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. KC House, Sentosa, Polyclinic..."
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs focus:outline-rose-500 shadow-2xs"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-zinc-700 mb-1">
              Notes & Details
            </label>
            <textarea
              rows={2}
              placeholder="Any details for the family..."
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
                <span>Delete Event</span>
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
                className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-colors"
              >
                {editingEvent ? 'Save Changes' : 'Add to Calendar'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
