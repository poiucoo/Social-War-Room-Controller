import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
    Calendar, TrendingUp, TrendingDown, Target, Zap, 
    ChevronRight, Eye, Activity, Settings
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { supabase } from './lib/supabase';
import { MilestoneCMSModal } from './components/MilestoneCMSModal';

export interface MilestoneEvent {
    id: string;
    date: string;
    platform: string; 
    title: string;
    description: string;
    observationWindow: {
        mode: 'auto' | 'manual';
        beforeStarts: string;
        beforeEnds: string;
        afterStarts: string;
        afterEnds: string;
    };
}



const ProgressiveRetentionChart = ({ beforeVids, afterVids }: { beforeVids: any[], afterVids: any[] }) => {
    const allFiltered = useMemo(() => {
        return [
            ...beforeVids.map(v => ({...v, phase: 'before'})), 
            ...afterVids.map(v => ({...v, phase: 'after'}))
        ].sort((a,b) => a.timestamp - b.timestamp);
    }, [beforeVids, afterVids]);

    const chartData = useMemo(() => {
        const allSecs = new Set<number>();
        allFiltered.forEach(v => v.retentionData.forEach((d:any) => allSecs.add(Math.round(d.time))));
        const sortedSecs = Array.from(allSecs).sort((a,b)=>a-b);
        return sortedSecs.map(sec => {
            const row: any = { time: sec };
            allFiltered.forEach(v => {
                const pt = v.retentionData.find((d:any) => Math.abs(d.time - sec) < 1.0);
                if (pt) row[`vid_${v.id}`] = Math.min(pt.retention, 150);
            });
            return row;
        });
    }, [allFiltered]);

    const [visibleCount, setVisibleCount] = useState(0);

    useEffect(() => {
        if (allFiltered.length === 0) return;
        setVisibleCount(0);
        const timer = setInterval(() => {
            setVisibleCount(prev => {
                if (prev >= allFiltered.length) {
                    clearInterval(timer);
                    return prev;
                }
                return prev + 1;
            });
        }, 150);
        return () => clearInterval(timer);
    }, [allFiltered.length]);

    const beforeWithRetention = beforeVids.filter(v => v.retentionData && v.retentionData.length > 0);
    const afterWithRetention = afterVids.filter(v => v.retentionData && v.retentionData.length > 0);

    if (allFiltered.length === 0) {
        return <div className="text-gray-500 text-[10px] text-center mt-3 bg-[#0B0F19]/50 rounded-lg py-4 border border-gray-800">此觀察期間內無影片留存數據可以比對。</div>;
    }

    const visibleVids = allFiltered.slice(0, visibleCount);

    return (
        <div className="h-[220px] w-full mt-3 bg-[#0B0F19]/90 rounded-xl p-3 border border-gray-800 relative z-20 shadow-inner">
             <div className="absolute top-3 left-3 flex items-center gap-4 text-[10px] tracking-wider font-bold mb-2">
                 <div className="flex items-center gap-1.5">
                     <span className="w-2.5 h-2.5 rounded-full bg-rose-500/50"></span>
                     BEFORE
                     <span className="ml-0.5 text-[9px] font-bold text-rose-400/70 bg-rose-500/10 px-1.5 py-0.5 rounded-full border border-rose-500/20">{beforeWithRetention.length}</span>
                 </div>
                 <div className="flex items-center gap-1.5">
                     <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>
                     AFTER
                     <span className="ml-0.5 text-[9px] font-bold text-emerald-400/70 bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/20">{afterWithRetention.length}</span>
                 </div>
             </div>
             <div className="w-full h-full pt-8 pb-1">
                 <ResponsiveContainer width="100%" height="100%">
                     <LineChart data={chartData} margin={{ top: 0, right: 0, left: -25, bottom: 5 }}>
                         <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0a" vertical={false} />
                         <XAxis 
                            dataKey="time" 
                            type="number" 
                            domain={[0, 'dataMax']} 
                            tick={{fontSize: 9, fill: '#6b7280'}} 
                            tickFormatter={(v) => `${v}s`} 
                            axisLine={{stroke: '#374151'}}
                            tickLine={false}
                         />
                         <YAxis 
                            tick={{fontSize: 9, fill: '#6b7280'}} 
                            domain={[0, 150]} 
                            tickFormatter={(v)=>`${v}%`} 
                            axisLine={false}
                            tickLine={false}
                         />
                          <Tooltip 
                              content={({ label }) => label !== undefined ? (
                                  <div style={{
                                      backgroundColor: '#0F172A',
                                      border: '1px solid #1E293B',
                                      borderRadius: '8px',
                                      padding: '6px 10px',
                                      fontSize: '11px',
                                      color: '#9CA3AF',
                                      pointerEvents: 'none'
                                  }}>
                                      ⏱ 影片時間：<span style={{color: '#fff', fontWeight: 'bold'}}>{label}秒</span>
                                  </div>
                              ) : null}
                          />
                         {visibleVids.map(v => (
                             <Line 
                                 key={v.id}
                                 type="monotone"
                                 dataKey={`vid_${v.id}`}
                                 stroke={v.phase === 'after' ? '#34d399' : '#f43f5e'}
                                 strokeWidth={v.phase === 'after' ? 2 : 1.5}
                                 strokeOpacity={v.phase === 'after' ? 1.0 : 0.4}
                                 dot={false}
                                 activeDot={{ r: 4, fill: '#0F172A', stroke: v.phase === 'after' ? '#34d399' : '#f43f5e', strokeWidth: 2 }}
                                 connectNulls={true}
                                 name={`vid_${v.id}`}
                                 isAnimationActive={true}
                                 animationDuration={600}
                             />
                         ))}
                     </LineChart>
                 </ResponsiveContainer>
             </div>
        </div>
    );
};

