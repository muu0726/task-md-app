import { NextResponse } from 'next/server';
import matter from 'gray-matter';
import { supabaseAdmin } from '@/lib/supabase';

// 手動でリポジトリの全マークダウンファイルを一括同期するAPI
// リポジトリオーナー名とリポジトリ名をクエリパラメータまたは環境変数から取得

async function fetchGitHubTree(repoFullName: string, token?: string) {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Aitask-md-App',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  // デフォルトブランチを取得するためにまずリポジトリ情報を取得
  const repoRes = await fetch(`https://api.github.com/repos/${repoFullName}`, { headers });
  if (!repoRes.ok) return null;
  const repoData = await repoRes.json();
  const defaultBranch = repoData.default_branch;

  // 再帰的にツリーを取得
  const treeUrl = `https://api.github.com/repos/${repoFullName}/git/trees/${defaultBranch}?recursive=1`;
  const treeRes = await fetch(treeUrl, { headers });
  if (!treeRes.ok) return null;
  const treeData = await treeRes.json();
  
  return treeData.tree.filter((item: any) => item.type === 'blob' && item.path.endsWith('.md'));
}

export async function POST(req: Request) {
  try {
    const { repoFullName } = await req.json().catch(() => ({ repoFullName: process.env.GITHUB_SYNC_REPO }));
    
    if (!repoFullName) {
      return NextResponse.json({ error: 'repoFullName is required' }, { status: 400 });
    }

    const githubToken = process.env.GITHUB_PAT;
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3.raw',
      'User-Agent': 'Aitask-md-App',
    };
    if (githubToken) {
      headers['Authorization'] = `Bearer ${githubToken}`;
    }

    const mdFiles = await fetchGitHubTree(repoFullName, githubToken);
    if (!mdFiles) {
      return NextResponse.json({ error: 'Failed to fetch repository tree' }, { status: 500 });
    }

    const processed = [];

    for (const fileItem of mdFiles) {
      const filePath = fileItem.path;
      // .cursorrules 等を除外（一応拡張子で絞ってはいるが）
      if (filePath.includes('.cursorrules')) continue;

      const parts = filePath.split('/');
      const projectName = parts.length > 1 ? parts[0] : 'root';
      const fileName = parts[parts.length - 1];

      const fileUrl = `https://api.github.com/repos/${repoFullName}/contents/${filePath}`;
      const res = await fetch(fileUrl, { headers });
      
      if (!res.ok) continue;

      const rawContent = await res.text();
      const parsed = matter(rawContent);
      
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

      if (!error) processed.push(filePath);
    }

    return NextResponse.json({ message: 'Sync completed', processedCount: processed.length, processed }, { status: 200 });
  } catch (error: any) {
    console.error('Sync error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
