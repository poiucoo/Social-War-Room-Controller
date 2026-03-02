import { useState, useEffect, useMemo } from 'react';
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Activity, TrendingUp, List, Eye, MousePointerClick, Layers, Flame, AlertCircle, RefreshCw, LayoutDashboard, LineChart, Hash, Menu, X, ExternalLink, ChevronDown } from 'lucide-react';
import { supabase } from './lib/supabase';

interface Channel {
    id: string;
    name: string;
}

interface ChannelStat {
    id: string;
    channel_id: string;
    title: string;
    subscribers?: number;
    followsCount?: number;
    total_views?: number;
    video_count?: number;
    igtvVideoCount?: number;
    platform?: string;
    name?: string;
    custom_url?: string;
    ownerUsername?: string;
    url?: string;
    timestamp?: string;
    created_at?: string;
}

interface YoutubeReporting {
    id: string | number;
    date: number;
    channel_id: string;
    video_id: string;
    views: number;
    watch_time_minutes: number;
    average_view_duration_seconds: number;
    subscribers_gained: number;
    subscribers_lost: number;
    likes: number;
    comments: number;
    shares: number;
}

// 預設頻道分類映射表
const channelTypeMap: Record<string, { label: string, color: string, bg: string }> = {
    'Ishaan': { label: '網賺 Business', color: 'text-amber-700', bg: 'bg-amber-100' },
    'Aarav': { label: '體育 Sports', color: 'text-blue-700', bg: 'bg-blue-100' },
    'Arman': { label: '故事 Story', color: 'text-purple-700', bg: 'bg-purple-100' }
};

interface PostData {
    id: string;
    channel_id: string;
    channels?: Channel;
    platform: string;
    title: string;
    description?: string;
    tags?: string[];
    url?: string;

    // 真實的計數欄位
    viewCount?: number;
    likeCount?: number;
    commentCount?: number;

    // 為了向前相容與動態屬性
    metrics?: {
        views: number;
        likes: number;
        comments: number;
    };
    publishedAt?: string;
    timestamp?: string;

    // 前端計算後的屬性
    viralScore?: number;
    er?: number;
    hoursSincePublished?: number;

    youtubeMetrics?: YoutubeReporting;

    [key: string]: any;
}

const MOCK_DATA: PostData[] = [
    { id: '1', channel_id: 'c1', channels: { id: 'c1', name: 'Tech Bro' }, platform: 'youtube', title: 'Vue.js vs React.js in 2026', content_id: 'v1', metrics: { views: 500000, likes: 25000, comments: 1200 }, timestamp: new Date(Date.now() - 24 * 3600 * 1000).toISOString() },
    { id: '2', channel_id: 'c1', channels: { id: 'c1', name: 'Tech Bro' }, platform: 'instagram', title: 'Desk Setup Tour', content_id: 'v2', metrics: { views: 120000, likes: 10000, comments: 400 }, timestamp: new Date(Date.now() - 48 * 3600 * 1000).toISOString() },
    { id: '3', channel_id: 'c2', channels: { id: 'c2', name: 'Design Daily' }, platform: 'threads', title: 'Why I left Figma', content_id: 'v3', metrics: { views: 80000, likes: 5000, comments: 2000 }, timestamp: new Date(Date.now() - 5 * 3600 * 1000).toISOString() },
    { id: '4', channel_id: 'c2', channels: { id: 'c2', name: 'Design Daily' }, platform: 'youtube', title: 'UI Trends 2026', content_id: 'v4', metrics: { views: 200000, likes: 8000, comments: 500 }, timestamp: new Date(Date.now() - 72 * 3600 * 1000).toISOString() },
];

function calculateMetrics(item: any): PostData {
    // 安全解析時間，優先取真實拿到的 publishedAt
    const safeTimestamp = item.publishedAt || item.timestamp || item.created_at || new Date().toISOString();
    const hoursSincePublished = Math.max(0.1, (Date.now() - new Date(safeTimestamp).getTime()) / (1000 * 3600));

    // 通用流量提取：優先使用真實欄位 viewCount，若無則降級
    const views = Number(item.viewCount) || item.metrics?.views || item.view_count || item.views || 0;
    const likes = Number(item.likeCount) || item.metrics?.likes || item.like_count || item.likes || 0;
    const comments = Number(item.commentCount) || item.metrics?.comments || item.comment_count || item.comments || 0;

    const viralScore = Math.round(views / hoursSincePublished);
    const er = views > 0 ? ((likes + comments) / views) * 100 : 0;

    return {
        ...item,
        title: item.title || item.name || '未命名內容',
        platform: item.platform || 'unknown',
        timestamp: safeTimestamp,
        viewCount: views,
        likeCount: likes,
        commentCount: comments,
        viralScore,
        er: parseFloat(er.toFixed(2)),
        hoursSincePublished,
        // 確保 tags 為陣列格式
        tags: Array.isArray(item.tags) ? item.tags : (typeof item.tags === 'string' ? item.tags.split(',') : [])
    };
}

const platformColors: Record<string, string> = {
    youtube: '#FF0000',
    instagram: '#E1306C',
    threads: '#000000'
};

const platformBgColors: Record<string, string> = {
    youtube: 'bg-[#FF0000]',
    instagram: 'bg-[#E1306C]',
    threads: 'bg-[#000000]'
};

const CHART_COLORS = ['#6366F1', '#F59E0B', '#10B981', '#EC4899', '#8B5CF6', '#14B8A6', '#F43F5E', '#0EA5E9', '#84CC16', '#A855F7'];

