"use client";

import { useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabase";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RefreshCw, FileText, Settings, Plus, Trash2, GripVertical } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";

type Task = {
  id: string;
  project_name: string;
  file_path: string;
  title: string;
  status: string;
  priority: string;
  content: string;
  updated_at: string;
};

type Repository = {
  id: string;
  repo_name: string;
};

const STATUSES = [
  { id: "todo", label: "未着手", color: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  { id: "in_progress", label: "進行中", color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  { id: "done", label: "完了", color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" }
];

export function KanbanBoard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<string[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  // リポジトリ管理用
  const [repos, setRepos] = useState<Repository[]>([]);
  const [newRepoName, setNewRepoName] = useState("");
  const [repoLoading, setRepoLoading] = useState(false);
  const [githubRepos, setGithubRepos] = useState<string[]>([]);

  // タスク詳細用
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const fetchTasks = async () => {
    setLoading(true);
    const { data, error } = await supabaseClient
      .from("tasks")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Error fetching tasks:", error);
    } else if (data) {
      setTasks(data);
      const uniqueProjects = Array.from(new Set(data.map((t) => t.project_name)));
      setProjects(uniqueProjects);
      if (uniqueProjects.length > 0 && selectedProject === "all") {
        setSelectedProject(uniqueProjects[0]);
      }
    }
    setLoading(false);
  };

  const fetchRepos = async () => {
    const res = await fetch('/api/repositories');
    if (res.ok) {
      const data = await res.json();
      setRepos(data);
    }
  };

  const fetchGithubRepos = async () => {
    const res = await fetch('/api/github/repos');
    if (res.ok) {
      const data = await res.json();
      setGithubRepos(data.repos || []);
    }
  };

  useEffect(() => {
    setIsMounted(true);
    fetchTasks();
    fetchRepos();
    fetchGithubRepos();
  }, []);

  const handleAddRepo = async () => {
    if (!newRepoName) return;
    setRepoLoading(true);
    const res = await fetch('/api/repositories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoName: newRepoName })
    });
    if (res.ok) {
      setNewRepoName("");
      await fetchRepos();
      setTimeout(fetchTasks, 3000); 
    } else {
      alert("リポジトリの追加に失敗しました。既に登録されている可能性があります。");
    }
    setRepoLoading(false);
  };

  const handleDeleteRepo = async (repoName: string) => {
    if (!confirm(`本当に ${repoName} を削除しますか？`)) return;
    const res = await fetch(`/api/repositories?repoName=${encodeURIComponent(repoName)}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      await fetchRepos();
      await fetchTasks();
    }
  };

  const manualSync = async () => {
    setLoading(true);
    await fetch('/api/sync', { method: 'POST' });
    await fetchTasks();
  };

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const newStatus = destination.droppableId;
    const oldStatus = source.droppableId;
    
    // Optimistic UI Update
    setTasks(prev => prev.map(t => t.id === draggableId ? { ...t, status: newStatus } : t));

    try {
      const res = await fetch('/api/tasks/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: draggableId, newStatus })
      });
      
      if (!res.ok) {
        throw new Error('Failed to update task');
      }
    } catch (error) {
      console.error(error);
      alert('タスクの更新・コミットに失敗しました。');
      // エラー時は元のステータスに戻す
      setTasks(prev => prev.map(t => t.id === draggableId ? { ...t, status: oldStatus } : t));
    }
  };

  const filteredTasks = selectedProject === "all" 
    ? tasks 
    : tasks.filter(t => t.project_name === selectedProject);

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case "high": return "bg-red-500 hover:bg-red-600";
      case "medium": return "bg-amber-500 hover:bg-amber-600";
      case "low": return "bg-green-500 hover:bg-green-600";
      default: return "bg-slate-500 hover:bg-slate-600";
    }
  };

  if (!isMounted) {
    return <div className="p-8 text-center text-slate-500 flex items-center justify-center"><RefreshCw className="w-6 h-6 animate-spin mr-2" /> 読み込み中...</div>;
  }

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h2 className="text-2xl font-bold tracking-tight">プロジェクトボード</h2>
          <Select value={selectedProject} onValueChange={(val) => setSelectedProject(val || "all")}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="プロジェクトを選択" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべてのプロジェクト</SelectItem>
              {projects.map(p => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center space-x-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                <Settings className="w-4 h-4 mr-2" />
                リポジトリ管理
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>リポジトリ管理</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-500">既存リポジトリから選択</label>
                  <Select 
                    value={newRepoName} 
                    onValueChange={setNewRepoName}
                    disabled={githubRepos.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={githubRepos.length === 0 ? "取得中..." : "リポジトリを選択してください"} />
                    </SelectTrigger>
                    <SelectContent>
                      <ScrollArea className="h-[200px]">
                        {githubRepos.map(repo => (
                          <SelectItem key={repo} value={repo}>{repo}</SelectItem>
                        ))}
                      </ScrollArea>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-500">または手動で入力</label>
                  <div className="flex items-center space-x-2">
                    <Input 
                      placeholder="例: muu0726/my-tasks" 
                      value={newRepoName}
                      onChange={(e) => setNewRepoName(e.target.value)}
                    />
                    <Button onClick={handleAddRepo} disabled={repoLoading || !newRepoName}>
                      {repoLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      <span className="ml-1">追加</span>
                    </Button>
                  </div>
                </div>

                <div className="mt-6 border-t pt-4">
                  <label className="text-xs font-medium text-slate-500 block mb-2">登録済みリポジトリ</label>
                  <ScrollArea className="h-[150px] w-full rounded-md border p-4 bg-slate-50 dark:bg-slate-900/50">
                    {repos.length === 0 ? (
                      <p className="text-sm text-slate-500 text-center mt-4">登録されていません</p>
                    ) : (
                      repos.map(repo => (
                        <div key={repo.id} className="flex items-center justify-between py-2 border-b last:border-0 border-slate-200 dark:border-slate-800">
                          <span className="text-sm font-medium">{repo.repo_name}</span>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteRepo(repo.repo_name)}>
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      ))
                    )}
                  </ScrollArea>
                </div>

              </div>
            </DialogContent>
          </Dialog>
          
          <Button 
            variant="ghost"
            size="sm"
            onClick={manualSync}
            className="h-9 w-9 p-0"
            disabled={loading}
          >
            <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 min-h-0">
          {STATUSES.map(status => {
            const colTasks = filteredTasks.filter(t => t.status === status.id);
            return (
              <div key={status.id} className="flex flex-col h-full bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className={`px-3 py-1 rounded-full text-sm font-medium ${status.color}`}>
                    {status.label}
                  </div>
                  <span className="text-sm font-medium text-slate-500 bg-white dark:bg-slate-800 px-2 py-1 rounded-md shadow-sm border">
                    {colTasks.length}
                  </span>
                </div>
                
                <Droppable droppableId={status.id}>
                  {(provided, snapshot) => (
                    <ScrollArea className={`flex-1 -mx-2 px-2 transition-colors ${snapshot.isDraggingOver ? 'bg-slate-100/50 dark:bg-slate-800/50 rounded-lg' : ''}`}>
                      <div 
                        className="space-y-3 pb-4 min-h-[200px]"
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                      >
                        {colTasks.length === 0 && !snapshot.isDraggingOver ? (
                          <div className="text-center py-8 text-sm text-slate-400 pointer-events-none">
                            タスクがありません
                          </div>
                        ) : (
                          colTasks.map((task, index) => (
                            <Draggable key={task.id} draggableId={task.id} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={`mb-3 ${snapshot.isDragging ? 'z-50' : ''}`}
                                  style={{
                                    ...provided.draggableProps.style,
                                    opacity: snapshot.isDragging ? 0.8 : 1,
                                  }}
                                >
                                  <Card 
                                    className={`group hover:shadow-md transition-all duration-200 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 cursor-pointer ${snapshot.isDragging ? 'shadow-xl scale-105' : ''}`}
                                    onClick={() => setSelectedTask(task)}
                                  >
                                    <CardHeader className="p-4 pb-2 pointer-events-none">
                                      <div className="flex justify-between items-start gap-2">
                                        <CardTitle className="text-base font-semibold leading-tight group-hover:text-primary transition-colors flex items-center">
                                          <GripVertical className="w-4 h-4 mr-2 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                                          {task.title}
                                        </CardTitle>
                                      </div>
                                    </CardHeader>
                                    <CardContent className="p-4 pt-2 pointer-events-none">
                                      <div className="flex flex-wrap gap-2 mt-2 items-center">
                                        <Badge className={`${getPriorityColor(task.priority)} text-white border-0 shadow-sm`}>
                                          {task.priority.toUpperCase()}
                                        </Badge>
                                        <span className="text-xs font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                                          {task.project_name}
                                        </span>
                                        <div className="flex items-center text-xs text-slate-500 ml-auto" title={task.file_path}>
                                          <FileText className="w-3 h-3 mr-1" />
                                          <span className="truncate max-w-[120px]">{task.file_path.split('/').pop()}</span>
                                        </div>
                                      </div>
                                    </CardContent>
                                  </Card>
                                </div>
                              )}
                            </Draggable>
                          ))
                        )}
                        {provided.placeholder}
                      </div>
                    </ScrollArea>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      {/* タスク詳細ダイアログ */}
      <Dialog open={!!selectedTask} onOpenChange={(open) => !open && setSelectedTask(null)}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] flex flex-col">
          {selectedTask && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">{selectedTask.title}</DialogTitle>
                <div className="flex items-center gap-2 mt-2">
                  <Badge className={`${getPriorityColor(selectedTask.priority)} text-white`}>
                    {selectedTask.priority.toUpperCase()}
                  </Badge>
                  <span className="text-xs text-slate-500 flex items-center">
                    <FileText className="w-3 h-3 mr-1" />
                    {selectedTask.file_path}
                  </span>
                </div>
              </DialogHeader>
              <div className="flex-1 mt-4 p-4 rounded-md border bg-slate-50 dark:bg-slate-900/50 overflow-y-auto min-h-0">
                <article className="prose prose-slate dark:prose-invert max-w-none">
                  <ReactMarkdown>{selectedTask.content}</ReactMarkdown>
                </article>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
