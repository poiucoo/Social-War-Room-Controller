import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Activity, TrendingUp, List, Eye, MousePointerClick, Layers, Flame } from 'lucide-react';

interface PostData {
    id: number;
    platform: 'youtube' | 'instagram' | 'threads';
    title: string;
    content_id: string;
    views: number;
    likes: number;
    comments: number;
    timestamp: string;
    viralScore?: number;
    er?: number;
    hoursSincePublished?: number | string;
}

const MOCK_DATA: PostData[] = [
    { id: 1, platform: 'youtube', title: 'Vue.js vs React.js: Which one to choose in 2026?', content_id: 'vid001', views: 154000, likes: 12000, comments: 1450, timestamp: new Date(Date.now() - 48 * 3600 * 1000).toISOString() },
    { id: 2, platform: 'youtube', title: 'Top 10 AI Tools that will change your workflow', content_id: 'vid002', views: 890000, likes: 65000, comments: 8900, timestamp: new Date(Date.now() - 12 * 3600 * 1000).toISOString() },
    { id: 3, platform: 'instagram', title: 'My Workspace Setup 2026', content_id: 'ig001', views: 45000, likes: 5600, comments: 120, timestamp: new Date(Date.now() - 5 * 3600 * 1000).toISOString() },
    { id: 4, platform: 'threads', title: 'Just realized something about modern auth flows...', content_id: 'th001', views: 12000, likes: 800, comments: 450, timestamp: new Date(Date.now() - 2 * 3600 * 1000).toISOString() },
    { id: 5, platform: 'youtube', title: 'Building a Fullstack App with Supabase', content_id: 'vid003', views: 42000, likes: 3200, comments: 200, timestamp: new Date(Date.now() - 72 * 3600 * 1000).toISOString() },
    { id: 6, platform: 'instagram', title: 'Why I stopped using Redux', content_id: 'ig002', views: 120000, likes: 15000, comments: 3400, timestamp: new Date(Date.now() - 24 * 3600 * 1000).toISOString() },
];

function calculateMetrics(item: PostData): PostData {
    const hoursSincePublished = Math.max(0.1, (Date.now() - new Date(item.timestamp).getTime()) / (1000 * 3600));
    const viralScore = Math.round(item.views / hoursSincePublished);
    const er = ((item.likes + item.comments) / item.views * 100).toFixed(2);
    return { ...item, viralScore, er: parseFloat(er), hoursSincePublished: hoursSincePublished.toFixed(1) };
}

const platformBgColors: Record<string, string> = {
    youtube: 'bg-[#FF0000]',
    instagram: 'bg-[#E1306C]',
    threads: 'bg-[#000000]'
};

