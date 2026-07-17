"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { AiMarkdown } from "@/components/AiMarkdown";
import { MicroInteractionButton } from "@/components/MotionComponents";
import { AiSelection, ModelSelector } from "@/components/ModelSelector";

interface JournalEntry {
  journalId: string;
  date: string;
  entryText: string;
  mood: string | null;
  tags: string[];
  aiFeedback: string | null;
  tomorrowTask: string | null;
  patternDetected: string | null;
  studyDone: boolean;
  exerciseDone: boolean;
  readingDone: boolean;
}

interface JournalResponse {
  success: boolean;
  journal?: JournalEntry | null;
  friendlyMessage?: string;
  error?: string;
}

const moods = [
  { value: "1", label: "Low", emoji: "??" },
  { value: "2", label: "Heavy", emoji: "??" },
  { value: "3", label: "Steady", emoji: "??" },
  { value: "4", label: "Clear", emoji: "???" },
  { value: "5", label: "Sharp", emoji: "?" },
];

const activityStamps = [
  { key: "studyDone", label: "Study", icon: "?" },
  { key: "exerciseDone", label: "Exercise", icon: "?" },
  { key: "readingDone", label: "Reading", icon: "?" },
] as const;

const promptSheets = [
  { title: "A quiet check-in", note: "Clear the mental desk", copy: "What is taking up the most space in my head today?\n\nWhat do I need to admit without judging it?" },
  { title: "Gratitude, without gloss", note: "Name what held you", copy: "Three things I am grateful for:\n1. \n2. \n3. \n\nOne person or moment I want to remember:" },
  { title: "Study blockers", note: "Find the friction", copy: "What did I mean to study?\n\nWhere did I get stuck?\n\nThe smallest next action that reduces the friction:" },
  { title: "Daily accountability", note: "Facts before feelings", copy: "What I said I would do:\n\nWhat actually happened:\n\nWhat I will protect tomorrow:" },
];

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(`${date}T12:00:00+05:30`));
}

