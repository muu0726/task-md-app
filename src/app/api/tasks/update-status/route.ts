import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import matter from 'gray-matter';

export async function POST(req: Request) {
  try {
    const { taskId, newStatus } = await req.json();

    if (!taskId || !newStatus) {
      return NextResponse.json({ error: 'taskId and newStatus are required' }, { status: 400 });
    }

    // 1. Supabaseからタスク情報を取得
    const { data: task, error: fetchError } = await supabaseAdmin
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (fetchError || !task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // 2. Supabase上のステータスを更新
    const { error: updateError } = await supabaseAdmin
      .from('tasks')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', taskId);

    if (updateError) {
      throw updateError;
    }

    // 3. GitHub側のマークダウンを更新する準備
    const fullFilePath = task.file_path; // format: owner/repo/path/to/file.md
    const parts = fullFilePath.split('/');
    if (parts.length < 3) {
      return NextResponse.json({ error: 'Invalid file_path format' }, { status: 400 });
    }
    
    const repoFullName = `${parts[0]}/${parts[1]}`;
    const filePathInRepo = parts.slice(2).join('/');
    
    const githubToken = process.env.GITHUB_PAT;
    if (!githubToken) {
      console.warn('GITHUB_PAT is not set. Skipping GitHub commit.');
      return NextResponse.json({ message: 'Database updated, but GitHub commit skipped due to missing token.' }, { status: 200 });
    }

    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `Bearer ${githubToken}`,
      'User-Agent': 'Aitask-md-App',
    };

    // GitHub APIで現在のファイルとSHAを取得
    const fileUrl = `https://api.github.com/repos/${repoFullName}/contents/${filePathInRepo}`;
    const res = await fetch(fileUrl, { headers });
    
    if (!res.ok) {
      console.error(`Failed to fetch file from GitHub: ${res.statusText}`);
      return NextResponse.json({ error: 'Failed to fetch from GitHub' }, { status: 500 });
    }

    const fileData = await res.json();
    const sha = fileData.sha;
    
    // contentはbase64エンコードされているのでデコードする
    // BufferはNode.js環境で有効
    const rawContent = Buffer.from(fileData.content, 'base64').toString('utf-8');

    // gray-matterでパースして書き換え
    const parsed = matter(rawContent);
    parsed.data.status = newStatus;
    
    // Frontmatterが元々ないファイルの場合は、title等を補完しておく
    if (!parsed.data.title) {
      const fileName = filePathInRepo.split('/').pop() || '';
      let defaultTitle = fileName.replace('.md', '');
      if (defaultTitle.toUpperCase() === 'README') defaultTitle = parts[1];
      parsed.data.title = defaultTitle;
    }
    if (!parsed.data.priority) {
      parsed.data.priority = 'medium';
    }

    const newRawContent = matter.stringify(parsed.content, parsed.data);
    const newBase64Content = Buffer.from(newRawContent, 'utf-8').toString('base64');

    // GitHub APIで更新をコミット
    const commitBody = {
      message: `Update task status to ${newStatus} via Aitask.md`,
      content: newBase64Content,
      sha: sha
    };

    const commitRes = await fetch(fileUrl, {
      method: 'PUT',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(commitBody)
    });

    if (!commitRes.ok) {
      const errText = await commitRes.text();
      console.error(`Failed to commit to GitHub: ${errText}`);
      // Supabaseは更新済みなのにGitHub側が失敗した場合は、エラーを返して呼び出し元に伝える（必要に応じてロールバック等）
      return NextResponse.json({ error: 'Failed to commit to GitHub' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Task status updated and committed to GitHub successfully' }, { status: 200 });
  } catch (error: any) {
    console.error('Update status error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
