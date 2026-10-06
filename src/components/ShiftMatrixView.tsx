import React, { useState } from 'react';
import { useCalendar } from '../context/CalendarContext';
import {
  SHIFT_DEFINITIONS,
  DEFAULT_ROSTER_WEEKS,
} from '../data/schedule';
import { ShiftCode, ShiftRosterWeek, ShiftRosterDay } from '../types';
import { translations } from '../data/i18n';
import {
  Clock,
  Plus,
  Trash2,
  Edit2,
  Save,
  RotateCcw,
  Check,
  X,
} from 'lucide-react';

interface ShiftMatrixViewProps {
  onOpenOverrideModal: (dateStr: string) => void;
}

export const ShiftMatrixView: React.FC<ShiftMatrixViewProps> = ({ onOpenOverrideModal }) => {
  const { settings, overrides, rosterWeeks, updateRosterWeeks, setSelectedDate, setCurrentDate, language } = useCalendar();
  const t = translations[language];

  // Local editable copy of roster weeks
  const [editableWeeks, setEditableWeeks] = useState<ShiftRosterWeek[]>(rosterWeeks);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ weekIdx: number; dayIdx: number } | null>(null);

  // Cell edit popover state
  const [cellCode, setCellCode] = useState<ShiftCode>('MORNING');
  const [cellName, setCellName] = useState('');
  const [cellTime, setCellTime] = useState('');

  const [savedSuccess, setSavedSuccess] = useState(false);

  // Sync if rosterWeeks from server changes and user is not editing
  React.useEffect(() => {
    if (!isEditing) {
      setEditableWeeks(rosterWeeks);
    }
  }, [rosterWeeks, isEditing]);

  const daysHeader = t.fullDays;

  // Add new week
  const handleAddWeek = () => {
    const nextWeekNum = editableWeeks.length + 1;
    const newWeek: ShiftRosterWeek = {
      weekNum: nextWeekNum,
      title: `Week ${nextWeekNum}`,
      days: [
        { dayOfWeek: 0, code: 'MORNING', name: 'Morning', time: '0630-1530' },
        { dayOfWeek: 1, code: 'MORNING', name: 'Morning', time: '0630-1530' },
        { dayOfWeek: 2, code: 'OFF', name: 'OFF Day', time: '' },
        { dayOfWeek: 3, code: 'REST', name: 'REST DAY', time: '' },
        { dayOfWeek: 4, code: 'AFTERNOON_1', name: 'Afternoon 1', time: '1600-0100' },
        { dayOfWeek: 5, code: 'AFTERNOON_2', name: 'Afternoon 2', time: '1400-0100' },
        { dayOfWeek: 6, code: 'REST', name: 'REST DAY', time: '' },
      ],
    };
    setEditableWeeks([...editableWeeks, newWeek]);
    setIsEditing(true);
  };

  // Delete week
  const handleDeleteWeek = (weekIdx: number) => {
    if (editableWeeks.length <= 1) {
      alert(language === 'zh' ? '至少需要保留一周排班' : 'Must have at least one week in roster');
      return;
    }
    const filtered = editableWeeks.filter((_, idx) => idx !== weekIdx);
    // Re-index week numbers
    const reindexed = filtered.map((w, idx) => ({
      ...w,
      weekNum: idx + 1,
      title: `Week ${idx + 1}`,
    }));
    setEditableWeeks(reindexed);
    setIsEditing(true);
  };

  // Open edit modal for a specific cell
  const handleOpenCellEdit = (weekIdx: number, dayIdx: number) => {
    const day = editableWeeks[weekIdx].days[dayIdx];
    setSelectedCell({ weekIdx, dayIdx });
    setCellCode(day.code);
    setCellName(day.name);
    setCellTime(day.time || '');
  };

  const handleSaveCellEdit = () => {
    if (!selectedCell) return;
    const { weekIdx, dayIdx } = selectedCell;
    const updated = [...editableWeeks];
    const baseInfo = SHIFT_DEFINITIONS[cellCode] || SHIFT_DEFINITIONS.OFF;

    updated[weekIdx].days[dayIdx] = {
      dayOfWeek: dayIdx,
      code: cellCode,
      name: cellName.trim() || baseInfo.name,
      time: cellTime.trim(),
    };

    setEditableWeeks(updated);
    setSelectedCell(null);
    setIsEditing(true);
  };

  // Save all changes to server
  const handleSaveRoster = async () => {
    await updateRosterWeeks(editableWeeks);
    setIsEditing(false);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  // Restore default
  const handleRestoreDefaults = async () => {
    if (confirm(language === 'zh' ? '确定恢复到默认的3周排班表吗？' : 'Reset to default 3-week shift table?')) {
      setEditableWeeks(DEFAULT_ROSTER_WEEKS);
      await updateRosterWeeks(DEFAULT_ROSTER_WEEKS);
      setIsEditing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 pb-16 sm:pb-10 space-y-4">
      {/* Top Controls Bar */}
      <div className="bg-white rounded-2xl border-2 border-zinc-300 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-purple-100 text-purple-900 font-bold">
              <Clock className="w-5 h-5" />
            </span>
            <h2 className="text-lg sm:text-xl font-black text-zinc-950">
              {language === 'zh' ? '俊杰工作排班表' : "Jun Jie's Shift Schedule"}
            </h2>
            <span className="text-2xs font-extrabold bg-purple-100 text-purple-900 px-2 py-0.5 rounded-full border border-purple-300">
              {editableWeeks.length} {language === 'zh' ? '周循环' : 'Weeks Cycle'}
            </span>
          </div>
          <p className="text-xs text-zinc-600 font-medium mt-1">
            {language === 'zh'
              ? '可自由添加周数、修改上下班时间或班次，修改后自动实时同步并应用至整个日历。'
              : 'Add extra weeks, change working hours, or customize shifts. Changes sync across all devices.'}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleAddWeek}
            className="px-3 py-1.5 rounded-xl text-xs font-black bg-purple-50 text-purple-900 hover:bg-purple-100 border border-purple-300 transition-colors flex items-center gap-1 shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            <span>{t.addWeek}</span>
          </button>

          {isEditing && (
            <button
              onClick={handleSaveRoster}
              className="px-4 py-1.5 rounded-xl text-xs font-black bg-purple-700 hover:bg-purple-800 text-white transition-colors flex items-center gap-1.5 shadow-xs animate-pulse"
            >
              <Save className="w-4 h-4" />
              <span>{t.saveRoster}</span>
            </button>
          )}

          {savedSuccess && (
            <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-300 flex items-center gap-1">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>{language === 'zh' ? '已成功保存!' : 'Saved!'}</span>
            </span>
          )}

          <button
            onClick={handleRestoreDefaults}
            className="p-1.5 rounded-xl text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 border border-zinc-300 transition-colors"
            title={t.restoreDefaultRoster}
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Editable Roster Table */}
      <div className="bg-white rounded-2xl border-2 border-zinc-300 shadow-sm overflow-hidden">
        <div className="p-3 bg-zinc-100 border-b border-zinc-300 flex items-center justify-between text-xs font-bold text-zinc-700">
          <span>{language === 'zh' ? '💡 点击任意单元格可修改班次与工作时间' : '💡 Click any shift cell to edit name & time'}</span>
          <span className="text-3xs text-zinc-500">{language === 'zh' ? '支持手机左右滑动查看' : 'Swipe horizontally on mobile'}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-center min-w-[720px]">
            <thead>
              <tr className="bg-zinc-950 text-white text-xs font-bold">
                <th className="py-2.5 px-3 border border-zinc-700 w-32 sticky left-0 z-10 bg-zinc-950">
                  {language === 'zh' ? '周数 / 操作' : 'Week / Action'}
                </th>
                {daysHeader.map((d) => (
                  <th key={d} className="py-2.5 px-2 border border-zinc-700 min-w-[105px]">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {editableWeeks.map((week, wIdx) => (
                <tr key={week.weekNum} className="border-b-2 border-zinc-200">
                  {/* Sticky Week Title & Delete Button */}
                  <td className="py-3 px-2 font-black text-xs text-zinc-950 bg-zinc-100 border-r-2 border-zinc-300 sticky left-0 z-10">
                    <div className="text-sm font-black text-purple-950">Week {week.weekNum}</div>
                    <button
                      onClick={() => handleDeleteWeek(wIdx)}
                      className="mt-1 text-3xs font-bold text-red-600 hover:text-red-800 hover:underline inline-flex items-center gap-0.5"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>{t.deleteWeek}</span>
                    </button>
                  </td>

                  {/* 7 Day cells */}
                  {week.days.map((day: ShiftRosterDay, dIdx: number) => {
                    let cellBg = '';
                    if (day.code === 'NIGHT') cellBg = 'bg-[#bfb6e0] text-[#1c1836]';
                    else if (day.code === 'MORNING') cellBg = 'bg-[#cbeae6] text-[#0d3430]';
                    else if (day.code === 'AFTERNOON_1') cellBg = 'bg-[#f4ccaa] text-[#4a2a10]';
                    else if (day.code === 'AFTERNOON_2') cellBg = 'bg-[#c5e4c2] text-[#173a14]';
                    else if (day.code === 'AFTERNOON_3') cellBg = 'bg-[#f7c0ca] text-[#4d1620]';
                    else if (day.code === 'OFF' || day.code === 'REST') cellBg = 'bg-[#fcf3cf] text-[#423a10]';
                    else cellBg = 'bg-blue-100 text-blue-950';

                    return (
                      <td
                        key={dIdx}
                        onClick={() => handleOpenCellEdit(wIdx, dIdx)}
                        className={`p-2 border border-zinc-300 font-black text-xs ${cellBg} cursor-pointer hover:ring-2 hover:ring-purple-500 hover:scale-[0.98] transition-all select-none relative group`}
                        title="Click to edit shift"
                      >
                        <div className="font-black text-xs sm:text-sm tracking-tight">{day.name}</div>
                        {day.time ? (
                          <div className="text-3xs font-extrabold opacity-95 mt-0.5">
                            ({day.time})
                          </div>
                        ) : (
                          <div className="text-3xs font-semibold opacity-70 mt-0.5">-</div>
                        )}
                        <span className="hidden group-hover:block absolute top-1 right-1 p-0.5 rounded bg-black/20 text-white">
                          <Edit2 className="w-2.5 h-2.5" />
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cell Edit Modal */}
      {selectedCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-2xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border-2 border-zinc-300 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
              <h4 className="font-black text-sm text-zinc-950">
                {language === 'zh'
                  ? `修改 Week ${editableWeeks[selectedCell.weekIdx].weekNum} - ${daysHeader[selectedCell.dayIdx]}`
                  : `Edit Week ${editableWeeks[selectedCell.weekIdx].weekNum} - ${daysHeader[selectedCell.dayIdx]}`}
              </h4>
              <button
                onClick={() => setSelectedCell(null)}
                className="p-1 text-zinc-400 hover:text-zinc-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-3">
              <div>
                <label className="block text-xs font-black text-zinc-700 mb-1">
                  {language === 'zh' ? '预设班次类别' : 'Shift Preset'}
                </label>
                <select
                  value={cellCode}
                  onChange={(e) => {
                    const code = e.target.value as ShiftCode;
                    setCellCode(code);
                    const def = SHIFT_DEFINITIONS[code];
                    if (def) {
                      setCellName(def.name);
                      setCellTime(def.time || '');
                    }
                  }}
                  className="w-full px-3 py-2 border-2 border-zinc-300 rounded-xl text-xs font-bold bg-white"
                >
                  <option value="NIGHT">Night (2200-0900)</option>
                  <option value="MORNING">Morning (0630-1530)</option>
                  <option value="AFTERNOON_1">Afternoon 1 (1600-0100)</option>
                  <option value="AFTERNOON_2">Afternoon 2 (1400-0100)</option>
                  <option value="AFTERNOON_3">Afternoon 3 (1500-0200)</option>
                  <option value="OFF">OFF Day</option>
                  <option value="REST">REST DAY</option>
                  <option value="LEAVE">Annual Leave / MC</option>
                  <option value="CUSTOM">Custom Shift</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-black text-zinc-700 mb-1">
                  {language === 'zh' ? '班次名称' : 'Shift Name'}
                </label>
                <input
                  type="text"
                  value={cellName}
                  onChange={(e) => setCellName(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-zinc-300 rounded-xl text-xs font-black"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-zinc-700 mb-1">
                  {language === 'zh' ? '工作时间 (如: 0800-1700 或 留空)' : 'Working Hours (e.g. 0800-1700)'}
                </label>
                <input
                  type="text"
                  placeholder="e.g. 0630-1530"
                  value={cellTime}
                  onChange={(e) => setCellTime(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-zinc-300 rounded-xl text-xs font-black"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-200">
              <button
                type="button"
                onClick={() => setSelectedCell(null)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-100"
              >
                {language === 'zh' ? '取消' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleSaveCellEdit}
                className="px-4 py-1.5 rounded-xl text-xs font-black bg-purple-700 text-white hover:bg-purple-800"
              >
                {language === 'zh' ? '确认修改' : 'Apply'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