export default function JournalPage() {
  const [entryText, setEntryText] = useState("");
  const [mood, setMood] = useState("3");
  const [tags, setTags] = useState<string[]>([]);
  const [studyDone, setStudyDone] = useState(false);
  const [exerciseDone, setExerciseDone] = useState(false);
  const [readingDone, setReadingDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<JournalEntry[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [lastSavedTask, setLastSavedTask] = useState("");
  const [lastFeedback, setLastFeedback] = useState("");
  const [error, setError] = useState("");
  const [isWriting, setIsWriting] = useState(false);
  const [aiSelection, setAiSelection] = useState<AiSelection>({ provider: "nvidia", model: "meta/llama-3.1-8b-instruct" });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const writingTimer = useRef<number | null>(null);
  const router = useRouter();

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const response = await fetch("/api/journal?limit=30", { cache: "no-store" });
      const result = await response.json() as { entries?: JournalEntry[]; error?: string };
      if (!response.ok) throw new Error(result.error || "Journal history could not be loaded.");
      setHistory(Array.isArray(result.entries) ? result.entries : []);
    } catch (loadError) {
      toast.error(loadError instanceof Error ? loadError.message : "Journal history could not be loaded.");
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.max(360, textarea.scrollHeight)}px`;
  }, [entryText]);

  useEffect(() => () => { if (writingTimer.current) window.clearTimeout(writingTimer.current); }, []);

  const updateWriting = (value: string) => {
    setEntryText(value.slice(0, 5000));
    setIsWriting(true);
    if (writingTimer.current) window.clearTimeout(writingTimer.current);
    writingTimer.current = window.setTimeout(() => setIsWriting(false), 650);
  };

  const insertPrompt = (copy: string) => {
    setEntryText((current) => `${current}${current.trim() ? "\n\n" : ""}${copy}\n`);
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const toggleTag = (tag: string) => setTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]);

  const updateActivity = (key: typeof activityStamps[number]["key"], value: boolean) => {
    if (key === "studyDone") setStudyDone(value);
    if (key === "exerciseDone") setExerciseDone(value);
    if (key === "readingDone") setReadingDone(value);
  };

  const activityValue = (key: typeof activityStamps[number]["key"]) => key === "studyDone" ? studyDone : key === "exerciseDone" ? exerciseDone : readingDone;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (entryText.trim().length < 20) {
      setError("Give this page at least a few honest lines ? 20 characters is enough to begin.");
      textareaRef.current?.focus();
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/journal", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryText, mood, tags, studyDone, exerciseDone, readingDone, aiProvider: aiSelection.provider, aiModel: aiSelection.model }),
      });
      const result = await response.json() as JournalResponse;
      if (!response.ok || !result.journal) throw new Error(result.error || "Journal entry could not be saved.");
      setLastSavedTask(result.journal.tomorrowTask || "Your page is safely sealed for today.");
      setLastFeedback(result.journal.aiFeedback || "");
      setEntryText("");
      setTags([]);
      setStudyDone(false);
      setExerciseDone(false);
      setReadingDone(false);
      setHistory(null);
      void loadHistory();
      toast.success(result.success ? "Entry saved securely" : (result.friendlyMessage || "Entry saved securely"));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Your draft is still on this page ? it was not discarded.");
    } finally {
      setLoading(false);
    }
  };

  const lockJournal = async () => {
    try {
      await fetch("/api/journal-auth", { method: "DELETE", cache: "no-store" });
    } finally {
      router.replace("/journal/unlock");
      router.refresh();
    }
  };

  return (
    <AppShell
      eyebrow="Private notebook"
      title="Today, in your own words"
      subtitle="A quiet page for the truth, protected separately from the rest of your workspace."
      actions={<button type="button" onClick={lockJournal} className="journal-lock-button focus-ring">Lock journal <span aria-hidden="true">?</span></button>}
    >
      <div className="journal-workspace">
        <section className="journal-paper brand-fixed" aria-label="Today?s private journal page">
          <div className="journal-paper-topline">
            <div><p className="journal-paper-overline">Personal record ? encrypted</p><h2>{new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" }).format(new Date())}</h2></div>
            <span className="journal-privacy-seal">Private</span>
          </div>

          <form onSubmit={submit}>
            <div className="journal-stamp-row" aria-label="How did today feel?">
              <span className="journal-meta-label">Mood</span>
              {moods.map((item) => <button key={item.value} type="button" aria-pressed={mood === item.value} onClick={() => setMood(item.value)} className={`journal-stamp focus-ring ${mood === item.value ? "is-selected" : ""}`}><span aria-hidden="true">{item.emoji}</span>{item.label}</button>)}
            </div>

            <div className="journal-writing-area">
              <textarea
                id="entryText"
                ref={textareaRef}
                value={entryText}
                onChange={(event) => updateWriting(event.target.value)}
                placeholder="There is no right way to begin. Start with what is true today?"
                className={`journal-textarea ${error ? "is-error" : ""}`}
                aria-describedby={error ? "journal-error" : undefined}
              />
            </div>

            <div className="journal-paper-footer">
              <div className="journal-ink-status" aria-live="polite"><span className={isWriting ? "is-writing" : ""} />{isWriting ? "Ink settling?" : `${entryText.length} / 5000`}</div>
              <div className="journal-submit-controls"><ModelSelector value={aiSelection} onChange={setAiSelection} /><MicroInteractionButton type="submit" loading={loading} disabled={entryText.trim().length < 20} className="journal-save-button">Seal today&apos;s page</MicroInteractionButton></div>
            </div>
            {error ? <p id="journal-error" className="journal-error" role="alert">{error}</p> : null}
          </form>

          <div className="journal-activity-row" aria-label="Activity stamps">
            <span className="journal-meta-label">Today&apos;s marks</span>
            {activityStamps.map((activity) => {
              const checked = activityValue(activity.key);
              return <button key={activity.key} type="button" aria-pressed={checked} onClick={() => updateActivity(activity.key, !checked)} className={`journal-activity-stamp focus-ring ${checked ? "is-marked" : ""}`}><span aria-hidden="true">{activity.icon}</span>{activity.label}</button>;
            })}
          </div>
          <div className="journal-tag-row" aria-label="Context tags">
            {['Study', 'Exercise', 'Reading', 'Sleep', 'Phone', 'Other'].map((tag) => <button key={tag} type="button" aria-pressed={tags.includes(tag)} onClick={() => toggleTag(tag)} className={`journal-tag focus-ring ${tags.includes(tag) ? "is-selected" : ""}`}>{tag}</button>)}
          </div>
        </section>

        <aside className="journal-sidebar" aria-label="Journal tools and history">
          <section className="journal-drawer">
            <div className="journal-drawer-heading"><div><p className="journal-panel-kicker">Prompt sheets</p><h2>Only if you need a nudge.</h2></div><span aria-hidden="true">?</span></div>
            <p className="journal-drawer-copy">Clicking a sheet adds its gentle structure to the end of your page. Your writing stays completely yours.</p>
            <div className="journal-prompt-list">
              {promptSheets.map((sheet) => <button type="button" key={sheet.title} onClick={() => insertPrompt(sheet.copy)} className="journal-prompt-card focus-ring"><span>{sheet.note}</span><strong>{sheet.title}</strong><i aria-hidden="true">Add ?</i></button>)}
            </div>
          </section>

          <section className="journal-history-panel">
            <div className="journal-history-heading"><div><p className="journal-panel-kicker">Past pages</p><h2>Journal timeline</h2></div><button type="button" className="journal-refresh focus-ring" onClick={() => void loadHistory()} disabled={historyLoading}>Refresh</button></div>
            {historyLoading && !history ? <div className="journal-history-loading"><i /><i /><i /></div> : history?.length ? <div className="journal-timeline">
              {history.map((entry) => <details key={entry.journalId} className="journal-history-entry"><summary className="focus-ring"><span className="journal-history-dot" /><div><time>{formatDate(entry.date)}</time><p>{entry.entryText}</p></div></summary><div className="journal-history-content"><p>{entry.entryText}</p>{entry.tomorrowTask ? <div><span>Next small promise</span>{entry.tomorrowTask}</div> : null}</div></details>)}
            </div> : <p className="journal-history-empty">Your first page will begin this little timeline.</p>}
          </section>
        </aside>
      </div>

      {lastFeedback || lastSavedTask ? <section className="journal-reflection brand-fixed"><p className="journal-panel-kicker">A note from your mentor</p>{lastFeedback ? <AiMarkdown content={lastFeedback} /> : null}{lastSavedTask ? <p className="journal-next-promise"><span>Tomorrow&apos;s thread</span>{lastSavedTask}</p> : null}</section> : null}
    </AppShell>
  );
}
