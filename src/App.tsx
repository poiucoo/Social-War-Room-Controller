import { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { AlertCircle, ChevronDown, ChevronUp, Hash, Loader2, Filter, Copy, CheckCircle2, Bookmark, Activity, Eye, ThumbsUp, Target, Menu, X, LayoutGrid, Database, BarChart2, RefreshCw, Focus, Calendar } from 'lucide-react';
import { supabase } from './lib/supabase';
import Papa from 'papaparse';
import { VideoDetailPanel } from './VideoDetailPanel';
import { ChannelMilestonePanel } from './ChannelMilestonePanel';

const SHEET_URL = "https://docs.google.com/spreadsheets/d/184Kve5A6Dto51RLbgDON3Z2zODiVniWVcIlWi1gNAVg/export?format=csv&gid=1214765895";

/** 
 * 強力標準化字串：移除所有不可見字元、前後空格並轉大寫
 * 用於徹底根除數據不一致導致的篩選失效
 */
const normalizeString = (str: any): string => {
    if (!str) return "";
    return String(str)
        .replace(/[\u200B-\u200D\uFEFF]/g, '') // 移除零寬空格等隱形字元
        .trim()
        .toUpperCase();
};

interface VideoData {
    id: string;
    originalId: string;
    sheetIndex: number; // 用於絕對唯一 ID 分辨
    title: string;
    channel: string;
    platform: string;
    thumbnail: string;
    publishedAt: string;
    timestamp: number;
    kpi: { views: number | string; likes: number | string; comments: number | string; watchTime: string; er: number | string; subs: number | string };
    l1Tags: string[];
    l2Tags: string[];
    retentionData: any[];
    dropEvents: Array<{
        timeIndex: number;
        timeLabel: string;
        severity: string;
        slideInsights: {
            role: string;
            visual: string;
            trigger: string;
            aiSummary: string;
            imageText: string;
            videoPrompt: string;
            strategy: string;
        }
    }>;
    timelineData: Array<{ day: string; views?: number; likes?: number; saves?: number; comments?: number }>;
    maxDuration: number;
    depthMetrics?: {
        averageRetention: number;
        averageWatchTime: string;
        endRetentionRate: number;
        stayAbove90End: string;
        stayAbove70End: string;
        rewatchDropStart: string;
        rewatchDropEnd: string;
        rewatchDropSeverity: number;
        coreDropStart: string;
        coreDropEnd: string;
        coreDropSeverity: number;
    };
    hasRetention: boolean;
    hasSlides: boolean;
    strategyLabels?: any[];
}

export default function ContentAttributionEngine() {
    const [expandedVideoId, setExpandedVideoId] = useState<string | null>(null);
    const [copiedTitleId, setCopiedTitleId] = useState<string | null>(null);
    const [videos, setVideos] = useState<VideoData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activePlatforms, setActivePlatforms] = useState<string[]>([]);
    const [activeChannels, setActiveChannels] = useState<string[]>([]);
    const [allSlidesData, setAllSlidesData] = useState<any[]>([]);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);
    const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(true);
    const [onlyHasRetention, setOnlyHasRetention] = useState(false);
    const [onlyHasSlides, setOnlyHasSlides] = useState(false);
    const [isMilestonePanelOpen, setIsMilestonePanelOpen] = useState(false);
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

    const [inlineMilestones, setInlineMilestones] = useState<any[]>([]);

    useEffect(() => {
        if (activeChannels.length !== 1) {
            setIsMilestonePanelOpen(false);
            setSelectedEventId(null);
            setInlineMilestones([]);
            return;
        }
        // 單一頻道選擇時，從 Supabase 抓取里程碑顯示在時間軸
        supabase
            .from('milestones')
            .select('*')
            .eq('channel_name', activeChannels[0])
            .order('date', { ascending: false })
            .then(({ data }) => {
                if (data && data.length > 0) {
                    setInlineMilestones(data.map(row => {
                        const pivotDate = new Date(row.date);
                        const beforeEnd = new Date(pivotDate);
                        beforeEnd.setDate(beforeEnd.getDate() - 1);
                        return {
                            id: row.id,
                            date: row.date,
                            platform: row.platform,
                            title: row.title,
                            description: row.description,
                            observationWindow: {
                                mode: 'auto',
                                beforeStarts: row.before_start,
                                beforeEnds: beforeEnd.toISOString().split('T')[0],
                                afterStarts: pivotDate.toISOString().split('T')[0],
                                afterEnds: row.after_end
                            }
                        };
                    }));
                } else {
                    setInlineMilestones([]);
                }
            });
    }, [activeChannels]);

    // Scroll inline event into view when selected from the sidebar
    useEffect(() => {
        if (selectedEventId) {
            const el = document.getElementById(`inline-evt-${selectedEventId}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, [selectedEventId]);

    // 使用 useMemo 快取過濾後的列表，確保在狀態切換時邏輯絕對精準
    const filteredVideos = useMemo(() => {
        return (videos || []).filter(v => {
            const vPlat = normalizeString(v.platform);
            const vChan = normalizeString(v.channel);

            const platformMatch = activePlatforms.length === 0 ||
                activePlatforms.some(p => normalizeString(p) === vPlat);
            const channelMatch = activeChannels.length === 0 ||
                activeChannels.some(c => normalizeString(c) === vChan);

            // 進階數據源過濾
            const retentionMatch = !onlyHasRetention || v.hasRetention;
            const slidesMatch = !onlyHasSlides || v.hasSlides;

            return platformMatch && channelMatch && retentionMatch && slidesMatch;
        });
    }, [videos, activePlatforms, activeChannels, onlyHasRetention, onlyHasSlides]);

    const combinedList = useMemo(() => {
        const list: any[] = filteredVideos.map(v => ({ type: 'video', data: v, timestamp: v.timestamp }));
        // 里程碑事件從 Supabase 即時讀取，插入時間軸
        inlineMilestones.forEach((e: any) => {
            const eventPlatform = String(e.platform).toUpperCase();
            const isMatch = activePlatforms.length === 0 ||
                            eventPlatform === 'ALL' ||
                            activePlatforms.some((p: string) => p.toUpperCase() === eventPlatform);
            if (isMatch) {
                list.push({ type: 'event', data: e, timestamp: new Date(e.date.replace(/-/g, '/')).getTime() });
            }
        });
        return list.sort((a, b) => b.timestamp - a.timestamp);
    }, [filteredVideos, activeChannels, activePlatforms, inlineMilestones]);

    const toggleFilter = (item: string, setter: any) => {
        setter((prev: string[]) => {
            if (item === 'all') return [];
            const normalizedItem = normalizeString(item);
            if (prev.includes(normalizedItem)) {
                return prev.filter(i => i !== normalizedItem);
            } else {
                return [...prev, normalizedItem];
            }
        });
        setExpandedVideoId(null);
    };



    const syncData = async (manual = false) => {
        try {
            if (manual) setIsSyncing(true);
            else setIsLoading(true);

            // 1. Fetch Supabase DB: Retention (Drops) & Slides (Visual elements) & Tags
            const { data: retData } = await supabase.from('yt_retention_analysis').select('*').order('created_at', { ascending: false });
            const { data: slidesData } = await supabase.from('video_slides_analysis').select('*').order('created_at', { ascending: false });
            const { data: tagsData } = await supabase.from('video_strategy_labels').select('*').order('created_at', { ascending: false });
            if (slidesData) setAllSlidesData(slidesData);

            // 2. Fetch Google Sheet Data (KPIs and Base Info)
            const res = await fetch(SHEET_URL);
            const csvText = await res.text();

            Papa.parse(csvText, {
                header: true,
                skipEmptyLines: true,
                transformHeader: (header, index) => header ? header : `Unnamed: ${index}`,
                complete: (results) => {
                    const sheetRows = results.data as any[];

                    // 1. 以 Google Sheet 為主數據源輸出所有影片
                    const realVideos: VideoData[] = [];

                    sheetRows.forEach((row, index) => {
                        const rawTitle = row['content_title'] || row['Title'] || `Untitled ${index}`;
                        const rawChannel = row['title'] || row['頻道'] || 'Unknown Channel';
                        const rawPlatform = row['platform'] || row['Platform'] || 'YOUTUBE';
                        const url = String(row['url'] || row['URL'] || '').trim();

                        // 標準化
                        const platformNorm = normalizeString(rawPlatform);
                        const channelNorm = normalizeString(rawChannel);

                        // 1. 強化 ID 提取邏輯：支援多種 URL 格式與後備機制
                        const getVid = (u: string) => {
                            if (!u) return '';
                            // YouTube Shorts
                            let m = u.match(/shorts\/([a-zA-Z0-9_-]{11})/);
                            if (m) return m[1];
                            // YouTube Watch
                            m = u.match(/v=([a-zA-Z0-9_-]{11})/);
                            if (m) return m[1];
                            // YouTube youtu.be
                            m = u.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
                            if (m) return m[1];
                            // Instagram Reel/P
                            m = u.match(/(?:reel|p)\/([a-zA-Z0-9_-]+)/);
                            if (m) return m[1];
                            return '';
                        };

                        let vId = getVid(url) || String(row['ID'] || '').trim();

                        // 使 ID 絕對唯一 (平台_影片ID_行號)，防止 React Key 碰撞
                        const uniqueId = `${platformNorm}_${vId || 'NOID'}_${index}`;

                        // 配對 Supabase DB 數據 (一級與二級標籤聚合)
                        // 強化：加入 trim 且不區分大小寫匹配 (雖 ID 通常區分，但保險起見)
                        const strategyRecord = tagsData?.find(t => t.video_id?.trim() === vId.trim()) || {};
                        const l1Tags: string[] = [];
                        const l2Tags: string[] = [];

                        (Object.entries(strategyRecord as Record<string, unknown>)).forEach(([key, val]: [string, unknown]) => {
                            if (!val || val === 'N/A' || val === '—' || val === '' || key === 'video_id' || key === 'analysis_updated_at') return;

                            const processVal = (v: any): string[] => {
                                if (Array.isArray(v)) return v.map(String);
                                if (typeof v === 'string') {
                                    if (v.startsWith('[') && v.endsWith(']')) {
                                        try {
                                            const parsed = JSON.parse(v);
                                            return Array.isArray(parsed) ? parsed.map(String) : [String(v)];
                                        } catch (e) { return [String(v)]; }
                                    }
                                    return [v];
                                }
                                return [String(v)];
                            };

                            if (key.startsWith('l1_')) {
                                l1Tags.push(...processVal(val));
                            } else if (key === 'l2_psych_drivers' || key === 'l2_content_core_dna_display' || key === 'l2_emotional_energy_level_display') {
                                l2Tags.push(...processVal(val));
                            }
                        });

                        const videoRetentions = retData?.filter(r => r.video_id === vId) || [];

                        // 3. 重建真實留存率曲線 (解讀 retention_csv 每個百分比對應的秒數)
                        let retentionCurve: any[] = [];
                        if (videoRetentions.length > 0 && videoRetentions[0].retention_csv) {
                            let totalSeconds = 0;
                            try {
                                const rawDur = videoRetentions[0].duration_raw || "0:00";
                                const parts = rawDur.split(':');
                                if (parts.length >= 2) totalSeconds = parseInt(parts[0]) * 60 + parseFloat(parts[1]);
                                else totalSeconds = parseFloat(rawDur);
                            } catch (e) { }

                            const csvVals = videoRetentions[0].retention_csv.split(',').map(Number);
                            const len = csvVals.length;
                            if (len > 1 && totalSeconds > 0) {
                                retentionCurve = csvVals.map((val: number, i: number) => {
                                    const sec = (i / (len - 1)) * totalSeconds;
                                    const min = Math.floor(sec / 60);
                                    const remSec = (sec % 60).toFixed(1);
                                    const fmtSec = remSec.length === 3 ? `0${remSec}` : remSec;
                                    return {
                                        time: parseFloat(sec.toFixed(1)),
                                        formattedTime: `0${min}:${fmtSec}`,
                                        retention: parseFloat((val * 100).toFixed(1))
                                    };
                                });
                            }
                        }

                        // (Fallback: 若沒有留存曲線，則不產生假數據，設為空陣列)
                        if (retentionCurve.length === 0) {
                            retentionCurve = [];
                        }

                        // 3.5 計算該影片的分析有效時長 (從 Slides 或 Retention 資料獲取)
                        const videoSlides = slidesData?.filter(s => s.video_id === vId) || [];
                        const maxSlideTime = videoSlides.length > 0
                            ? Math.max(...videoSlides.map(s => parseFloat(s.end_time)))
                            : 0;

                        const retentionMaxTime = retentionCurve.length > 0
                            ? retentionCurve[retentionCurve.length - 1].time
                            : 0;

                        const maxDuration = Math.max(maxSlideTime, retentionMaxTime);

                        // 4. 重大流失與高光事件配對
                        let finalEvents: any[] = [];
                        if (videoRetentions.length > 0) {
                            for (const drop of videoRetentions) {
                                if (!drop.drop_start) continue;
                                let dropS = 0;
                                try {
                                    const parts = drop.drop_start.split(':');
                                    if (parts.length >= 2) dropS = parseInt(parts[0]) * 60 + parseFloat(parts[1]);
                                } catch (e) { }

                                // Find Guilty Slide
                                const guiltySlides = slidesData?.filter(s => {
                                    if (s.video_id !== vId) return false;
                                    try {
                                        const stParts = s.start_time.split(':');
                                        const edParts = s.end_time.split(':');
                                        const sStart = parseInt(stParts[0]) * 60 + parseFloat(stParts[1]);
                                        const sEnd = parseInt(edParts[0]) * 60 + parseFloat(edParts[1]);
                                        return dropS >= sStart && dropS <= sEnd;
                                    } catch (e) { return false; }
                                }) || [];

                                const targetSlide = guiltySlides.length > 0 ? guiltySlides[0] : null;
                                const isPeak = drop.drop_type === 'Peak';

                                finalEvents.push({
                                    timeIndex: dropS, // numeric exact second match for line
                                    timeLabel: drop.drop_start.replace('.0', ''), // string like "0:04.6"
                                    severity: isPeak ? 'Positive' : 'Critical',
                                    slideInsights: {
                                        role: targetSlide?.role || '未配對到簡報角色',
                                        visual: targetSlide?.visual_evidence || '無對應特徵畫面 (可能發生於動態轉場)',
                                        trigger: targetSlide?.psychological_trigger || '無法解析觸發觀眾痛點的原因',
                                        imageText: targetSlide?.image_text_ch || '—',
                                        videoPrompt: targetSlide?.speech_content_ch || '—',
                                        strategy: targetSlide?.tag_alignment || '—',
                                        aiSummary: isPeak
                                            ? `高潮點歸因成功！發生了大約 +${Math.abs(drop.drop_severity || 0)}% 留存率修正，數據指出此處發生大量重播回看。`
                                            : `系統偵測到觀眾在此發生 -${Math.abs(drop.drop_severity || 0)}% 的斷崖流失。右列為對齊秒數所剖析出的致命簡報特徵。`
                                    }
                                });
                            }
                        }

                        // 防呆：有時候第一列會是中文的次要標頭，若符合則略過
                        if (rawTitle === '內容標題' || rawChannel === '頻道名稱') return;

                        const pubDate = String(row['date'] || row['Date'] || '2026/01/01');
                        let ts = 0;
                        try { ts = new Date(pubDate).getTime(); } catch (e) { }

                        // 建立時間序列趨勢資料 (1d, 2d, 3d, 7d, 14d)
                        // 建立時間序列趨勢資料 (0D, 1d, 2d, 3d, 7d, 14d)
                        const timelineData = [];
                        // 1. 新增 0D 基準點，數值皆為 0
                        timelineData.push({ day: '0D', views: 0, likes: 0, saves: 0, comments: 0 });

                        const dayMap = [
                            { label: '1D', v: '1d', l: 'Unnamed: 10', s: 'Unnamed: 11', c: 'Unnamed: 12' },
                            { label: '2D', v: '2d', l: 'Unnamed: 14', s: 'Unnamed: 15', c: 'Unnamed: 16' },
                            { label: '3D', v: '3d', l: 'Unnamed: 18', s: 'Unnamed: 19', c: 'Unnamed: 20' },
                            { label: '7D', v: '7d', l: 'Unnamed: 22', s: 'Unnamed: 23', c: 'Unnamed: 24' },
                            { label: '14D', v: '14d', l: 'Unnamed: 26', s: 'Unnamed: 27', c: 'Unnamed: 28' },
                        ];
                        for (const d of dayMap) {
                            const rawVal = String(row[d.v] || '').trim();
                            // 修正邏輯：即便沒數據 ('-' 或 '') 也 push 物件以固定 X 軸標籤位置
                            if (rawVal === '-' || rawVal === '') {
                                timelineData.push({ day: d.label }); // 不包含數字屬性，線會斷開
                                continue;
                            }

                            const views = parseInt(rawVal.replace(/,/g, '')) || 0;
                            const likes = parseInt(String(row[d.l] || '0').replace(/,/g, '')) || 0;
                            const saves = parseInt(String(row[d.s] || '0').replace(/,/g, '')) || 0;
                            const comments = parseInt(String(row[d.c] || '0').replace(/,/g, '')) || 0;

                            timelineData.push({ day: d.label, views, likes, saves, comments });
                        }

                        realVideos.push({
                            id: uniqueId,
                            originalId: vId,
                            sheetIndex: index,
                            title: rawTitle,
                            channel: channelNorm,
                            platform: platformNorm,
                            thumbnail: vId ? `https://img.youtube.com/vi/${vId}/maxresdefault.jpg` : 'https://placehold.co/600x400/1e293b/6366f1?text=No+Preview',
                            publishedAt: pubDate,
                            timestamp: ts,
                            kpi: {
                                views: row['觀看次數'] || row['views'] || (timelineData.filter(t => typeof t.views === 'number').pop()?.views) || 0,
                                likes: row['按讚數'] || row['likes'] || (timelineData.filter(t => typeof t.likes === 'number').pop()?.likes) || 0,
                                comments: row['留言數'] || row['comments'] || (timelineData.filter(t => typeof t.comments === 'number').pop()?.comments) || 0,
                                watchTime: row['平均觀看時間'] || row['觀看時間'] || row['average_watch_time'] || '0:00',
                                er: row['留言%'] || row['ER(%)'] || row['daily_engagement'] || 0,
                                subs: row['獲得訂閱數'] || row['subs'] || 0
                            },
                            l1Tags: Array.from(new Set(l1Tags)),
                            l2Tags: Array.from(new Set(l2Tags)),
                            strategyLabels: Object.keys(strategyRecord).length > 0 ? [strategyRecord] : [],
                            retentionData: retentionCurve,
                            dropEvents: finalEvents,
                            timelineData: timelineData,
                            maxDuration: maxDuration,
                            hasRetention: retentionCurve.length > 0,
                            hasSlides: videoSlides.length > 0,
                            depthMetrics: videoRetentions.length > 0 ? {
                                averageRetention: videoRetentions[0].average_retention,
                                averageWatchTime: videoRetentions[0].average_watch_time,
                                endRetentionRate: videoRetentions[0].end_retention_rate,
                                stayAbove90End: videoRetentions[0].stay_above_90_end,
                                stayAbove70End: videoRetentions[0].stay_above_70_end,
                                rewatchDropStart: videoRetentions[0].rewatch_drop_start,
                                rewatchDropEnd: videoRetentions[0].rewatch_drop_end,
                                rewatchDropSeverity: videoRetentions[0].rewatch_drop_severity,
                                coreDropStart: videoRetentions[0].core_drop_start,
                                coreDropEnd: videoRetentions[0].core_drop_end,
                                coreDropSeverity: videoRetentions[0].core_drop_severity,
                            } : undefined
                        });
                    });

                    // 新到舊排序 (Sort by Date Descending)
                    realVideos.sort((a, b) => b.timestamp - a.timestamp);

                    // Pick all parsed videos that exist in the DB (should be ~10)
                    setVideos(realVideos);
                    if (realVideos.length > 0 && !manual) setExpandedVideoId(realVideos[0].id);

                    const now = new Date();
                    setLastUpdated(`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`);
                    setIsLoading(false);
                    setIsSyncing(false);
                }
            });

        } catch (err) {
            console.error("Data Sync Error:", err);
            setIsLoading(false);
            setIsSyncing(false);
        }
    }

    useEffect(() => {
        syncData();
    }, []);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#0B0F19] flex flex-col items-center justify-center text-indigo-400">
                <Loader2 className="w-12 h-12 animate-spin mb-4" />
                <p className="font-bold tracking-widest text-lg">DATALINK ESTABLISHING...</p>
                <p className="text-gray-500 text-sm mt-2">正在從 Supabase 與 Google Sheet 汲取並 JOIN 真實數據</p>
            </div>
        )
    }

    if (videos.length === 0) {
        return (
            <div className="min-h-screen bg-[#0B0F19] flex flex-col items-center justify-center text-rose-400">
                <AlertCircle className="w-12 h-12 mb-4" />
                <p className="font-bold">找不到關聯資料</p>
                <p className="text-gray-500 text-sm mt-2">無法配對 Google Sheet 發文資料庫與 Supabase 重大事件庫。請確認資料來源。</p>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#0B0F19] text-gray-200 font-sans selection:bg-indigo-500/30 flex overflow-hidden">

            {/* A. 側邊導覽列 (Collapsed Sidebar) */}
            <aside
                className={`fixed inset-y-0 left-0 z-50 bg-[#0F172A] border-r border-gray-800 transition-all duration-300 ease-in-out lg:relative ${isSidebarOpen ? 'w-64' : 'w-20'
                    }`}
            >
                <div className="h-16 flex items-center justify-between px-6 border-b border-gray-800">
                    {isSidebarOpen && (
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded bg-indigo-500 flex items-center justify-center">
                                <Activity className="w-3.5 h-3.5 text-white" />
                            </div>
                            <span className="text-sm font-bold tracking-tight text-white">WAR ROOM</span>
                        </div>
                    )}
                    {!isSidebarOpen && (
                        <div className="w-full flex justify-center">
                            <div className="w-8 h-8 rounded bg-indigo-500 flex items-center justify-center">
                                <Activity className="w-4 h-4 text-white" />
                            </div>
                        </div>
                    )}
                    <button
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="p-2 rounded-lg hover:bg-white/5 text-gray-400 transition-colors"
                    >
                        {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>
                </div>

                <div className="py-6 px-3 space-y-2">
                    <div
                        className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all cursor-pointer bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-[0_0_15px_-4px_rgba(99,102,241,0.3)]`}
                    >
                        <LayoutGrid className="w-5 h-5 shrink-0" />
                        {isSidebarOpen && (
                            <div className="flex flex-col min-w-0">
                                <span className="text-sm font-bold truncate">內容歸因引擎</span>
                                <span className="text-[9px] uppercase tracking-tighter opacity-50 font-mono">AUTOMATED ATTRIBUTION</span>
                            </div>
                        )}
                    </div>

                    <div className="pt-4 px-3 mb-2">
                        {isSidebarOpen ? (
                            <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest leading-none">Modules</span>
                        ) : (
                            <div className="h-px bg-gray-800 w-full" />
                        )}
                    </div>

                    <div className="group flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-500 hover:bg-white/5 hover:text-gray-300 transition-all cursor-not-allowed grayscale">
                        <Database className="w-5 h-5 shrink-0" />
                        {isSidebarOpen && <span className="text-sm font-medium">資料庫管理</span>}
                    </div>

                    <div className="group flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-500 hover:bg-white/5 hover:text-gray-300 transition-all cursor-not-allowed grayscale">
                        <BarChart2 className="w-5 h-5 shrink-0" />
                        {isSidebarOpen && <span className="text-sm font-medium">深度洞察匯報</span>}
                    </div>
                </div>

                {isSidebarOpen && (
                    <div className="absolute bottom-6 left-6 right-6">
                        <div className="bg-[#151E32] rounded-2xl p-4 border border-indigo-500/20">
                            <p className="text-[10px] font-bold text-indigo-400 uppercase mb-2">System Status</p>
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[11px] text-gray-400 font-medium">DB Stream Connected</span>
                            </div>
                        </div>
                    </div>
                )}
            </aside>

            {/* B. 主內容區域 (Main Content View) */}
            <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
                <nav className="border-b border-gray-800 bg-[#0F172A]/80 backdrop-blur-md sticky top-0 z-40">
                    <div className="max-w-full px-8 h-16 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <h1 className="text-lg font-bold tracking-tight text-white">
                                Content<span className="text-emerald-400 font-light">Attribution</span>
                            </h1>
                            <div className="h-4 w-px bg-gray-800 hidden sm:block" />
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] uppercase font-bold tracking-widest hidden sm:inline-block">
                                Live API Connected
                            </span>
                        </div>

                        <div className="flex items-center gap-6">
                            {lastUpdated && (
                                <div className="hidden md:flex flex-col items-end">
                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-0.5">Last Updated</span>
                                    <span className="text-xs font-mono text-gray-300 font-bold">{lastUpdated}</span>
                                </div>
                            )}
                            <button
                                onClick={() => syncData(true)}
                                disabled={isSyncing}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500 hover:text-white transition-all group ${isSyncing ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                                <span className="text-sm font-bold">同步資料庫</span>
                            </button>
                        </div>
                    </div>
                </nav>

                <main className="flex-grow p-8 lg:p-12 space-y-12 w-full">

                    {/* 頁首標題區 */}
                    <header className="flex flex-col gap-2">
                        <h2 className="text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
                            全自動內容歸因引擎 <span className="text-gray-500 font-light text-2xl">| 真實數據同步版</span>
                        </h2>
                        <p className="text-gray-400 max-w-2xl leading-relaxed mt-2 text-sm sm:text-base">
                            目前已連線您的 Google Sheet 與 Supabase 資料庫。此引擎透過分析 <strong>{videos.length} 取樣的「擁有受眾流失標記的影片」</strong> ，進行 Slide 與留存率聯集，實現數據驅動 (Data-Driven) 的簡報畫面改善歸因。
                        </p>
                    </header>

                    {/* 多維度篩選器 (Filter Bar) */}
                    <div className="bg-[#0F172A] border border-gray-800 rounded-2xl shadow-xl overflow-hidden mb-8">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-[#0F172A]">
                            <div className="flex items-center gap-3">
                                <Filter className="w-5 h-5 text-indigo-400" />
                                <h3 className="font-bold text-white tracking-wide">資料庫多維度篩選</h3>
                            </div>
                            <button
                                onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
                                className="p-2 hover:bg-white/5 rounded-lg text-gray-400 transition-colors"
                            >
                                {isFilterPanelOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                            </button>
                        </div>

                        <div className={`transition-all duration-300 ease-in-out ${isFilterPanelOpen ? 'max-h-[1000px] opacity-100 p-6' : 'max-h-0 opacity-0 p-0 overflow-hidden'}`}>
                            <div className="space-y-6">

                                {/* Platform Filters */}
                                <div>
                                    <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-3">社群平台 (Platforms)</p>
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            onClick={() => toggleFilter('all', setActivePlatforms)}
                                            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all border ${activePlatforms.length === 0
                                                ? 'bg-indigo-500 text-white border-indigo-400 shadow-[0_0_15px_-3px_rgba(99,102,241,0.4)]'
                                                : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
                                                }`}
                                        >
                                            所有平台
                                        </button>
                                        {Array.from(new Set(videos.map(v => v.platform))).filter(Boolean).map(plat => (
                                            <button
                                                key={plat}
                                                onClick={() => toggleFilter(plat, setActivePlatforms)}
                                                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all border ${activePlatforms.includes(plat)
                                                    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500 shadow-[0_0_15px_-3px_rgba(99,102,241,0.2)]'
                                                    : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10 hover:text-gray-200'
                                                    }`}
                                            >
                                                {plat}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Channel Filters */}
                                <div>
                                    <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-3">創作者頻道 (Channels)</p>
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            onClick={() => toggleFilter('all', setActiveChannels)}
                                            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all border ${activeChannels.length === 0
                                                ? 'bg-emerald-500 text-white border-emerald-400 shadow-[0_0_15px_-3px_rgba(16,185,129,0.4)]'
                                                : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
                                                }`}
                                        >
                                            所有頻道
                                        </button>
                                        {Array.from(new Set(videos.map(v => v.channel))).map((channel) => (
                                            <button
                                                key={channel}
                                                onClick={() => toggleFilter(channel, setActiveChannels)}
                                                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all border ${activeChannels.includes(normalizeString(channel))
                                                    ? 'bg-emerald-500 text-white border-emerald-400 shadow-[0_0_15px_-3px_rgba(16,185,129,0.4)]'
                                                    : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
                                                    }`}
                                            >
                                                {channel}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Data Source Filters */}
                                <div className="pt-2">
                                    <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-3">數據深度 (Data Source)</p>
                                    <div className="flex flex-wrap gap-3">
                                        <button
                                            onClick={() => setOnlyHasRetention(!onlyHasRetention)}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all border ${onlyHasRetention
                                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-[0_0_12px_-4px_rgba(16,185,129,0.5)]'
                                                : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
                                                }`}
                                        >
                                            <BarChart2 className={`w-4 h-4 ${onlyHasRetention ? 'animate-pulse' : ''}`} />
                                            <span className="text-sm font-bold">僅顯示有續看數據</span>
                                        </button>
                                        <button
                                            onClick={() => setOnlyHasSlides(!onlyHasSlides)}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all border ${onlyHasSlides
                                                ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/50 shadow-[0_0_12px_-4px_rgba(99,102,241,0.5)]'
                                                : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
                                                }`}
                                        >
                                            <Focus className={`w-4 h-4 ${onlyHasSlides ? 'animate-pulse' : ''}`} />
                                            <span className="text-sm font-bold">僅顯示有畫面解剖</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 影片清單與功過表面板容器移至外部以防止受 max-h-0 影響 */}
                    </div>
                    {/* 影片清單與任務事件混合列表 */}
                    <div className="space-y-6 relative mt-10 pr-20">
                        <div 
                            className="absolute right-10 -top-5 w-10 h-10 translate-x-1/2 rounded-full bg-[#0B0F19] border border-indigo-500/50 flex items-center justify-center cursor-pointer shadow-[0_0_15px_rgba(99,102,241,0.3)] hover:bg-indigo-500 hover:border-indigo-400 hover:text-white text-indigo-400 transition-all z-20 group"
                            onClick={() => { setIsMilestonePanelOpen(true); setSelectedEventId(null); }}
                            title="展開完整的頻道調整歷程"
                        >
                            <Target className="w-5 h-5 group-hover:scale-110 transition-transform" />
                        </div>
                        <div className="absolute right-10 top-0 bottom-0 w-px bg-gradient-to-b from-indigo-500/50 via-gray-800 to-transparent z-0"></div>

                        {combinedList.map((item, _index) => {
                            if (item.type === 'video') {
                                const video = item.data;
                                const isExpanded = expandedVideoId === video.id;

                                return (
                                    <div
                                        key={video.id}
                                    className={`rounded-2xl border transition-all duration-500 overflow-hidden ${isExpanded
                                        ? 'bg-[#151E32] border-indigo-500/30 shadow-[0_0_40px_-10px_rgba(99,102,241,0.15)]'
                                        : 'bg-[#0F172A] border-gray-800 hover:border-gray-700 cursor-pointer'
                                        }`}
                                >
                                    {/* 影片卡片標題列 (A. 全局統整標籤與 KPI) */}
                                    <div
                                        className="p-6 md:p-8 flex flex-col xl:flex-row gap-8 xl:items-center cursor-pointer group"
                                        onClick={() => setExpandedVideoId(isExpanded ? null : video.id)}
                                    >
                                        <div className="flex gap-6 flex-1 min-w-0 flex-col sm:flex-row items-start sm:items-center">
                                            <div className="w-full sm:w-48 aspect-video rounded-xl overflow-hidden shrink-0 relative bg-gray-900 ring-1 ring-white/10 group-hover:ring-indigo-500/50 transition-all">
                                                {/* Fetch valid YouTube Thumbnail based on video ID */}
                                                <img src={video.thumbnail} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt="thumbnail" />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                                                <span className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/70 backdrop-blur-sm rounded text-[10px] font-bold text-white tracking-wider">
                                                    {video.kpi.watchTime}
                                                </span>
                                            </div>
                                            <div className="flex flex-col justify-center min-w-0 pr-4">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <span className="bg-red-500/10 text-red-400 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border border-red-500/20">{video.platform} · {video.channel}</span>
                                                    <span
                                                        className="bg-indigo-500/10 text-indigo-400 px-2.5 py-1 rounded text-[13px] font-mono border border-indigo-500/20 cursor-pointer hover:bg-indigo-500/20 transition-all active:scale-95 flex items-center gap-2"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            navigator.clipboard.writeText(video.originalId);
                                                            setCopiedTitleId(video.id + '_id');
                                                            setTimeout(() => setCopiedTitleId(null), 2000);
                                                        }}
                                                        title="點擊複製 ID"
                                                    >
                                                        {copiedTitleId === video.id + '_id' ? (
                                                            <>
                                                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                                                <span className="text-emerald-400">COPIED</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Database className="w-3.5 h-3.5 opacity-50" />
                                                                <span>ID: {video.originalId}</span>
                                                                <div className="flex items-center gap-1 border-l border-indigo-500/20 pl-2 ml-1">
                                                                    <BarChart2
                                                                        className={`w-3.5 h-3.5 ${video.hasRetention ? 'text-emerald-400' : 'text-gray-600 opacity-20'}`}
                                                                    />
                                                                    <Focus
                                                                        className={`w-3.5 h-3.5 ${video.hasSlides ? 'text-indigo-400' : 'text-gray-600 opacity-20'}`}
                                                                    />
                                                                </div>
                                                            </>
                                                        )}
                                                    </span>
                                                    <span className="text-gray-400 text-xs font-mono">{video.publishedAt}</span>
                                                </div>

                                                <div className="relative group/title mb-3 flex items-start gap-4">
                                                    <h3 className="text-xl font-bold text-white group-hover:text-indigo-400 transition-colors line-clamp-2 leading-snug flex-1"
                                                        title={video.title}>
                                                        {video.title}
                                                    </h3>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            navigator.clipboard.writeText(video.title);
                                                            setCopiedTitleId(video.id + '_title');
                                                            setTimeout(() => setCopiedTitleId(null), 2000);
                                                        }}
                                                        className="shrink-0 p-2 bg-gray-800 hover:bg-indigo-500 rounded-lg text-gray-300 hover:text-white transition-all shadow-lg border border-gray-700 hover:border-indigo-400 flex items-center gap-2 opacity-0 group-hover/title:opacity-100"
                                                        title="複製標題"
                                                    >
                                                        {copiedTitleId === video.id + '_title' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                                                        <span className="text-xs font-bold uppercase tracking-tighter">{copiedTitleId === video.id + '_title' ? '已複製' : '複製標題'}</span>
                                                    </button>
                                                </div>

                                                <div className="flex flex-col gap-2.5 mt-2">
                                                    {/* 第一行：一級標籤 (策略/結構) - Indigo */}
                                                    {video.l1Tags.length > 0 && (
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {video.l1Tags.map((tag: string, idx: number) => (
                                                                <span key={idx} className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 whitespace-nowrap">
                                                                    <Hash className="w-2.5 h-2.5 text-indigo-400" /> {tag.replace(/\[|\]|"/g, '')}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {/* 第二行：二級標籤 (心理/核心) - Emerald */}
                                                    {video.l2Tags.length > 0 && (
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {video.l2Tags.map((tag: string, idx: number) => (
                                                                <span key={idx} className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 whitespace-nowrap">
                                                                    <Activity className="w-2.5 h-2.5 text-emerald-400" /> {tag.replace(/\[|\]|"/g, '')}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {video.l1Tags.length === 0 && video.l2Tags.length === 0 && (
                                                        <span className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-md bg-white/5 text-gray-500 border border-white/5">
                                                            <Hash className="w-3 h-3 opacity-20" /> 無標籤
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* 趨勢小線圖 (Sparklines) */}
                                        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-4 gap-3 xl:w-[480px] shrink-0 mt-4 xl:mt-0 pb-4 xl:pb-0 pr-4">
                                            {[
                                                { key: 'views', label: '觀看', color: '#10B981', icon: Eye },
                                                { key: 'likes', label: '按讚', color: '#F43F5E', icon: ThumbsUp },
                                                { key: 'saves', label: '收藏', color: '#6366F1', icon: Bookmark },
                                                { key: 'comments', label: '留言', color: '#F59E0B', icon: Target }
                                            ].map((metric) => {
                                                const tl = video.timelineData;
                                                // 修正：僅過濾出真正有數值的節點，排除為了固定 X 軸而產生的空節點或字串
                                                const validTl = tl.filter((t: Record<string, unknown>) => typeof t[metric.key] === 'number');
                                                const lastVal = validTl.length > 0 ? validTl[validTl.length - 1][metric.key as keyof typeof validTl[0]] : 0;

                                                return (
                                                    <div key={metric.key} className="bg-[#0B0F19]/60 rounded-xl border border-white/5 overflow-hidden flex flex-col pt-3 relative group/spark mx-1 sm:mx-0">
                                                        <div className="px-3 flex justify-between items-start z-10">
                                                            <p className="text-gray-500 text-[10px] uppercase font-bold tracking-widest flex items-center gap-1"><metric.icon className="w-3 h-3" /> {metric.label}</p>
                                                            <p className={`text-sm font-bold`} style={{ color: metric.color }}>{typeof lastVal === 'number' ? lastVal.toLocaleString() : lastVal}</p>
                                                        </div>
                                                        <div className="h-10 w-full mt-1 relative -bottom-1">
                                                            {validTl.length > 1 ? (
                                                                <ResponsiveContainer width="100%" height="100%">
                                                                    <LineChart data={validTl} margin={{ top: 2, right: 3, left: 3, bottom: 0 }}>
                                                                        <Line type="monotone" dataKey={metric.key} stroke={metric.color} strokeWidth={2} dot={false} isAnimationActive={false} />
                                                                    </LineChart>
                                                                </ResponsiveContainer>
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center text-[9px] text-gray-700 font-bold">INSUFFICIENT DATA</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>

                                        <div className="hidden xl:flex items-center justify-center p-4">
                                            <ChevronDown className={`w-6 h-6 text-gray-500 transition-transform duration-500 ${isExpanded ? 'rotate-180 text-indigo-400' : 'group-hover:text-white'}`} />
                                        </div>
                                    </div>

                                    {/* 展開面板：B, C, D 功能區 */}
                                    <div className={`grid transition-all duration-500 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                                        <div className="overflow-hidden">
                                            <VideoDetailPanel video={video} allSlidesData={allSlidesData} />
                                        </div>
                                    </div>
                                </div>
                            );
                            } else {
                                const evt = item.data;
                                const isSelected = selectedEventId === evt.id;
                                
                                return (
                                    <div key={`evt-${evt.id}`} id={`inline-evt-${evt.id}`} className={`relative group w-full flex justify-end items-center shrink-0 z-10 transition-all cursor-pointer py-4`} onClick={() => { setSelectedEventId(evt.id); setIsMilestonePanelOpen(true); }}>
                                        <div className={`absolute top-1/2 w-3 h-3 rounded-full ${isSelected ? 'bg-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.8)]' : 'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.6)] group-hover:bg-indigo-400 group-hover:scale-125'} ring-4 ring-[#0B0F19] transition-all duration-300`} style={{ right: '-40px', transform: 'translate(50%, -50%)' }}></div>
                                        
                                        <div className={`mr-10 w-[260px] md:w-[280px] bg-[#151E32]/90 backdrop-blur-md border rounded-xl p-3.5 shadow-xl transition-all duration-300 border-gray-700/60 ${isSelected ? 'ring-1 ring-emerald-500/50 bg-[#151E32] scale-[1.02]' : 'hover:bg-[#151E32]'}`}>
                                            <div className="flex items-center gap-2 mb-1.5">
                                                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                                                <span className="text-[11px] font-mono text-gray-400 font-bold tracking-wide">{evt.date}</span>
                                                <span className={`ml-auto text-[9px] px-1.5 py-0.5 rounded uppercase tracking-widest border ${
                                                    evt.platform === 'YOUTUBE' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 
                                                    evt.platform === 'INSTAGRAM' ? 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20' :
                                                    evt.platform === 'TIKTOK' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' :
                                                    'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                }`}>{evt.platform}</span>
                                            </div>
                                            <p className={`text-sm font-bold leading-snug mb-1.5 transition-colors ${isSelected ? 'text-emerald-300' : 'text-gray-200 group-hover:text-white'}`}>{evt.title}</p>
                                            <p className="text-[10px] text-emerald-400/80 font-medium flex items-center gap-1.5">
                                                <Eye className="w-3 h-3" /> 點擊展開前後數據比較
                                            </p>
                                        </div>
                                    </div>
                                );
                            }
                        })}
                    </div>
                </main>
            </div>

            {/* C. 右側邊欄：單一頻道 Milestone 面板 */}
            <ChannelMilestonePanel
                channelName={activeChannels.length > 0 ? activeChannels[0] : ""}
                isOpen={isMilestonePanelOpen}
                selectedEventId={selectedEventId}
                activePlatforms={activePlatforms}
                videos={videos}
                onSelectEvent={(id) => setSelectedEventId(id)}
                onClose={() => setIsMilestonePanelOpen(false)}
            />
        </div>
    );
}
