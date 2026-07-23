"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { MicroInteractionButton } from "@/components/MotionComponents";
import { motion, AnimatePresence } from "motion/react";

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const writingTimer = useRef<number | null>(null);
  const router = useRouter();
  const [isLocking, setIsLocking] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [isStickyToViewport, setIsStickyToViewport] = useState(true);
  const [activeTab, setActiveTab] = useState<"today" | "history">("today");
  const [selectedHistoryEntry, setSelectedHistoryEntry] = useState<JournalEntry | null>(null);
  const [selectedHistoryDate, setSelectedHistoryDate] = useState<string | null>(null);

  const checkScroll = useCallback(() => {
    const el = textareaRef.current;
    if (!el || typeof window === "undefined") return;
    
    // Check if textarea text is scrollable
    const canScrollDown = el.scrollHeight > el.clientHeight && el.scrollTop + el.clientHeight < el.scrollHeight - 10;
    setShowScrollDown(canScrollDown);
    
    // Check if bottom of the textarea is off-screen
    const rect = el.getBoundingClientRect();
    const isBottomOffScreen = rect.bottom > window.innerHeight - 80;
    setIsStickyToViewport(isBottomOffScreen);
  }, []);

  const handleScrollDown = () => {
    const el = textareaRef.current;
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
      const response = await fetch("/api/journal?limit=30", { cache: "no-store" });
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
        body: JSON.stringify({ entryText, mood, tags, studyDone, exerciseDone, readingDone }),
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
      setError(submitError instanceof Error ? submitError.message : "Your draft is still on this page — it was not discarded.");
    } finally {
      setLoading(false);
    }
  };

  const lockJournal = async () => {
    setIsLocking(true);
    await new Promise((resolve) => setTimeout(resolve, 1400));
    try {
      await fetch("/api/journal-auth", { method: "DELETE", cache: "no-store" });
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
        <div className="flex-1 min-w-0 flex flex-col h-full">
          <div style={{ display: activeTab === 'today' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }} className="flex-1 min-h-0">
            <section className="journal-paper brand-fixed" aria-label="Private journal page" style={{ height: '100%' }}>
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

                <div className="journal-writing-area">
                  <textarea
                    id="entryText"
                    ref={textareaRef}
                    value={entryText}
                    onChange={(event) => updateWriting(event.target.value)}
                    onScroll={checkScroll}
                    placeholder="There is no right way to begin. Start with what is true today..."
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

                <div className="journal-paper-footer">
                  <div className="journal-ink-status" aria-live="polite"><span className={isWriting ? "is-writing" : ""} />{isWriting ? "Ink settling..." : `${entryText.length} / 5000`}</div>
                  <div className="journal-submit-controls"><MicroInteractionButton type="submit" loading={loading} disabled={entryText.trim().length < 20} className="journal-save-button">Seal today&apos;s page</MicroInteractionButton></div>
                </div>
                {error ? <p id="journal-error" className="journal-error" role="alert">{error}</p> : null}
              </form>

              <div className="journal-activity-row" aria-label="Activity stamps">
                <span className="journal-meta-label">Today&apos;s marks</span>
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
              <div className="journal-tag-row" aria-label="Context tags">
                {['Sleep', 'Phone', 'Social', 'Work', 'Leisure', 'Other'].map((tag) => <button key={tag} type="button" aria-pressed={tags.includes(tag)} onClick={() => toggleTag(tag)} className={`journal-tag focus-ring ${tags.includes(tag) ? "is-selected" : ""}`}>{tag}</button>)}
              </div>
            </section>
          </div>

          <div style={{ display: activeTab === 'history' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }} className="flex-1 min-h-0">
            <section className="journal-paper brand-fixed" aria-label="Selected past journal page" style={{ height: '100%' }}>
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
                        <h2>
                          {new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" }).format(new Date(`${selectedHistoryDate}T12:00:00+05:30`))}
                        </h2>
                        <svg 
                          xmlns="http://www.w3.org/2000/svg" 
                          fill="none" 
                          viewBox="0 0 24 24" 
                          stroke="currentColor" 
                          strokeWidth="2.5" 
                          className="w-3.5 h-3.5 opacity-60 mt-0.5"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                        </svg>
                      </div>
                      <input
                        ref={dateInputRef}
                        type="date"
                        value={selectedHistoryDate}
                        onChange={(e) => {
                          if (e.target.value) {
                            handleDateChange(e.target.value);
                          }
                        }}
                        className="journal-calendar-picker-input"
                        aria-label="Choose page date"
                      />
                    </div>
                  ) : (
                    <h2>Select Date</h2>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="journal-privacy-seal" style={{ borderColor: "#826451", color: "#826451" }}>Sealed</span>
                </div>
              </div>

              <div className="journal-paper-form-like">
                <div className="journal-stamp-row" aria-label="How did that day feel?">
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
                    <textarea
                      readOnly
                      value={selectedHistoryEntry.entryText}
                      placeholder="No text written."
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

                <div className="journal-paper-footer">
                  <div className="journal-ink-status">
                    {selectedHistoryEntry ? (
                      <>
                        <span style={{ display: "inline-block", width: "6px", height: "6px", borderRadius: "50%", background: "#47745d", marginRight: "6px" }} />
                        Sealed Page
                      </>
                    ) : (
                      <>
                        <span style={{ display: "inline-block", width: "6px", height: "6px", borderRadius: "50%", background: "#a3413d", marginRight: "6px" }} />
                        Empty Page
                      </>
                    )}
                  </div>
                  <div className="journal-submit-controls">
                    <button
                      type="button"
                      onClick={() => setActiveTab("today")}
                      className="journal-save-button focus-ring"
                      style={{ background: "#826451", borderColor: "#826451", boxShadow: "3px 3px 0 #eadbc1" }}
                    >
                      Back to Today
                    </button>
                  </div>
                </div>
              </div>

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
              <div className="journal-tag-row" aria-label="Context tags">
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
            </section>
          </div>
        </div>

        <aside className="journal-sidebar" aria-label="Journal tools and history">
          <section className="journal-drawer">
            <div className="journal-drawer-heading">
              <p className="journal-panel-kicker" style={{ margin: 0 }}>Prompt sheets</p>
            </div>
            <div className="journal-prompt-list">
              {promptSheets.map((sheet) => <button type="button" key={sheet.title} onClick={() => insertPrompt(sheet.copy)} className="journal-prompt-card focus-ring"><span>{sheet.note}</span><strong>{sheet.title}</strong><i aria-hidden="true">Add +</i></button>)}
            </div>
          </section>

          <section className="journal-history-panel">
            <div className="journal-history-heading"><div><p className="journal-panel-kicker">Past pages</p><h2>Journal timeline</h2></div><button type="button" className="journal-refresh focus-ring" onClick={() => void loadHistory()} disabled={historyLoading}>Refresh</button></div>
            {historyLoading && !history ? <div className="journal-history-loading"><i /><i /><i /></div> : history?.length ? <div className="journal-timeline">
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
            </div> : <p className="journal-history-empty">Your first page will begin this little timeline.</p>}
          </section>
        </aside>
      </motion.div>

      {/* Lock screen overlay transition */}

      <AnimatePresence>
        {isLocking && (
          <motion.div
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center text-[var(--text-primary)] bg-[var(--bg-page)] overflow-hidden"
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
      </AnimatePresence>
    </AppShell>
  );
}
