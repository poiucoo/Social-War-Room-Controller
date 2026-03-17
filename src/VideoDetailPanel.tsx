import { useState, useEffect } from 'react';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine, ReferenceArea } from 'recharts';
import { Activity, Eye, Zap, BarChart2, Layers, Focus, Lightbulb, TrendingUp, Music, Timer, CheckCircle2, Maximize2, X, ChevronUp, ChevronDown } from 'lucide-react';
import { supabase } from './lib/supabase';

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

export function VideoDetailPanel({ video, allSlidesData }: { video: VideoData; allSlidesData: any[] }) {
    const targetEvent = video.dropEvents[0];
    const isPositive = targetEvent?.severity === 'Positive';

    // pinnedSecond: 當前分析釘點的秒數，初始化為 AI 偵測到的 Drop/Peak 點
    const [pinnedSecond, setPinnedSecond] = useState<number>(targetEvent?.timeIndex ?? 0);
    const [activeTimelineMetrics, setActiveTimelineMetrics] = useState<string[]>(['views', 'likes', 'saves', 'comments']);
    const [isStudioMode, setIsStudioMode] = useState(false);
    
    // Gemini API States
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [geminiResponse, setGeminiResponse] = useState<string | null>(null);
    const [showApiKeyPrompt, setShowApiKeyPrompt] = useState(false);
    const [apiKeyInput, setApiKeyInput] = useState('');
    const [lastAnalyzedAt, setLastAnalyzedAt] = useState<string | null>(null);
    const [isReportExpanded, setIsReportExpanded] = useState(false);

    // Initial load: check if an insight exists in Supabase
    useEffect(() => {
        const fetchExistingInsight = async () => {
            if (!video.originalId) return;
            const { data, error } = await supabase
                .from('video_ai_insights')
                .select('insight_content, created_at')
                .eq('video_id', video.originalId)
                .eq('insight_type', 'FULL_VIDEO_CHECKUP')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (data && !error) {
                setGeminiResponse(data.insight_content);
                setLastAnalyzedAt(new Date(data.created_at).toLocaleString('zh-TW'));
                setIsReportExpanded(false); // 讀取舊紀錄預設收合
            } else {
                setGeminiResponse(null);
                setLastAnalyzedAt(null);
                setIsReportExpanded(false);
            }
        };
        fetchExistingInsight();
    }, [video.originalId]);

    const toggleTimelineMetric = (metric: string) => {
        setActiveTimelineMetrics(prev =>
            prev.includes(metric) ? prev.filter(m => m !== metric) : [...prev, metric]
        );
    };

    // 查找 pinnedSecond 對應的 Slide 資料 (使用 originalId 與資料庫 video_id 對齊)
    const matchedSlide = allSlidesData
        .filter((s: any) => s.video_id === video.originalId)
        .find((s: any) => {
            const st = typeof s.start_time === 'string' ? parseFloat(s.start_time) : Number(s.start_time);
            const ed = typeof s.end_time === 'string' ? parseFloat(s.end_time) : Number(s.end_time);
            return pinnedSecond >= st && pinnedSecond < ed;
        }) ?? null;

    const displayRole = matchedSlide?.role ?? targetEvent?.slideInsights?.role ?? '—';
    const displayVisual = matchedSlide?.visual_evidence ?? targetEvent?.slideInsights?.visual ?? '—';
    const displayAuditory = matchedSlide?.auditory_vibe ?? '—';
    const displayTrigger = matchedSlide?.psychological_trigger ?? targetEvent?.slideInsights?.trigger ?? '—';
    const displayPacing = matchedSlide?.speech_pacing ? `${matchedSlide.speech_pacing} 字/秒` : null;
    const displayImageText = matchedSlide?.image_text_ch ?? targetEvent?.slideInsights?.imageText ?? '—';
    const displayVideoPrompt = matchedSlide?.speech_content_ch ?? targetEvent?.slideInsights?.videoPrompt ?? '—';
    const displayStrategy = matchedSlide?.tag_alignment ?? targetEvent?.slideInsights?.strategy ?? '—';
    const displayTime = `0${Math.floor(pinnedSecond / 60)}:${String(Math.floor(pinnedSecond % 60)).padStart(2, '0')}`;

    const panelColor = isPositive ? 'bg-emerald-950/20 border-emerald-900/50' : 'bg-rose-950/20 border-rose-900/50';
    const titleColor = isPositive ? 'text-emerald-400' : 'text-rose-400';
    const iconBg = isPositive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400';

    // Helper: 將 "MM:SS.m" 字串轉為秒數
    const timeToSeconds = (timeStr: string | undefined): number => {
        if (!timeStr || typeof timeStr !== 'string') return 0;
        try {
            const parts = timeStr.split(':');
            if (parts.length >= 2) return parseInt(parts[0]) * 60 + parseFloat(parts[1]);
            return parseFloat(timeStr);
        } catch (e) { return 0; }
    };

    const s90 = timeToSeconds(video.depthMetrics?.stayAbove90End);
    const s70 = timeToSeconds(video.depthMetrics?.stayAbove70End);

    const cwStart = timeToSeconds(video.depthMetrics?.rewatchDropStart);
    const cwEnd = timeToSeconds(video.depthMetrics?.rewatchDropEnd);

    const coreStart = timeToSeconds(video.depthMetrics?.coreDropStart);
    const coreEnd = timeToSeconds(video.depthMetrics?.coreDropEnd);

    // 自訂釘點 Label (在 ReferenceLine 頂部顯示大頭針圖示)
    const PinLabel = (props: any) => {
        const { viewBox } = props;
        if (!viewBox) return null;
        const { x, y } = viewBox;
        return (
            <g>
                <circle cx={x} cy={y - 8} r={10} fill="#F43F5E" opacity={0.95} filter="url(#pinShadow)" />
                <text x={x} y={y - 3} textAnchor="middle" fill="white" fontSize={11} fontWeight="bold">📍</text>
                <text x={x} y={y - 22} textAnchor="middle" fill="#F43F5E" fontSize={9} fontFamily="monospace" fontWeight="bold">{displayTime}</text>
                <defs>
                    <filter id="pinShadow" x="-50%" y="-50%" width="200%" height="200%">
                        <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#F43F5E" floodOpacity="0.6" />
                    </filter>
                </defs>
            </g>
        );
    };

    // 自定義指標標籤，讓虛線能連到文字
    const MetricLabel = (props: any) => {
        const { viewBox, value, fill, dy } = props;
        if (!viewBox) return null;
        const { x, y } = viewBox;
        return (
            <g>
                <line x1={x} y1={y} x2={x} y2={y + dy + 8} stroke={fill} strokeWidth={1} strokeDasharray="2 2" />
                <text x={x} y={y + dy} textAnchor="middle" fill={fill} fontSize={9} fontWeight="bold">{value}</text>
            </g>
        );
    };

    // 原有單一斷點流失診斷邏輯 (generateDiagnosticReport) 已被 Gemini 全片綜合健檢取代並移除。

    const handleGeminiAnalysis = async () => {
        let key = localStorage.getItem('GEMINI_API_KEY') || import.meta.env.VITE_GEMINI_API_KEY;
        if (!key) {
            setShowApiKeyPrompt(true);
            return;
        }
        
        setIsAnalyzing(true);
        setGeminiResponse(null);
        setLastAnalyzedAt(null);
        setShowApiKeyPrompt(false);
        
        try {
            // 建構 Full Context Prompt
            const slidesContext = allSlidesData
                .filter((s: any) => s.video_id === video.originalId)
                .sort((a, b) => Number(a.slide_no) - Number(b.slide_no))
                .map((s: any, idx) => `[Slide ${idx + 1} (${s.start_time}s - ${s.end_time}s)]\n角色: ${s.role || '未標註'}\n旁白: ${s.speech_content_ch || '未標註'}\n字卡: ${s.image_text_ch || '未標註'}\n視覺證據: ${s.visual_evidence || '未標註'}`)
                .join('\n\n');

            const retCurveStr = (video.retentionData || []).map((d: any) => `${d.formattedTime || d.time || d.time_label || d.timeIndex || ''}:${d.retention || d.retention_rate || d.rate || d.y || ''}%`).filter((s: string) => !s.startsWith(':')).join(', ');
            
            const kpiContext = `[基礎表現]\n平台: ${video.platform || '無'} | 觀看數: ${video.kpi.views || '0'} | 發布時間: ${video.publishedAt}\n按讚: ${video.kpi.likes || '0'} | 留言: ${video.kpi.comments || '0'} | 預期收益: ${video.kpi.er || '無'}\n\n[留存深度]\n平均觀看: ${video.depthMetrics?.averageRetention || 0}% | 完看率: ${video.depthMetrics?.endRetentionRate || 0}%\n影片總長: ${video.maxDuration}秒\n\n全網留存曲線 (時間:留存率%):\n[ ${retCurveStr} ]\n\n[策略標籤]\n一級標籤: ${video.l1Tags?.join(', ') || '無'}\n二級標籤: ${video.l2Tags?.join(', ') || '無'}`;

            const fullPrompt = `你現在是一位高階短影音策略顧問與流量分析師。請對以下影片進行「全片綜合健檢」，並輸出可用的 Prompt Action。

### 【重要分析原則：包容性判定與頻道差異防呆】
當您發現影片中的「字卡 (Image Text)」或「視覺證據 (Visual Evidence)」等欄位出現『未標註』或空白時，**請絕對不要直接將其批評為「視覺匱乏」、「無聊」或「製作失敗」**。
發生空值的原因可能如下：
1. **尚未分析/標註**：該影片可能只有系統自動爬取的留存數據與旁白，尚未進行人工的視覺與心理特微標註。
2. **頻道屬性差異**：某些類型的短影音（例如：純故事解說頻道、Vlog、純語音配圖頻道）本來就不仰賴畫面強調的字卡，而是完全依靠「旁白/字幕」的聽覺來推進劇情。

👉 **你的診斷要求**：
- 請依據當前「有提供」的實質資料（如：旁白的文本內容、以及秒級留存曲線的真實起伏），結合這支影片「最有可能的頻道屬性」去進行客觀判斷。
- 如果字卡是空的，就去審視旁白說了什麼導致留存率崩潰，並給予**文案寫作**的 Prompt 建議。
- 不要對空值窮追猛打，要聚焦在「現有資料為何導致觀眾流失」以及「如何透過具體的 Prompt 規則設定來改善」。

### 【量化數據與表現指標】
${kpiContext}

### 【全片劇本與畫面分鏡表】
${slidesContext}

請產出以下格式的報告 (使用 Markdown 結構化輸出)：
## 1. 全片策略總評 (Overview)
基於數據表現、完整留存曲線與標籤設定，評估整體策略是否奏效，以及做得好的高光點與失敗的缺失。
## 2. 關鍵流失診斷 (Critical Drops)
結合秒數留存率的劇烈變化與該區段的劇本內容，明確指出哪裡做得不好、致命點是什麼。
## 3. 行動指南：Prompt 升級建議 (Actionable Prompt Advice)
將你發現的解決方案轉化為「具體的 Prompt 寫作規則設計」。這些規則應該可以直接複製貼上到我未來影片生成的 Prompt 中（例如：請在腳本中規定前 10 秒單行字數不得超過...）。`;

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: fullPrompt }] }],
                    generationConfig: { temperature: 0.7 }
                })
            });

            if (!response.ok) {
                if (response.status === 400 || response.status === 403) {
                     localStorage.removeItem('GEMINI_API_KEY');
                     throw new Error('API Key 無效或過期，請重新輸入。');
                }
                throw new Error('API 呼叫失敗: ' + response.statusText);
            }

            const data = await response.json();
            const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (textResponse) {
                setGeminiResponse(textResponse);
                setIsReportExpanded(true); // 新分析完成預設展開
                const currentTime = new Date().toLocaleString('zh-TW');
                setLastAnalyzedAt(currentTime);
                
                // 非同步寫入 Supabase
                supabase.from('video_ai_insights').insert([{
                    video_id: video.originalId,
                    insight_type: 'FULL_VIDEO_CHECKUP',
                    insight_content: textResponse,
                    model_used: 'gemini-2.5-flash'
                }]).then(({ error }) => {
                    if (error) console.error("Failed to save insight to Supabase:", error);
                });
            } else {
                setGeminiResponse('⚠️ 無法解析 Gemini 回應，請稍後再試。');
            }
        } catch (error: any) {
            setGeminiResponse(`❌ 分析失敗: ${error.message}`);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const saveApiKeyAndRun = () => {
        if (!apiKeyInput.trim()) return;
        localStorage.setItem('GEMINI_API_KEY', apiKeyInput.trim());
        setShowApiKeyPrompt(false);
        setApiKeyInput('');
        handleGeminiAnalysis();
    };

    return (
        <div className="p-4 md:p-5 pt-0 border-t border-gray-800/50 grid grid-cols-1 lg:grid-cols-12 gap-4 mt-1">

            {/* B. 互動式留存率折線圖 (左側占 5 欄) */}
            <div className="lg:col-span-5 bg-[#0B0F19] p-3 md:p-4 rounded-xl border border-gray-800 relative shadow-inner">
                <div className="flex flex-row items-center justify-between mb-2">
                    <h4 className="text-white font-bold flex items-center gap-2">
                        <BarChart2 className="w-5 h-5 text-indigo-400" />
                        互動式觀眾留存曲線
                    </h4>
                    <div className="flex bg-[#1E293B]/40 px-3 py-1.5 rounded-xl border border-white/5 items-center gap-4 w-fit scale-90 origin-right">
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest flex items-center gap-1.5 whitespace-nowrap"><Activity className="w-3 h-3 text-indigo-400" /> 平均觀看%</span>
                            <span className="text-sm font-bold text-white tracking-tight">{video.depthMetrics?.averageRetention ?? 0}%</span>
                        </div>
                        <div className="flex flex-col items-center border-l border-white/5 pl-6">
                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest flex items-center gap-1.5 whitespace-nowrap"><Timer className="w-3 h-3 text-amber-400" /> 平均觀看時間</span>
                            <span className="text-sm font-bold text-white font-mono">{video.depthMetrics?.averageWatchTime ?? '0:00'}</span>
                        </div>
                        <div className="flex flex-col items-center border-l border-white/5 pl-6">
                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest flex items-center gap-1.5 whitespace-nowrap"><CheckCircle2 className="w-3 h-3 text-emerald-400" /> 完看率%</span>
                            <span className="text-sm font-bold text-white font-mono">{video.depthMetrics?.endRetentionRate ?? 0}%</span>
                        </div>
                        <button
                            onClick={() => setIsStudioMode(true)}
                            className="p-2 hover:bg-white/10 rounded-lg text-gray-400 transition-all hover:text-white border border-transparent hover:border-white/10 ml-2"
                            title="進入全螢幕戰情室模式"
                        >
                            <Maximize2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="h-[280px] w-full cursor-crosshair">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                            data={video.retentionData.length > 0 ? video.retentionData : Array.from({ length: Math.ceil(video.maxDuration) + 1 }, (_, i) => ({
                                time: i,
                                retention: 0,
                                formattedTime: `0${Math.floor(i / 60)}:${String(i % 60).padStart(2, '0')}`
                            }))}
                            margin={{ top: 35, right: 20, left: -15, bottom: 10 }}
                            onClick={(state: any) => {
                                if (state?.activePayload?.[0]?.payload?.time !== undefined) {
                                    setPinnedSecond(state.activePayload[0].payload.time);
                                }
                            }}
                        >
                            <defs>
                                <linearGradient id={`gradArea_${video.id}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={isPositive ? '#10B981' : '#6366F1'} stopOpacity={0.4} />
                                    <stop offset="95%" stopColor={isPositive ? '#10B981' : '#6366F1'} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1E293B" />
                            <XAxis
                                dataKey="time"
                                type="number"
                                domain={[0, video.maxDuration || 'dataMax']}
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 11, fill: '#64748B' }}
                                tickCount={6}
                                tickFormatter={(v) => `0${Math.floor(v / 60)}:${String(Math.floor(v % 60)).padStart(2, '0')}`}
                            />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                            <RechartsTooltip
                                cursor={{ stroke: '#334155', strokeWidth: 1, strokeDasharray: '5 5' }}
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        const d = payload[0].payload;
                                        return (
                                            <div className="bg-[#0F172A] p-3 rounded-lg border border-gray-700 shadow-xl backdrop-blur-xl">
                                                <p className="text-gray-400 text-xs font-bold font-mono mb-1 text-center">{d.formattedTime}</p>
                                                <p className="text-white text-xl font-bold text-center">{Number(payload[0].value).toFixed(1)}%</p>
                                                <div className="mt-1 text-[10px] text-gray-500 text-center">點擊以移動釘點</div>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            {/* 90% 勾子持續秒數標記 */}
                            {s90 > 0 && (
                                <ReferenceLine
                                    x={s90}
                                    stroke="#818CF8"
                                    strokeDasharray="2 2"
                                    label={<MetricLabel value="🛡️ 90% 勾子" fill="#818CF8" dy={-24} />}
                                />
                            )}
                            {/* 70% 核心持續秒數標記 */}
                            {s70 > 0 && (
                                <ReferenceLine
                                    x={s70}
                                    stroke="#F59E0B"
                                    strokeDasharray="2 2"
                                    label={<MetricLabel value="🔥 70% 核心" fill="#FBBF24" dy={-8} />}
                                />
                            )}
                            {/* 1. 核心流失區 (Core Drop) - 紅色區間 */}
                            {coreStart > 0 && coreEnd > coreStart && (
                                <ReferenceArea
                                    x1={coreStart}
                                    x2={coreEnd}
                                    fill="#F43F5E"
                                    fillOpacity={0.25}
                                    label={{
                                        value: `🔴 核心流失 (${video.depthMetrics?.coreDropStart} ~ ${video.depthMetrics?.coreDropEnd}) -${video.depthMetrics?.coreDropSeverity}%`,
                                        position: 'insideBottomLeft',
                                        fill: '#F43F5E',
                                        fontSize: 9,
                                        fontWeight: 'bold',
                                        dy: -2 // 向上微調以區分文字
                                    }}
                                />
                            )}

                            {/* 2. 重播衰退區 (Rewatch Drop) - 藍色區間 */}
                            {cwStart > 0 && cwEnd > cwStart && (
                                <ReferenceArea
                                    x1={cwStart}
                                    x2={cwEnd}
                                    fill="#6366F1"
                                    fillOpacity={0.25}
                                    label={{
                                        value: `🔵 重播衰退 (${video.depthMetrics?.rewatchDropStart} ~ ${video.depthMetrics?.rewatchDropEnd}) -${video.depthMetrics?.rewatchDropSeverity}%`,
                                        position: 'insideBottomLeft',
                                        fill: '#818CF8',
                                        fontSize: 9,
                                        fontWeight: 'bold',
                                        dy: 10 // 向下微調
                                    }}
                                />
                            )}
                            {/* 📍 可移動的分析釘點虛線 */}
                            <ReferenceLine
                                x={pinnedSecond}
                                stroke="#F43F5E"
                                strokeDasharray="3 3"
                                strokeWidth={2}
                                label={<PinLabel />}
                            />
                            <Area
                                type="monotone"
                                dataKey="retention"
                                stroke={isPositive ? '#10B981' : '#818CF8'}
                                strokeWidth={3}
                                fill={`url(#gradArea_${video.id})`}
                                activeDot={{ r: 6, fill: '#0F172A', stroke: isPositive ? '#10B981' : '#818CF8', strokeWidth: 3 }}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* 1D ~ 14D 綜合成長趨勢線圖 */}
                <div className="mt-3 pt-3 border-t border-gray-800/50">
                    <div className="flex justify-between items-center mb-1">
                        <h4 className="text-white text-sm font-bold flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-indigo-400" />
                            發布後 1~14 天核心成長趨勢 (Growth Timeline)
                        </h4>
                    </div>
                    <div className="h-[90px] w-full">
                        {video.timelineData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={video.timelineData} margin={{ top: 5, right: 10, left: -20, bottom: -10 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1E293B" />
                                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                                    <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v} />
                                    <RechartsTooltip
                                        cursor={{ stroke: '#334155', strokeWidth: 1, strokeDasharray: '5 5' }}
                                        content={({ active, payload, label }) => {
                                            if (active && payload && payload.length) {
                                                return (
                                                    <div className="bg-[#0F172A] p-4 rounded-xl border border-gray-700 shadow-2xl backdrop-blur-xl min-w-[160px]">
                                                        <p className="text-gray-400 text-xs font-bold font-mono mb-3 border-b border-gray-800 pb-2">{label} 累積數據</p>
                                                        <div className="space-y-2">
                                                            {payload.map((entry, index) => (
                                                                <div key={`item-${index}`} className="flex justify-between items-center text-sm font-bold">
                                                                    <span style={{ color: entry.color }} className="flex items-center gap-1.5">
                                                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></span>
                                                                        {entry.name === 'views' ? '觀看' : entry.name === 'likes' ? '按讚' : entry.name === 'saves' ? '收藏' : '留言'}
                                                                    </span>
                                                                    <span className="text-white font-mono">{Number(entry.value).toLocaleString()}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Line hide={!activeTimelineMetrics.includes('views')} yAxisId="left" type="monotone" dataKey="views" name="views" stroke="#10B981" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                                    <Line hide={!activeTimelineMetrics.includes('likes')} yAxisId="left" type="monotone" dataKey="likes" name="likes" stroke="#F43F5E" strokeWidth={2} dot={{ r: 3 }} />
                                    <Line hide={!activeTimelineMetrics.includes('saves')} yAxisId="left" type="monotone" dataKey="saves" name="saves" stroke="#6366F1" strokeWidth={2} dot={{ r: 3 }} />
                                    <Line hide={!activeTimelineMetrics.includes('comments')} yAxisId="left" type="monotone" dataKey="comments" name="comments" stroke="#F59E0B" strokeWidth={2} dot={{ r: 3 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 bg-[#0B0F19]/50 rounded-xl border border-dashed border-gray-800">
                                <BarChart2 className="w-8 h-8 mb-2 opacity-50" />
                                <p className="text-xs font-bold tracking-widest uppercase">INSUFFICIENT TIMELINE DATA</p>
                            </div>
                        )}
                    </div>
                    {video.timelineData.length > 0 && (
                        <div className="flex justify-center gap-3 mt-2 mb-0">
                            {[
                                { key: 'views', label: '觀看', color: '#10B981' },
                                { key: 'likes', label: '按讚', color: '#F43F5E' },
                                { key: 'saves', label: '收藏', color: '#6366F1' },
                                { key: 'comments', label: '留言', color: '#F59E0B' }
                            ].map(metric => {
                                const isActive = activeTimelineMetrics.includes(metric.key);
                                return (
                                    <button
                                        key={metric.key}
                                        title={`點擊${isActive ? '隱藏' : '顯示'} ${metric.label}`}
                                        onClick={() => toggleTimelineMetric(metric.key)}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${isActive ? 'bg-white/5 border-white/10 text-white shadow-sm' : 'bg-transparent border-transparent text-gray-600 hover:text-gray-400'}`}
                                    >
                                        <span className="w-2 h-2 rounded-full transition-colors" style={{ backgroundColor: isActive ? metric.color : '#334155' }}></span>
                                        {metric.label}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* C & D. Slide 釘點解剖 與 AI 建議 (右側佔 7 欄) */}
            <div className="lg:col-span-7 flex flex-col gap-5">

                {/* Slide 剖析 (C component) */}
                <div className={`flex-1 rounded-xl border p-3 md:p-4 shadow-sm transition-colors duration-300 ${panelColor}`}>
                    <div className="flex items-center gap-3 mb-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${iconBg}`}>
                            <Focus className="w-4 h-4" />
                        </div>
                        <div>
                            <h5 className={`font-bold ${titleColor} flex items-center gap-2`}>
                                📍 Slide {matchedSlide?.slide_no || '—'} 畫面解剖
                                <span className="text-sm font-mono opacity-50 font-normal">|</span>
                                <span className="text-sm font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                                    {matchedSlide ? `${matchedSlide.start_time}s ~ ${matchedSlide.end_time}s` : displayTime}
                                </span>
                            </h5>
                            <p className="text-xs text-gray-500 mt-0.5">點擊留存曲線任意位置可切換分析秒數</p>
                        </div>
                    </div>

                    <div className="flex flex-col gap-4">
                        {/* 第一列：內容角色 + 語速 + 心理觸發 */}
                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr] gap-3">
                            <div className="bg-[#0B0F19]/80 p-3 rounded-xl border border-gray-800/50 transition-colors hover:border-indigo-500/30">
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5">
                                    <Layers className="w-3 h-3 text-indigo-400" /> 內容角色 (Role)
                                </p>
                                <p className="text-sm font-semibold text-gray-200 leading-relaxed truncate">{displayRole}</p>
                            </div>
                            <div className="bg-[#0B0F19]/80 p-4 rounded-xl border border-gray-800/50 transition-colors hover:border-indigo-500/30">
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                    <Activity className="w-3 h-3 text-amber-400" /> 語速 (Speech Pacing)
                                </p>
                                <p className="text-sm font-semibold text-amber-300 leading-relaxed truncate">{displayPacing ?? '—'}</p>
                            </div>
                            <div className="bg-[#0B0F19]/80 p-4 rounded-xl border border-gray-800/50 transition-colors hover:border-indigo-500/30 flex flex-col justify-center">
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                    <Zap className="w-3 h-3 text-indigo-400" /> 心理觸發 (Trigger)
                                </p>
                                <div className="flex">
                                    <span className="bg-indigo-500/10 px-3 py-1 rounded border border-indigo-500/20 text-xs font-bold text-indigo-300 uppercase tracking-tighter truncate">
                                        {displayTrigger}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* 兩欄並列分析區 */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                            {/* 左欄：數據文字、旁白、策略 */}
                            <div className="space-y-3">
                                <div className="bg-[#0B0F19]/80 p-3 rounded-xl border border-gray-800/50 transition-colors hover:border-indigo-500/30">
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5">
                                        <BarChart2 className="w-3 h-3 text-indigo-400" /> 圖片文字 (Image Text)
                                    </p>
                                    <div className="h-10 overflow-y-auto scrollbar-hide pr-1 interaction-box">
                                        <p className="text-sm font-semibold text-gray-200 leading-tight">{displayImageText}</p>
                                    </div>
                                </div>
                                <div className="bg-[#0B0F19]/80 p-4 rounded-xl border border-gray-800/50 transition-colors hover:border-indigo-500/30">
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                        <Music className="w-3 h-3 text-emerald-400" /> 旁白 (Video Prompt)
                                    </p>
                                    <div className="h-10 overflow-y-auto scrollbar-hide pr-1 interaction-box">
                                        <p className="text-sm font-semibold text-gray-200 leading-tight">{displayVideoPrompt}</p>
                                    </div>
                                </div>
                                <div className="bg-[#0B0F19]/80 p-4 rounded-xl border border-gray-800/50 transition-colors hover:border-indigo-500/30">
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                        <Lightbulb className="w-3 h-3 text-amber-400" /> 策略解析 (Strategy)
                                    </p>
                                    <div className="h-10 overflow-y-auto scrollbar-hide pr-1 interaction-box">
                                        <p className="text-sm font-semibold text-gray-200 leading-tight">{displayStrategy}</p>
                                    </div>
                                </div>
                            </div>

                            {/* 右欄：視覺證據、聽覺氛圍 */}
                            <div className="space-y-4">
                                <div className="bg-[#0B0F19]/80 p-4 rounded-xl border border-gray-800/50 transition-colors hover:border-indigo-500/30 relative overflow-hidden">
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                        <Eye className="w-3 h-3 text-indigo-400" /> 視覺證據 (Visual Evidence)
                                    </p>
                                    <div className="h-10 overflow-y-auto scrollbar-hide pr-1 interaction-box">
                                        <p className="text-sm font-semibold text-gray-200 leading-tight">{displayVisual}</p>
                                    </div>
                                </div>
                                <div className="bg-[#0B0F19]/80 p-4 rounded-xl border border-gray-800/50 transition-colors hover:border-indigo-500/30">
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                        <Music className="w-3 h-3 text-indigo-400" /> 聽覺氛圍 (Auditory Vibe)
                                    </p>
                                    <div className="h-10 overflow-y-auto scrollbar-hide hover:scrollbar-default pr-1 interaction-box">
                                        <p className="text-sm font-semibold text-gray-200 leading-tight">{displayAuditory}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* AI 改善總結與核心診斷 (D component) */}
                {/* AI 全域綜合健檢 (D component) */}
                <div className="flex flex-col gap-4">
                    <div className="w-full">
                        {/* Gemini 一鍵分析按鈕 */}
                        <div className="flex flex-col gap-1 mt-4">
                            <button
                                onClick={handleGeminiAnalysis}
                                disabled={isAnalyzing}
                                className={`w-full py-3 ${isAnalyzing ? 'bg-indigo-800 cursor-wait' : 'bg-indigo-600/80 hover:bg-indigo-500'} text-white rounded-xl text-[13px] font-bold tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-indigo-500/25 border border-indigo-400/50 group/btn`}
                            >
                                {isAnalyzing ? (
                                    <><span className="animate-spin text-lg leading-none">⚙️</span> 系統分析中...</>
                                ) : (
                                    <><span className="group-hover/btn:animate-bounce text-lg leading-none">✨</span> 呼叫 Gemini 進行全片綜合健檢與 Prompt 優化</>
                                )}
                            </button>
                            {lastAnalyzedAt && !isAnalyzing && !geminiResponse && (
                                <p className="text-[10px] text-gray-500 text-center uppercase tracking-widest mt-1">
                                    🕒 上次綜合健檢：<span className="text-indigo-400">{lastAnalyzedAt}</span> (點擊按鈕載入或重複健檢)
                                </p>
                            )}
                        </div>

                        {/* API Key Modal */}
                        {showApiKeyPrompt && (
                            <div className="mt-4 bg-black/60 border border-gray-700 p-4 rounded-xl backdrop-blur-sm animate-in fade-in zoom-in duration-200">
                                <p className="text-sm font-bold text-gray-200 mb-2">🔑 請輸入您的 Gemini API Key</p>
                                <p className="text-[10px] text-gray-400 mb-3">您的 Key 將安全地儲存在本地瀏覽器中，不會上傳至任何伺服器。</p>
                                <input 
                                    type="password" 
                                    value={apiKeyInput}
                                    onChange={(e) => setApiKeyInput(e.target.value)}
                                    placeholder="AIzaSy..."
                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white mb-3 focus:outline-none focus:border-indigo-500"
                                />
                                <div className="flex gap-2 justify-end">
                                    <button onClick={() => setShowApiKeyPrompt(false)} className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-white transition-colors">取消</button>
                                    <button onClick={saveApiKeyAndRun} className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors">儲存並開始分析</button>
                                </div>
                            </div>
                        )}

                        {/* Gemini 報告渲染區塊 */}
                        {geminiResponse && (
                            <div className="mt-4 w-full bg-gradient-to-br from-[#111827] to-[#0d1424] border border-indigo-500/30 rounded-xl shadow-2xl animate-in slide-in-from-top-2 duration-300">
                                <div 
                                    className="bg-indigo-900/30 px-4 py-3 border-b border-indigo-500/20 flex justify-between items-center relative overflow-hidden cursor-pointer hover:bg-indigo-900/40 transition-colors rounded-t-xl"
                                    onClick={() => setIsReportExpanded(!isReportExpanded)}
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 opacity-50"></div>
                                    <div className="flex flex-col relative z-10 w-full">
                                        <div className="flex items-center justify-between w-full">
                                            <div className="flex items-center gap-2">
                                                <span className="text-lg leading-none">✨</span>
                                                <span className="text-sm font-bold text-indigo-300 tracking-widest uppercase">全片策略總評與行動建議</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); localStorage.removeItem('GEMINI_API_KEY'); setGeminiResponse(null); alert('API Key 已從本地清除！'); }}
                                                    className="text-[10px] text-gray-400 hover:text-rose-400 transition-colors z-10 px-2 py-1 rounded bg-black/20"
                                                    title="清除本地儲存的 API Key"
                                                >
                                                    清除金鑰
                                                </button>
                                                <button className="text-indigo-400 hover:text-indigo-300 transition-colors">
                                                    {isReportExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                                </button>
                                            </div>
                                        </div>
                                        {lastAnalyzedAt && (
                                            <span className="text-[10px] text-gray-400 mt-1 ml-7">🕒 診斷時間：{lastAnalyzedAt}</span>
                                        )}
                                    </div>
                                </div>
                                
                                {isReportExpanded && (
                                    <div className="p-4 md:p-5 text-[13px] md:text-sm text-gray-200 leading-relaxed font-medium overflow-y-auto max-h-[500px] scrollbar-hide text-left rounded-b-xl border-t border-indigo-500/10">
                                        {geminiResponse.split('\n').map((line, i) => {
                                        if (line.startsWith('## ')) return <h3 key={i} className="text-lg font-bold text-white mt-5 mb-2">{line.replace('## ', '')}</h3>;
                                        if (line.startsWith('### ')) return <h4 key={i} className="text-md font-bold text-indigo-200 mt-4 mb-1">{line.replace('### ', '')}</h4>;
                                        if (line.startsWith('* **') || line.startsWith('- **')) return <ul key={i} className="list-disc ml-5 my-1"><li className="text-gray-100">{line.replace(/^[\*\-] \*\*/, '').replace(/\*\*:/, ':')}</li></ul>;
                                        if (line.startsWith('* ') || line.startsWith('- ')) return <ul key={i} className="list-disc ml-5 my-1"><li className="text-gray-300">{line.replace(/^[\*\-] /, '')}</li></ul>;
                                        if (line.trim() === '') return <div key={i} className="h-2" />;
                                        
                                        // Handle basic bold text
                                        const parts = line.split(/(\*\*.*?\*\*)/g);
                                        return (
                                            <p key={i} className="mb-2 last:mb-0">
                                                {parts.map((part, j) => 
                                                    part.startsWith('**') && part.endsWith('**') 
                                                        ? <strong key={j} className="text-indigo-200">{part.slice(2, -2)}</strong>
                                                        : part
                                                )}
                                            </p>
                                        );
                                    })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* 常規 AI 優化建議 */}
                    {targetEvent && (
                        <div className="bg-gradient-to-br from-indigo-900/40 to-purple-900/20 border border-indigo-500/20 p-6 rounded-2xl relative overflow-hidden group shadow-lg">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl mix-blend-screen transition-transform group-hover:scale-150"></div>
                            <h5 className="font-bold text-indigo-300 text-[13px] uppercase tracking-widest mb-3 flex items-center gap-2 relative z-10">
                                <Lightbulb className="w-4 h-4 text-amber-400" /> AI 獲客與留存總結 (Insights)
                            </h5>
                            <p className="text-sm text-indigo-100/90 leading-relaxed relative z-10 font-medium">
                                {targetEvent.slideInsights.aiSummary}
                            </p>
                        </div>
                    )}
                </div>

            </div>
            {/* --- 全螢幕影片分析戰情室 (Studio Mode Overlay) --- */}
            {isStudioMode && (
                <div className="fixed inset-0 z-[100] bg-[#030712]/95 backdrop-blur-2xl flex flex-col animate-in fade-in zoom-in duration-300 overflow-hidden">
                    {/* 戰情室標頭 */}
                    <div className="flex justify-between items-center p-6 border-b border-white/5 bg-gray-950/50">
                        <div className="flex items-center gap-4">
                            <div className="bg-indigo-500/20 p-3 rounded-2xl">
                                <Activity className="w-6 h-6 text-indigo-400" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-white tracking-tighter flex items-center gap-2 uppercase italic">
                                    Video Analysis Studio
                                    <span className="text-indigo-500">.</span>
                                </h2>
                                <p className="text-xs text-gray-400 font-bold uppercase tracking-[0.2em] opacity-80">{video.title}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-6">
                            {/* 快速 KPI 狀態 */}
                            <div className="hidden md:flex bg-white/5 px-6 py-2.5 rounded-2xl border border-white/5 items-center gap-10">
                                <div className="flex flex-col items-center">
                                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest"><BarChart2 className="w-3 h-3 inline mr-1" /> Retention</span>
                                    <span className="text-lg font-black text-white italic">{video.depthMetrics?.averageRetention ?? 0}%</span>
                                </div>
                                <div className="flex flex-col items-center border-l border-white/5 pl-10">
                                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest"><Timer className="w-3 h-3 inline mr-1" /> Avg. Time</span>
                                    <span className="text-lg font-black text-white font-mono">{video.depthMetrics?.averageWatchTime ?? '0:00'}</span>
                                </div>
                            </div>

                            <button
                                onClick={() => setIsStudioMode(false)}
                                className="p-3 bg-white/5 hover:bg-rose-500/20 text-gray-400 hover:text-rose-400 rounded-2xl transition-all border border-white/5 hover:border-rose-500/30"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
                        {/* 1. 全螢幕延展圖表區 */}
                        <div className="bg-[#0B0F19] p-8 rounded-[2.5rem] border border-white/5 shadow-2xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -mr-32 -mt-32"></div>

                            <div className="flex justify-between items-center mb-8 relative z-10">
                                <h4 className="text-xl font-bold text-white flex items-center gap-3">
                                    <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
                                    互動式觀眾留存曲線 (延展視圖)
                                </h4>
                                <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-widest bg-white/5 px-4 py-2 rounded-full border border-white/5">
                                    <Focus className="w-4 h-4 text-indigo-400" />
                                    Analysis Pin: <span className="text-indigo-400 ml-1">{displayTime}</span>
                                </div>
                            </div>

                            <div className="h-[450px] w-full cursor-crosshair">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart
                                        data={video.retentionData}
                                        margin={{ top: 20, right: 30, left: 10, bottom: 0 }}
                                        onClick={(state: any) => {
                                            if (state?.activePayload?.[0]?.payload?.time !== undefined) {
                                                setPinnedSecond(state.activePayload[0].payload.time);
                                            }
                                        }}
                                    >
                                        <defs>
                                            <linearGradient id="gradStudio" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#6366F1" stopOpacity={0.4} />
                                                <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1E293B" opacity={0.5} />
                                        <XAxis
                                            dataKey="time"
                                            type="number"
                                            domain={[0, video.maxDuration]}
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fontSize: 12, fill: '#64748B', fontWeight: 'bold' }}
                                            tickCount={15}
                                            tickFormatter={(v) => `0${Math.floor(v / 60)}:${String(Math.floor(v % 60)).padStart(2, '0')}`}
                                        />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B', fontWeight: 'bold' }} domain={[0, 100]} />
                                        <RechartsTooltip
                                            cursor={{ stroke: '#6366F1', strokeWidth: 2, strokeDasharray: '5 5' }}
                                            content={({ active, payload }) => {
                                                if (active && payload && payload.length) {
                                                    const d = payload[0].payload;
                                                    return (
                                                        <div className="bg-[#0F172A]/90 p-5 rounded-2xl border border-indigo-500/30 shadow-2xl backdrop-blur-xl">
                                                            <p className="text-gray-400 text-sm font-black font-mono mb-2 text-center tracking-widest">{d.formattedTime}</p>
                                                            <p className="text-white text-4xl font-black text-center italic tracking-tighter">{Number(payload[0].value).toFixed(1)}%</p>
                                                            <div className="mt-2 text-[10px] text-indigo-400/70 font-bold text-center uppercase tracking-widest">Interactive Tracking Mode</div>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                        />

                                        {s90 > 0 && <ReferenceLine x={s90} stroke="#818CF8" strokeDasharray="4 4" label={<MetricLabel value="🛡️ 90% HOOK" fill="#818CF8" dy={-30} />} />}
                                        {s70 > 0 && <ReferenceLine x={s70} stroke="#F59E0B" strokeDasharray="4 4" label={<MetricLabel value="🔥 70% CORE" fill="#FBBF24" dy={-10} />} />}

                                        {coreStart > 0 && coreEnd > coreStart && (
                                            <ReferenceArea x1={coreStart} x2={coreEnd} fill="#F43F5E" fillOpacity={0.15} label={{ value: `🔴 CORE LOSS: -${video.depthMetrics?.coreDropSeverity}%`, position: 'insideBottomLeft', fill: '#F43F5E', fontSize: 11, fontWeight: 'black', dy: -10 }} />
                                        )}
                                        {cwStart > 0 && cwEnd > cwStart && (
                                            <ReferenceArea x1={cwStart} x2={cwEnd} fill="#6366F1" fillOpacity={0.15} label={{ value: `🔵 REWATCH DECLINE: -${video.depthMetrics?.rewatchDropSeverity}%`, position: 'insideBottomLeft', fill: '#818CF8', fontSize: 11, fontWeight: 'black', dy: 10 }} />
                                        )}

                                        <ReferenceLine x={pinnedSecond} stroke="#F43F5E" strokeDasharray="3 3" strokeWidth={3} label={<PinLabel />} />

                                        <Area
                                            type="monotone"
                                            dataKey="retention"
                                            stroke="#818CF8"
                                            strokeWidth={5}
                                            fill="url(#gradStudio)"
                                            activeDot={{ r: 8, fill: '#0F172A', stroke: '#818CF8', strokeWidth: 4 }}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* 2. 三欄式深度解析區 */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* 左欄：核心屬性 */}
                            <div className="space-y-6">
                                <div className="bg-[#0B0F19] p-6 rounded-[2rem] border border-white/5 shadow-xl">
                                    <h5 className="text-gray-400 text-xs font-black uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
                                        <Layers className="w-4 h-4 text-indigo-400" /> Core Attributes
                                    </h5>
                                    <div className="space-y-4">
                                        <div className="bg-white/5 p-5 rounded-2xl border border-white/5">
                                            <p className="text-[10px] text-gray-500 font-bold uppercase mb-2">Content Role</p>
                                            <p className="text-lg font-bold text-white">{displayRole}</p>
                                        </div>
                                        <div className="bg-white/5 p-5 rounded-2xl border border-white/5">
                                            <p className="text-[10px] text-gray-500 font-bold uppercase mb-2">Psychological Trigger</p>
                                            <p className="text-lg font-bold text-indigo-400 uppercase italic tracking-tighter">{displayTrigger}</p>
                                        </div>
                                        <div className="bg-white/5 p-5 rounded-2xl border border-white/5">
                                            <p className="text-[10px] text-gray-500 font-bold uppercase mb-2">Speech Pacing</p>
                                            <p className="text-lg font-bold text-amber-400 font-mono">{displayPacing ?? '—'}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 中欄：內容特徵 */}
                            <div className="space-y-6">
                                <div className="bg-[#0B0F19] p-6 rounded-[2rem] border border-white/5 shadow-xl h-full">
                                    <h5 className="text-gray-400 text-xs font-black uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
                                        <Focus className="w-4 h-4 text-indigo-400" /> Screen Details
                                    </h5>
                                    <div className="space-y-6">
                                        <div>
                                            <p className="text-[10px] text-gray-500 font-bold uppercase mb-3 flex items-center gap-2">
                                                <BarChart2 className="w-3 h-3" /> Image Text (CH)
                                            </p>
                                            <div className="bg-white/5 p-5 rounded-2xl border border-white/5 min-h-[80px]">
                                                <p className="text-gray-200 leading-relaxed font-medium">{displayImageText}</p>
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-gray-500 font-bold uppercase mb-3 flex items-center gap-2">
                                                <Music className="w-3 h-3" /> Audio Prompt
                                            </p>
                                            <div className="bg-white/5 p-5 rounded-2xl border border-white/5 min-h-[80px]">
                                                <p className="text-gray-200 leading-relaxed font-medium">{displayVideoPrompt}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 右欄：證據與策略 */}
                            <div className="space-y-6">
                                <div className="bg-[#0B0F19] p-6 rounded-[2rem] border border-white/5 shadow-xl h-full">
                                    <h5 className="text-gray-400 text-xs font-black uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
                                        <Eye className="w-4 h-4 text-indigo-400" /> Strategy Evidence
                                    </h5>
                                    <div className="space-y-6">
                                        <div className="group">
                                            <p className="text-[10px] text-gray-500 font-bold uppercase mb-3 flex items-center gap-2">
                                                <Zap className="w-3 h-3" /> Visual Evidence
                                            </p>
                                            <div className="bg-white/5 p-5 rounded-2xl border border-white/5 border-l-4 border-l-indigo-500 transition-all group-hover:bg-indigo-500/5">
                                                <p className="text-gray-100 font-semibold">{displayVisual}</p>
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-gray-500 font-bold uppercase mb-3">Strategy Alignment</p>
                                            <div className="bg-indigo-500/10 p-5 rounded-2xl border border-indigo-500/20">
                                                <p className="text-indigo-200 leading-relaxed font-medium">{displayStrategy}</p>
                                            </div>
                                        </div>
                                        {targetEvent && (
                                            <div className="bg-gradient-to-r from-amber-500/20 to-transparent p-5 rounded-2xl border border-amber-500/20 mt-4">
                                                <p className="text-[10px] text-amber-500 font-black uppercase tracking-widest mb-2 flex items-center gap-2">
                                                    <Lightbulb className="w-3 h-3" /> AI Optimization Recommendation
                                                </p>
                                                <p className="text-xs text-amber-100/80 leading-relaxed italic">{targetEvent.slideInsights.aiSummary}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