export default function App() {
    const [data, setData] = useState<PostData[]>([]);
    const [platformFilter, setPlatformFilter] = useState('all');
    const [sortBy, setSortBy] = useState('timestamp');

    useEffect(() => {
        // Simulated Supabase fetch
        setTimeout(() => {
            const processedData = MOCK_DATA.map(calculateMetrics);
            setData(processedData);
        }, 800);
    }, []);

    const filteredData = useMemo(() => {
        let result = [...data];
        if (platformFilter !== 'all') {
            result = result.filter(d => d.platform === platformFilter);
        }

        result.sort((a, b) => {
            if (sortBy === 'timestamp') return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
            if (sortBy === 'viralScore') return (b.viralScore || 0) - (a.viralScore || 0);
            if (sortBy === 'er') return (b.er || 0) - (a.er || 0);
            return 0;
        });

        return result;
    }, [data, platformFilter, sortBy]);

    // Calculate Outliers (2 std deviations) for Viral Score
    const viralScores = data.map(d => d.viralScore || 0);
    const mean = viralScores.reduce((a, b) => a + b, 0) / Math.max(viralScores.length, 1);
    const varience = viralScores.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / Math.max(viralScores.length, 1);
    const stdDev = Math.sqrt(varience);
    const threshold = mean + (2 * stdDev);

    const kpiData = {
        totalViews: data.reduce((acc, curr) => acc + curr.views, 0),
        avgER: (data.reduce((acc, curr) => acc + (curr.er || 0), 0) / Math.max(data.length, 1)).toFixed(2),
        totalPosts: data.length,
        viralPosts: data.filter(d => (d.viralScore || 0) > threshold && (d.viralScore || 0) > 0).length
    };

    const chartData = [...filteredData].reverse().map(d => ({
        name: d.title.substring(0, 15) + '...',
        Views: d.views,
        ViralScore: d.viralScore
    }));

    return (
        <div className="min-h-screen p-6">
            <div className="max-w-7xl mx-auto space-y-6">

                <header className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex flex-col md:flex-row md:items-center gap-4 w-full justify-between">
                        <div className="flex items-center gap-3">
                            <Activity className="text-indigo-600 w-8 h-8" />
                            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
                                Social War Room
                            </h1>
                        </div>

                        <div className="flex gap-4">
                            <select
                                className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5"
                                value={platformFilter}
                                onChange={(e) => setPlatformFilter(e.target.value)}
                            >
                                <option value="all">所有平台 (All)</option>
                                <option value="youtube">YouTube</option>
                                <option value="instagram">Instagram</option>
                                <option value="threads">Threads</option>
                            </select>

                            <select
                                className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5"
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                            >
                                <option value="timestamp">最新發布</option>
                                <option value="viralScore">爆發值最高</option>
                                <option value="er">互動率最高</option>
                            </select>
                        </div>
                    </div>
                </header>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md transition-shadow">
                        <div>
                            <p className="text-sm font-medium text-gray-500 mb-1">總觀看數</p>
                            <p className="text-3xl font-bold text-gray-900">{kpiData.totalViews.toLocaleString()}</p>
                        </div>
                        <div className="p-3 bg-blue-50 text-blue-500 rounded-lg">
                            <Eye className="w-6 h-6" />
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md transition-shadow">
                        <div>
                            <p className="text-sm font-medium text-gray-500 mb-1">平均互動率 (ER)</p>
                            <p className="text-3xl font-bold text-gray-900">{kpiData.avgER}%</p>
                        </div>
                        <div className="p-3 bg-green-50 text-green-500 rounded-lg">
                            <MousePointerClick className="w-6 h-6" />
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md transition-shadow">
                        <div>
                            <p className="text-sm font-medium text-gray-500 mb-1">總內容數</p>
                            <p className="text-3xl font-bold text-gray-900">{kpiData.totalPosts}</p>
                        </div>
                        <div className="p-3 bg-purple-50 text-purple-500 rounded-lg">
                            <Layers className="w-6 h-6" />
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md transition-shadow">
                        <div>
                            <p className="text-sm font-medium text-gray-500 mb-1">爆款文章數</p>
                            <p className="text-3xl font-bold text-gray-900">{kpiData.viralPosts}</p>
                        </div>
                        <div className="p-3 bg-orange-50 text-orange-500 rounded-lg">
                            <Flame className="w-6 h-6" />
                        </div>
                    </div>
                </div>

                {/* Chart */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-gray-400" />
                        趨勢折線圖
                    </h2>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} dy={10} />
                                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
                                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
                                <Tooltip cursor={{ stroke: '#E5E7EB', strokeWidth: 2 }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                <Legend iconType="circle" />
                                <Line yAxisId="left" type="monotone" dataKey="Views" name="觀看數" stroke="#6366F1" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                                <Line yAxisId="right" type="monotone" dataKey="ViralScore" name="爆發值" stroke="#F59E0B" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* List */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100">
                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <List className="w-5 h-5 text-gray-400" />
                            內容明細列表
                        </h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-500">
                            <thead className="text-xs text-gray-400 uppercase bg-gray-50">
                                <tr>
                                    <th className="px-6 py-4 font-medium whitespace-nowrap">平台 / 標題</th>
                                    <th className="px-6 py-4 font-medium whitespace-nowrap">發布時間</th>
                                    <th className="px-6 py-4 font-medium">觀看數</th>
                                    <th className="px-6 py-4 font-medium whitespace-nowrap">互動率 (ER)</th>
                                    <th className="px-6 py-4 font-medium text-right">爆發值</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredData.map((item) => {
                                    const isViral = (item.viralScore || 0) > threshold && (item.viralScore || 0) > 0;
                                    return (
                                        <tr key={item.id} className="bg-white border-b hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3 w-max">
                                                    <span className={`px-2.5 py-1 text-xs font-semibold text-white rounded-full ${platformBgColors[item.platform]} uppercase tracking-wider`}>
                                                        {item.platform}
                                                    </span>
                                                    <span className="font-medium text-gray-900 max-w-[300px] truncate" title={item.title}>
                                                        {item.title}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {new Date(item.timestamp).toLocaleString('zh-TW', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td className="px-6 py-4 font-medium text-gray-900">
                                                {item.views.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-1 rounded">
                                                    {item.er}%
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {isViral && (
                                                        <span className="flex items-center gap-1 text-orange-600 font-bold bg-orange-50 px-2 py-1 rounded-md text-xs whitespace-nowrap" title="數值偏離平均值2個標準差">
                                                            <Flame className="w-3 h-3 text-orange-500" />
                                                            爆款預警
                                                        </span>
                                                    )}
                                                    <span className="font-bold text-gray-900">{item.viralScore?.toLocaleString()}</span>
                                                    <span className="text-xs text-gray-400">/hr</span>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    );
}