interface Props {
    channelName: string;
    isOpen: boolean;
    activePlatforms: string[];
    selectedEventId?: string | null;
    videos?: any[];
    onSelectEvent: (id: string) => void;
    onClose: () => void;
}

export const ChannelMilestonePanel: React.FC<Props> = ({ channelName, isOpen, activePlatforms, selectedEventId, videos = [], onSelectEvent, onClose }) => {
    const [dbEvents, setDbEvents] = useState<any[]>([]);
    const [isCMSOpen, setIsCMSOpen] = useState(false);

    const fetchSupabaseMilestones = async () => {
        if (!channelName) return;
        const { data } = await supabase.from('milestones').select('*').eq('channel_name', channelName).order('date', { ascending: false });
        if (data && data.length > 0) {
            setDbEvents(data.map(row => {
                const pivotDate = new Date(row.date);
                const beforeEnd = new Date(pivotDate);
                beforeEnd.setDate(beforeEnd.getDate() - 1);
                const afterStart = pivotDate;
                
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
                        afterStarts: afterStart.toISOString().split('T')[0],
                        afterEnds: row.after_end
                    }
                };
            }));
        } else {
            setDbEvents([]);
        }
    };

    useEffect(() => {
        if (isOpen) fetchSupabaseMilestones();
    }, [channelName, isOpen]);

    const events = useMemo(() => {
        return dbEvents.filter(e => {
            const eventPlatform = e.platform.toUpperCase();
            return activePlatforms.length === 0 || 
                   eventPlatform === 'ALL' || 
                   activePlatforms.some(p => p.toUpperCase() === eventPlatform);
        });
    }, [dbEvents, activePlatforms]);
    
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [activeTab, setActiveTab] = useState<string>('YOUTUBE');

    // Auto-scroll to selected event when opened
    useEffect(() => {
        if (isOpen && selectedEventId) {
            // Optional: reset activeTab to YOUTUBE if we switch events, or maybe keep user's preference
            setTimeout(() => {
                const el = document.getElementById(`panel-evt-${selectedEventId}`);
                if (el && scrollContainerRef.current) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 100); 
        }
    }, [isOpen, selectedEventId]);

    return (
        <aside 
            className={`fixed inset-y-0 right-0 z-[60] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] bg-[#0B0F19] border-l border-gray-800 shadow-2xl flex flex-col w-full md:w-[400px] xl:w-[460px] ${
                isOpen ? 'translate-x-0' : 'translate-x-full'
            }`}
        >
            {/* Header */}
            <div className="sticky top-0 z-20 bg-[#0B0F19]/90 backdrop-blur-md border-b border-gray-800 px-6 py-5 flex items-center justify-between">
                <div>
                    <h2 className="text-white font-extrabold text-lg flex items-center gap-2">
                        <Target className="w-5 h-5 text-indigo-400" />
                        詳細調整數據
                    </h2>
                    <p className="text-gray-400 text-sm font-medium mt-1 truncate max-w-[200px] xl:max-w-[280px]">
                        {channelName} 
                    </p>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setIsCMSOpen(true)}
                        className="p-2 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-full text-indigo-400 transition-colors shadow-[0_0_15px_rgba(99,102,241,0.2)]"
                        title="CMS 策略部署管理"
                    >
                        <Settings className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={onClose}
                        className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-gray-400 transition-colors"
                        title="收起面板"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <MilestoneCMSModal 
                isOpen={isCMSOpen} 
                onClose={() => setIsCMSOpen(false)} 
                channelName={channelName} 
                onMilestonesUpdated={fetchSupabaseMilestones} 
            />

            {/* Scrollable Content */}
            <div className="p-6 relative flex-1 overflow-y-auto" ref={scrollContainerRef}>
                <div className="absolute left-[30px] top-6 bottom-0 w-[2px] bg-indigo-500/30 -ml-[1px]"></div>

                <div className="space-y-10 relative z-10 pb-16">
                    {events.map((evt) => {
                        const isSelected = selectedEventId === evt.id;
                        const isFaded = selectedEventId && !isSelected;

                        // 1. Safe Time Parser to bypass string format discrepancy (dash vs slash)
                        const safeTs = (dateStr: string) => {
                            try { return new Date(dateStr.replace(/-/g, '/')).getTime(); }
                            catch { return 0; }
                        };

                        const bStart = safeTs(evt.observationWindow.beforeStarts);
                        const bEnd = safeTs(evt.observationWindow.beforeEnds) + 86399999;
                        const aStart = safeTs(evt.observationWindow.afterStarts);
                        const aEnd = safeTs(evt.observationWindow.afterEnds) + 86399999;

                        const relevantFiltered = videos.filter(v => 
                            (evt.platform === 'ALL' ? v.platform === activeTab : v.platform === evt.platform) &&
                            (channelName === '' || v.channel === channelName)
                        );

                        const beforeVids = relevantFiltered.filter(v => v.timestamp >= bStart && v.timestamp <= bEnd);
                        const afterVids = relevantFiltered.filter(v => v.timestamp >= aStart && v.timestamp <= aEnd);

                        const calcAvg = (vids: any[]) => {
                            if (vids.length === 0) return { views: 0, interactions: 0 };
                            let totalV = 0; let totalI = 0;
                            vids.forEach(v => {
                                totalV += Number(v.kpi?.views || 0);
                                totalI += Number(v.kpi?.comments || 0) + Number(v.kpi?.likes || 0) + Number(v.kpi?.interactions || 0);
                            });
                            return {
                                views: Math.round(totalV / vids.length),
                                interactions: Math.round(totalI / vids.length)
                            };
                        };

                        const beforeAvg = calcAvg(beforeVids);
                        const afterAvg = calcAvg(afterVids);

                        const viewGrowth = beforeAvg.views > 0 ? ((afterAvg.views - beforeAvg.views) / beforeAvg.views * 100).toFixed(0) : (afterAvg.views > 0 ? "100" : "0");
                        const intGrowth = beforeAvg.interactions > 0 ? ((afterAvg.interactions - beforeAvg.interactions) / beforeAvg.interactions * 100).toFixed(0) : (afterAvg.interactions > 0 ? "100" : "0");

                        return (
                            <div 
                                id={`panel-evt-${evt.id}`}
                                key={evt.id} 
                                onClick={() => onSelectEvent(evt.id)}
                                className={`relative pl-10 pr-2 transition-all duration-300 ease-out cursor-pointer ${
                                    isSelected ? 'opacity-100' : 
                                    isFaded ? 'opacity-30 grayscale filter hover:opacity-60 hover:grayscale-0' : 'opacity-100'
                                }`}
                            >
                                <div className={`absolute left-0 top-1.5 w-3 h-3 rounded-full ${isSelected ? 'bg-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.8)]' : 'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.6)]'} ring-4 ring-[#0B0F19] transition-all duration-300 -ml-1.5`}></div>
                                
                                <div className={`flex flex-col gap-3 transition-colors duration-300 ${isSelected ? 'bg-[#151E32]/50 p-4 -m-4 rounded-2xl border border-indigo-500/30' : ''}`}>
                                    <div className="flex items-center justify-between">
                                        <span className={`flex items-center gap-1.5 text-xs font-bold tracking-wider font-mono px-2 py-0.5 rounded border ${isSelected ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'}`}>
                                            <Calendar className="w-3 h-3" />
                                            {evt.date}
                                        </span>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border tracking-widest uppercase ${
                                            evt.platform === 'YOUTUBE' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 
                                            evt.platform === 'INSTAGRAM' ? 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20' :
                                            evt.platform === 'TIKTOK' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' :
                                            'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                        }`}>
                                            {evt.platform === 'ALL' ? 'MULTI-PLATFORM' : evt.platform}
                                        </span>
                                    </div>

                                    <div>
                                        <h3 className={`font-bold text-lg mb-1 leading-snug transition-colors ${isSelected ? 'text-emerald-300' : 'text-white'}`}>{evt.title}</h3>
                                        <p className="text-gray-400 text-sm leading-relaxed">{evt.description}</p>
                                        
                                        {evt.platform === 'ALL' && isSelected && (
                                            <div className="flex items-center gap-2 mt-4 mb-1">
                                                {['YOUTUBE', 'INSTAGRAM', 'TIKTOK'].map(p => {
                                                    const isActive = activeTab === p;
                                                    return (
                                                        <button 
                                                            key={p} 
                                                            onClick={(e) => { e.stopPropagation(); setActiveTab(p); }}
                                                            className={`px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase rounded-lg transition-all ${
                                                                isActive ? (
                                                                    p === 'YOUTUBE' ? 'bg-red-500/20 text-red-400 border border-red-500/40 shadow-[0_0_10px_rgba(239,68,68,0.2)]' : 
                                                                    p === 'INSTAGRAM' ? 'bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/40 shadow-[0_0_10px_rgba(217,70,239,0.2)]' : 
                                                                    'bg-sky-500/20 text-sky-400 border border-sky-500/40 shadow-[0_0_10px_rgba(14,165,233,0.2)]'
                                                                ) : 'bg-[#0B0F19] text-gray-500 border border-gray-800 hover:bg-white/5 hover:text-gray-300'
                                                            }`}
                                                        >
                                                            {p}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    <div className="mt-2 grid grid-cols-2 gap-3">
                                        <div className={`bg-[#0B0F19] rounded-xl p-3 border flex flex-col ${isSelected ? 'border-gray-700' : 'border-gray-800'}`}>
                                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1 flex justify-between items-center">
                                                <span>BEFORE</span>
                                                <span className="text-[9px] lowercase bg-white/5 px-2 py-0.5 rounded ml-auto text-gray-400 whitespace-nowrap">共 {beforeVids.length} 支</span>
                                            </div>
                                            {evt.observationWindow && (
                                                <div className="text-[10px] text-gray-400 font-mono mb-2 flex items-center gap-1.5">
                                                    <Calendar className="w-2.5 h-2.5" /> 
                                                    {evt.observationWindow.beforeStarts.replace('2026-','').replace('2025-','')} - {evt.observationWindow.beforeEnds.replace('2026-','')}
                                                </div>
                                            )}
                                            <div className="space-y-2 mt-auto">
                                                <div className="flex items-end justify-between">
                                                    <span className="text-gray-400 text-xs flex items-center gap-1"><Eye className="w-3.5 h-3.5"/> 平均觀看</span>
                                                    <span className="text-white font-mono text-sm">{beforeAvg.views.toLocaleString()}</span>
                                                </div>
                                                <div className="flex items-end justify-between">
                                                    <span className="text-gray-400 text-xs flex items-center gap-1"><Activity className="w-3.5 h-3.5"/> 平均互動</span>
                                                    <span className="text-white font-mono text-sm">{beforeAvg.interactions.toLocaleString()}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className={`bg-[#151E32] rounded-xl p-3 border relative overflow-hidden group flex flex-col ${isSelected ? 'border-emerald-500/50 shadow-[0_0_20px_-5px_rgba(52,211,153,0.3)]' : 'border-indigo-500/30'}`}>
                                            <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity ${isSelected ? 'bg-emerald-500/10' : 'bg-indigo-500/5'}`}></div>
                                            <div className={`text-[10px] font-bold uppercase tracking-widest mb-1 flex items-center ${isSelected ? 'text-emerald-400' : 'text-indigo-400'}`}>
                                                <span>AFTER</span>
                                                <span className={`text-[9px] lowercase px-2 py-0.5 rounded ml-auto whitespace-nowrap ${isSelected ? 'bg-emerald-500/10' : 'bg-indigo-500/10'}`}>共 {afterVids.length} 支</span>
                                            </div>
                                            {evt.observationWindow && (
                                                <div className={`text-[10px] font-mono mb-2 flex items-center gap-1.5 ${isSelected ? 'text-emerald-400/80' : 'text-indigo-300/80'}`}>
                                                    <Calendar className="w-2.5 h-2.5" /> 
                                                    {evt.observationWindow.afterStarts.replace('2026-','')} - {evt.observationWindow.afterEnds.replace('2026-','')}
                                                </div>
                                            )}
                                            <div className="space-y-2 relative z-10 mt-auto">
                                                <div className="flex items-end justify-between">
                                                    <span className="text-gray-400 text-xs flex items-center gap-1"><Eye className="w-3.5 h-3.5"/> 平均觀看</span>
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-white font-mono text-sm">{afterAvg.views.toLocaleString()}</span>
                                                        {afterAvg.views > beforeAvg.views ? (
                                                            <TrendingUp className="w-3 h-3 text-emerald-400" />
                                                        ) : (
                                                            <TrendingDown className="w-3 h-3 text-rose-400" />
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-end justify-between">
                                                    <span className="text-gray-400 text-xs flex items-center gap-1"><Activity className="w-3.5 h-3.5"/> 平均互動</span>
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-white font-mono text-sm">{afterAvg.interactions.toLocaleString()}</span>
                                                        {afterAvg.interactions > beforeAvg.interactions ? (
                                                            <TrendingUp className="w-3 h-3 text-emerald-400" />
                                                        ) : (
                                                            <TrendingDown className="w-3 h-3 text-rose-400" />
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className={`mt-1 flex flex-col gap-2 rounded-lg px-3 py-2 border ${isSelected ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-white/5 border-white/5'}`}>
                                        <div className="flex items-center gap-2">
                                            <Zap className={`w-4 h-4 shrink-0 ${isSelected ? 'text-emerald-400' : 'text-amber-400'}`} />
                                            <p className="text-xs text-gray-300 font-medium leading-relaxed">
                                                平均觀看成長 <span className={`${isSelected ? 'text-emerald-300' : 'text-emerald-400'} font-bold`}>{Number(viewGrowth) > 0 ? '+' : ''}{viewGrowth}%</span>，
                                                平均互動差異 <span className={`${isSelected ? 'text-emerald-300' : 'text-indigo-400'} font-bold`}>{Number(intGrowth) > 0 ? '+' : ''}{intGrowth}%</span>
                                            </p>
                                        </div>
                                        
                                        {/* Progressive Retention Chart (Only renders when Selected) */}
                                        {isSelected && (
                                            <ProgressiveRetentionChart beforeVids={beforeVids} afterVids={afterVids} />
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </aside>
    );
};