export default function App() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [currentView, setCurrentView] = useState<'dashboard' | 'insights' | 'channel' | 'wall-of-fame' | 'tags'>('dashboard');

    const [data, setData] = useState<PostData[]>([]);
    const [channelDataList, setChannelDataList] = useState<ChannelStat[]>([]);
    const [youtubeReports, setYoutubeReports] = useState<YoutubeReporting[]>([]);

    const [isLoading, setIsLoading] = useState(true);

    const [platformFilter, setPlatformFilter] = useState('all');
    const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
    const [isChannelDropdownOpen, setIsChannelDropdownOpen] = useState(false);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            // 查詢 daily_video_stats 並關聯 daily_channel_stats 取得頻道名稱
            const { data: videoData, error: videoError } = await supabase
                .from('daily_video_stats')
                .select('*');

            if (videoError) throw videoError;

            const { data: channelData, error: channelError } = await supabase
                .from('daily_channel_stats')
                .select('*');

            if (channelError) throw channelError;

            // 抓取 youtube_reporting 詳細資料
            const { data: reportingData, error: reportingError } = await supabase
                .from('youtube_reporting')
                .select('*')
                .gte('views', 0); // 基本過濾，確保有資料

            if (reportingError) {
                console.warn('youtube_reporting fetch failed:', reportingError);
                // 不要因為這個錯就中斷整個戰情室
            } else {
                setYoutubeReports(reportingData || []);
            }

            // 建立 Channel Dictionary
            const channelMap = new Map();
            if (channelData) {
                setChannelDataList(channelData); // 供給頻道概況使用

                channelData.forEach((c: any) => {
                    const cid = c.channel_id;
                    if (cid) channelMap.set(cid, c);
                });
            }

            if (videoData && videoData.length > 0) {
                // 將查詢到的 channels 資料結構映射到現有 UI 需要的格式
                const processedData = videoData.map((item: any) => {
                    const cid = item.channel_id || item.channelId;
                    const matchedChannel = channelMap.get(cid) || { id: cid || 'unknown', name: `頻道 ${cid || '未知'}` };

                    const vid = item.content_id || item.video_id || item.url?.split('v=')[1] || item.id;
                    const ytReport = (reportingData || []).find((r: any) => r.video_id === vid);

                    return calculateMetrics({
                        ...item,
                        channels: matchedChannel,
                        youtubeMetrics: ytReport
                    });
                });
                setData(processedData);
            } else {
                // Fallback for development if table is empty
                console.warn('Table is empty or RLS prevented access. Using Mock Data for preview.');
                setData(MOCK_DATA.map(calculateMetrics));
            }
        } catch (err: any) {
            console.error('Error fetching data:', err);
            // Fallback to demo data to keep the UI interactive during development
            setData(MOCK_DATA.map(calculateMetrics));
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Extract unique channels with proper titles and platform filtering
    const uniqueChannels = useMemo(() => {
        const map = new Map<string, { id: string, name: string, platform: string }>();
        channelDataList.forEach(c => {
            const cid = c.channel_id;
            if (!cid) return;
            const ctitle = c.title || c.name || `頻道 ${cid}`;
            const cplatform = c.platform?.toLowerCase() || 'youtube';
            if (platformFilter === 'all' || platformFilter === cplatform) {
                if (!map.has(cid)) {
                    map.set(cid, { id: cid, name: ctitle, platform: cplatform });
                }
            }
        });
        return Array.from(map.values());
    }, [channelDataList, platformFilter]);

    // App.tsx 中負責過濾與彙整的核心邏輯
    const historicalFilteredData = useMemo(() => {
        let result = [...data];

        if (platformFilter !== 'all') {
            result = result.filter(d => (d.platform?.toLowerCase() || 'youtube') === platformFilter);
        }

        if (selectedChannels.length > 0) {
            result = result.filter(d =>
                selectedChannels.includes(d.channels?.id || '') ||
                selectedChannels.includes(d.channel_id || '')
            );
        }

        return result;
    }, [data, platformFilter, selectedChannels]);

    // 取「最新一筆」作為儀表板的現況指標與排行
    const latestFilteredData = useMemo(() => {
        const map = new Map<string, PostData>();
        historicalFilteredData.forEach(d => {
            const uniqueId = d.content_id || d.video_id || d.url || d.title || d.id;
            const existing = map.get(uniqueId);
            const tDate = d.timestamp ? new Date(d.timestamp).getTime() : 0;
            const existingDate = existing && existing.timestamp ? new Date(existing.timestamp).getTime() : 0;

            if (!existing || tDate > existingDate) {
                map.set(uniqueId, d);
            }
        });

        const result = Array.from(map.values());
        result.sort((a, b) => {
            const timeA = new Date(a.timestamp ? String(a.timestamp) : 0).getTime();
            const timeB = new Date(b.timestamp ? String(b.timestamp) : 0).getTime();
            return timeB - timeA;
        });

        return result;
    }, [historicalFilteredData]);

    const latestChannelStats = useMemo(() => {
        const map = new Map<string, ChannelStat>();
        channelDataList.forEach(c => {
            const cid = c.channel_id;
            if (!cid) return;

            const existing = map.get(cid);
            const tDateNum = new Date(c.timestamp || c.created_at || 0).getTime();
            const existingDateNum = existing ? new Date(existing.timestamp || existing.created_at || 0).getTime() : 0;

            if (!existing || tDateNum > existingDateNum) {
                map.set(cid, c);
            }
        });

        let result = Array.from(map.values());
        if (platformFilter !== 'all') {
            result = result.filter(c => (c.platform?.toLowerCase() || 'youtube') === platformFilter);
        }
        if (selectedChannels.length > 0) {
            result = result.filter(c => selectedChannels.includes(c.channel_id || ''));
        }
        return result;
    }, [channelDataList, platformFilter, selectedChannels]);

    // Calculate Outliers (2 std deviations) for Viral Score globally
    const viralScores = latestFilteredData.map(d => d.viralScore || 0);
    const mean = viralScores.length > 0 ? viralScores.reduce((a, b) => a + b, 0) / viralScores.length : 0;
    const variance = viralScores.length > 0 ? viralScores.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / viralScores.length : 0;
    const stdDev = Math.sqrt(variance);
    const viralThreshold = mean + (2 * stdDev);

    const kpiData = {
        totalViews: latestFilteredData.reduce((acc, curr) => acc + (curr.viewCount || 0), 0),
        avgER: (latestFilteredData.reduce((acc, curr) => acc + (curr.er || 0), 0) / Math.max(latestFilteredData.length, 1)).toFixed(2),
        totalPosts: latestFilteredData.length,
        viralPosts: latestFilteredData.filter(d => stdDev > 0 && (d.viralScore || 0) > viralThreshold).length,
        totalWatchTime: latestFilteredData.reduce((acc, curr) => acc + (curr.youtubeMetrics?.watch_time_minutes || 0), 0),
        totalNetSubs: latestFilteredData.reduce((acc, curr) => acc + ((curr.youtubeMetrics?.subscribers_gained || 0) - (curr.youtubeMetrics?.subscribers_lost || 0)), 0),
    };

    // Prepare LineChart Data (Historical Trend by Date & Entity)
    const { chartData, chartLines } = useMemo(() => {
        const dayMap = new Map<number, any>();
        const linesSet = new Set<string>();

        historicalFilteredData.forEach(d => {
            if (!d.timestamp) return;
            const dTime = new Date(d.timestamp);
            if (isNaN(dTime.getTime())) return;

            const dayStart = new Date(dTime.getFullYear(), dTime.getMonth(), dTime.getDate()).getTime();

            if (!dayMap.has(dayStart)) {
                dayMap.set(dayStart, { timestamp: dayStart });
            }

            const dayObj = dayMap.get(dayStart)!;

            // 如果沒選定任何頻道，則以「頻道」為單位畫線；若有選定，則以「影片標題」為單位畫線
            let lineKey = '未命名';
            if (selectedChannels.length === 0) {
                lineKey = d.channels?.name || d.channelTitle || `頻道 ${d.channel_id}`;
            } else {
                lineKey = d.title || '未命名影片';
            }
            if (lineKey.length > 20) lineKey = lineKey.substring(0, 20) + '...';

            linesSet.add(lineKey);
            // 累加該特徵主體的當日總觀看
            dayObj[lineKey] = (dayObj[lineKey] || 0) + (d.viewCount || 0);
        });

        const sortedData = Array.from(dayMap.values())
            .sort((a, b) => a.timestamp - b.timestamp)
            .map(obj => {
                const dateObj = new Date(obj.timestamp);
                const dateStr = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;
                return { name: dateStr, ...obj };
            });

        return { chartData: sortedData, chartLines: Array.from(linesSet) };
    }, [historicalFilteredData, selectedChannels]);

    // Prepare PieChart Data for Platform Distribution
    const platformDistribution = useMemo(() => {
        const stats: Record<string, number> = {};
        latestFilteredData.forEach(d => {
            const plat = d.platform?.toLowerCase() || 'unknown';
            if (plat !== 'unknown') {
                stats[plat] = (stats[plat] || 0) + (d.viewCount || 0);
            }
        });

        return Object.entries(stats).map(([key, value]) => ({
            name: key.charAt(0).toUpperCase() + key.slice(1),
            value,
            fill: platformColors[key] || '#9ca3af'
        })).filter(item => item.value > 0);
    }, [latestFilteredData]);

    // Prepare Tags Analytics Data
    const tagsStats = useMemo(() => {
        const tagMap: Record<string, { count: number; views: number; totalEr: number }> = {};

        latestFilteredData.forEach(post => {
            if (Array.isArray(post.tags) && post.tags.length > 0) {
                post.tags.forEach(tag => {
                    if (!tag) return;
                    const cleanTag = tag.trim().toLowerCase();
                    if (!tagMap[cleanTag]) {
                        tagMap[cleanTag] = { count: 0, views: 0, totalEr: 0 };
                    }
                    tagMap[cleanTag].count += 1;
                    tagMap[cleanTag].views += (post.viewCount || 0);
                    tagMap[cleanTag].totalEr += (post.er || 0);
                });
            }
        });

        return Object.entries(tagMap)
            .map(([tag, stats]) => ({
                tag,
                count: stats.count,
                views: stats.views,
                avgEr: stats.count > 0 ? (stats.totalEr / stats.count).toFixed(2) : 0
            }))
            .sort((a, b) => b.views - a.views)
            .slice(0, 50); // 只取前 50 大標籤
    }, [latestFilteredData]);

    const viralPosts = latestFilteredData.filter(d => stdDev > 0 && (d.viralScore || 0) > viralThreshold);

    // AI Actionable Insights Generator (v2.0)
    const renderActionableInsights = () => {
        if (selectedChannels.length === 0) return null;
        const selectedChannelReports = youtubeReports.filter(r => selectedChannels.includes(r.channel_id || ''));
        if (selectedChannelReports.length === 0) return null;

        // Rule 1: Retention Alert (Avg duration < 30 sec on videos with > 100 views)
        const lowRetention = selectedChannelReports.some(r => r.views > 100 && r.average_view_duration_seconds < 30);

        // Rule 2: Subscription Funnel (Views > 500 but gaining < 2 subscribers)
        const lowConversion = selectedChannelReports.some(r => r.views > 500 && r.subscribers_gained < 2);

        if (!lowRetention && !lowConversion) return null;

        return (
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-6 shadow-[0_4px_20px_-5px_rgba(251,191,36,0.2)] mb-6 transform transition-all duration-500 ease-out translate-y-0 opacity-100">
                <h3 className="text-xl font-bold text-amber-800 flex items-center gap-2 mb-4">
                    ✨ AI 運營優化建議清單 (Actionable Insights)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {lowRetention && (
                        <div className="bg-white/80 p-4 rounded-xl border border-amber-100 flex items-start gap-4 shadow-sm hover:shadow-md transition-shadow">
                            <div className="bg-red-100 text-red-600 p-2.5 rounded-lg shrink-0">
                                <AlertCircle className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 text-base">⚠️ 鉤子失效警告 (Retention Drop)</h4>
                                <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">偵測到部分爆款影片平均觀看秒數過低，建議優先優化影片前 3 秒 Hook，或大刀闊斧剪去冗長開頭片段，避免被演算法降流。</p>
                            </div>
                        </div>
                    )}
                    {lowConversion && (
                        <div className="bg-white/80 p-4 rounded-xl border border-amber-100 flex items-start gap-4 shadow-sm hover:shadow-md transition-shadow">
                            <div className="bg-blue-100 text-blue-600 p-2.5 rounded-lg shrink-0">
                                <MousePointerClick className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 text-base">💡 高曝光缺乏轉換 (Sub Funnel)</h4>
                                <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">偵測到部分影片獲得大量曝光觀看卻未能轉化成有效粉絲。建議在這些破播影片的片尾、以及留言區置頂加入明確的 Call to Action (CTA) 訂閱呼籲。</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="flex h-screen bg-gray-50/50 font-sans overflow-hidden">

            {/* Sidebar Overlay (Mobile) */}
            {!isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-gray-900/50 z-40 lg:hidden"
                    onClick={() => setIsSidebarOpen(true)}
                ></div>
            )}

            {/* Main Sidebar */}
            <aside
                className={`${isSidebarOpen ? 'w-64' : 'w-20'} 
                flex-shrink-0 bg-white border-r border-gray-200 transition-all duration-300 ease-in-out z-50 flex flex-col`}>

                {/* Sidebar Header */}
                <div className="h-16 flex items-center justify-between px-4 border-b border-gray-100">
                    {isSidebarOpen ? (
                        <div className="flex items-center gap-2 overflow-hidden">
                            <Activity className="text-indigo-600 w-6 h-6 flex-shrink-0" />
                            <span className="font-bold text-gray-900 whitespace-nowrap">War Room Controller</span>
                        </div>
                    ) : (
                        <Activity className="text-indigo-600 w-6 h-6 mx-auto" />
                    )}
                    {isSidebarOpen && (
                        <button onClick={() => setIsSidebarOpen(false)} className="text-gray-400 hover:text-gray-600 lg:hidden">
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>

                {/* Navigation Links */}
                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                    <button
                        onClick={() => setCurrentView('dashboard')}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${currentView === 'dashboard' ? 'bg-indigo-50 text-indigo-600 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
                        <LayoutDashboard className="w-5 h-5 flex-shrink-0" />
                        {isSidebarOpen && <span>網紅趨勢面板</span>}
                    </button>

                    <button
                        onClick={() => setCurrentView('insights')}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${currentView === 'insights' ? 'bg-amber-50 text-amber-600 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
                        <Activity className="w-5 h-5 flex-shrink-0" />
                        {isSidebarOpen && <span>智能運營優化</span>}
                    </button>

                    <button
                        onClick={() => setCurrentView('channel')}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${currentView === 'channel' ? 'bg-indigo-50 text-indigo-600 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
                        <LineChart className="w-5 h-5 flex-shrink-0" />
                        {isSidebarOpen && <span>頻道整體概況</span>}
                    </button>

                    <button
                        onClick={() => setCurrentView('wall-of-fame')}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${currentView === 'wall-of-fame' ? 'bg-orange-50 text-orange-600 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
                        <Flame className="w-5 h-5 flex-shrink-0" />
                        {isSidebarOpen && <span>超級爆款金榜</span>}
                    </button>

                    <button
                        onClick={() => setCurrentView('tags')}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${currentView === 'tags' ? 'bg-indigo-50 text-indigo-600 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
                        <Hash className="w-5 h-5 flex-shrink-0" />
                        {isSidebarOpen && <span>熱門標籤分析</span>}
                    </button>
                </nav>

                {/* Sidebar Footer */}
                <div className="p-4 border-t border-gray-100">
                    <div className={`flex items-center gap-2 ${!isSidebarOpen && 'justify-center'}`}>
                        <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
                        {isSidebarOpen && <span className="text-xs text-gray-500 font-medium">Supabase Connected</span>}
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-screen overflow-hidden">

                {/* Topbar for filtering */}
                <header className="bg-white border-b border-gray-200 p-4 flex flex-col sm:flex-row items-center justify-between gap-4 z-10 shadow-sm relative">
                    <div className="flex items-center gap-4 w-full sm:w-auto">
                        <button onClick={() => setIsSidebarOpen(true)} className="text-gray-500 hover:text-indigo-600 transition-colors lg:hidden">
                            <Menu className="w-6 h-6" />
                        </button>
                        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 leading-tight hidden lg:block">
                            Omnichannel War Room
                        </h1>
                    </div>

                    <div className="flex gap-3 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                        <select
                            className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 hover:border-indigo-300 p-2.5 outline-none font-medium min-w-[140px] transition-colors shadow-sm"
                            value={platformFilter}
                            onChange={(e) => {
                                setPlatformFilter(e.target.value);
                                setSelectedChannels([]); // 換平台時重設頻道多選狀態
                            }}
                        >
                            <option value="all">所有平台 (綜效)</option>
                            <option value="youtube">YouTube</option>
                            <option value="instagram">Instagram</option>
                            <option value="threads">Threads</option>
                        </select>

                        {/* Custom Multiselect Channel Dropdown */}
                        <div className="relative min-w-[200px]" onMouseLeave={() => setIsChannelDropdownOpen(false)}>
                            <button
                                onClick={() => setIsChannelDropdownOpen(!isChannelDropdownOpen)}
                                className="bg-white border border-gray-200 text-gray-700 text-sm rounded-lg hover:border-indigo-300 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 p-2.5 outline-none font-medium w-full flex items-center justify-between transition-colors shadow-sm min-h-[42px]"
                            >
                                <span className="truncate pr-2 select-none">
                                    {selectedChannels.length === 0 ? "所有頻道 (未篩選)" : `已選擇 ${selectedChannels.length} 個頻道`}
                                </span>
                                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isChannelDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isChannelDropdownOpen && (
                                <div className="absolute z-50 top-full mt-1.5 left-0 sm:right-auto right-0 sm:w-[260px] w-full min-w-[220px] bg-white border border-gray-200 rounded-xl shadow-xl max-h-[320px] flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                                    <div className="bg-gray-50/80 p-2 border-b border-gray-100 flex gap-2 justify-between shrink-0">
                                        <button onClick={() => setSelectedChannels(uniqueChannels.map(c => c.id))} className="text-xs text-indigo-600 hover:bg-indigo-50 px-2.5 py-1.5 rounded-md font-medium transition-colors border border-transparent hover:border-indigo-100 flex-1">
                                            全選
                                        </button>
                                        <button onClick={() => setSelectedChannels([])} className="text-xs text-gray-500 hover:bg-gray-200/50 px-2.5 py-1.5 rounded-md font-medium transition-colors flex-1">
                                            清除
                                        </button>
                                    </div>
                                    <div className="overflow-y-auto flex-1 p-1 custom-scrollbar">
                                        {uniqueChannels.length === 0 ? (
                                            <div className="p-4 text-center text-sm text-gray-400">目前平台下無頻道資料</div>
                                        ) : uniqueChannels.map(c => {
                                            const isChecked = selectedChannels.includes(c.id);
                                            return (
                                                <label key={c.id} className={`flex items-center px-3 py-2.5 cursor-pointer rounded-lg mb-0.5 last:mb-0 transition-colors ${isChecked ? 'bg-indigo-50/60' : 'hover:bg-gray-50'}`}>
                                                    <div className={`mr-3 flex items-center justify-center w-4 h-4 rounded border transition-colors shrink-0 ${isChecked ? 'bg-indigo-500 border-indigo-500 shadow-sm' : 'border-gray-300 bg-white'}`}>
                                                        {isChecked && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                                                    </div>
                                                    <span className={`text-sm truncate select-none ${isChecked ? 'font-semibold text-indigo-900' : 'text-gray-600'}`} title={c.name}>
                                                        {c.name}
                                                    </span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={fetchData}
                            disabled={isLoading}
                            className="p-2.5 text-gray-500 hover:text-indigo-600 bg-gray-50 hover:bg-indigo-50 rounded-lg transition-colors border border-gray-200 hover:border-indigo-200 disabled:opacity-50 shrink-0"
                            title="Refresh Data"
                        >
                            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin cursor-wait' : ''}`} />
                        </button>
                    </div>
                </header>

                {/* Scrollable Content View */}
                <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">

                    {/* Render Content Based on currentView */}
                    {currentView === 'insights' && (
                        <div className="max-w-7xl mx-auto space-y-6">
                            <div className="flex items-center gap-3 mb-6">
                                <Activity className="text-amber-500 w-8 h-8" />
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900">智能運營優化中心</h2>
                                    <p className="text-sm text-gray-500">基於頻道 YouTube Studio 的日誌數據，為您產出具體可行的下一步決策。</p>
                                </div>
                            </div>

                            {selectedChannels.length === 0 ? (
                                <div className="bg-amber-50 rounded-2xl p-10 text-center border border-amber-100 shadow-sm">
                                    <Activity className="w-16 h-16 text-amber-300 mx-auto mb-4" />
                                    <h3 className="text-xl font-bold text-amber-800">請先於上方選擇目標頻道</h3>
                                    <p className="text-base text-amber-700 mt-2">智能優化系統專注於解析頻道的生長軌跡，<br />請在螢幕右上方選擇您想深度優化的目標頻道來啟動 AI 運算。</p>
                                </div>
                            ) : (
                                renderActionableInsights() || (
                                    <div className="bg-green-50 rounded-2xl p-10 text-center border border-green-100 shadow-sm">
                                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                        </div>
                                        <h3 className="text-xl font-bold text-green-800">頻道指標健康</h3>
                                        <p className="text-base text-green-700 mt-2">目前沒有偵測到需要緊急優化的項目，內容轉換漏斗與留存率皆在合理範圍內。請繼續保持！</p>
                                    </div>
                                )
                            )}
                        </div>
                    )}

                    {currentView === 'dashboard' && (
                        <div className="max-w-7xl mx-auto space-y-8">

                            <div className="flex items-center gap-3 mb-4">
                                <LayoutDashboard className="text-indigo-600 w-8 h-8" />
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900">總覽與趨勢面板</h2>
                                    <p className="text-sm text-gray-500">以宏觀視角檢視各大平台的大數據表現與互動指標</p>
                                </div>
                            </div>

                            {/* KPI Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between hover:-translate-y-1 hover:shadow-md transition-all duration-300">
                                    <div>
                                        <p className="text-sm font-medium text-gray-500 mb-1">總觀看數</p>
                                        {isLoading ? <div className="h-9 w-24 bg-gray-200 rounded animate-pulse"></div> : (
                                            <div className="flex items-baseline gap-2">
                                                <p className="text-3xl font-bold text-gray-900">{kpiData.totalViews.toLocaleString()}</p>
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-3 bg-blue-50 text-blue-500 rounded-xl">
                                        <Eye className="w-6 h-6" />
                                    </div>
                                </div>

                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between hover:-translate-y-1 hover:shadow-md transition-all duration-300">
                                    <div>
                                        <p className="text-sm font-medium text-gray-500 mb-1">平均互動率 (ER)</p>
                                        {isLoading ? <div className="h-9 w-20 bg-gray-200 rounded animate-pulse"></div> : (
                                            <p className="text-3xl font-bold text-gray-900">{kpiData.avgER}%</p>
                                        )}
                                    </div>
                                    <div className="p-3 bg-green-50 text-green-500 rounded-xl">
                                        <MousePointerClick className="w-6 h-6" />
                                    </div>
                                </div>

                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between hover:-translate-y-1 hover:shadow-md transition-all duration-300">
                                    <div>
                                        <p className="text-sm font-medium text-gray-500 mb-1">分析內容數</p>
                                        {isLoading ? <div className="h-9 w-12 bg-gray-200 rounded animate-pulse"></div> : (
                                            <p className="text-3xl font-bold text-gray-900">{kpiData.totalPosts}</p>
                                        )}
                                    </div>
                                    <div className="p-3 bg-purple-50 text-purple-500 rounded-xl">
                                        <Layers className="w-6 h-6" />
                                    </div>
                                </div>

                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between hover:-translate-y-1 hover:shadow-md transition-all duration-300">
                                    <div>
                                        <p className="text-sm font-medium text-gray-500 mb-1">爆款標的</p>
                                        {isLoading ? <div className="h-9 w-12 bg-gray-200 rounded animate-pulse"></div> : (
                                            <p className="text-3xl font-bold text-orange-600">{kpiData.viralPosts}</p>
                                        )}
                                    </div>
                                    <div className="p-3 bg-orange-50 text-orange-500 rounded-xl shadow-[0_0_15px_rgba(249,115,22,0.2)]">
                                        <Flame className="w-6 h-6" />
                                    </div>
                                </div>

                                {platformFilter === 'youtube' && (
                                    <>
                                        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-6 rounded-2xl shadow-sm border border-indigo-100 flex items-center justify-between hover:-translate-y-1 hover:shadow-md transition-all duration-300">
                                            <div>
                                                <p className="text-sm font-medium text-indigo-800 mb-1">總觀看時長 (分)</p>
                                                {isLoading ? <div className="h-9 w-20 bg-indigo-200/50 rounded animate-pulse"></div> : (
                                                    <p className="text-3xl font-bold text-indigo-900">{kpiData.totalWatchTime.toLocaleString()}</p>
                                                )}
                                            </div>
                                            <div className="p-3 bg-white text-indigo-600 rounded-xl shadow-sm">
                                                <Activity className="w-6 h-6" />
                                            </div>
                                        </div>

                                        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-6 rounded-2xl shadow-sm border border-emerald-100 flex items-center justify-between hover:-translate-y-1 hover:shadow-md transition-all duration-300">
                                            <div>
                                                <p className="text-sm font-medium text-emerald-800 mb-1">淨訂閱成長</p>
                                                {isLoading ? <div className="h-9 w-16 bg-emerald-200/50 rounded animate-pulse"></div> : (
                                                    <p className="text-3xl font-bold text-emerald-900">+{kpiData.totalNetSubs.toLocaleString()}</p>
                                                )}
                                            </div>
                                            <div className="p-3 bg-white text-emerald-600 rounded-xl shadow-sm">
                                                <TrendingUp className="w-6 h-6" />
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {currentView === 'wall-of-fame' && (
                        <div className="max-w-7xl mx-auto space-y-6">
                            <div className="flex items-center gap-3 mb-6">
                                <Flame className="text-orange-500 w-8 h-8" />
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900">超級爆款金榜</h2>
                                    <p className="text-sm text-gray-500">檢視系統從海量貼文中篩選出，互動爆發值超越均值兩倍標準差 (2 Std Dev) 的超限離群高成長內容。</p>
                                </div>
                            </div>

                            <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
                                <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 content-start">
                                    {isLoading ? (
                                        <>
                                            <div className="h-32 bg-gray-100 rounded-xl animate-pulse"></div>
                                            <div className="h-32 bg-gray-100 rounded-xl animate-pulse"></div>
                                            <div className="h-32 bg-gray-100 rounded-xl animate-pulse"></div>
                                        </>
                                    ) : viralPosts.length > 0 ? (
                                        viralPosts.map(post => (
                                            <div key={post.id} className="relative overflow-hidden rounded-xl border border-orange-100/50 bg-gradient-to-br from-white to-orange-50/30 p-5 shadow-[0_4px_20px_-5px_rgba(249,115,22,0.15)] group hover:shadow-[0_6px_30px_-5px_rgba(249,115,22,0.3)] transition-all ease-out duration-300 hover:-translate-y-1 block">
                                                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-400/10 rounded-full blur-3xl -mr-12 -mt-12"></div>
                                                <div className="flex items-start justify-between relative z-10">
                                                    <div>
                                                        <p className="text-[11px] font-bold text-gray-500 mb-1.5 uppercase letter-spacing-wider">{post.channels?.name || post.channelTitle || 'Unknown Channel'}</p>
                                                        <h3 className="text-base font-bold text-gray-900 line-clamp-2 leading-tight" title={post.title}>{post.title}</h3>
                                                    </div>
                                                    <span className={`px-2.5 py-1 text-[10px] font-bold text-white rounded uppercase tracking-wider ${platformBgColors[post.platform?.toLowerCase()] || 'bg-gray-500'} shadow-sm ml-2 shrink-0`}>
                                                        {post.platform}
                                                    </span>
                                                </div>

                                                {/* Tags Rendering in Wall of fame */}
                                                {post.tags && post.tags.length > 0 && (
                                                    <div className="mt-3 flex flex-wrap gap-1.5 relative z-10">
                                                        {post.tags.slice(0, 4).map((tag: string, idx: number) => (
                                                            <span key={idx} className="text-[11px] font-medium bg-white/80 text-orange-600 px-2 py-0.5 rounded-md border border-orange-100">#{tag.trim()}</span>
                                                        ))}
                                                        {post.tags.length > 4 && <span className="text-[11px] text-gray-400 font-medium self-center pl-1">+{post.tags.length - 4}</span>}
                                                    </div>
                                                )}

                                                <div className="mt-5 flex items-end justify-between text-sm relative z-10">
                                                    <div>
                                                        <p className="text-[10px] text-gray-400 font-medium mb-0.5">總觀看</p>
                                                        <div className="font-extrabold text-gray-800 text-lg leading-none">{(post.viewCount || 0).toLocaleString()}</div>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] text-orange-400/80 font-medium mb-0.5 text-right">爆發值</p>
                                                        <div className="flex items-center gap-1.5 font-bold text-orange-600 bg-white border border-orange-100 px-2.5 py-1.5 rounded-lg shadow-sm">
                                                            <Flame className="w-4 h-4" />
                                                            {post.viralScore?.toLocaleString()} <span className="text-[10px] font-medium text-orange-400">/hr</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="col-span-full h-40 flex flex-col items-center justify-center text-gray-400 py-6">
                                            <div className="w-14 h-14 rounded-full bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center mb-4">
                                                <Flame className="w-6 h-6 text-gray-300" />
                                            </div>
                                            <p className="text-base font-medium">指定條件下尚未偵測到超越雙倍標準差的爆款</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {currentView === 'dashboard' && (
                        <div className="max-w-7xl mx-auto space-y-6">
                            {/* Dashboard Charts: Pie & Trend */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-2">
                                {/* Platform Distribution Pie Chart */}
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 lg:col-span-1 flex flex-col">
                                    <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                                        平台流量佔比
                                    </h2>
                                    {isLoading ? (
                                        <div className="h-[300px] flex items-center justify-center">
                                            <div className="w-20 h-20 border-4 border-gray-100 border-t-indigo-500 rounded-full animate-spin"></div>
                                        </div>
                                    ) : platformDistribution.length > 0 ? (
                                        <div className="h-[300px] w-full relative">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={platformDistribution}
                                                        innerRadius={60}
                                                        outerRadius={90}
                                                        paddingAngle={5}
                                                        dataKey="value"
                                                    >
                                                        {platformDistribution.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={entry.fill} />
                                                        ))}
                                                    </Pie>
                                                    <RechartsTooltip
                                                        formatter={(value: number) => value.toLocaleString()}
                                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                                    />
                                                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                    ) : (
                                        <div className="h-[300px] flex items-center justify-center text-gray-400">目前無數據</div>
                                    )}
                                </div>

                                {/* Main Trend Chart */}
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 lg:col-span-2 flex flex-col">
                                    <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                                        <TrendingUp className="w-5 h-5 text-indigo-500" />
                                        動態趨勢折線圖
                                    </h2>
                                    {isLoading ? (
                                        <div className="h-[300px] w-full bg-gray-50 rounded-lg animate-pulse"></div>
                                    ) : (
                                        <div className="h-[300px] w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <RechartsLineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} dy={10} />
                                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} tickFormatter={(val) => typeof val === 'number' && val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val} />
                                                    <RechartsTooltip cursor={{ stroke: '#e5e7eb', strokeWidth: 2 }} contentStyle={{ borderRadius: '12px', border: '1px solid #f3f4f6', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                                                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                                                    {chartLines.map((lineKey, idx) => {
                                                        const color = CHART_COLORS[idx % CHART_COLORS.length];
                                                        return (
                                                            <Line key={lineKey} type="monotone" dataKey={lineKey} name={lineKey} stroke={color} strokeWidth={3} dot={{ r: 4, fill: color, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6, strokeWidth: 0 }} />
                                                        );
                                                    })}
                                                </RechartsLineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Detailed Table */}
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                        <List className="w-5 h-5 text-gray-400" />
                                        數據明細列表
                                    </h2>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left text-gray-500">
                                        <thead className="text-xs text-gray-400 uppercase bg-gray-50/50">
                                            <tr>
                                                <th className="px-6 py-4 font-semibold whitespace-nowrap">頻道與內容</th>
                                                <th className="px-6 py-4 font-semibold whitespace-nowrap">發布時間</th>
                                                <th className="px-6 py-4 font-semibold">觀看 / 互動</th>
                                                <th className="px-6 py-4 font-semibold whitespace-nowrap">深度成效 (YT)</th>
                                                <th className="px-6 py-4 font-semibold whitespace-nowrap">健康度 (ER)</th>
                                                <th className="px-6 py-4 font-semibold text-right">爆發指標</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {isLoading ? (
                                                [...Array(3)].map((_, i) => (
                                                    <tr key={i} className="border-b border-gray-50"><td colSpan={5} className="px-6 py-4"><div className="h-10 bg-gray-100 rounded animate-pulse"></div></td></tr>
                                                ))
                                            ) : latestFilteredData.length > 0 ? (
                                                latestFilteredData.map((item) => {
                                                    const isViral = stdDev > 0 && (item.viralScore || 0) > viralThreshold;
                                                    return (
                                                        <tr key={item.id} className="bg-white border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                                                            <td className="px-6 py-4">
                                                                <div className="flex flex-col gap-1 w-max">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className={`px-2 py-0.5 text-[10px] font-bold text-white rounded uppercase tracking-wider ${platformBgColors[item.platform?.toLowerCase()] || 'bg-gray-500'} shrink-0`}>
                                                                            {item.platform}
                                                                        </span>
                                                                        <span className="text-xs font-semibold text-gray-400">{item.channels?.name || item.channelTitle || item.channel_id}</span>
                                                                    </div>
                                                                    <a href={item.url || '#'} target="_blank" rel="noreferrer" className="group flex items-center justify-between gap-4 max-w-[350px]">
                                                                        <span className="font-semibold text-gray-900 truncate group-hover:text-indigo-600 transition-colors" title={item.title}>
                                                                            {item.title}
                                                                        </span>
                                                                        {item.url && <ExternalLink className="w-4 h-4 text-gray-300 group-hover:text-indigo-500 flex-shrink-0" />}
                                                                    </a>
                                                                    {item.tags && item.tags.length > 0 && (
                                                                        <div className="flex flex-wrap gap-1 mt-1 max-w-[350px]">
                                                                            {item.tags.slice(0, 4).map((tag: string, idx: number) => (
                                                                                <span key={idx} className="text-[10px] bg-gray-100 text-gray-500 px-1 py-0.5 rounded">#{tag.trim()}</span>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-gray-400">
                                                                {new Date(item.timestamp || '').toLocaleString('zh-TW', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                                <div className="text-[10px] text-gray-400 mt-1">{item.hoursSincePublished?.toFixed(0)} 小時前</div>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <div className="font-semibold text-gray-900">{(item.viewCount || 0).toLocaleString()}</div>
                                                                <div className="text-xs text-gray-400 mt-1 flex gap-2">
                                                                    <span title="Likes">👍 {item.likeCount || 0}</span>
                                                                    <span title="Comments">💬 {item.commentCount || 0}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap">
                                                                {item.youtubeMetrics ? (
                                                                    <div className="flex flex-col gap-1.5 text-xs text-gray-500 font-medium">
                                                                        <div className="flex items-center gap-1.5" title="總觀看時長(分鐘)">⏱️ {item.youtubeMetrics.watch_time_minutes?.toLocaleString() || 0} 分鐘</div>
                                                                        <div className="flex items-center gap-1.5" title="平均觀看時長(秒)">👁️ {item.youtubeMetrics.average_view_duration_seconds?.toLocaleString() || 0} 秒</div>
                                                                        <div className="flex items-center gap-1.5" title="淨訂閱成長">📈 <span className="text-green-600">+{(item.youtubeMetrics.subscribers_gained || 0) - (item.youtubeMetrics.subscribers_lost || 0)}</span></div>
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-gray-300 italic text-[10px] bg-gray-50 px-2 py-0.5 rounded border border-gray-100">無深度數據</span>
                                                                )}
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full ${(item.er || 0) > 10 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                                                    {item.er}%
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 text-right">
                                                                <div className="flex items-center justify-end gap-2" title={isViral ? "超級爆款" : undefined}>
                                                                    {isViral && <Flame className="w-4 h-4 text-orange-500 animate-pulse" />}
                                                                    <span className={`font-bold ${isViral ? 'text-orange-600 text-base' : 'text-gray-900'}`}>{item.viralScore?.toLocaleString()}</span>
                                                                    <span className="text-xs text-gray-400">/hr</span>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            ) : (
                                                <tr>
                                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-400">目前選擇的條件下無資料</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                        </div>
                    )}



                    {/* Render Channel Overview */}
                    {currentView === 'channel' && (
                        <div className="max-w-7xl mx-auto space-y-6">
                            <header className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100 gap-4">
                                <div className="flex items-center gap-3">
                                    <LineChart className="text-indigo-600 w-8 h-8" />
                                    <div>
                                        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 leading-tight">
                                            頻道整體概況
                                        </h1>
                                        <p className="text-xs text-gray-400 font-medium">追蹤您的所有社群帳號成長軌跡</p>
                                    </div>
                                </div>
                            </header>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {isLoading ? (
                                    [...Array(3)].map((_, i) => (
                                        <div key={i} className="bg-white p-6 rounded-2xl border border-gray-100 h-40 animate-pulse"></div>
                                    ))
                                ) : latestChannelStats.length > 0 ? (
                                    latestChannelStats.map(ch => (
                                        <div key={ch.id || ch.channel_id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow group relative overflow-hidden">
                                            {/* 背景裝飾 */}
                                            <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl -mr-10 -mt-10 opacity-20 ${platformBgColors[ch.platform?.toLowerCase() || 'youtube'] || 'bg-gray-300'}`}></div>

                                            <div className="flex justify-between items-start mb-4 relative z-10">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h3 className="font-bold text-gray-900 text-lg">{ch.title || ch.name || '未命名頻道'}</h3>
                                                        {ch.title && channelTypeMap[ch.title.split(' ')[0]] && (
                                                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded shadow-sm ${channelTypeMap[ch.title.split(' ')[0]].color} ${channelTypeMap[ch.title.split(' ')[0]].bg}`}>
                                                                {channelTypeMap[ch.title.split(' ')[0]].label}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`px-2 py-0.5 text-[10px] font-bold text-white rounded uppercase tracking-wider ${platformBgColors[ch.platform?.toLowerCase() || 'youtube'] || 'bg-gray-500'} shadow-sm`}>
                                                            {ch.platform || 'youtube'}
                                                        </span>
                                                        {(ch.custom_url || ch.ownerUsername) && (
                                                            <span className="text-xs text-gray-400 font-medium">{ch.custom_url || `@${ch.ownerUsername}`}</span>
                                                        )}
                                                    </div>
                                                </div>
                                                {ch.url && (
                                                    <a href={ch.url} target="_blank" rel="noreferrer" className="p-2 bg-gray-50 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="前往頻道">
                                                        <ExternalLink className="w-4 h-4" />
                                                    </a>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-2 gap-4 mt-6 relative z-10">
                                                <div className="bg-gray-50/50 p-3 rounded-xl border border-gray-100/50">
                                                    <p className="text-xs text-gray-500 font-medium mb-1">總訂閱 / 粉絲</p>
                                                    <p className="font-bold text-gray-900 text-lg">{(ch.subscribers || ch.followsCount || 0).toLocaleString()}</p>
                                                </div>
                                                <div className="bg-gray-50/50 p-3 rounded-xl border border-gray-100/50">
                                                    <p className="text-xs text-gray-500 font-medium mb-1">累積觀看次數</p>
                                                    <p className="font-bold text-gray-900 text-lg">{(ch.total_views || 0).toLocaleString()}</p>
                                                </div>
                                                <div className="bg-gray-50/50 p-3 rounded-xl border border-gray-100/50 col-span-2 flex justify-between items-center">
                                                    <span className="text-xs text-gray-500 font-medium">總上傳影片數</span>
                                                    <span className="font-bold text-gray-900">{(ch.video_count || ch.igtvVideoCount || 0).toLocaleString()} <span className="text-xs text-gray-400 font-normal">部</span></span>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="col-span-full bg-white p-12 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-gray-400">
                                        <LineChart className="w-12 h-12 mb-4 text-gray-300" />
                                        <p>目前尚無頻道資料</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Render Tags Analysis */}
                    {currentView === 'tags' && (
                        <div className="max-w-7xl mx-auto space-y-6">
                            <header className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100 gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                                        <Hash className="w-8 h-8" />
                                    </div>
                                    <div>
                                        <h1 className="text-2xl font-bold text-gray-900 leading-tight">
                                            熱門標籤分析矩陣
                                        </h1>
                                        <p className="text-xs text-gray-500 font-medium">透視哪些關鍵字為您帶來最多流量與互動</p>
                                    </div>
                                </div>
                            </header>

                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/30">
                                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                        流量紅利排行榜 (Top 50)
                                    </h2>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left text-gray-500">
                                        <thead className="text-xs text-gray-400 uppercase bg-gray-50/80">
                                            <tr>
                                                <th className="px-6 py-4 font-semibold whitespace-nowrap">標籤名稱 (Hashtag)</th>
                                                <th className="px-6 py-4 font-semibold whitespace-nowrap text-right">出現次數</th>
                                                <th className="px-6 py-4 font-semibold text-right">累積觀看流量</th>
                                                <th className="px-6 py-4 font-semibold whitespace-nowrap text-right">平均互動率 (ER)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {isLoading ? (
                                                [...Array(5)].map((_, i) => (
                                                    <tr key={i} className="border-b border-gray-50"><td colSpan={4} className="px-6 py-4"><div className="h-10 bg-gray-100 rounded animate-pulse"></div></td></tr>
                                                ))
                                            ) : tagsStats.length > 0 ? (
                                                tagsStats.map((item, index) => (
                                                    <tr key={item.tag} className="bg-white border-b border-gray-50 hover:bg-gray-50/50 transition-colors group">
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <span className={`w-6 text-center font-bold ${index < 3 ? 'text-indigo-600' : 'text-gray-300'}`}>
                                                                    {index + 1}
                                                                </span>
                                                                <span className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">#{item.tag}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-right font-medium text-gray-600">
                                                            {item.count} <span className="text-xs text-gray-400 font-normal">次</span>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <div className="font-bold text-gray-900 text-base">{(item.views).toLocaleString()}</div>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <div className="inline-flex items-center justify-end gap-1.5 font-bold text-green-600 bg-green-50 px-2.5 py-1 rounded-md">
                                                                {item.avgEr}%
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={4} className="px-6 py-12 text-center text-gray-400">
                                                        <Hash className="w-10 h-10 mx-auto text-gray-300 mb-3" />
                                                        沒有分析出任何標籤數據
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                </main>
            </div >
        </div >
    );
}

