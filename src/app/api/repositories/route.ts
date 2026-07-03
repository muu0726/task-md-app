import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// 登録されているリポジトリ一覧を取得
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('repositories')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json(data, { status: 200 });
  } catch (error: any) {
    console.error('Fetch repositories error:', error);
    return NextResponse.json({ error: 'Failed to fetch repositories' }, { status: 500 });
  }
}

// 新しいリポジトリを登録
export async function POST(req: Request) {
  try {
    const { repoName } = await req.json();
    if (!repoName) {
      return NextResponse.json({ error: 'repoName is required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('repositories')
      .insert([{ repo_name: repoName }])
      .select();

    if (error) {
      if (error.code === '23505') { // unique violation
        return NextResponse.json({ error: 'Repository already exists' }, { status: 409 });
      }
      throw error;
    }

    // 登録直後に同期をトリガーする（非同期で実行）
    fetch(`${req.headers.get('origin') || 'http://localhost:3000'}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoFullName: repoName })
    }).catch(e => console.error('Auto-sync failed:', e));

    return NextResponse.json({ message: 'Repository added', repository: data[0] }, { status: 201 });
  } catch (error: any) {
    console.error('Add repository error:', error);
    return NextResponse.json({ error: 'Failed to add repository' }, { status: 500 });
  }
}

// リポジトリを削除
export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const repoName = url.searchParams.get('repoName');
    if (!repoName) {
      return NextResponse.json({ error: 'repoName is required' }, { status: 400 });
    }

    // リポジトリの削除
    const { error: deleteRepoError } = await supabaseAdmin
      .from('repositories')
      .delete()
      .eq('repo_name', repoName);

    if (deleteRepoError) throw deleteRepoError;

    // 紐づくタスクも削除する（任意ですが、削除した方が綺麗）
    await supabaseAdmin
      .from('tasks')
      .delete()
      .eq('project_name', repoName.split('/')[1] || repoName);

    return NextResponse.json({ message: 'Repository deleted' }, { status: 200 });
  } catch (error: any) {
    console.error('Delete repository error:', error);
    return NextResponse.json({ error: 'Failed to delete repository' }, { status: 500 });
  }
}
