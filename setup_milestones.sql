-- 實行這個腳本來建立策略管理 (Milestones) 資料表
CREATE TABLE milestones (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    channel_name TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('ALL', 'YOUTUBE', 'INSTAGRAM', 'TIKTOK')),
    date DATE NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    before_start DATE NOT NULL,
    after_end DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 若您想啟用開放讀取，請執行 RLS (Row Level Security)
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "允許公開讀取 milestones" ON milestones FOR SELECT USING (true);
CREATE POLICY "允許匿名寫入/修改 milestones" ON milestones FOR ALL USING (true); -- 生產環境建議加入 Auth 判定
