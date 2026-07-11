"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell, PageSection } from "@/components/AppShell";
import { AiMarkdown } from "@/components/AiMarkdown";
import { EmptyState, MicroInteractionButton } from "@/components/MotionComponents";
import { AiSelection, ModelSelector } from "@/components/ModelSelector";

interface JournalEntry {
  journalId: string; date: string; entryText: string; mood: string | null; tags: string[] | null;
  aiFeedback: string | null; tomorrowTask: string | null; patternDetected: string | null;
  studyDone: boolean; exerciseDone: boolean; readingDone: boolean;
}
interface JournalResponse { success: boolean; journal: JournalEntry; rawAiOutput?: string; friendlyMessage?: string; error?: string }
interface JournalHistoryResponse { entries: JournalEntry[] }

const moods = [{ value: "1", label: "Low" }, { value: "2", label: "Heavy" }, { value: "3", label: "Steady" }, { value: "4", label: "Clear" }, { value: "5", label: "Sharp" }];
const availableTags = ["Study", "Exercise", "Reading", "Sleep", "Phone", "Other"];
const starterLines = ["Studied:", "Solved:", "Got stuck at:", "Wasted time on:", "Tomorrow must start with:"];

export default function JournalPage() {
  const [entryText, setEntryText] = useState("");
  const [mood, setMood] = useState("3");
  const [tags, setTags] = useState<string[]>([]);
  const [studyDone, setStudyDone] = useState(false);
  const [exerciseDone, setExerciseDone] = useState(false);
  const [readingDone, setReadingDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastSavedTask, setLastSavedTask] = useState("");
  const [lastFeedback, setLastFeedback] = useState("");
  const [error, setError] = useState("");
  const [view, setView] = useState<"today" | "history">("today");
  const [history, setHistory] = useState<JournalEntry[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [aiSelection, setAiSelection] = useState<AiSelection>({ provider: "nvidia", model: "meta/llama-3.1-8b-instruct" });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const response = await fetch(`${backendUrl}/api/journal/history?limit=30`, { headers: {} });
      const result = (await response.json()) as JournalHistoryResponse & { error?: string };
      if (!response.ok) throw new Error(result.error || "Journal history could not be loaded.");
      setHistory(Array.isArray(result.entries) ? result.entries : []);
    } catch (loadError) { toast.error(loadError instanceof Error ? loadError.message : "Journal history could not be loaded."); }
    finally { setHistoryLoading(false); }
  }, [backendUrl]);

  const changeView = (next: "today" | "history") => { setView(next); if (next === "history" && history === null) void loadHistory(); };
  const toggleTag = (tag: string) => setTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]);
  const appendStarterLine = (line: string) => { setEntryText((current) => `${current}${current.trim() ? "\n" : ""}${line} `); window.setTimeout(() => textareaRef.current?.focus(), 0); };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (entryText.trim().length < 20) { setError("Write at least 20 characters so the plan has real context."); return; }
    setLoading(true); setError(""); setLastSavedTask(""); setLastFeedback("");
    try {
      const response = await fetch(`${backendUrl}/api/journal`, {
        method: "POST", headers: { "Content-Type": "application/json",},
        body: JSON.stringify({ entryText, mood, tags, studyDone, exerciseDone, readingDone, aiProvider: aiSelection.provider, aiModel: aiSelection.model }),
      });
      const result = (await response.json()) as JournalResponse;
      if (!response.ok) throw new Error(result.error || "Journal could not be saved.");
      setLastSavedTask(result.journal.tomorrowTask || "Saved. Dashboard can now build the plan.");
      setLastFeedback(result.rawAiOutput || result.journal.aiFeedback || "");
      setEntryText(""); setTags([]); setStudyDone(false); setExerciseDone(false); setReadingDone(false); setHistory(null);
      if (textareaRef.current) textareaRef.current.style.height = "320px";
      toast.success("Entry saved");
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : "Could not reach the mentor server. Your draft is still here."); }
    finally { setLoading(false); }
  };

  return (
    <AppShell eyebrow="Evening accountability" title="Today's entry" subtitle="Write the facts. The next plan comes from this." actions={<div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-1">{(["today", "history"] as const).map((item) => <button key={item} type="button" onClick={() => changeView(item)} className={`focus-ring rounded-md px-3 py-1.5 text-[11px] font-semibold capitalize ${view === item ? "bg-white text-[var(--accent)] shadow-sm" : "text-[var(--text-secondary)]"}`}>{item}</button>)}</div>}>
      {view === "today" ? <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <PageSection title="Write" eyebrow="Input" className="xl:col-span-8">
          <form onSubmit={handleSubmit} className="surface p-4">
            <label htmlFor="entryText" className="section-label mb-2 block">Today</label>
            <textarea id="entryText" ref={textareaRef} value={entryText} onChange={(event) => setEntryText(event.target.value.slice(0, 5000))} placeholder="Studied Fluid Mechanics for 2 hours. Solved pipe-flow questions. Wasted 45 minutes after lunch. Tomorrow should start with..." className={`app-input min-h-[320px] resize-none px-4 py-3 text-sm leading-6 ${error ? "error" : ""}`} />
            <div className="mt-3 flex flex-wrap gap-1.5">{starterLines.map((line) => <button key={line} type="button" onClick={() => appendStarterLine(line)} className="focus-ring rounded-full border border-[var(--border)] bg-white px-2 py-1 text-[10px] font-semibold text-[var(--text-secondary)]">{line}</button>)}</div>
            <div className="mt-3 flex justify-between text-[11px] font-semibold text-[var(--text-secondary)]"><span>{entryText.length} / 5000</span><span>{entryText.trim().length >= 20 ? "Ready" : "Minimum 20"}</span></div>
            {error ? <div className="mt-4 rounded-lg border border-[var(--danger)]/20 bg-[var(--danger-soft)] px-4 py-3 text-sm font-semibold text-[var(--danger)]">{error}</div> : null}
            <div className="mt-4 flex flex-wrap items-center justify-end gap-2"><ModelSelector value={aiSelection} onChange={setAiSelection} /><MicroInteractionButton type="submit" loading={loading} disabled={entryText.trim().length < 20} className="btn-primary">Save entry</MicroInteractionButton></div>
          </form>
          {lastFeedback ? <div className="surface mt-4 p-5"><p className="section-label mb-3">Mentor feedback</p><AiMarkdown content={lastFeedback} /></div> : null}
        </PageSection>
        <div className="space-y-4 xl:col-span-4">
          <PageSection title="Plan Seed" eyebrow="Tomorrow"><div className="surface soft-mint grid gap-2 p-4"><Checklist checked={studyDone} label="Study happened" onChange={setStudyDone} /><Checklist checked={exerciseDone} label="Exercise happened" onChange={setExerciseDone} /><Checklist checked={readingDone} label="Reading happened" onChange={setReadingDone} /></div></PageSection>
          <PageSection title="Mood + Tags" eyebrow="Context"><div className="surface p-4"><div className="grid grid-cols-5 gap-1.5">{moods.map((item) => <button key={item.value} type="button" onClick={() => setMood(item.value)} className={`focus-ring rounded-md border px-1 py-1.5 text-center ${mood === item.value ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--border)] bg-white text-[var(--text-secondary)]"}`}><span className="block text-xs font-semibold">{item.value}</span><span className="text-[9px]">{item.label}</span></button>)}</div><div className="mt-3 flex flex-wrap gap-1.5">{availableTags.map((tag) => <button key={tag} type="button" onClick={() => toggleTag(tag)} className={`focus-ring rounded-full border px-2 py-1 text-[10px] font-semibold ${tags.includes(tag) ? "border-[var(--teal)] bg-[var(--teal-soft)] text-[var(--teal)]" : "border-[var(--border)] bg-white text-[var(--text-secondary)]"}`}>{tag}</button>)}</div></div></PageSection>
          {lastSavedTask ? <div className="surface soft-blue p-4"><p className="section-label mb-2">Tomorrow priority</p><p className="text-sm font-semibold leading-6">{lastSavedTask}</p></div> : null}
        </div>
      </div> : <JournalHistory entries={history || []} loading={historyLoading} onRefresh={loadHistory} />}
    </AppShell>
  );
}

