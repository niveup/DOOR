"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { MicroInteractionButton } from "@/components/MotionComponents";
import { motion, AnimatePresence } from "motion/react";
import { useDemoFetch, useDemoMode } from "@/lib/DemoContext";

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
  { value: "1", label: "Low" },
  { value: "2", label: "Heavy" },
  { value: "3", label: "Steady" },
  { value: "4", label: "Clear" },
  { value: "5", label: "Sharp" },
];

const activityStamps = [
  { key: "studyDone", label: "Study" },
  { key: "exerciseDone", label: "Exercise" },
  { key: "readingDone", label: "Reading" },
] as const;

const moodIcons: Record<string, React.ReactNode> = {
  "1": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <circle cx="12" cy="12" r="9" />
      {/* Downward sloped closed pensive eyes */}
      <path d="M8.5 10.5l2.2 1.2M15.5 10.5l-2.2 1.2" strokeWidth="1.8" />
      {/* Sad mouth curve */}
      <path d="M9.5 16.5c1-1.5 4-1.5 5 0" />
    </svg>
  ),
  "2": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <circle cx="12" cy="12" r="9" />
      {/* Stressed eyebrows */}
      <path d="M8 9.5c1-.5 2-.2 2.5.3M16 9.5c-1-.5-2-.2-2.5.3" />
      {/* Closed tight eyes */}
      <path d="M8.5 12h2M13.5 12h2" strokeWidth="2" />
      {/* Wavy sighing mouth */}
      <path d="M9.5 16c1-.6 2 .6 3 0s1.5-.6 2 0" />
    </svg>
  ),
  "3": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <circle cx="12" cy="12" r="9" />
      {/* Peaceful closed smiling eyes */}
      <path d="M8.5 11c.6.6 1.8.6 2.4 0M13.1 11c.6.6 1.8.6 2.4 0" />
      {/* Steady flat mouth */}
      <path d="M9.5 15.5h5" />
    </svg>
  ),
  "4": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <circle cx="12" cy="12" r="9" />
      {/* Happy open eyes */}
      <circle cx="9" cy="11.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="11.5" r="1.2" fill="currentColor" stroke="none" />
      {/* Smiling mouth */}
      <path d="M9.5 15c1 1.8 4 1.8 5 0" />
    </svg>
  ),
  "5": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <circle cx="12" cy="12" r="9" />
      {/* Slanted focused eyebrows */}
      <path d="M7.5 9.5l2.2.8M16.5 9.5l-2.2.8" />
      {/* Alert eye pupils */}
      <circle cx="9" cy="12.2" r="0.95" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12.2" r="0.95" fill="currentColor" stroke="none" />
      {/* Focused slight smile curve */}
      <path d="M10 15.8c.8.6 3.2.6 4 0" />
    </svg>
  ),
};

const activityIcons: Record<string, React.ReactNode> = {
  studyDone: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      {/* Diamond Cap Top */}
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      {/* Cap Skull Base */}
      <path d="M6 10v4c0 3 2.5 5 6 5s6-2 6-5v-4" />
      {/* Tassel */}
      <path d="M18 7.5v6.5M16 13h4M12 12v3" strokeWidth="1" strokeOpacity="0.6" />
    </svg>
  ),
  exerciseDone: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      {/* Bar */}
      <path d="M3 12h18" strokeWidth="2.2" />
      {/* Left Plates */}
      <rect x="6" y="6" width="2" height="12" rx="0.8" fill="currentColor" stroke="none" />
      <rect x="4" y="8" width="1.5" height="8" rx="0.5" fill="currentColor" stroke="none" />
      {/* Right Plates */}
      <rect x="16" y="6" width="2" height="12" rx="0.8" fill="currentColor" stroke="none" />
      <rect x="18.5" y="8" width="1.5" height="8" rx="0.5" fill="currentColor" stroke="none" />
      {/* Inner collar details */}
      <circle cx="9" cy="12" r="1.5" fill="none" stroke="currentColor" strokeWidth="1" />
      <circle cx="15" cy="12" r="1.5" fill="none" stroke="currentColor" strokeWidth="1" />
    </svg>
  ),
  readingDone: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      {/* Left Page Outline */}
      <path d="M12 6c-3.5-3-7-3-10-1v13c3-2 6.5-2 10 1" />
      {/* Right Page Outline */}
      <path d="M12 6c3.5-3 7-3 10-1v13c-3-2-6.5-2-10 1" />
      {/* Center Spine */}
      <path d="M12 5v14" />
      {/* Text Lines Details */}
      <path d="M5 9h4M5 12h4M15 9h4M15 12h4" strokeWidth="1.2" strokeOpacity="0.5" />
    </svg>
  ),
};

interface PinnedPrompt {
  title: string;
  note: string;
  copy: string;
}

