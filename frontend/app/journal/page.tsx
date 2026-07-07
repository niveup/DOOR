"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell, PageSection } from "@/components/AppShell";
import { MicroInteractionButton } from "@/components/MotionComponents";
import { AiSelection, ModelSelector } from "@/components/ModelSelector";

interface JournalEntry {
  journalId: string;
  date: string;
  entryText: string;
  mood: string | null;
  tags: string[] | null;
  aiFeedback: string | null;
  tomorrowTask: string | null;
  patternDetected: string | null;
  studyDone: boolean;
  exerciseDone: boolean;
  readingDone: boolean;
}

interface JournalResponse {
  success: boolean;
  journal: JournalEntry;
  rawAiOutput?: string;
  friendlyMessage?: string;
  error?: string;
}

interface JournalHistoryResponse {
  entries: JournalEntry[];
}

const moods = [
  { value: "1", label: "Low" },
  { value: "2", label: "Heavy" },
  { value: "3", label: "Steady" },
  { value: "4", label: "Clear" },
  { value: "5", label: "Sharp" },
];

const availableTags = ["Study", "Exercise", "Reading", "Sleep", "Phone", "Other"];

const starterLines = [
  "Studied:",
  "Solved:",
  "Got stuck at:",
  "Wasted time on:",
  "Tomorrow must start with:",
];

