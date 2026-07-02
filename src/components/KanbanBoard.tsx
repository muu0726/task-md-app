"use client";

import { useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabase";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RefreshCw, FileText } from "lucide-react";

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

const STATUSES = [
  { id: "todo", label: "To Do", color: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  { id: "in_progress", label: "In Progress", color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  { id: "done", label: "Done", color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" }
];

export function KanbanBoard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<string[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    fetchTasks();
  }, []);

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

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h2 className="text-2xl font-bold tracking-tight">Project Board</h2>
          <Select value={selectedProject} onValueChange={(val) => setSelectedProject(val || "all")}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select a project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects.map(p => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <button 
          onClick={fetchTasks}
          className="p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          disabled={loading}
        >
          <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

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
              
              <ScrollArea className="flex-1 -mx-2 px-2">
                <div className="space-y-3 pb-4">
                  {colTasks.length === 0 ? (
                    <div className="text-center py-8 text-sm text-slate-400">
                      No tasks
                    </div>
                  ) : (
                    colTasks.map(task => (
                      <Card key={task.id} className="group hover:shadow-md transition-all duration-200 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
                        <CardHeader className="p-4 pb-2">
                          <div className="flex justify-between items-start gap-2">
                            <CardTitle className="text-base font-semibold leading-tight group-hover:text-primary transition-colors">
                              {task.title}
                            </CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent className="p-4 pt-2">
                          <div className="flex flex-wrap gap-2 mt-2 items-center">
                            <Badge className={`${getPriorityColor(task.priority)} text-white border-0 shadow-sm`}>
                              {task.priority.toUpperCase()}
                            </Badge>
                            <div className="flex items-center text-xs text-slate-500 ml-auto" title={task.file_path}>
                              <FileText className="w-3 h-3 mr-1" />
                              <span className="truncate max-w-[120px]">{task.file_path.split('/').pop()}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          );
        })}
      </div>
    </div>
  );
}
