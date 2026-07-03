-- リポジトリ一覧を管理するテーブル
CREATE TABLE IF NOT EXISTS public.repositories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repo_name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS（Row Level Security）を無効化するか、適切なポリシーを設定（今回はシンプルにすべて許可）
ALTER TABLE public.repositories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous read access on repositories"
    ON public.repositories FOR SELECT
    USING (true);

CREATE POLICY "Allow service role insert on repositories"
    ON public.repositories FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Allow service role delete on repositories"
    ON public.repositories FOR DELETE
    USING (true);