export default function JournalPage() {
  const [entryText, setEntryText] = useState("");
  const [mood, setMood] = useState("3");
  const [tags, setTags] = useState<string[]>([]);
  const [studyDone, setStudyDone] = useState(false);
  const [exerciseDone, setExerciseDone] = useState(false);
  const [readingDone, setReadingDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastSavedTask, setLastSavedTask] = useState("");
  const [error, setError] = useState("");
  const [view, setView] = useState<"today" | "history">("today");
  const [history, setHistory] = useState<JournalEntry[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [aiSelection, setAiSelection] = useState<AiSelection>({
    provider: "nvidia",
    model: "meta/llama-3.1-8b-instruct",
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const response = await fetch(`${backendUrl}/api/journal/history?limit=30`, {
        headers: { "x-passcode": "1234" },
      });
      const result = (await response.json()) as JournalHistoryResponse & { error?: string };
      if (!response.ok) throw new Error(result.error || "Journal history could not be loaded.");
      setHistory(Array.isArray(result.entries) ? result.entries : []);
    } catch (historyError) {
      toast.error(historyError instanceof Error ? historyError.message : "Journal history could not be loaded.");
    } finally {
      setHistoryLoading(false);
    }
  }, [backendUrl]);

  const changeView = (nextView: "today" | "history") => {
    setView(nextView);
    if (nextView === "history" && history === null) {
      void loadHistory();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length > 5000) return;
    setEntryText(value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 520)}px`;
    }
  };

  const appendStarterLine = (line: string) => {
    const prefix = entryText.trim().length > 0 ? "\n" : "";
    const next = `${entryText}${prefix}${line} `;
    setEntryText(next);
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const toggleTag = (tag: string) => {
    setTags((prev) => (prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]));
  };

  const handleJournalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (entryText.trim().length < 20) {
      setError("Write at least 20 characters so the plan has real context.");
      return;
    }

    setLoading(true);
    setError("");
    setLastSavedTask("");

    try {
      const res = await fetch(`${backendUrl}/api/journal`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-passcode": "1234",
        },
        body: JSON.stringify({
          entryText,
          mood,
          tags,
          studyDone,
          exerciseDone,
          readingDone,
          aiProvider: aiSelection.provider,
          aiModel: aiSelection.model,
        }),
      });

      const data = (await res.json()) as JournalResponse;
      if (res.ok) {
        setLastSavedTask(data.journal.tomorrowTask || "Saved. Dashboard can now build the plan.");
        setEntryText("");
        setTags([]);
        setStudyDone(false);
        setExerciseDone(false);
        setReadingDone(false);
        setHistory(null);
        if (textareaRef.current) textareaRef.current.style.height = "300px";
        toast.success(data.success ? "Entry saved" : "Entry saved");
      } else {
        setError(data.error || "Journal could not be saved.");
      }
    } catch {
      setError("Could not reach the mentor server. Your draft is still here.");
    } finally {
      setLoading(false);
    }
  };

  const isApproachingLimit = entryText.length >= 4500;

  return (
    <AppShell
      eyebrow="Evening accountability"
      title="Today's entry"
      subtitle="Write the facts. The next plan comes from this."
      actions={
        <div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-1">
          {(["today", "history"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => changeView(item)}
              className={`focus-ring rounded-md px-3 py-1.5 text-[11px] font-semibold capitalize transition ${
                view === item ? "bg-white text-[var(--accent)] shadow-sm" : "text-[var(--text-secondary)]"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      }
    >
      {view === "today" ? (
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <PageSection title="Write" eyebrow="Input" className="xl:col-span-8">
          <form onSubmit={handleJournalSubmit} className="surface p-4">
            <label htmlFor="entryText" className="section-label mb-2 block">
              Today
            </label>
            <textarea
              id="entryText"
              ref={textareaRef}
              value={entryText}
              onChange={handleTextareaChange}
              placeholder="Studied Fluid Mechanics for 2 hours. Solved pipe-flow questions. Wasted 45 minutes after lunch. Tomorrow should start with..."
              className={`app-input min-h-[320px] resize-none px-4 py-3 text-sm leading-6 ${error ? "error" : ""}`}
            />

            <div className="mt-3 flex flex-wrap gap-1.5">
              {starterLines.map((line) => (
                <button
                  key={line}
                  type="button"
                  onClick={() => appendStarterLine(line)}
                  className="focus-ring rounded-full border border-[var(--border)] bg-white px-2 py-1 text-[10px] font-semibold text-[var(--text-secondary)] transition hover:border-[var(--border-strong)]"
                >
                  {line}
                </button>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between gap-3 text-[11px] font-semibold">
              <span className={isApproachingLimit ? "text-[var(--warning)]" : "text-[var(--text-secondary)]"}>
                {entryText.length} / 5000
              </span>
              <span className={entryText.trim().length >= 20 ? "text-[var(--success)]" : "text-[var(--text-faint)]"}>
                Minimum 20
              </span>
            </div>

            {loading ? (
              <div className="mt-4 rounded-lg border border-[var(--accent)]/20 bg-[var(--accent-soft)] p-3">
                <div className="mb-2 flex items-center justify-between gap-3 text-xs font-semibold text-[var(--accent)]">
                  <span>Saving entry</span>
                  <span>Preparing tomorrow seed</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white">
                  <span className="block h-full w-2/3 animate-pulse rounded-full bg-[var(--accent)]" />
                </div>
              </div>
            ) : null}

            {error ? (
              <div className="mt-4 rounded-lg border border-[var(--danger)]/20 bg-[var(--danger-soft)] px-4 py-3 text-sm font-semibold text-[var(--danger)]">
                {error}
              </div>
            ) : null}

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs font-medium leading-5 text-[var(--text-secondary)]">
                Specific topic, time spent, and one miss are enough.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <ModelSelector value={aiSelection} onChange={setAiSelection} />
                <MicroInteractionButton type="submit" loading={loading} disabled={entryText.trim().length < 20} className="btn-primary sm:min-w-[130px]">
                  Save entry
                </MicroInteractionButton>
              </div>
            </div>
          </form>
        </PageSection>

        <div className="space-y-4 xl:col-span-4">
          <PageSection title="Plan Seed" eyebrow="Tomorrow">
            <div className="surface soft-mint p-4">
              <div className="grid gap-2">
                <Checklist checked={studyDone} label="Study happened" onChange={setStudyDone} />
                <Checklist checked={exerciseDone} label="Exercise happened" onChange={setExerciseDone} />
                <Checklist checked={readingDone} label="Reading happened" onChange={setReadingDone} />
              </div>
            </div>
          </PageSection>

          <PageSection title="Mood + Tags" eyebrow="Context">
            <div className="surface p-4">
              <div className="grid grid-cols-5 gap-1.5">
                {moods.map((item) => {
                  const active = mood === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setMood(item.value)}
                      className={`focus-ring rounded-md border px-1 py-1.5 text-center transition ${
                        active
                          ? "border-[var(--accent)]/25 bg-[var(--accent-soft)] text-[var(--accent)]"
                          : "border-[var(--border)] bg-white text-[var(--text-secondary)]"
                      }`}
                    >
                      <span className="block text-xs font-semibold">{item.value}</span>
                      <span className="mt-0.5 block truncate text-[9px] font-medium">{item.label}</span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {availableTags.map((tag) => {
                  const active = tags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`focus-ring rounded-full border px-2 py-1 text-[10px] font-semibold transition ${
                        active
                          ? "border-[var(--teal)]/25 bg-[var(--teal-soft)] text-[var(--teal)]"
                          : "border-[var(--border)] bg-white text-[var(--text-secondary)]"
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          </PageSection>

          {lastSavedTask ? (
            <div className="surface soft-blue p-4">
              <p className="section-label mb-2">Saved</p>
              <p className="text-sm font-semibold leading-6 text-[var(--text-primary)]">{lastSavedTask}</p>
            </div>
          ) : null}
        </div>
      </div>
      ) : (
        <JournalHistory entries={history || []} loading={historyLoading} onRefresh={loadHistory} />
      )}
    </AppShell>
  );
}

function Checklist({ checked, label, onChange }: { checked: boolean; label: string; onChange: (value: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-white px-3 py-2.5 transition-colors hover:border-[var(--border-strong)]">
      <span className="text-xs font-semibold text-[var(--text-primary)]">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-[var(--accent)]"
      />
    </label>
  );
}

function JournalHistory({
  entries,
  loading,
  onRefresh,
}: {
  entries: JournalEntry[];
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <PageSection
      title="Journal history"
      eyebrow="Last 30 entries"
      action={
        <MicroInteractionButton type="button" onClick={onRefresh} loading={loading} className="btn-secondary">
          Refresh
        </MicroInteractionButton>
      }
    >
      {loading && entries.length === 0 ? (
        <div className="surface space-y-3 p-4">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-20 animate-pulse rounded-lg bg-[var(--track)]" />
          ))}
        </div>
      ) : entries.length > 0 ? (
        <div className="surface divide-y divide-[var(--border)] overflow-hidden">
          {entries.map((entry) => {
            const date = new Intl.DateTimeFormat("en-IN", {
              weekday: "short",
              day: "2-digit",
              month: "short",
              year: "numeric",
              timeZone: "Asia/Kolkata",
            }).format(new Date(entry.date));
            const entryTags = Array.isArray(entry.tags) ? entry.tags : [];

            return (
              <details key={entry.journalId} className="group p-4 open:bg-[var(--bg-elevated)]">
                <summary className="focus-ring flex cursor-pointer list-none items-center justify-between gap-4 rounded-md">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{date}</p>
                    <p className="mt-1 truncate text-xs font-medium text-[var(--text-secondary)]">{entry.entryText}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {entryTags.slice(0, 2).map((tag) => (
                      <span key={tag} className="pill pill-blue px-2 py-0.5 text-[9px]">{tag}</span>
                    ))}
                    <span className="grid h-6 w-6 place-items-center rounded-md text-xs font-semibold text-[var(--text-secondary)] transition group-open:rotate-45">+</span>
                  </div>
                </summary>
                <div className="mt-4 border-t border-[var(--border)] pt-4">
                  <p className="whitespace-pre-wrap text-sm font-medium leading-6 text-[var(--text-primary)]">{entry.entryText}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <HistoryFlag active={entry.studyDone} label="Study" />
                    <HistoryFlag active={entry.exerciseDone} label="Exercise" />
                    <HistoryFlag active={entry.readingDone} label="Reading" />
                    {entry.mood ? <span className="pill pill-blue">Mood {entry.mood}/5</span> : null}
                  </div>
                  {entry.tomorrowTask ? (
                    <div className="mt-3 rounded-lg border border-[var(--border)] bg-white px-3 py-2">
                      <p className="section-label mb-1">Next priority</p>
                      <p className="text-xs font-semibold leading-5 text-[var(--text-primary)]">{entry.tomorrowTask}</p>
                    </div>
                  ) : null}
                </div>
              </details>
            );
          })}
        </div>
      ) : (
        <div className="surface p-8 text-center">
          <p className="text-sm font-semibold text-[var(--text-primary)]">No journal entries yet</p>
          <p className="mt-1 text-xs font-medium text-[var(--text-secondary)]">Saved entries will appear here.</p>
        </div>
      )}
    </PageSection>
  );
}

function HistoryFlag({ active, label }: { active: boolean; label: string }) {
  return <span className={`pill ${active ? "pill-green" : ""}`}>{label} {active ? "done" : "not logged"}</span>;
}
