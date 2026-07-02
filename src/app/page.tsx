import { KanbanBoard } from "@/components/KanbanBoard";

export default function Home() {
  return (
    <main className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-50">
      <div className="max-w-[1600px] mx-auto p-6 md:p-8 h-screen flex flex-col">
        <header className="mb-8">
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent">
            Aitask.md
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2">
            Markdown files automatically synced to a Kanban board
          </p>
        </header>
        
        <div className="flex-1 min-h-0 bg-white dark:bg-slate-950 rounded-2xl">
          <KanbanBoard />
        </div>
      </div>
    </main>
  );
}
