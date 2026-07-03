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
    const body = await req.json().catch(() => ({}));
    let repos: string[] = [];
    
    if (body.repoFullName) {
      repos = [body.repoFullName];
    } else {
      // データベースから取得
      const { data: dbRepos } = await supabaseAdmin.from('repositories').select('repo_name');
      if (dbRepos && dbRepos.length > 0) {
        repos = dbRepos.map(r => r.repo_name);
      } else {
        // フォールバック: 環境変数
        const reposStr = process.env.GITHUB_SYNC_REPOS || process.env.GITHUB_SYNC_REPO || '';
        repos = reposStr.split(',').map(r => r.trim()).filter(Boolean);
      }
    }
    
    if (repos.length === 0) {
      return NextResponse.json({ error: 'No repositories configured for sync' }, { status: 400 });
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

    for (const repoFullName of repos) {
      const mdFiles = await fetchGitHubTree(repoFullName, githubToken);
      if (!mdFiles) {
        console.error(`Failed to fetch tree for ${repoFullName}`);
        continue;
      }

      for (const fileItem of mdFiles) {
        const filePath = fileItem.path;
        if (filePath.includes('.cursorrules')) continue;

        const fileName = filePath.split('/').pop() || '';
        const repoName = repoFullName.split('/')[1] || repoFullName;
        const projectName = repoName; // プロジェクト名をリポジトリ名に
        const uniqueFilePath = `${repoFullName}/${filePath}`; // 一意のファイルパス

        const fileUrl = `https://api.github.com/repos/${repoFullName}/contents/${filePath}`;
        const res = await fetch(fileUrl, { headers });
        
        if (!res.ok) continue;

        const rawContent = await res.text();
        const parsed = matter(rawContent);
        
        let defaultTitle = fileName.replace('.md', '');
        if (defaultTitle.toUpperCase() === 'README') {
          defaultTitle = repoName;
        }
        
        const status = parsed.data?.status || 'todo';
        const priority = parsed.data?.priority || 'medium';
        const title = parsed.data?.title || defaultTitle;
        const content = parsed.content || '';

        const { error } = await supabaseAdmin
          .from('tasks')
          .upsert({
            project_name: projectName,
            file_path: uniqueFilePath,
            title,
            status,
            priority,
            content,
            updated_at: new Date().toISOString()
          }, { onConflict: 'file_path' });

        if (!error) processed.push(uniqueFilePath);
      }
    }

    return NextResponse.json({ message: 'Sync completed', processedCount: processed.length, processed }, { status: 200 });
  } catch (error: any) {
    console.error('Sync error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