const DEFAULT_PINNED_PROMPT: PinnedPrompt = {
  title: "Daily Life",
  note: "Campus & routine log",
  copy: `Daily Routine & Schedule
• Wake-up time, sleep hours & morning readiness: 
• College classes, lectures, lab, or coaching attended: 

Study & Prep Log
• Core subjects studied & topics covered: 
• Numerical practice & PYQs / questions solved: 
• Deep focus hours vs total planned time: 
• Tough concept understood or key takeaway: 

Hostel, Health & Expenses
• Meals/mess status & daily expenses logged: 
• Workout, walk, sports, or evening break: 
• Call with parents or talk with friends: 

Distractions & Friction
• Where did focus slip (phone, social media, hostel chatter): 
• Small action to eliminate this friction tomorrow: 

Night Review & Tomorrow's Priority
• Solid win or progress made today: 
• Single non-negotiable target for tomorrow morning: `,
};

const promptSheets = [
  { title: "A quiet check-in", note: "Clear the mental desk", copy: "What is taking up the most space in my head today?\n\nWhat do I need to admit without judging it?" },
  { title: "Gratitude, without gloss", note: "Name what held you", copy: "Three things I am grateful for:\n1. \n2. \n3. \n\nOne person or moment I want to remember:" },
  { title: "Study blockers", note: "Find the friction", copy: "What did I mean to study?\n\nWhere did I get stuck?\n\nThe smallest next action that reduces the friction:" },
  { title: "Daily accountability", note: "Facts before feelings", copy: "What I said I would do:\n\nWhat actually happened:\n\nWhat I will protect tomorrow:" },
];

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(`${date}T12:00:00+05:30`));
}

function escapeHtml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatJournalTextToHTML(rawText: string): string {
  if (!rawText) return "";
  const lines = rawText.split("\n");
  const htmlLines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return "<br/>";
    
    // Bullet Prompts with subtle warm prompt labels (e.g. • Wake-up time, sleep hours:)
    if (trimmed.startsWith("•") || trimmed.startsWith("-") || /^\d+\./.test(trimmed)) {
      const colonIdx = trimmed.indexOf(":");
      if (colonIdx !== -1) {
        const promptLabel = trimmed.slice(0, colonIdx + 1);
        const userContent = trimmed.slice(colonIdx + 1);
        return `<div><span class="journal-prompt-question">${escapeHtml(promptLabel)}</span><span class="journal-user-ink">${escapeHtml(userContent)}</span></div>`;
      }
      return `<div><span class="journal-prompt-question">${escapeHtml(trimmed)}</span></div>`;
    }

    const upper = trimmed.toUpperCase();

    // Section Headers (Only non-bullet lines)
    if (upper.includes("DAILY ROUTINE") || trimmed === "Daily Routine & Schedule") {
      return `<div class="journal-sec-header journal-sec-routine">${escapeHtml(trimmed)}</div>`;
    }
    if (upper.includes("STUDY & PREP") || upper.includes("STUDY LOG") || trimmed === "Study & Prep Log") {
      return `<div class="journal-sec-header journal-sec-study">${escapeHtml(trimmed)}</div>`;
    }
    if (upper.includes("HEALTH & EXPENSES") || upper.includes("HOSTEL, HEALTH") || trimmed === "Hostel, Health & Expenses") {
      return `<div class="journal-sec-header journal-sec-health">${escapeHtml(trimmed)}</div>`;
    }
    if (upper.includes("DISTRACTION") || upper.includes("FRICTION") || trimmed === "Distractions & Friction") {
      return `<div class="journal-sec-header journal-sec-distraction">${escapeHtml(trimmed)}</div>`;
    }
    if (upper.includes("NIGHT REVIEW") || upper.includes("TOMORROW'S PRIORITY") || trimmed === "Night Review & Tomorrow's Priority") {
      return `<div class="journal-sec-header journal-sec-night">${escapeHtml(trimmed)}</div>`;
    }
    
    // Custom Section Titles (e.g. A quiet check-in, Gratitude without gloss)
    if (trimmed.length > 3 && trimmed.length < 50 && !trimmed.includes(":") && !trimmed.endsWith(".")) {
      return `<div class="journal-sec-header journal-sec-routine">${escapeHtml(trimmed)}</div>`;
    }

    return `<div class="journal-user-ink">${escapeHtml(line)}</div>`;
  });

  return htmlLines.join("");
}