function Checklist({ checked, label, onChange }: { checked: boolean; label: string; onChange: (value: boolean) => void }) {
  return <label className="flex cursor-pointer items-center justify-between rounded-lg border border-[var(--border)] bg-white px-3 py-2.5"><span className="text-xs font-semibold">{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-[var(--accent)]" /></label>;
}

function JournalHistory({ entries, loading, onRefresh }: { entries: JournalEntry[]; loading: boolean; onRefresh: () => void }) {
  return <PageSection title="Journal history" eyebrow="Last 30 entries" action={<MicroInteractionButton type="button" onClick={onRefresh} loading={loading} className="btn-secondary">Refresh</MicroInteractionButton>}>
    {loading && entries.length === 0 ? <div className="surface space-y-3 p-4">{[0, 1, 2].map((item) => <div key={item} className="h-20 animate-pulse rounded-lg bg-[var(--track)]" />)}</div> : entries.length ? <div className="surface divide-y divide-[var(--border)] overflow-hidden">{entries.map((entry) => <details key={entry.journalId} className="p-4 open:bg-[var(--bg-elevated)]"><summary className="focus-ring cursor-pointer list-none"><p className="text-sm font-semibold">{new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(entry.date))}</p><p className="mt-1 truncate text-xs text-[var(--text-secondary)]">{entry.entryText}</p></summary><div className="mt-4 border-t border-[var(--border)] pt-4"><p className="whitespace-pre-wrap text-sm leading-6">{entry.entryText}</p>{entry.tomorrowTask ? <div className="mt-3 rounded-lg bg-white p-3"><p className="section-label mb-1">Next priority</p><p className="text-xs font-semibold">{entry.tomorrowTask}</p></div> : null}</div></details>)}</div> : <EmptyState mark="J" title="No journal entries yet" description="Save tonight's entry and your history will build here." className="min-h-[300px]" />}
  </PageSection>;
}
