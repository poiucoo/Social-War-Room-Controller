import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { supabase } from '../lib/supabase';
import { Lock, X, Plus, Trash2, Save, Edit2, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

// ─────────────────────────────────────────────
// Mini Calendar Picker Component
// ─────────────────────────────────────────────
const MONTH_NAMES = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
const DAY_NAMES = ['日','一','二','三','四','五','六'];

const MiniCalendar = ({
    value,
    onChange,
    accentColor = 'indigo',
}: {
    value: string;
    onChange: (v: string) => void;
    accentColor?: 'indigo' | 'emerald';
}) => {
    const [open, setOpen] = useState(false);
    const [viewYear, setViewYear] = useState(() => {
        if (value) return new Date(value + 'T00:00:00').getFullYear();
        return new Date().getFullYear();
    });
    const [viewMonth, setViewMonth] = useState(() => {
        if (value) return new Date(value + 'T00:00:00').getMonth();
        return new Date().getMonth();
    });
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        if (open) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    // Sync display month when value changes externally
    useEffect(() => {
        if (value) {
            const d = new Date(value + 'T00:00:00');
            setViewYear(d.getFullYear());
            setViewMonth(d.getMonth());
        }
    }, [value]);

    const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    const handleDayClick = (day: number) => {
        const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        onChange(dateStr);
        setOpen(false);
    };

    const prevMonth = () => {
        if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
        else setViewMonth(m => m - 1);
    };
    const nextMonth = () => {
        if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
        else setViewMonth(m => m + 1);
    };

    const accentBtn = accentColor === 'emerald'
        ? 'bg-emerald-500 text-white shadow-[0_0_10px_rgba(52,211,153,0.5)]'
        : 'bg-indigo-500 text-white shadow-[0_0_10px_rgba(99,102,241,0.5)]';
    const borderFocus = accentColor === 'emerald' ? 'border-emerald-500/50' : 'border-indigo-500/50';
    const displayText = accentColor === 'emerald' ? 'text-emerald-400 font-bold' : 'text-gray-300';

    return (
        <div className="relative" ref={ref}>
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className={`w-full bg-[#0B0F19] border px-3 py-2 text-sm rounded-md text-left flex items-center justify-between gap-2 transition-colors focus:outline-none ${
                    open ? borderFocus : 'border-gray-700 hover:border-gray-600'
                } ${value ? displayText : 'text-gray-600'}`}
            >
                <span>{value || '選擇日期'}</span>
                <Calendar className="w-4 h-4 shrink-0 text-gray-500" />
            </button>

            {open && (
                <div className="absolute z-[300] mt-1.5 bg-[#0F172A] border border-gray-700 rounded-xl shadow-2xl p-3 w-64 left-0">
                    {/* Month navigation */}
                    <div className="flex items-center justify-between mb-2">
                        <button type="button" onClick={prevMonth} className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors">
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-sm text-white font-bold tracking-wide">
                            {viewYear}年 {MONTH_NAMES[viewMonth]}
                        </span>
                        <button type="button" onClick={nextMonth} className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors">
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Day headers */}
                    <div className="grid grid-cols-7 mb-1">
                        {DAY_NAMES.map(d => (
                            <div key={d} className="text-center text-[10px] text-gray-600 font-bold py-1">{d}</div>
                        ))}
                    </div>

                    {/* Day grid */}
                    <div className="grid grid-cols-7 gap-0.5">
                        {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`pad-${i}`} />)}
                        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                            const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                            const isSelected = value === dateStr;
                            const isToday = dateStr === new Date().toISOString().split('T')[0];
                            return (
                                <button
                                    key={day}
                                    type="button"
                                    onClick={() => handleDayClick(day)}
                                    className={`text-xs py-1.5 rounded-lg transition-all font-medium w-full ${
                                        isSelected
                                            ? accentBtn
                                            : isToday
                                            ? 'ring-1 ring-gray-500 text-gray-300 hover:bg-white/10'
                                            : 'text-gray-400 hover:bg-white/10 hover:text-white'
                                    }`}
                                >
                                    {day}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

// ─────────────────────────────────────────────
// Main CMS Modal Component
// ─────────────────────────────────────────────
interface MilestoneCMSProps {
    isOpen: boolean;
    onClose: () => void;
    channelName: string;
    onMilestonesUpdated: () => void;
}

export const MilestoneCMSModal = ({ isOpen, onClose, channelName, onMilestonesUpdated }: MilestoneCMSProps) => {
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [passcode, setPasscode] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [saveError, setSaveError] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const [milestones, setMilestones] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        platform: 'ALL',
        date: '',
        before_start: '',
        after_end: ''
    });

    useEffect(() => {
        if (isOpen && isUnlocked && channelName) {
            fetchMilestones();
        }
    }, [isOpen, isUnlocked, channelName]);

    const fetchMilestones = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('milestones')
            .select('*')
            .eq('channel_name', channelName)
            .order('date', { ascending: false });
        if (data) setMilestones(data);
        if (error) console.error('Fetch milestones error:', error);
        setLoading(false);
    };

    const handleUnlock = (e: React.FormEvent) => {
        e.preventDefault();
        if (passcode === '8888') {
            setIsUnlocked(true);
            setErrorMsg('');
        } else {
            setErrorMsg('密碼錯誤，請重新輸入');
        }
    };

    const resetForm = () => {
        setEditingId(null);
        setSaveError('');
        setFormData({ title: '', description: '', platform: 'ALL', date: '', before_start: '', after_end: '' });
    };

    const startEdit = (m: any) => {
        setEditingId(m.id);
        setSaveError('');
        setFormData({
            title: m.title,
            description: m.description,
            platform: m.platform,
            date: m.date,
            before_start: m.before_start,
            after_end: m.after_end
        });
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaveError('');

        if (!formData.title || !formData.date || !formData.before_start || !formData.after_end) {
            setSaveError('請填寫所有必填欄位（標題、三個日期）');
            return;
        }
        if (formData.before_start >= formData.date) {
            setSaveError('觀察開始日必須早於正式部署日');
            return;
        }
        if (formData.after_end <= formData.date) {
            setSaveError('觀察結束日必須晚於正式部署日');
            return;
        }

        setIsSaving(true);
        const payload = { ...formData, channel_name: channelName };

        let dbError = null;
        if (editingId) {
            const { error } = await supabase.from('milestones').update(payload).eq('id', editingId);
            dbError = error;
        } else {
            const { error } = await supabase.from('milestones').insert([payload]);
            dbError = error;
        }

        setIsSaving(false);

        if (dbError) {
            setSaveError(`儲存失敗: ${dbError.message}`);
            return;
        }

        resetForm();
        await fetchMilestones();
        onMilestonesUpdated();
    };

    const handleDelete = async (id: string) => {
        if (!confirm('確定要刪除這個策略紀錄嗎？')) return;
        await supabase.from('milestones').delete().eq('id', id);
        fetchMilestones();
        onMilestonesUpdated();
    };

    if (!isOpen) return null;

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-md flex items-center justify-center p-6">
            <div className="bg-[#0B0F19] w-full max-w-[90vw] xl:max-w-7xl border border-gray-700/80 rounded-2xl shadow-[0_0_80px_-10px_rgba(99,102,241,0.3)] overflow-hidden flex flex-col" style={{ height: '90vh' }}>

                {/* Header */}
                <div className="px-6 py-4 flex items-center justify-between bg-white/5 border-b border-gray-800 shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <h2 className="text-white font-bold flex items-center gap-2 shrink-0">
                            <Lock className={`w-4 h-4 ${isUnlocked ? 'text-emerald-400' : 'text-amber-400'}`} />
                            策略里程碑控制台 (CMS)
                        </h2>
                        {channelName && (
                            <span className="text-xs text-indigo-300 font-mono bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20 truncate max-w-xs">
                                📡 {channelName}
                            </span>
                        )}
                    </div>
                    <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-white rounded-md bg-white/5 hover:bg-white/10 transition-colors shrink-0">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden flex min-h-0">
                    {!isUnlocked ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-10">
                            <Lock className="w-16 h-16 text-amber-500/50 mb-4" />
                            <h3 className="text-xl text-white font-medium mb-2">安全解鎖</h3>
                            <p className="text-gray-400 text-sm mb-6">請輸入管理員密碼以進入 CMS</p>
                            <form onSubmit={handleUnlock} className="flex flex-col gap-3 w-full max-w-xs">
                                <input
                                    type="password"
                                    placeholder="輸入 PIN 碼"
                                    className="w-full bg-[#151E32] text-white border border-gray-700 px-4 py-3 rounded-lg focus:outline-none focus:border-indigo-500 text-center tracking-widest text-lg"
                                    value={passcode}
                                    onChange={e => setPasscode(e.target.value)}
                                    autoFocus
                                />
                                {errorMsg && <p className="text-rose-400 text-xs text-center">{errorMsg}</p>}
                                <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-lg transition-colors shadow-lg">
                                    解鎖進入
                                </button>
                            </form>
                        </div>
                    ) : (
                        <div className="flex flex-1 w-full flex-col md:flex-row min-h-0">
                            {/* Left Side: List */}
                            <div className="w-full md:w-72 lg:w-80 bg-[#151E32]/30 border-r border-gray-800 flex flex-col shrink-0">
                                <div className="p-4 flex justify-between items-center sticky top-0 bg-[#0B0F19]/90 backdrop-blur border-b border-gray-800 z-10">
                                    <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">歷史紀錄 ({milestones.length})</span>
                                    <button onClick={resetForm} className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-1 flex items-center gap-1 rounded hover:bg-emerald-500/30 transition border border-emerald-500/30">
                                        <Plus className="w-3 h-3" /> 新增
                                    </button>
                                </div>
                                <div className="p-3 space-y-2 overflow-y-auto flex-1">
                                    {loading ? (
                                        <div className="text-gray-500 text-xs text-center py-4">載入中...</div>
                                    ) : milestones.length === 0 ? (
                                        <div className="text-gray-500 text-xs text-center py-4">目前沒有任何策略</div>
                                    ) : milestones.map(m => (
                                        <div
                                            key={m.id}
                                            className={`p-3 rounded-lg border cursor-pointer transition-colors group ${editingId === m.id ? 'bg-indigo-500/10 border-indigo-500/40' : 'bg-white/5 border-transparent hover:border-gray-700'}`}
                                            onClick={() => startEdit(m)}
                                        >
                                            <div className="flex justify-between items-start mb-1">
                                                <span className="text-[10px] text-gray-400 font-mono py-0.5 px-1.5 bg-black/40 rounded">{m.date}</span>
                                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${m.platform === 'ALL' ? 'text-indigo-400 bg-indigo-500/10' : 'text-emerald-400 bg-emerald-500/10'}`}>
                                                    {m.platform === 'ALL' ? 'MULTI' : m.platform}
                                                </span>
                                            </div>
                                            <h4 className="text-gray-200 text-sm font-bold truncate group-hover:text-white transition-colors">{m.title}</h4>
                                            {m.description && <p className="text-gray-500 text-[11px] mt-1 line-clamp-2">{m.description}</p>}
                                            {editingId === m.id && (
                                                <div className="mt-3 flex justify-end gap-2 border-t border-gray-800 pt-2">
                                                    <button onClick={(e) => { e.stopPropagation(); startEdit(m); }} className="text-gray-400 hover:text-indigo-400 p-1">
                                                        <Edit2 className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(m.id); }} className="text-gray-400 hover:text-rose-400 p-1">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Right Side: Form */}
                            <div className="flex-1 p-8 overflow-y-auto">
                                <h3 className="text-xl text-white font-bold mb-8 flex items-center gap-2">
                                    {editingId ? '✏️ 編輯策略' : '🚀 新增策略部署'}
                                </h3>

                                <form onSubmit={handleSave} className="space-y-6 max-w-3xl">
                                    {/* Title + Platform */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <div>
                                            <label className="block text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-2">
                                                策略標題 <span className="text-rose-500">*</span>
                                            </label>
                                            <input
                                                required
                                                type="text"
                                                className="w-full bg-[#151E32] text-white border border-gray-700 px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
                                                value={formData.title}
                                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                                                placeholder="例：縮短影片開頭鉤子"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-2">
                                                適用平台 <span className="text-rose-500">*</span>
                                            </label>
                                            <select
                                                className="w-full bg-[#151E32] text-white border border-gray-700 px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:border-indigo-500"
                                                value={formData.platform}
                                                onChange={e => setFormData({ ...formData, platform: e.target.value })}
                                            >
                                                <option value="ALL">MULTI-PLATFORM (全平台跨平台)</option>
                                                <option value="YOUTUBE">YouTube</option>
                                                <option value="INSTAGRAM">Instagram</option>
                                                <option value="TIKTOK">TikTok</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Description */}
                                    <div>
                                        <label className="block text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-2">策略詳細說明</label>
                                        <textarea
                                            rows={3}
                                            className="w-full bg-[#151E32] text-white border border-gray-700 px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:border-indigo-500 resize-none transition-colors"
                                            value={formData.description}
                                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                                            placeholder="記錄為什麼做這次改變？改變了什麼？"
                                        />
                                    </div>

                                    {/* Date Pickers */}
                                    <div className="border-t border-gray-800 pt-6">
                                        <h4 className="text-sm text-indigo-400 font-bold mb-4 flex items-center gap-2">
                                            <Calendar className="w-4 h-4" /> 部署與觀測區間設定
                                        </h4>

                                        <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-5">
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                {/* Column 1: Before Start */}
                                                <div>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <label className="text-[10px] text-gray-500 uppercase font-bold">
                                                            觀察開始日 <span className="text-rose-500">*</span>
                                                        </label>
                                                        <span className="text-[9px] text-gray-600">(BEFORE START)</span>
                                                    </div>
                                                    <MiniCalendar
                                                        value={formData.before_start}
                                                        onChange={v => setFormData({ ...formData, before_start: v })}
                                                        accentColor="indigo"
                                                    />
                                                </div>

                                                {/* Column 2: Pivot */}
                                                <div className="relative">
                                                    <div className="hidden md:block absolute top-8 -left-3 w-3 h-px bg-gray-700" />
                                                    <div className="hidden md:block absolute top-8 -right-3 w-3 h-px bg-gray-700" />
                                                    <div className="flex items-center justify-between mb-2 bg-emerald-500/10 px-2 py-0.5 rounded">
                                                        <label className="text-[10px] text-emerald-500 uppercase font-bold">
                                                            正式部署日 <span className="text-rose-500">*</span>
                                                        </label>
                                                        <span className="text-[9px] text-emerald-700">(PIVOT)</span>
                                                    </div>
                                                    <MiniCalendar
                                                        value={formData.date}
                                                        onChange={v => setFormData({ ...formData, date: v })}
                                                        accentColor="emerald"
                                                    />
                                                    <p className="text-[9px] text-gray-500 mt-2 text-center leading-tight">
                                                        自動切割：<br />(前天) Before End ／ (當天) After Start
                                                    </p>
                                                </div>

                                                {/* Column 3: After End */}
                                                <div>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <label className="text-[10px] text-gray-500 uppercase font-bold">
                                                            觀察結束日 <span className="text-rose-500">*</span>
                                                        </label>
                                                        <span className="text-[9px] text-gray-600">(AFTER END)</span>
                                                    </div>
                                                    <MiniCalendar
                                                        value={formData.after_end}
                                                        onChange={v => setFormData({ ...formData, after_end: v })}
                                                        accentColor="indigo"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Error message */}
                                    {saveError && (
                                        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm px-4 py-3 rounded-lg">
                                            ⚠️ {saveError}
                                        </div>
                                    )}

                                    {/* Submit */}
                                    <div className="pt-2 flex items-center justify-end gap-3">
                                        {editingId && (
                                            <button type="button" onClick={resetForm} className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-600 rounded-lg transition-colors">
                                                取消編輯
                                            </button>
                                        )}
                                        <button
                                            type="submit"
                                            disabled={isSaving}
                                            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-2.5 rounded-lg font-bold flex items-center gap-2 transition shadow-lg"
                                        >
                                            <Save className="w-4 h-4" />
                                            {isSaving ? '儲存中...' : '儲存部署'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
        , document.body);
};
