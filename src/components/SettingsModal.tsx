import React, { useState } from 'react';
import { useCalendar } from '../context/CalendarContext';
import {
  X,
  Sliders,
  RotateCcw,
  Users,
  MapPin,
  Clock,
  Plus,
  Trash2,
  Check,
  Share2,
  Download,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const {
    settings,
    updateSettings,
    familyMembers,
    addFamilyMember,
    deleteFamilyMember,
    resetToDefaults,
    events,
    overrides,
    syncStatus,
    language,
  } = useCalendar();

  const [grandmaAnchor, setGrandmaAnchor] = useState(settings.grandmaAnchorDate);
  const [stayDays, setStayDays] = useState(settings.grandmaCycleDays || 14);

  // Add member
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRel, setNewMemberRel] = useState('');

  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateSettings({
      grandmaAnchorDate: grandmaAnchor,
      grandmaCycleDays: Number(stayDays) || 14,
    });
    onClose();
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;
    await addFamilyMember({
      name: newMemberName.trim(),
      relationship: newMemberRel.trim() || 'Family Member',
      color: '#3b82f6',
    });
    setNewMemberName('');
    setNewMemberRel('');
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportJson = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      settings,
      familyMembers,
      events,
      overrides,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `familysync-calendar-sg-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden border border-zinc-200 max-h-[90vh] flex flex-col justify-between">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-zinc-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-zinc-800 rounded-xl text-zinc-300">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg">Calendar Settings & Multi-Device Sync</h3>
              <p className="text-xs text-zinc-400">
                Configure rotation rules, family sync, and persistence
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

        {/* Scrollable Content */}
        <div className="p-5 overflow-y-auto space-y-6">
          {/* Multi-Device Cloud Sync Status Card */}
          <div className={`border rounded-xl p-4 ${
            syncStatus === 'connected'
              ? 'bg-emerald-50/60 border-emerald-300'
              : 'bg-amber-50/80 border-amber-300'
          }`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${syncStatus === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                  <span className="text-xs font-black text-zinc-900">
                    {syncStatus === 'connected'
                      ? (language === 'zh' ? '多设备云端实时同步：已连接' : 'Multi-Device Cloud Sync: Connected')
                      : (language === 'zh' ? '多设备云端同步：尚未配置 (仅保存在当前设备)' : 'Multi-Device Cloud Sync: Setup Needed (Saved Locally Only)')}
                  </span>
                </div>
                <p className="text-xs text-zinc-600 mt-1.5 leading-relaxed">
                  {syncStatus === 'connected'
                    ? (language === 'zh'
                        ? '家庭计划已实时保存在云端 GitHub (tanlt227/Ahma-rotation)！在任何手机、电脑或微信/浏览器打开，都会自动同步。'
                        : 'Family events are synchronized via GitHub repository storage. All family members see new events automatically across devices.')
                    : (language === 'zh'
                        ? '提示：在 Vercel 部署上，为了让一部手机添加的计划能在另一部手机显示，需要在 Vercel 项目设置中添加环境变量 GITHUB_TOKEN（个人访问令牌）。目前修改仅保存在本设备的浏览器缓存中。'
                        : 'Notice: On Vercel, to mirror events between different phones and computers, add GITHUB_TOKEN to your Vercel Project Settings → Environment Variables. Currently, plans are only saved on this device.')}
                </p>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-zinc-200/60 flex items-center justify-between gap-2">
              <span className="text-3xs text-zinc-500 font-mono">
                Repo: tanlt227/Ahma-rotation
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white border border-zinc-300 hover:bg-zinc-100 text-zinc-800 flex items-center gap-1.5 shadow-2xs"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied Link!' : 'Share URL'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportJson}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white border border-zinc-300 hover:bg-zinc-100 text-zinc-800 flex items-center gap-1.5 shadow-2xs"
                  title="Backup / Export calendar data"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export</span>
                </button>
              </div>
            </div>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-5">
            {/* 1. Ahma Settings */}
            <div className="border border-teal-200 rounded-xl p-4 bg-teal-50/30">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="w-4 h-4 text-teal-700" />
                <h4 className="font-bold text-sm text-teal-950">
                  Ahma's Rotation (Kay Cheow &gt; Kay Guan &gt; Kay Boon)
                </h4>
              </div>
              <p className="text-xs text-teal-800 mb-3">
              Ahma rotates between Kay Cheow (KC) &gt; Kay Guan (KG) &gt; Kay Boon (KB). Cycle start date is 7th May 2026 @ Kay Cheow.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-1">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">
                    Fortnightly Cycle Start Date (Kay Cheow)
                  </label>
                  <input
                    type="date"
                    value={grandmaAnchor}
                    onChange={(e) => setGrandmaAnchor(e.target.value)}
                    className="w-full px-3 py-1.5 border border-zinc-300 rounded-lg text-xs font-semibold bg-white"
                  />
                  <div className="text-3xs text-zinc-500 mt-1">
                    Cycle starts at Kay Cheow on this date (can be any day of the week).
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">
                    Stay Duration per Rotation (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="180"
                    value={stayDays}
                    onChange={(e) => setStayDays(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-1.5 border border-zinc-300 rounded-lg text-xs font-semibold bg-white"
                  />
                  <div className="text-3xs text-zinc-500 mt-1">
                    Number of days Ahma stays at each house (default: 14 days).
                  </div>
                </div>
              </div>
            </div>

            {/* Save Settings Button */}
            <div className="flex justify-end">
              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-xs font-bold bg-zinc-900 text-white hover:bg-zinc-800 transition-colors shadow-xs"
              >
                Save Settings
              </button>
            </div>
          </form>

          {/* 3. Family Members Management */}
          <div className="border border-zinc-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-zinc-700" />
              <h4 className="font-bold text-sm text-zinc-900">Family Members</h4>
            </div>

            <div className="space-y-1.5 mb-4">
              {familyMembers.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 border border-zinc-200 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: m.color || '#10b981' }}
                    />
                    <span className="font-bold text-zinc-900">{m.name}</span>
                    <span className="text-zinc-500">({m.relationship})</span>
                  </div>
                  {!['all', 'grandma', 'junjie'].includes(m.id) && (
                    <button
                      onClick={() => deleteFamilyMember(m.id)}
                      className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Add member form */}
            <form onSubmit={handleAddMember} className="flex items-center gap-2">
              <input
                type="text"
                placeholder="New Member Name"
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                className="flex-1 px-3 py-1.5 border border-zinc-300 rounded-lg text-xs bg-white"
              />
              <input
                type="text"
                placeholder="Role (e.g. Sister)"
                value={newMemberRel}
                onChange={(e) => setNewMemberRel(e.target.value)}
                className="w-32 px-3 py-1.5 border border-zinc-300 rounded-lg text-xs bg-white"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shrink-0"
              >
                + Add
              </button>
            </form>
          </div>

          {/* Reset to defaults */}
          <div className="pt-3 border-t border-zinc-100 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-zinc-700">Restore Default Seed Data</div>
              <div className="text-3xs text-zinc-400">
                Restores Grandmother KC 7 May anchor & Jun Jie 15 Jun anchor
              </div>
            </div>
            <button
              onClick={() => {
                if (confirm('Reset calendar data to defaults?')) {
                  resetToDefaults();
                  onClose();
                }
              }}
              className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Data</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-zinc-50 border-t border-zinc-200 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-900 text-white hover:bg-zinc-800 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