export default function JournalPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
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
  const editorRef = useRef<HTMLDivElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const writingTimer = useRef<number | null>(null);
  const router = useRouter();
  const { isDemoMode } = useDemoMode();
  const appFetch = useDemoFetch();
  const [isLocking, setIsLocking] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [isStickyToViewport, setIsStickyToViewport] = useState(true);
  const [activeTab, setActiveTab] = useState<"today" | "history">("today");
  const [selectedHistoryEntry, setSelectedHistoryEntry] = useState<JournalEntry | null>(null);
  const [selectedHistoryDate, setSelectedHistoryDate] = useState<string | null>(null);
  const [pinnedPrompt, setPinnedPrompt] = useState<PinnedPrompt>(DEFAULT_PINNED_PROMPT);
  const [pinnedDraft, setPinnedDraft] = useState<PinnedPrompt>(DEFAULT_PINNED_PROMPT);
  const [editingPinned, setEditingPinned] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("door_journal_pinned_prompt");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.title === "string" && typeof parsed.copy === "string") {
          // If stored template contains emojis or old generic placeholder, refresh to updated Indian student template
          if (parsed.title === "Daily Life Blueprint" || parsed.copy.includes("🌅") || parsed.copy.includes("Morning & Intentions")) {
            setPinnedPrompt(DEFAULT_PINNED_PROMPT);
            setPinnedDraft(DEFAULT_PINNED_PROMPT);
            localStorage.setItem("door_journal_pinned_prompt", JSON.stringify(DEFAULT_PINNED_PROMPT));
          } else {
            setPinnedPrompt(parsed);
            setPinnedDraft(parsed);
          }
        }
      }
    } catch {
      // fallback to default
    }
  }, []);

  const handleSavePinned = (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!pinnedDraft.title.trim() || !pinnedDraft.copy.trim()) {
      toast.error("Please provide both a title and template text.");
      return;
    }
    const updated: PinnedPrompt = {
      title: pinnedDraft.title.trim(),
      note: pinnedDraft.note.trim() || "What to log every day",
      copy: pinnedDraft.copy.trim(),
    };
    setPinnedPrompt(updated);
    try {
      localStorage.setItem("door_journal_pinned_prompt", JSON.stringify(updated));
    } catch {}
    setEditingPinned(false);
    toast.success("Pinned daily prompt updated permanently!");
  };

  const handleResetPinned = () => {
    setPinnedDraft(DEFAULT_PINNED_PROMPT);
    setPinnedPrompt(DEFAULT_PINNED_PROMPT);
    try {
      localStorage.removeItem("door_journal_pinned_prompt");
    } catch {}
    setEditingPinned(false);
    toast.success("Reset pinned prompt to default template.");
  };

  const checkScroll = useCallback(() => {
    const el = editorRef.current;
    if (!el || typeof window === "undefined") return;
    
    // Check if editor text is scrollable
    const canScrollDown = el.scrollHeight > el.clientHeight && el.scrollTop + el.clientHeight < el.scrollHeight - 10;
    setShowScrollDown(canScrollDown);
    
    // Check if bottom of the editor is off-screen
    const rect = el.getBoundingClientRect();
    const isBottomOffScreen = rect.bottom > window.innerHeight - 80;
    setIsStickyToViewport(isBottomOffScreen);
  }, []);

  const handleScrollDown = () => {
    const el = editorRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: "smooth",
    });
  };

  const handleDateChange = (selectedDateStr: string) => {
    setSelectedHistoryDate(selectedDateStr);
    if (!history) return;
    const entry = history.find(e => e.date === selectedDateStr);
    if (entry) {
      setSelectedHistoryEntry(entry);
    } else {
      setSelectedHistoryEntry(null);
    }
    setActiveTab("history");
  };

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const response = await appFetch("/api/journal?limit=30", { cache: "no-store" });
      const result = await response.json() as { entries?: JournalEntry[]; error?: string };
      if (!response.ok) throw new Error(result.error || "Journal history could not be loaded.");
      const loadedEntries = Array.isArray(result.entries) ? result.entries : [];
      setHistory(loadedEntries);
      
      setSelectedHistoryDate((currentDate) => {
        if (currentDate) return currentDate;
        
        // Always default to yesterday's date in local Asia/Kolkata timezone
        const nowInKolkata = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
        const yesterday = new Date(nowInKolkata);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
        
        // Find if there is a sealed entry for yesterday
        const yesterdayEntry = loadedEntries.find(e => e.date === yesterdayStr);
        setSelectedHistoryEntry(yesterdayEntry || null);
        
        return yesterdayStr;
      });
    } catch (loadError) {
      toast.error(loadError instanceof Error ? loadError.message : "Journal history could not be loaded.");
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  useEffect(() => {
    if (isDemoMode && typeof window !== "undefined" && localStorage.getItem("jujum-demo-journal-unlocked") !== "true") {
      router.push("/journal/unlock");
    }
  }, [isDemoMode, router]);

  useEffect(() => {
    router.prefetch("/journal/unlock");
  }, [router]);

  useEffect(() => () => { if (writingTimer.current) window.clearTimeout(writingTimer.current); }, []);

  useEffect(() => {
    checkScroll();
  }, [entryText, activeTab, selectedHistoryEntry, selectedHistoryDate, checkScroll]);

  useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    window.addEventListener("scroll", checkScroll, { passive: true });
    return () => {
      window.removeEventListener("resize", checkScroll);
      window.removeEventListener("scroll", checkScroll);
    };
  }, [checkScroll]);

  const updateWriting = (value: string) => {
    setEntryText(value.slice(0, 5000));
    setIsWriting(true);
    if (writingTimer.current) window.clearTimeout(writingTimer.current);
    writingTimer.current = window.setTimeout(() => setIsWriting(false), 650);
  };

  const insertPrompt = (copy: string) => {
    const updated = entryText && entryText.trim() ? `${entryText.trim()}\n\n${copy}\n` : `${copy}\n`;
    setEntryText(updated);
    if (editorRef.current) {
      editorRef.current.innerHTML = formatJournalTextToHTML(updated);
      editorRef.current.focus();
    }
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
      editorRef.current?.focus();
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await appFetch("/api/journal", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryText, mood, tags, studyDone, exerciseDone, readingDone }),
      });
      const result = await response.json() as JournalResponse;
      if (!response.ok || !result.journal) throw new Error(result.error || "Journal entry could not be saved.");
      setLastSavedTask(result.journal.tomorrowTask || "Your page is safely sealed for today.");
      setLastFeedback(result.journal.aiFeedback || "");
      setEntryText("");
      if (editorRef.current) editorRef.current.innerHTML = "";
      setTags([]);
      setStudyDone(false);
      setExerciseDone(false);
      setReadingDone(false);
      setHistory(null);
      void loadHistory();
      toast.success(result.success ? "Entry saved securely" : (result.friendlyMessage || "Entry saved securely"));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Your draft is still on this page — it was not discarded.");
    } finally {
      setLoading(false);
    }
  };

  const lockJournal = async () => {
    setIsLocking(true);
    await new Promise((resolve) => setTimeout(resolve, 1400));
    try {
      if (isDemoMode) {
        document.cookie = "jujum_demo_journal_unlocked=; path=/; max-age=0";
        localStorage.removeItem("jujum-demo-journal-unlocked");
      } else {
        await appFetch("/api/journal-auth", { method: "DELETE", cache: "no-store" });
        document.cookie = "jujum_journal_unlocked=; path=/; max-age=0";
        localStorage.removeItem("jujum-journal-unlocked");
      }
      window.dispatchEvent(new CustomEvent("journal-lock-change", { detail: { locked: true } }));
    } finally {
      router.replace("/journal/unlock");
      router.refresh();
    }
  };

  return (
    <AppShell>
      <motion.div 
        className="journal-workspace"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
          <div style={{ display: activeTab === 'today' ? 'flex' : 'none', flexDirection: 'column' }} className="flex-1 min-w-0 h-full overflow-hidden">
            <section className="journal-paper brand-fixed" aria-label="Private journal page">
              <div className="journal-paper-topline">
                <div>
                  <div className="flex gap-2 mb-3">
                    <button 
                      type="button" 
                      className={`journal-tab-btn ${activeTab === 'today' ? 'is-active' : ''}`}
                      onClick={() => setActiveTab('today')}
                    >
                      Today&apos;s Page
                    </button>
                    <button 
                      type="button" 
                      className={`journal-tab-btn ${activeTab === 'history' ? 'is-active' : ''}`}
                      onClick={() => setActiveTab('history')}
                    >
                      Past Page
                    </button>
                  </div>
                  <h2 suppressHydrationWarning>{new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" }).format(new Date())}</h2>
                </div>
                <div className="flex items-center gap-3">
                  <span className="journal-privacy-seal">Private</span>
                  <button type="button" onClick={lockJournal} className="journal-lock-button focus-ring">
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor" 
                      strokeWidth="2.2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      className="w-3.5 h-3.5" 
                      aria-hidden="true"
                      style={{ overflow: "visible" }}
                    >
                      <path className="lock-shackle" d="M8 10V6.5a4 4 0 0 1 8 0V10" />
                      <rect x="5" y="10" width="14" height="10.5" rx="2.5" />
                      <rect x="7" y="9" width="2" height="1.2" rx="0.4" fill="currentColor" stroke="none" />
                      <rect x="15" y="9" width="2" height="1.2" rx="0.4" fill="currentColor" stroke="none" />
                      <circle cx="7.5" cy="12.5" r="0.45" fill="currentColor" stroke="none" opacity="0.75" />
                      <circle cx="16.5" cy="12.5" r="0.45" fill="currentColor" stroke="none" opacity="0.75" />
                      <circle cx="7.5" cy="18" r="0.45" fill="currentColor" stroke="none" opacity="0.75" />
                      <circle cx="16.5" cy="18" r="0.45" fill="currentColor" stroke="none" opacity="0.75" />
                      <rect x="6.8" y="11.8" width="10.4" height="6.9" rx="1.5" stroke="currentColor" strokeWidth="0.6" strokeOpacity="0.35" />
                      <circle cx="12" cy="15.2" r="2.8" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.5" />
                      <circle cx="12" cy="14.6" r="0.8" fill="currentColor" stroke="none" />
                      <path d="M11.5 15.2l1 0l-0.3 1.8l-0.4 0z" fill="currentColor" stroke="none" />
                    </svg>
                    <span>Lock</span>
                  </button>
                </div>
              </div>

              <form onSubmit={submit} className="journal-paper-form-like">
                {/* Mood Selection at Top */}
                <div className="journal-stamp-row" aria-label="How did today feel?">
                  <span className="journal-meta-label">Mood</span>
                  {moods.map((item) => (
                    <button 
                      key={item.value} 
                      type="button" 
                      aria-pressed={mood === item.value} 
                      onClick={() => setMood(item.value)} 
                      className={`journal-stamp focus-ring ${mood === item.value ? "is-selected" : ""}`}
                    >
                      <span aria-hidden="true" className="flex items-center text-inherit">{moodIcons[item.value]}</span>
                      {item.label}
                    </button>
                  ))}
                </div>

                {/* Expanded Writing Section */}
                <div className="journal-writing-area">
                  <div
                    id="entryText"
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={(e) => updateWriting(e.currentTarget.innerText)}
                    onScroll={checkScroll}
                    data-placeholder="There is no right way to begin. Start with what is true today..."
                    className={`journal-textarea ${error ? "is-error" : ""}`}
                    aria-describedby={error ? "journal-error" : undefined}
                  />
                  <AnimatePresence>
                    {showScrollDown && (
                      <motion.button
                        type="button"
                        onClick={handleScrollDown}
                        className={`journal-scroll-down-btn focus-ring ${isStickyToViewport ? "is-floating" : "is-docked"}`}
                        initial={{ opacity: 0, y: 10, scale: 0.8, x: "-50%" }}
                        animate={{ opacity: 1, y: 0, scale: 1, x: "-50%" }}
                        exit={{ opacity: 0, y: 10, scale: 0.8, x: "-50%" }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        aria-label="Scroll to bottom"
                      >
                        <svg
                           xmlns="http://www.w3.org/2000/svg"
                           fill="none"
                           viewBox="0 0 24 24"
                           stroke="currentColor"
                           strokeWidth="2.5"
                           className="w-3.5 h-3.5 text-inherit"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m0 0l-4-4m4 4l4-4" />
                        </svg>
                      </motion.button>
                    )}
                  </AnimatePresence>
                </div>

                {/* Fixed Floating Bottom Controls Overlay */}
                <div className="journal-bottom-overlay">
                  {/* Line 1: Marks */}
                  <div className="journal-activity-row" aria-label="Activity stamps">
                    <span className="journal-meta-label">Marks</span>
                    {activityStamps.map((activity) => {
                      const checked = activityValue(activity.key);
                      return (
                        <button 
                          key={activity.key} 
                          type="button" 
                          aria-pressed={checked} 
                          onClick={() => updateActivity(activity.key, !checked)} 
                          className={`journal-activity-stamp focus-ring ${checked ? "is-marked" : ""}`}
                        >
                          <span aria-hidden="true" className="flex items-center text-inherit">{activityIcons[activity.key]}</span>
                          {activity.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Line 2: Tags on left, Seal button on right */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="journal-tag-row" aria-label="Context tags">
                      <span className="journal-meta-label">Tags</span>
                      {['Sleep', 'Phone', 'Social', 'Work', 'Leisure', 'Other'].map((tag) => (
                        <button 
                          key={tag} 
                          type="button" 
                          aria-pressed={tags.includes(tag)} 
                          onClick={() => toggleTag(tag)} 
                          className={`journal-tag focus-ring ${tags.includes(tag) ? "is-selected" : ""}`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>

                    <div className="journal-submit-controls shrink-0">
                      <MicroInteractionButton 
                        type="submit" 
                        loading={loading} 
                        disabled={entryText.trim().length < 20} 
                        className="journal-save-button"
                      >
                        Seal today&apos;s page
                      </MicroInteractionButton>
                    </div>
                  </div>
                </div>
                {error ? <p id="journal-error" className="journal-error" role="alert">{error}</p> : null}
              </form>
            </section>
          </div>

          <div style={{ display: activeTab === 'history' ? 'flex' : 'none', flexDirection: 'column' }} className="flex-1 min-h-0 h-full overflow-hidden">
            <section className="journal-paper brand-fixed" aria-label="Selected past journal page">
              <div className="journal-paper-topline">
                <div>
                  <div className="flex gap-2 mb-3">
                    <button 
                      type="button" 
                      className={`journal-tab-btn ${activeTab === 'today' ? 'is-active' : ''}`}
                      onClick={() => setActiveTab('today')}
                    >
                      Today&apos;s Page
                    </button>
                    <button 
                      type="button" 
                      className={`journal-tab-btn ${activeTab === 'history' ? 'is-active' : ''}`}
                      onClick={() => setActiveTab('history')}
                    >
                      Past Page
                    </button>
                  </div>
                  {selectedHistoryDate ? (
                    <div className="journal-date-selector-wrapper relative inline-block">
                      <div className="journal-date-display flex items-center gap-1.5">
                        <span className="font-semibold">{formatDate(selectedHistoryDate)}</span>
                        <svg className="w-3.5 h-3.5 text-[#8b6e48]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                      <input 
                        type="date"
                        ref={dateInputRef}
                        aria-label="Pick journal date"
                        value={selectedHistoryDate}
                        onChange={(e) => {
                          if (e.target.value) handleDateChange(e.target.value);
                        }}
                        className="journal-date-input"
                      />
                    </div>
                  ) : (
                    <h2>No past page selected</h2>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="journal-privacy-seal" style={{ borderColor: "#826451", color: "#826451" }}>Sealed</span>
                </div>
              </div>

              <div className="journal-paper-form-like">
                {/* Mood View at Top */}
                <div className="journal-stamp-row" aria-label="Selected day mood">
                  <span className="journal-meta-label">Mood</span>
                  {moods.map((item) => {
                    const isSelected = selectedHistoryEntry?.mood === item.value;
                    return (
                      <button 
                        key={item.value} 
                        type="button" 
                        disabled
                        aria-pressed={isSelected} 
                        className={`journal-stamp focus-ring ${isSelected ? "is-selected" : ""}`}
                      >
                        <span aria-hidden="true" className="flex items-center text-inherit">{moodIcons[item.value]}</span>
                        {item.label}
                      </button>
                    );
                  })}
                </div>

                <div className="journal-writing-area">
                  {selectedHistoryEntry ? (
                    <div
                      dangerouslySetInnerHTML={{ __html: formatJournalTextToHTML(selectedHistoryEntry.entryText) }}
                      className="journal-textarea read-only"
                    />
                  ) : (
                    <div className="journal-empty-paper-state">
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor" 
                        strokeWidth="1.5" 
                        className="w-8 h-8 opacity-40 mb-3"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <p>No journal page was sealed on this date.</p>
                    </div>
                  )}
                </div>

                {/* Fixed Floating Bottom Controls Overlay */}
                <div className="journal-bottom-overlay">
                  {/* Line 1: Marks */}
                  <div className="journal-activity-row" aria-label="Activity stamps">
                    <span className="journal-meta-label">Marks</span>
                    {activityStamps.map((activity) => {
                      const checked = selectedHistoryEntry ? !!selectedHistoryEntry[activity.key] : false;
                      return (
                        <button 
                          key={activity.key} 
                          type="button" 
                          disabled
                          aria-pressed={checked} 
                          className={`journal-activity-stamp focus-ring ${checked ? "is-marked" : ""}`}
                        >
                          <span aria-hidden="true" className="flex items-center text-inherit">{activityIcons[activity.key]}</span>
                          {activity.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Line 2: Tags on left, Back button on right */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="journal-tag-row" aria-label="Context tags">
                      <span className="journal-meta-label">Tags</span>
                      {['Sleep', 'Phone', 'Social', 'Work', 'Leisure', 'Other'].map((tag) => {
                        const isSelected = selectedHistoryEntry?.tags.includes(tag) || false;
                        return (
                          <button 
                            key={tag} 
                            type="button" 
                            disabled
                            aria-pressed={isSelected} 
                            className={`journal-tag focus-ring ${isSelected ? "is-selected" : ""}`}
                          >
                            {tag}
                          </button>
                        );
                      })}
                    </div>

                    <div className="journal-submit-controls shrink-0">
                      <button
                        type="button"
                        onClick={() => setActiveTab("today")}
                        className="journal-save-button focus-ring"
                        style={{ background: "#826451", borderColor: "#826451", boxShadow: "2px 2px 0 #eadbc1" }}
                      >
                        Back to Today
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>

        <aside className="journal-sidebar" aria-label="Journal tools and history">
          <section className="journal-drawer" aria-label="Prompt sheets">
            <div className="journal-drawer-heading flex items-center justify-between">
              <p className="journal-panel-kicker" style={{ margin: 0 }}>Prompt sheets</p>
            </div>
            <div className="journal-prompt-list">
              {/* Top Pinned Daily Life Prompt */}
              <div className="journal-pinned-card group">
                <div className="flex items-center justify-between gap-2">
                  <div
                    onClick={() => insertPrompt(pinnedPrompt.copy)}
                    className="flex items-center gap-1.5 cursor-pointer min-w-0"
                    title="Click to insert into editor"
                  >
                    <svg className="h-3.5 w-3.5 text-[var(--accent)] shrink-0" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5v6l1 1 1-1v-6h5v-2l-2-2z" />
                    </svg>
                    <strong className="text-sm font-bold tracking-tight text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors truncate">
                      {pinnedPrompt.title}
                    </strong>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPinnedDraft(pinnedPrompt);
                      setEditingPinned(true);
                    }}
                    className="focus-ring flex h-6 w-6 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-[var(--bg-card)] transition cursor-pointer shrink-0"
                    aria-label="Edit template"
                    title="Edit daily template"
                  >
                    <svg className="h-3.5 w-3.5 transition-transform duration-200 hover:scale-110" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                </div>

                {/* Compact Preview */}
                <div 
                  onClick={() => insertPrompt(pinnedPrompt.copy)}
                  className="mt-1.5 cursor-pointer"
                  title="Click to insert into editor"
                >
                  <p 
                    className="line-clamp-2 text-[11px] leading-relaxed text-[var(--text-secondary)] whitespace-pre-line opacity-85"
                    style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", serif' }}
                  >
                    {pinnedPrompt.copy}
                  </p>
                </div>

                <div className="mt-2 flex items-center justify-between border-t border-[var(--border)] pt-2">
                  <span className="text-[10px] font-medium text-[var(--text-secondary)] truncate max-w-[140px]">
                    {pinnedPrompt.note || "Campus & routine log"}
                  </span>
                  <button
                    type="button"
                    onClick={() => insertPrompt(pinnedPrompt.copy)}
                    className="focus-ring inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 py-0.5 text-[10.5px] font-semibold text-[var(--text-primary)] hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-[var(--bg-card)] transition cursor-pointer"
                  >
                    <span>+ Use</span>
                  </button>
                </div>
              </div>

              {/* Standard Prompt Sheets */}
              {promptSheets.map((sheet) => (
                <button
                  type="button"
                  key={sheet.title}
                  onClick={() => insertPrompt(sheet.copy)}
                  className="journal-prompt-card focus-ring"
                >
                  <span>{sheet.note}</span>
                  <strong>{sheet.title}</strong>
                  <i aria-hidden="true">Add +</i>
                </button>
              ))}
            </div>
          </section>

          <section className="journal-history-panel" aria-label="Journal timeline">
            <div className="journal-history-heading">
              <div>
                <p className="journal-panel-kicker">Past pages</p>
                <h2>Journal timeline</h2>
              </div>
              <button type="button" className="journal-refresh focus-ring" onClick={() => void loadHistory()} disabled={historyLoading}>
                Refresh
              </button>
            </div>
            {historyLoading && !history ? (
              <div className="journal-history-loading"><i /><i /><i /></div>
            ) : history?.length ? (
              <div className="journal-timeline" role="region" aria-label="Past pages timeline" tabIndex={0}>
                {history.map((entry) => (
                  <details key={entry.journalId} className="journal-history-entry">
                    <summary className="focus-ring">
                      <span className="journal-history-dot" />
                      <div>
                        <time>{formatDate(entry.date)}</time>
                        <p>{entry.entryText}</p>
                      </div>
                    </summary>
                    <div className="journal-history-content">
                      <p>{entry.entryText}</p>
                      {entry.tomorrowTask ? <div><span>Next small promise</span>{entry.tomorrowTask}</div> : null}
                      <button
                        type="button"
                        className="journal-tab-btn mt-2"
                        style={{ fontSize: "0.58rem", padding: "0.22rem 0.45rem", minHeight: "0" }}
                        onClick={() => {
                          setSelectedHistoryEntry(entry);
                          setSelectedHistoryDate(entry.date);
                          setActiveTab("history");
                        }}
                      >
                        View on paper
                      </button>
                    </div>
                  </details>
                ))}
              </div>
            ) : (
              <p className="journal-history-empty">Your first page will begin this little timeline.</p>
            )}
          </section>
        </aside>
      </motion.div>

      {/* Lock screen overlay transition */}

      {mounted && typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {isLocking && (
            <motion.div
              className="fixed inset-0 z-[99999] flex flex-col items-center justify-center text-[var(--text-primary)] bg-[var(--bg-page)] overflow-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.2, ease: "easeInOut" }}
            >
              {/* Grain/Texture Overlay */}
              <div 
                className="absolute inset-0 pointer-events-none opacity-[0.055] mix-blend-overlay"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`
                }}
              />
              
              {/* Subtle Vignette */}
              <div 
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: "radial-gradient(circle at center, transparent 30%, rgba(0,0,0,0.1) 100%)"
                }}
              />

              <div className="relative flex flex-col items-center justify-center">
                {/* SVG Lock Icon animating: grows in center, snaps closed, and holds its state */}
                <motion.div
                  style={{ transformOrigin: "24px 24px" }}
                  initial={{ scale: 0.15, y: 120, opacity: 0 }}
                  animate={{ scale: 2.5, y: 0, opacity: 1 }}
                  transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
                >
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor" 
                    strokeWidth="1.8" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    className="w-12 h-12 text-[var(--accent)]"
                    style={{ overflow: "visible" }}
                  >
                    {/* Animatable lock shackle */}
                    <motion.path 
                      className="lock-shackle"
                      d="M8 10V6.5a4 4 0 0 1 8 0V10"
                      style={{ transformOrigin: "16px 10px" }}
                      initial={{ y: -2.5, rotate: -22 }}
                      animate={{ y: 0, rotate: 0 }}
                      transition={{ delay: 0.5, type: "spring", stiffness: 120, damping: 12 }}
                    />
                    
                    {/* Lock Body */}
                    <rect x="5" y="10" width="14" height="10.5" rx="2.5" />
                    
                    {/* Shackle Collars (Shoulders) */}
                    <rect x="7" y="9" width="2" height="1.2" rx="0.4" fill="currentColor" stroke="none" />
                    <rect x="15" y="9" width="2" height="1.2" rx="0.4" fill="currentColor" stroke="none" />
                    
                    {/* Decorative Rivets in 4 corners */}
                    <circle cx="7.5" cy="12.5" r="0.45" fill="currentColor" stroke="none" opacity="0.75" />
                    <circle cx="16.5" cy="12.5" r="0.45" fill="currentColor" stroke="none" opacity="0.75" />
                    <circle cx="7.5" cy="18" r="0.45" fill="currentColor" stroke="none" opacity="0.75" />
                    <circle cx="16.5" cy="18" r="0.45" fill="currentColor" stroke="none" opacity="0.75" />
                    
                    {/* Inner Panel Bevel */}
                    <rect x="6.8" y="11.8" width="10.4" height="6.9" rx="1.5" stroke="currentColor" strokeWidth="0.6" strokeOpacity="0.35" />
                    
                    {/* Center Keyhole Medallion Ring */}
                    <circle cx="12" cy="15.2" r="2.8" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.5" />
                    
                    {/* Vintage Keyhole */}
                    <circle cx="12" cy="14.6" r="0.8" fill="currentColor" stroke="none" />
                    <path d="M11.5 15.2l1 0l-0.3 1.8l-0.4 0z" fill="currentColor" stroke="none" />
                  </svg>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      <AnimatePresence>
        {editingPinned && (
          <PinnedPromptEditModal
            draft={pinnedDraft}
            onChange={setPinnedDraft}
            onClose={() => setEditingPinned(false)}
            onSave={handleSavePinned}
            onReset={handleResetPinned}
          />
        )}
      </AnimatePresence>
    </AppShell>
  );
}

function PinnedPromptEditModal({
  draft,
  onChange,
  onClose,
  onSave,
  onReset,
}: {
  draft: PinnedPrompt;
  onChange: React.Dispatch<React.SetStateAction<PinnedPrompt>>;
  onClose: () => void;
  onSave: (e?: FormEvent) => void;
  onReset: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md overflow-y-auto sm:p-6"
    >
      <motion.form
        initial={{ opacity: 0, y: 12, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.96 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={onSave}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pinned-prompt-title"
        className="my-auto w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--accent)]">PINNED PROMPT SHEET</p>
            <h2 id="pinned-prompt-title" className="mt-1 text-lg font-semibold tracking-tight text-[var(--text-primary)]">
              Edit Daily Reflection Template
            </h2>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Customize what you log each day. Changes are permanently stored on your device.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="focus-ring grid h-8 w-8 place-items-center rounded-md border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] cursor-pointer"
            aria-label="Close"
          >
            <span className="text-base leading-none">×</span>
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--text-secondary)]">Template Title</span>
              <input
                required
                value={draft.title}
                onChange={(e) => onChange((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="e.g. Daily Life"
                className="app-input h-10 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 text-xs font-medium text-[var(--text-primary)] outline-none"
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--text-secondary)]">Subtitle / Note</span>
              <input
                value={draft.note}
                onChange={(e) => onChange((prev) => ({ ...prev, note: e.target.value }))}
                placeholder="e.g. What to log every day"
                className="app-input h-10 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 text-xs font-medium text-[var(--text-primary)] outline-none"
              />
            </label>
          </div>

          <label className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--text-secondary)]">Prompt Format & Questions</span>
              <span className="text-[10px] text-[var(--text-secondary)]">Supports structured sections & bullet points</span>
            </div>
            <textarea
              required
              rows={11}
              value={draft.copy}
              onChange={(e) => onChange((prev) => ({ ...prev, copy: e.target.value }))}
              placeholder="What questions should guide your daily journaling?"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-3 font-mono text-xs text-[var(--text-primary)] leading-relaxed placeholder:text-[var(--text-faint)] outline-none resize-y"
            />
          </label>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
          <button
            type="button"
            onClick={onReset}
            className="focus-ring rounded-lg border border-transparent px-2.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
          >
            Reset to Default
          </button>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="focus-ring rounded-lg border border-[var(--border)] px-3.5 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="focus-ring rounded-lg bg-[var(--text-primary)] px-4 py-2 text-xs font-semibold text-[var(--bg-card)] hover:opacity-90 transition cursor-pointer"
            >
              Save Permanently
            </button>
          </div>
        </div>
      </motion.form>
    </motion.div>,
    document.body
  );
}
