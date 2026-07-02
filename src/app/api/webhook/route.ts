import { NextResponse } from 'next/server';
import matter from 'gray-matter';
import { supabaseAdmin } from '@/lib/supabase';

// Webhookのシークレット検証は今回は省略し、ペイロードベースで処理します
// 実際の運用では headers().get('x-hub-signature-256') などを検証してください

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const repoFullName = payload.repository?.full_name;
    const commits = payload.commits || [];

    if (!repoFullName || commits.length === 0) {
      return NextResponse.json({ message: 'No relevant data' }, { status: 200 });
    }

    // 処理対象のマークダウンファイルを収集
    const targetFiles = new Set<string>();
    
    commits.forEach((commit: any) => {
      [...(commit.added || []), ...(commit.modified || [])].forEach((file: string) => {
        if (file.endsWith('.md')) {
          targetFiles.add(file);
        }
      });
      // 削除されたファイルの処理 (今回はUpsertのみの実装のためスキップしますが、必要に応じて削除処理も追加可能)
    });

    if (targetFiles.size === 0) {
      return NextResponse.json({ message: 'No markdown files changed' }, { status: 200 });
    }

    const githubToken = process.env.GITHUB_PAT;
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3.raw',
      'User-Agent': 'Aitask-md-App',
    };
    if (githubToken) {
      headers['Authorization'] = `Bearer ${githubToken}`;
    }

    const processed = [];

    // 各ファイルをパースしてSupabaseへUpsert
    for (const filePath of Array.from(targetFiles)) {
      const parts = filePath.split('/');
      // project_name は最初のディレクトリ名（存在しない場合は 'root'）
      const projectName = parts.length > 1 ? parts[0] : 'root';
      const fileName = parts[parts.length - 1];

      // GitHub API から raw content を取得
      const fileUrl = `https://api.github.com/repos/${repoFullName}/contents/${filePath}`;
      const res = await fetch(fileUrl, { headers });
      
      if (!res.ok) {
        console.error(`Failed to fetch ${filePath}: ${res.statusText}`);
        continue;
      }

      const rawContent = await res.text();
      const parsed = matter(rawContent);
      
      // Frontmatterのフォールバック処理
      const status = parsed.data?.status || 'todo';
      const priority = parsed.data?.priority || 'medium';
      const title = parsed.data?.title || fileName.replace('.md', '');
      const content = parsed.content || '';

      const { error } = await supabaseAdmin
        .from('tasks')
        .upsert({
          project_name: projectName,
          file_path: filePath,
          title,
          status,
          priority,
          content,
          updated_at: new Date().toISOString()
        }, { onConflict: 'file_path' });

      if (error) {
        console.error(`Supabase upsert error for ${filePath}:`, error);
      } else {
        processed.push(filePath);
      }
    }

    return NextResponse.json({ message: 'Webhook processed successfully', processed }, { status: 200 });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
