import React, { useState, useEffect, useMemo } from 'react';
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Activity, TrendingUp, List, Eye, MousePointerClick, Layers, Flame, AlertCircle, RefreshCw, LayoutDashboard, LineChart, Hash, Menu, X, ExternalLink } from 'lucide-react';
import { supabase } from './lib/supabase';

interface Channel {
    id: string;
    name: string;
}

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

export default function App() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [currentView, setCurrentView] = useState<'dashboard' | 'channel' | 'tags'>('dashboard');

    const [data, setData] = useState<PostData[]>([]);
    const [channelDataList, setChannelDataList] = useState<any[]>([]); // 追加儲存所有頻道的原始資料
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [channelFilter, setChannelFilter] = useState('all');
    const [sortBy, setSortBy] = useState('timestamp');

    const fetchData = async () => {
        setIsLoading(true);
        setError(null);
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

            // 建立 Channel Dictionary
            const channelMap = new Map();
            if (channelData) {
                setChannelDataList(channelData); // 供給頻道概況使用

                channelData.forEach((c: any) => {
                    const cid = c.id || c.channel_id;
                    if (cid) channelMap.set(cid, c);
                });
            }

            if (videoData && videoData.length > 0) {
                // 將查詢到的 channels 資料結構映射到現有 UI 需要的格式
                const processedData = videoData.map((item: any) => {
                    const cid = item.channel_id || item.channelId;
                    const matchedChannel = channelMap.get(cid) || { id: cid || 'unknown', name: `頻道 ${cid || '未知'}` };

                    return calculateMetrics({
                        ...item,
                        channels: matchedChannel
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
            setError(err.message || 'Failed to fetch data from Supabase. Make sure your .env is set properly and RLS allows read access.');
            // Fallback to demo data to keep the UI interactive during development
            setData(MOCK_DATA.map(calculateMetrics));
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Extract unique channels
    const uniqueChannels = useMemo(() => {
        const channelsMap = new Map<string, { id: string, name: string }>();
        data.forEach(item => {
            if (item.channels && item.channels.id && item.channels.name) {
                channelsMap.set(item.channels.id, { id: item.channels.id, name: item.channels.name });
            } else if (item.channel_id) { // Fallback if join fails but we have channel_id
                channelsMap.set(item.channel_id, { id: item.channel_id, name: `Channel ${item.channel_id}` });
            }
        });
        return Array.from(channelsMap.values());
    }, [data]);

    // Apply Filters and Sorting
    const filteredData = useMemo(() => {
        let result = [...data];
        if (channelFilter !== 'all') {
            result = result.filter(d =>
                (d.channels && d.channels.id === channelFilter) ||
                d.channel_id === channelFilter
            );
        }

        result.sort((a, b) => {
            if (sortBy === 'timestamp') return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
            if (sortBy === 'viralScore') return (b.viralScore || 0) - (a.viralScore || 0);
            if (sortBy === 'er') return (b.er || 0) - (a.er || 0);
            return 0;
        });

        return result;
    }, [data, channelFilter, sortBy]);

    // Calculate Outliers (2 std deviations) for Viral Score globally (or per filtered context)
    const viralScores = filteredData.map(d => d.viralScore || 0);
    const mean = viralScores.length > 0 ? viralScores.reduce((a, b) => a + b, 0) / viralScores.length : 0;
    const variance = viralScores.length > 0 ? viralScores.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / viralScores.length : 0;
    const stdDev = Math.sqrt(variance);
    const viralThreshold = mean + (2 * stdDev);

    const kpiData = {
        totalViews: filteredData.reduce((acc, curr) => acc + (curr.viewCount || 0), 0),
        avgER: (filteredData.reduce((acc, curr) => acc + (curr.er || 0), 0) / Math.max(filteredData.length, 1)).toFixed(2),
        totalPosts: filteredData.length,
        viralPosts: filteredData.filter(d => stdDev > 0 && (d.viralScore || 0) > viralThreshold).length
    };

    // Prepare LineChart Data
    const chartData = [...filteredData].sort((a, b) => {
        const timeA = new Date(a.timestamp ? String(a.timestamp) : '').getTime();
        const timeB = new Date(b.timestamp ? String(b.timestamp) : '').getTime();
        return timeA - timeB;
    }).map(d => {
        const titleStr = d.title || '未命名內容';
        return {
            name: titleStr.length > 15 ? titleStr.substring(0, 15) + '...' : titleStr,
            Views: d.viewCount || 0,
            ViralScore: d.viralScore || 0
        };
    });

    // Prepare PieChart Data for Platform Distribution
    const platformDistribution = useMemo(() => {
        const stats: Record<string, number> = {};
        filteredData.forEach(d => {
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
    }, [filteredData]);

    const viralPosts = filteredData.filter(d => stdDev > 0 && (d.viralScore || 0) > viralThreshold);

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
                        onClick={() => setCurrentView('channel')}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${currentView === 'channel' ? 'bg-indigo-50 text-indigo-600 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
                        <LineChart className="w-5 h-5 flex-shrink-0" />
                        {isSidebarOpen && <span>頻道整體概況</span>}
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

                {/* Topbar for mobile opening sidebar */}
                <div className="lg:hidden bg-white border-b border-gray-200 p-4 flex items-center gap-4">
                    <button onClick={() => setIsSidebarOpen(true)} className="text-gray-500 hover:text-indigo-600 transition-colors">
                        <Menu className="w-6 h-6" />
                    </button>
                    <span className="font-bold text-gray-900">War Room</span>
                </div>

                {/* Scrollable Content View */}
                <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">

                    {/* Render Content Based on currentView */}
                    {currentView === 'dashboard' && (
                        <div className="max-w-7xl mx-auto space-y-6">

                            {/* Header Section */}
                            <header className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100 gap-4">
                                <div className="flex items-center gap-3">
                                    <Activity className="text-indigo-600 w-8 h-8" />
                                    <div>
                                        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 leading-tight">
                                            Omnichannel War Room
                                        </h1>
                                        <p className="text-xs text-gray-400 font-medium">Data Sync via Supabase (Read-Only)</p>
                                    </div>
                                </div>

                                <div className="flex gap-4">
                                    <select
                                        className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 outline-none transition-shadow hover:shadow-sm"
                                        value={channelFilter}
                                        onChange={(e) => setChannelFilter(e.target.value)}
                                    >
                                        <option value="all">所有頻道 (All Channels)</option>
                                        {uniqueChannels.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>

                                    <select
                                        className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 outline-none transition-shadow hover:shadow-sm"
                                        value={sortBy}
                                        onChange={(e) => setSortBy(e.target.value)}
                                    >
                                        <option value="timestamp">最新發布</option>
                                        <option value="viralScore">爆發值最高</option>
                                        <option value="er">互動率最高</option>
                                    </select>

                                    <button
                                        onClick={fetchData}
                                        disabled={isLoading}
                                        className="p-2.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-transparent disabled:opacity-50"
                                        title="Refresh Data"
                                    >
                                        <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                                    </button>
                                </div>
                            </header>

                            {/* Error Banner */}
                            {error && (
                                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg flex items-start gap-3">
                                    <AlertCircle className="text-red-500 w-5 h-5 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <h3 className="text-red-800 font-medium">Connection Error</h3>
                                        <p className="text-sm text-red-600 mt-1">{error}</p>
                                        <p className="text-xs text-red-500 mt-2">Currently displaying simulated mock data.</p>
                                    </div>
                                </div>
                            )}

                            {/* Schema Discovery View */}
                            {data.length > 0 && !error && (
                                <div className="bg-indigo-50 border border-indigo-200 p-6 rounded-2xl shadow-sm mb-6 max-h-96 overflow-auto">
                                    <h2 className="text-lg font-bold text-indigo-900 mb-2 flex items-center gap-2">
                                        <Layers className="w-5 h-5 text-indigo-500" />
                                        資料庫 Schema 探測器 (Raw Data Preview)
                                    </h2>
                                    <p className="text-sm text-indigo-700 mb-4">
                                        為了能依照您的實際欄位重新規劃 UI，請拷貝以下這筆資料，並貼給 AI！
                                    </p>
                                    <pre className="text-xs text-indigo-800 bg-white p-4 rounded-lg border border-indigo-100/50 shadow-inner overflow-x-auto">
                                        {JSON.stringify(data[0], null, 2)}
                                    </pre>
                                </div>
                            )}

                            {/* KPI Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
                            </div>

                            {/* Wall of Fame & Platform Dist */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Platform Distribution Pie Chart */}
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 lg:col-span-1">
                                    <h2 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
                                        平台流量佔比
                                    </h2>
                                    {isLoading ? (
                                        <div className="h-[250px] flex items-center justify-center">
                                            <div className="w-40 h-40 border-4 border-gray-100 border-t-indigo-500 rounded-full animate-spin"></div>
                                        </div>
                                    ) : platformDistribution.length > 0 ? (
                                        <div className="h-[250px] relative">
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
                                        <div className="h-[250px] flex items-center justify-center text-gray-400">目前無數據</div>
                                    )}
                                </div>

                                {/* Wall of Fame */}
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 lg:col-span-2 flex flex-col">
                                    <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                        <Flame className="w-5 h-5 text-orange-500" />
                                        超級爆款名人堂 <span className="text-xs font-normal text-gray-400 ml-2">(偏離平均 2 Std Dev)</span>
                                    </h2>

                                    <div className="flex-1 overflow-y-auto pr-2 grid gap-4 grid-cols-1 md:grid-cols-2 content-start">
                                        {isLoading ? (
                                            <>
                                                <div className="h-24 bg-gray-100 rounded-xl animate-pulse"></div>
                                                <div className="h-24 bg-gray-100 rounded-xl animate-pulse"></div>
                                            </>
                                        ) : viralPosts.length > 0 ? (
                                            viralPosts.map(post => (
                                                <div key={post.id} className="relative overflow-hidden rounded-xl border border-orange-100/50 bg-gradient-to-br from-white to-orange-50/30 p-4 shadow-[0_4px_20px_-5px_rgba(249,115,22,0.15)] group hover:shadow-[0_4px_25px_-5px_rgba(249,115,22,0.3)] transition-all">
                                                    <div className="absolute top-0 right-0 w-24 h-24 bg-orange-400/10 rounded-full blur-2xl -mr-8 -mt-8"></div>
                                                    <div className="flex items-start justify-between relative z-10">
                                                        <div>
                                                            <p className="text-xs font-bold text-gray-500 mb-1">{post.channels?.name || post.channelTitle || 'Unknown Channel'}</p>
                                                            <h3 className="text-sm font-bold text-gray-900 line-clamp-2 leading-tight" title={post.title}>{post.title}</h3>
                                                        </div>
                                                        <span className={`px-2 py-0.5 text-[10px] font-bold text-white rounded uppercase tracking-wider ${platformBgColors[post.platform?.toLowerCase()] || 'bg-gray-500'} shadow-sm m-1 shrink-0`}>
                                                            {post.platform}
                                                        </span>
                                                    </div>

                                                    {/* Tags Rendering in Wall of fame */}
                                                    {post.tags && post.tags.length > 0 && (
                                                        <div className="mt-2 flex flex-wrap gap-1 relative z-10">
                                                            {post.tags.slice(0, 3).map((tag: string, idx: number) => (
                                                                <span key={idx} className="text-[10px] bg-white/60 text-orange-600 px-1.5 py-0.5 rounded border border-orange-100/50">#{tag.trim()}</span>
                                                            ))}
                                                            {post.tags.length > 3 && <span className="text-[10px] text-gray-400">+{post.tags.length - 3}</span>}
                                                        </div>
                                                    )}

                                                    <div className="mt-4 flex items-center justify-between text-sm relative z-10">
                                                        <div className="font-semibold text-gray-700">{(post.viewCount || 0).toLocaleString()} <span className="text-xs font-normal text-gray-400">觀看</span></div>
                                                        <div className="flex items-center gap-1.5 font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-md">
                                                            <Flame className="w-3.5 h-3.5" />
                                                            {post.viralScore?.toLocaleString()} <span className="text-xs font-normal text-orange-400">/hr</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="col-span-full h-full flex flex-col items-center justify-center text-gray-400 py-6">
                                                <div className="w-12 h-12 rounded-full border border-dashed border-gray-300 flex items-center justify-center mb-3">
                                                    <Flame className="w-5 h-5 text-gray-300" />
                                                </div>
                                                <p className="text-sm">尚未出現爆款內容</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Main Trend Chart */}
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
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
                                                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} tickFormatter={(val) => typeof val === 'number' && val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val} />
                                                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} />
                                                <RechartsTooltip cursor={{ stroke: '#e5e7eb', strokeWidth: 2 }} contentStyle={{ borderRadius: '12px', border: '1px solid #f3f4f6', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                                                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                                                <Line yAxisId="left" type="monotone" dataKey="Views" name="觀看數" stroke="#6366F1" strokeWidth={3} dot={{ r: 4, fill: '#6366F1', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6, strokeWidth: 0 }} />
                                                <Line yAxisId="right" type="monotone" dataKey="ViralScore" name="總合爆發值" stroke="#F59E0B" strokeWidth={3} dot={{ r: 4, fill: '#F59E0B', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6, strokeWidth: 0 }} />
                                            </RechartsLineChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}
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
                                                <th className="px-6 py-4 font-semibold whitespace-nowrap">健康度 (ER)</th>
                                                <th className="px-6 py-4 font-semibold text-right">爆發指標</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {isLoading ? (
                                                [...Array(3)].map((_, i) => (
                                                    <tr key={i} className="border-b border-gray-50"><td colSpan={5} className="px-6 py-4"><div className="h-10 bg-gray-100 rounded animate-pulse"></div></td></tr>
                                                ))
                                            ) : filteredData.length > 0 ? (
                                                filteredData.map((item) => {
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
                                ) : channelDataList.length > 0 ? (
                                    channelDataList.map(ch => (
                                        <div key={ch.id || ch.channel_id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow group relative overflow-hidden">
                                            {/* 背景裝飾 */}
                                            <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl -mr-10 -mt-10 opacity-20 ${platformBgColors[ch.platform?.toLowerCase()] || 'bg-gray-300'}`}></div>

                                            <div className="flex justify-between items-start mb-4 relative z-10">
                                                <div>
                                                    <h3 className="font-bold text-gray-900 text-lg mb-1">{ch.title || ch.name || '未命名頻道'}</h3>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`px-2 py-0.5 text-[10px] font-bold text-white rounded uppercase tracking-wider ${platformBgColors[ch.platform?.toLowerCase()] || 'bg-gray-500'} shadow-sm`}>
                                                            {ch.platform || '未知'}
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
                                    <Hash className="text-indigo-600 w-8 h-8" />
                                    <div>
                                        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 leading-tight">
                                            熱門標籤分析 (開發中)
                                        </h1>
                                        <p className="text-xs text-gray-400 font-medium">即將對所有 tags 進行詞頻與流量交叉分析</p>
                                    </div>
                                </div>
                            </header>
                            <div className="bg-white p-12 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-gray-400">
                                <Hash className="w-12 h-12 mb-4 text-gray-300" />
                                <p>標籤流量轉換分析模組即將完成</p>
                            </div>
                        </div>
                    )}

                </main>
            </div>
        </div>
    );
}

