import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const githubToken = process.env.GITHUB_PAT;
    if (!githubToken) {
      return NextResponse.json({ error: 'GITHUB_PAT is not set' }, { status: 400 });
    }

    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `Bearer ${githubToken}`,
      'User-Agent': 'Aitask-md-App',
    };

    // GitHub APIでユーザーがアクセスできるリポジトリ一覧を取得
    // visibility=all, sort=updated で直近更新されたものを取得
    const res = await fetch('https://api.github.com/user/repos?visibility=all&sort=updated&per_page=100', {
      headers
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`Failed to fetch github repos: ${errText}`);
      return NextResponse.json({ error: 'Failed to fetch github repos' }, { status: 500 });
    }

    const data = await res.json();
    
    // full_name (e.g., owner/repo) の配列を抽出
    const repos = data.map((repo: any) => repo.full_name);

    return NextResponse.json({ repos }, { status: 200 });
  } catch (error: any) {
    console.error('Fetch github repos error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
