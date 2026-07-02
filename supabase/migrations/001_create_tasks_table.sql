-- tasks テーブルの作成
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_name TEXT NOT NULL,
    file_path TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'todo',
    priority TEXT NOT NULL DEFAULT 'medium',
    content TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS (Row Level Security) の設定
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- 全ての操作を許可するポリシー（開発用・Webhook用）
CREATE POLICY "Allow all actions for authenticated and anon"
ON public.tasks
FOR ALL
USING (true)
WITH CHECK (true);
