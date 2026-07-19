"use client";

import Image from "next/image";
import { useEffect, useState, useMemo, ReactNode } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { AppShell } from "@/components/AppShell";
import { MicroInteractionButton } from "@/components/MotionComponents";
import { AiMarkdown } from "@/components/AiMarkdown";
import { ModelSelector, AiSelection } from "@/components/ModelSelector";

interface Section {
  id: string;
  title: string;
  type: "text" | "formula" | "table" | "hierarchy" | "alert";
  content: string;
  data?: any;
  collapsed?: boolean;
}

interface QuizQuestion {
  question: string;
  options: string[];
  answer: number;
}

interface Explanation {
  session: {
    topic: string;
    difficulty: string;
    exam_tags: string[];
    prerequisites: string[];
    next_topics: string[];
  };
  layout?: "sections" | "essay";
  overview: string;
  sections: Section[];
  follow_up_questions: string[];
  quiz?: QuizQuestion[];
  off_syllabus?: boolean;
}

interface ApiResponse {
  data?: any;
  error?: string;
  details?: string;
  ocrExtracted?: string | null;
}

interface ThreadItem {
  query: string;
  explanation: Explanation;
}

const suggestedPrompts = [
 "Explain entropy and irreversibility",
 "Mohr’s circle for plane stress",
 "Boundary layer separation",
 "Vapour compression refrigeration cycle",
 "Casting defects and remedies",
];

interface LearningStyle {
  id: string;
  label: string;
  icon: ReactNode;
}

const learningStyles: LearningStyle[] = [
  { id: "Exam Focus", label: "Exam Focus", icon: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <circle cx="12" cy="12" r="10"></circle>
      <circle cx="12" cy="12" r="5"></circle>
      <circle cx="12" cy="12" r="2"></circle>
    </svg>
  )},
  { id: "Beginner", label: "Beginner", icon: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  )},
  { id: "Interview", label: "Interview", icon: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  )},
  { id: "Mathematical", label: "Mathematical", icon: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  )},
  { id: "Visual", label: "Visual", icon: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )},
  { id: "Research", label: "Research", icon: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  )},
];

const formatCell = (value: unknown) => {
  if (value === null || value === undefined) return "";
  let cleaned = String(value).trim();

  // If already fully wrapped in $, keep it
  if (cleaned.startsWith("$") && cleaned.endsWith("$")) return cleaned;

  // Clean some legacy/raw representations
  cleaned = cleaned.replace(/\bneq\b/g, "\\neq");
  cleaned = cleaned.replace(/\beq\b/g, "=");

  // Math words to ignore when checking if a string has normal words
  const mathWords = /^(sin|cos|tan|log|ln|lim|max|min|deg|rev|gen|sys|surr|univ|exp|div|grad|curl|var|neq|eq)$/i;
  
  // Find words of 3 or more letters
  const words = cleaned.match(/\b[a-zA-Z]{3,}\b/g) || [];
  const hasTextWords = words.some(w => !mathWords.test(w));

  // A pure formula contains LaTeX commands, or has no standard text words but contains math symbols
  const isPureFormula = !hasTextWords && (
    cleaned.includes("\\") || 
    (/^[a-zA-Z0-9\s\+\-\*\/\=\(\)\{\}\[\]\_\^\<\>\.\,\:\;]+$/.test(cleaned) && 
     ["_", "^", "=", "<", ">", "|"].some(token => cleaned.includes(token)))
  );

  if (isPureFormula) {
    return `$${cleaned}$`;
  }

  // It's a mixed sentence. Let's selectively wrap standard math patterns
  let formatted = cleaned;

  // 1. Standalone variables with subscripts/superscripts (e.g. S_{gen}, T_1, c_v, dS_{gen})
  // Match 1-3 letters, followed by underscore/caret and curly braces or single character
  formatted = formatted.replace(/(?<!\$)\b([a-zA-Z]{1,3})_\{([a-zA-Z0-9]+)\}\b(?!\$)/g, '$$$1_{$2}$$');
  formatted = formatted.replace(/(?<!\$)\b([a-zA-Z]{1,3})_([a-zA-Z0-9])\b(?!\$)/g, '$$$1_$2$$');
  formatted = formatted.replace(/(?<!\$)\b([a-zA-Z]{1,3})\^\{([a-zA-Z0-9]+)\}\b(?!\$)/g, '$$$1^{$2}$$');
  formatted = formatted.replace(/(?<!\$)\b([a-zA-Z]{1,3})\^([a-zA-Z0-9])\b(?!\$)/g, '$$$1^$2$$');

  // 2. Simple comparison/equality statements within normal text (e.g. S_{gen} = 0, S_gen > 0)
  formatted = formatted.replace(/(?<!\$)\b([a-zA-Z]{1,3})_\{([a-zA-Z0-9]+)\}\s*([=><])\s*([0-9a-zA-Z]+)\b(?!\$)/g, '$$$1_{$2} $3 $4$$');
  formatted = formatted.replace(/(?<!\$)\b([a-zA-Z]{1,3})_([a-zA-Z0-9])\s*([=><])\s*([0-9a-zA-Z]+)\b(?!\$)/g, '$$$1_$2 $3 $4$$');

  return formatted;
};

function normalizeRows(rows: unknown): string[][] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    if (Array.isArray(row)) return row.map((cell) => formatCell(cell));
    if (row && typeof row === "object") return Object.values(row as Record<string, unknown>).map((cell) => formatCell(cell));
    return [formatCell(row)];
  }).filter((row) => row.some((cell) => cell.trim().length > 0));
}

function normalizeHeaders(headers: unknown, rows: string[][]) {
  if (Array.isArray(headers)) return headers.map((cell) => formatCell(cell));
  if (headers && typeof headers === "object") return Object.values(headers as Record<string, unknown>).map((cell) => formatCell(cell));
  
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
  return Array.from({ length: width }, (_, index) => `Column ${index + 1}`);
}

function normalizeChildren(children: unknown) {
  if (Array.isArray(children)) return children.map((child) => formatCell(child)).filter(Boolean);
  if (children === null || children === undefined) return [];
  return [formatCell(children)];
}

function normalizeApiResponse(raw: any): Explanation {
  if (!raw) {
    throw new Error("No explanation data was returned.");
  }

  // Extract direct content string fallback for maximum AI output formatting freedom
  const directContent = raw.content || raw.explanation || raw.explanation_markdown;
  if (typeof directContent === "string") {
    const topic = raw.concept || raw.session?.topic || "Engineering Concept";
    const session = {
      topic,
      difficulty: raw.session?.difficulty || raw.metadata?.difficulty || "Medium",
      exam_tags: raw.session?.exam_tags || raw.metadata?.related_subjects || ["GATE", "PSU"],
      prerequisites: raw.session?.prerequisites || raw.metadata?.prerequisites || [],
      next_topics: raw.session?.next_topics || []
    };

    return {
      session,
      layout: raw.layout || "essay",
      overview: raw.overview || raw.summary || "",
      sections: [
        {
          id: "main-content",
          title: "",
          type: "text",
          content: directContent,
          data: null
        }
      ],
      follow_up_questions: Array.isArray(raw.follow_up_questions)
        ? raw.follow_up_questions
        : (Array.isArray(raw.suggestions) ? raw.suggestions : []),
      quiz: Array.isArray(raw.quiz) ? raw.quiz : [],
      off_syllabus: Boolean(raw.off_syllabus)
    };
  }

  // Already matches the new rich schema
  if (raw.session && raw.sections && Array.isArray(raw.sections)) {
    return {
      ...raw,
      layout: raw.layout || "sections",
      sections: raw.sections.map((b: any, idx: number) => ({
        id: b.id || `section-${idx}`,
        title: typeof b.title === "string" ? b.title : "Section",
        type: b.type || "text",
        content: b.content || "",
        data: b.data || null,
        collapsed: b.collapsed !== undefined ? Boolean(b.collapsed) : undefined
      }))
    } as Explanation;
  }

  // Handle older or mixed schema fallback gracefully
  const topic = raw.concept || raw.session?.topic || "Engineering Concept";
  const session = {
    topic,
    difficulty: raw.session?.difficulty || raw.metadata?.difficulty || "Medium",
    exam_tags: raw.session?.exam_tags || raw.metadata?.related_subjects || ["GATE", "PSU"],
    prerequisites: raw.session?.prerequisites || raw.metadata?.prerequisites || [],
    next_topics: raw.session?.next_topics || []
  };

  const overview = raw.summary || raw.overview || "";
  
  const rawSections = Array.isArray(raw.sections) ? raw.sections : (Array.isArray(raw.blocks) ? raw.blocks : []);
  const sections: Section[] = rawSections.map((b: any, idx: number) => ({
    id: b.id || `section-${idx}`,
    title: typeof b.title === "string" ? b.title : "Section",
    type: b.type || "text",
    content: b.content || "",
    data: b.data || null,
    collapsed: b.collapsed !== undefined ? Boolean(b.collapsed) : undefined
  }));

  const follow_up_questions = Array.isArray(raw.follow_up_questions)
    ? raw.follow_up_questions
    : (Array.isArray(raw.suggestions) ? raw.suggestions : []);

  const quiz = Array.isArray(raw.quiz) ? raw.quiz : [];

  return {
    session,
    layout: raw.layout || "sections",
    overview,
    sections,
    follow_up_questions,
    quiz,
    off_syllabus: Boolean(raw.off_syllabus)
  };
}

export default function ExplainerPage() {
  const [topic, setTopic] = useState("");
  const [learningStyle, setLearningStyle] = useState("Exam Focus");
  const [deepMode, setDeepMode] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  const [thread, setThread] = useState<ThreadItem[]>([]);
  const [followUpText, setFollowUpText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const [copiedText, setCopiedText] = useState("");
  const [aiSelection, setAiSelection] = useState<AiSelection>({
    provider: "nvidia",
    model: "meta/llama-3.1-8b-instruct",
  });
  
  // Custom states for interactive widgets
  const [activeMenuIndex, setActiveMenuIndex] = useState<number | null>(null);
  const [activeSpeechIndex, setActiveSpeechIndex] = useState<number | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [quizScore, setQuizScore] = useState<Record<string, number>>({});
  
  // Simulated streaming animation count
  const [revealedSectionsCount, setRevealedSectionsCount] = useState<number>(0);

  const shouldReduceMotion = useReducedMotion();
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || "/api/backend";

  // Progressive reveal of sections when a new turn is loaded
  useEffect(() => {
    if (thread.length > 0) {
      const lastTurn = thread[thread.length - 1];
      const sectionsCount = lastTurn.explanation.sections?.length || 0;
      setRevealedSectionsCount(0);
      
      let count = 0;
      const timer = setInterval(() => {
        count += 1;
        setRevealedSectionsCount(count);
        if (count >= sectionsCount) {
          clearInterval(timer);
        }
      }, 400);
      return () => clearInterval(timer);
    }
  }, [thread]);

  const loadImageFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const source = String(event.target?.result || "");
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxSize = 1100;
        let { width, height } = img;
        if (width > height && width > maxSize) {
          height *= maxSize / width;
          width = maxSize;
        } else if (height > maxSize) {
          width *= maxSize / height;
          height = maxSize;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, width, height);
        const base64 = canvas.toDataURL("image/jpeg", 0.68);
        setImage(base64);
        setImagePreview(base64);
      };
      img.src = source;
    };
    reader.readAsDataURL(file);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadImageFile(file);
  };

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.includes("image")) {
          const file = item.getAsFile();
          if (file) {
            loadImageFile(file);
            e.preventDefault();
          }
          break;
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  const triggerQuery = async (queryText: string, isFollowUp = false) => {
    if (!queryText.trim() && !image) return;

    setLoading(true);
    setError("");
    if (!isFollowUp) {
      setThread([]);
    }

    const selectedMode = 
      learningStyle === "Beginner" ? "beginner" :
      learningStyle === "Exam Focus" ? "detailed" :
      learningStyle === "Interview" ? "interview" :
      learningStyle === "Mathematical" ? "mathematical" :
      learningStyle === "Visual" ? "visual" : "research";

    try {
      const history = isFollowUp ? thread.flatMap(item => [
        { role: "user", content: item.query },
        { role: "assistant", content: JSON.stringify(item.explanation) }
      ]) : [];

      const res = await fetch(`${backendUrl}/api/explainer/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic: queryText,
          mode: selectedMode,
          deep: deepMode,
          history,
          aiProvider: aiSelection.provider,
          aiModel: aiSelection.model,
        }),
      });

      const result = (await res.json()) as ApiResponse;
      const explanationData = result.data;

      if (!res.ok || !explanationData) {
        setError(result.details || result.error || "Unable to retrieve explanation.");
        return;
      }

      const normalized = normalizeApiResponse(explanationData);
      if (isFollowUp) {
        setThread(prev => [...prev, { query: queryText, explanation: normalized }]);
      } else {
        setThread([{ query: queryText || "Uploaded Image", explanation: normalized }]);
      }
    } catch {
      setError("Could not reach the explainer service.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuery = (e: React.FormEvent) => {
    e.preventDefault();
    void triggerQuery(topic, false);
  };

  const handleFollowUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!followUpText.trim()) return;

    const queryText = followUpText;
    setFollowUpText("");
    await triggerQuery(queryText, true);
  };

  const handleCopy = async (text: string) => {
    if (!navigator.clipboard) return;
    await navigator.clipboard.writeText(text);
    setCopiedText(text);
    window.setTimeout(() => setCopiedText(""), 1600);
  };

  const toggleSection = (sectionId: string, defaultCollapsed: boolean) => {
    setCollapsedSections(prev => {
      const current = prev[sectionId] !== undefined ? prev[sectionId] : defaultCollapsed;
      return {
        ...prev,
        [sectionId]: !current
      };
    });
  };

  const handleNewSession = () => {
    setTopic("");
    setImage(null);
    setImagePreview(null);
    setThread([]);
    setError("");
    setFollowUpText("");
    setRevealedSectionsCount(0);
    setCollapsedSections({});
    setQuizScore({});
  };

  const handleReadAloud = (index: number, text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    if (activeSpeechIndex === index) {
      window.speechSynthesis.cancel();
      setActiveSpeechIndex(null);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => setActiveSpeechIndex(null);
    utterance.onerror = () => setActiveSpeechIndex(null);
    window.speechSynthesis.speak(utterance);
    setActiveSpeechIndex(index);
  };

  return (
    <AppShell>
      <div className="w-full px-1 pt-5 sm:pt-6 flex flex-col gap-6">
        
        {/* Main Input Card OR New Doubt Header */}
        <AnimatePresence mode="wait">
          {thread.length === 0 ? (
            <motion.form
              key="input-form"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleQuery}
              className="surface explainer-query-form p-4 sm:p-5 flex flex-col gap-4 shadow-md border border-[var(--border)] rounded-2xl bg-white"
            >
              <div className="flex flex-col gap-1.5">
                <label htmlFor="topic" className="section-label block">
                  Ask your doubt
                </label>
                <textarea
                  id="topic"
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  placeholder={imagePreview ? "Ask what to explain from the image..." : "What is entropy? / Why does binary search work? / Ask any engineering doubt..."}
                  className="app-input min-h-[90px] h-[90px] resize-none px-4 py-3 text-sm leading-6 w-full rounded-xl border border-[var(--border)] focus:outline-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void triggerQuery(topic);
                    }
                  }}
                />
              </div>

              {/* Learning Style Selector */}
              <div>
                <span className="text-[10px] font-bold text-[var(--text-secondary)] tracking-wider uppercase mb-1.5 block">Learning Mode</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {learningStyles.map((style) => (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => setLearningStyle(style.id)}
                      className={`focus-ring rounded-lg border py-1.5 px-2.5 text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                        learningStyle === style.id
                          ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                          : "border-[var(--border)] bg-white text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
                      }`}
                    >
                      <span className="flex items-center justify-center text-[var(--text-secondary)]">{style.icon}</span>
                      <span>{style.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Divider and Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-[var(--border)] pt-3.5 mt-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <ModelSelector value={aiSelection} onChange={setAiSelection} />
                  
                  <button
                    type="button"
                    onClick={() => setDeepMode((value) => !value)}
                    className={`focus-ring flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition cursor-pointer select-none ${
                      deepMode
                        ? "border-[var(--teal)] bg-[var(--teal-soft)] text-[var(--teal)] shadow-sm"
                        : "border-[var(--border)] bg-white text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${deepMode ? "bg-[var(--teal)] animate-pulse" : "bg-gray-300"}`} />
                    <span>Deep Research</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <label className="focus-ring !min-h-[2rem] !rounded-lg !text-[11px] !py-1.5 !px-2.5 border border-[var(--border)] bg-white text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center gap-1.5 cursor-pointer hover:bg-[var(--bg-elevated)] transition active:scale-[0.98]">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                    </svg>
                    <span className="font-semibold">Add image</span>
                    <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                  </label>

                  <MicroInteractionButton
                    type="submit"
                    loading={loading && thread.length === 0}
                    disabled={loading || (!topic.trim() && !image)}
                    className="btn-primary !min-h-[2rem] !rounded-lg !text-[11px] !py-1.5 !px-3.5 flex items-center justify-center gap-1.5 shadow-sm hover:bg-[var(--accent-hover)] transition cursor-pointer active:scale-[0.98] disabled:opacity-45"
                  >
                    <span>Explain Concept</span>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </MicroInteractionButton>
                </div>
              </div>

              {imagePreview && (
                <div className="flex max-w-xl items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-2">
                  <Image src={imagePreview} alt="Uploaded problem preview" width={58} height={58} unoptimized className="h-14 w-14 rounded-lg border border-[var(--border)] object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-[var(--text-primary)]">Image attached</p>
                    <p className="text-[11px] font-medium text-[var(--text-secondary)]">Sent with question</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setImage(null);
                      setImagePreview(null);
                    }}
                    className="focus-ring rounded-lg px-2 py-1.5 text-xs font-semibold text-[var(--danger)] hover:bg-[var(--danger-soft)] cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              )}

              {error && (
                <div className="rounded-lg border border-[var(--danger)]/20 bg-[var(--danger-soft)] px-3 py-2 text-xs font-semibold text-[var(--danger)]">
                  {error}
                </div>
              )}
            </motion.form>
          ) : (
            <motion.div
              key="new-doubt-bar"
              initial={{ opacity: 0, y: -20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 350, damping: 28 }}
              className="surface explainer-session-bar flex justify-between items-center border border-[var(--border)] p-4 px-6 rounded-2xl bg-white shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent)] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[var(--accent)]"></span>
                </div>
                <span className="text-xs font-semibold text-[var(--text-secondary)]">
                  Session Topic: <strong className="text-[var(--text-primary)] font-bold">{thread[0]?.explanation?.session?.topic || thread[0]?.query || topic}</strong>
                </span>
              </div>
              <motion.button
                whileHover={{ scale: 1.05, y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleNewSession}
                type="button"
                className="btn-primary !min-h-[2.25rem] !rounded-xl !text-xs !py-1.5 !px-4 flex items-center justify-center gap-2 shadow-md hover:bg-[var(--accent-hover)] transition cursor-pointer active:scale-[0.98]"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                <span className="font-bold">New Doubt</span>
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content Flow */}
        <div className="w-full flex flex-col gap-6">
          {thread.length > 0 ? (
            <div className="flex flex-col gap-6">
              
              {/* Thread turns */}
              {thread.map((turn, turnIdx) => {
                const exp = turn.explanation;
                return (
                  <div key={turnIdx} className="flex flex-col gap-5 border-b border-[var(--border)] pb-8 last:border-b-0 last:pb-0">
                    
                    {/* User Doubt Bubble */}
                    {turnIdx > 0 && (
                      <div className="flex items-start gap-3 justify-end">
                        <div className="rounded-2xl bg-[var(--accent-soft)] border border-[var(--accent)]/10 px-4 py-2.5 text-xs font-semibold text-[var(--accent)] max-w-[80%] shadow-sm">
                          {turn.query}
                        </div>
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-white text-[10px] font-bold shadow-sm">
                          U
                        </span>
                      </div>
                    )}

                    {/* Explainer Workspace Panel - Typography First Notion/Apple style */}
                    <div className="flex flex-col gap-6 py-2">
                      
                      {/* Off-syllabus Warning Banner */}
                      {exp.off_syllabus && (
                        <div className="rounded-xl border border-[var(--amber)]/20 bg-[var(--amber-soft)] p-3.5 text-xs font-medium text-[var(--amber)] flex items-start gap-2.5">
                          <span className="text-base leading-none">💡</span>
                          <div>
                            <span className="font-bold block mb-0.5">Off-Syllabus Topic</span>
                            This concept is outside the core GATE syllabus. We have explained it fully to satisfy your curiosity, but we highly encourage you to stay focused on your primary GATE subjects to make the best use of your study time!
                          </div>
                        </div>
                      )}

                      {/* Header with Title & Metadata info */}
                      <div>
                        <h2 className="text-2xl font-bold tracking-tight text-[var(--text-primary)] mt-1">{exp.session?.topic || "Doubt Explanation"}</h2>
                        <p className="text-xs font-medium leading-6 text-[var(--text-secondary)] mt-3 italic">
                          {exp.overview}
                        </p>
                      </div>

                      {/* Sleek Horizontal Meta Row */}
                      <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-xs text-[var(--text-secondary)] font-semibold border-b border-[var(--border)]/50 pb-4">
                        <span className="flex items-center gap-1.5 bg-[var(--accent-soft)] text-[var(--accent)] px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider select-none">
                          {exp.session?.difficulty || "Medium"}
                        </span>
                        
                        {!exp.off_syllabus && exp.session?.exam_tags && exp.session.exam_tags.length > 0 && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[var(--text-faint)] font-medium">Appears in:</span>
                            <div className="flex items-center gap-1">
                              {exp.session.exam_tags.map(tag => (
                                <span key={tag} className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px] select-none">{tag}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {exp.session?.prerequisites && exp.session.prerequisites.length > 0 && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[var(--text-faint)] font-medium">Prerequisites:</span>
                            <span className="text-[var(--text-primary)] font-semibold">{exp.session.prerequisites.join(" • ")}</span>
                          </div>
                        )}

                        {exp.session?.next_topics && exp.session.next_topics.length > 0 && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[var(--text-faint)] font-medium">Next:</span>
                            <span className="text-[var(--text-primary)] font-semibold">{exp.session.next_topics.join(" • ")}</span>
                          </div>
                        )}
                      </div>

                      {/* Flowing Textbook Sections */}
                      <div className="space-y-4">
                        {(exp.sections || []).map((sec, idx) => {
                          // Hide sections not yet revealed in client-side progressive reveal (only for last turn)
                          const isLastTurn = turnIdx === thread.length - 1;
                          if (isLastTurn && idx >= revealedSectionsCount) {
                            return null;
                          }

                          const isEssay = exp.layout === "essay";
                          const hasTitle = !!(sec.title && sec.title.trim());
                          const isCollapsible = !isEssay && hasTitle && sec.collapsed !== false;

                          if (!isCollapsible) {
                            return (
                              <div key={sec.id} className="pt-6 mt-6 first:pt-0 first:mt-0">
                                {hasTitle && (
                                  <h3 className="font-bold text-sm text-[var(--text-primary)] py-2 select-none tracking-tight [&_p]:m-0 [&_p]:inline-block [&_p]:text-inherit">
                                    <AiMarkdown content={sec.title} />
                                  </h3>
                                )}
                                <div className="mt-2 px-2">
                                  <SectionRenderer section={sec} copiedText={copiedText} onCopy={handleCopy} />
                                </div>
                              </div>
                            );
                          }

                          const defaultCollapsed = sec.collapsed !== undefined ? sec.collapsed : idx > 0;
                          const isCollapsed = collapsedSections[`${turnIdx}-${sec.id}`] !== undefined
                            ? collapsedSections[`${turnIdx}-${sec.id}`]
                            : defaultCollapsed;

                          return (
                            <div key={sec.id} className="pt-6 mt-6 first:pt-0 first:mt-0">
                              <button
                                type="button"
                                onClick={() => toggleSection(`${turnIdx}-${sec.id}`, defaultCollapsed)}
                                className="explainer-section-toggle flex items-center justify-between w-full text-left font-bold text-sm text-[var(--text-primary)] py-2 hover:bg-[var(--bg-elevated)] px-2 rounded-lg transition cursor-pointer select-none"
                              >
                                <span className="tracking-tight [&_p]:m-0 [&_p]:inline-block [&_p]:text-inherit">
                                  <AiMarkdown content={sec.title} />
                                </span>
                                <span className="text-xs text-[var(--text-secondary)]">{isCollapsed ? "▶ Show" : "▼ Hide"}</span>
                              </button>
                              
                              <AnimatePresence initial={false}>
                                {!isCollapsed && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden mt-3 px-2"
                                  >
                                    <SectionRenderer section={sec} copiedText={copiedText} onCopy={handleCopy} />
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })}
                      </div>

                      {/* Inline suggested follow-up chips between content & quiz */}
                      {exp.follow_up_questions && exp.follow_up_questions.length > 0 && (
                        <div className="border-t border-[var(--border)] pt-4 mt-6">
                          <span className="section-label mb-2 block flex items-center gap-1">
                            <span>💡</span> Continue learning
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {exp.follow_up_questions.slice(0, 3).map((q) => (
                              <button
                                key={q}
                                type="button"
                                onClick={() => void triggerQuery(q, true)}
                                className="explainer-followup focus-ring rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] transition cursor-pointer"
                              >
                                {q}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Interactive Quiz Widget */}
                      {exp.quiz && exp.quiz.length > 0 && (
                        <QuizWidget quiz={exp.quiz} quizKey={`${turnIdx}`} score={quizScore} setScore={setQuizScore} />
                      )}

                      {/* Floating / Menu dots tool */}
                      <div className="flex justify-end gap-2 border-t border-[var(--border)]/60 pt-4 mt-4 relative">
                        <button
                          type="button"
                          onClick={() => setActiveMenuIndex(activeMenuIndex === turnIdx ? null : turnIdx)}
                          className="focus-ring p-1.5 rounded-lg hover:bg-[var(--bg-elevated)] border border-transparent hover:border-[var(--border)] transition cursor-pointer"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-[var(--text-secondary)]">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                          </svg>
                        </button>
                        
                        {activeMenuIndex === turnIdx && (
                          <div className="absolute right-0 bottom-10 z-10 w-48 bg-white border border-[var(--border)] rounded-xl shadow-lg p-1.5 flex flex-col gap-1">
                            <button
                              onClick={() => {
                                void handleCopy(JSON.stringify(exp, null, 2));
                                setActiveMenuIndex(null);
                              }}
                              className="w-full text-left px-3 py-2 text-xs font-semibold rounded-lg hover:bg-[var(--bg-elevated)] transition cursor-pointer text-[var(--text-primary)]"
                            >
                              Copy Markdown
                            </button>
                            <button
                              onClick={() => {
                                handleReadAloud(turnIdx, `${exp.session?.topic}. ${exp.overview}. ${exp.sections.map(s => `${s.title}. ${s.content}`).join(". ")}`);
                                setActiveMenuIndex(null);
                              }}
                              className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-lg hover:bg-[var(--bg-elevated)] transition cursor-pointer text-[var(--text-primary)] flex items-center justify-between`}
                            >
                              <span>{activeSpeechIndex === turnIdx ? "Stop Reading" : "Read Aloud"}</span>
                              <span className="text-[10px]">{activeSpeechIndex === turnIdx ? "🔊" : "🔈"}</span>
                            </button>
                            <button
                              onClick={() => {
                                void triggerQuery(`Can you simplify the concept of "${exp.session?.topic}" for a beginner?`);
                                setActiveMenuIndex(null);
                              }}
                              className="w-full text-left px-3 py-2 text-xs font-semibold rounded-lg hover:bg-[var(--bg-elevated)] transition cursor-pointer text-[var(--text-primary)]"
                            >
                              Simplify explanation
                            </button>
                            <button
                              onClick={() => {
                                void triggerQuery(`Give me a detailed numerical problem with solution for "${exp.session?.topic}"`);
                                setActiveMenuIndex(null);
                              }}
                              className="w-full text-left px-3 py-2 text-xs font-semibold rounded-lg hover:bg-[var(--bg-elevated)] transition cursor-pointer text-[var(--text-primary)]"
                            >
                              Get Numericals / PYQs
                            </button>
                          </div>
                        )}
                      </div>

                    </div>
                  </div>
                );
              })}

              {/* Progress skeleton/thinking panel for follow-up */}
              {loading && <ThinkingPanel />}

            </div>
          ) : loading ? (
            <ThinkingPanel />
          ) : (
            /* Empty State */
            <div className="surface p-6 sm:p-8 rounded-2xl bg-white border border-[var(--border)] shadow-sm text-center flex flex-col items-center justify-center min-h-[380px]">
              <span className="text-4xl mb-4">📖</span>
              <h3 className="text-lg font-bold text-[var(--text-primary)]">What would you like to understand today?</h3>
              <p className="text-xs font-semibold text-[var(--text-secondary)] mt-2 max-w-sm">
                Select a suggested query or type any engineering concept to start your study session.
              </p>
              
              <div className="flex flex-wrap items-center justify-center gap-2 mt-6 max-w-lg">
                {suggestedPrompts.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => {
                      setTopic(q);
                      void triggerQuery(q);
                    }}
                    className="focus-ring rounded-full border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] transition cursor-pointer"
                  >
                    • {q}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Floating Follow-up Input Bar */}
      {thread.length > 0 && (
        <div className="sticky bottom-0 left-0 right-0 bg-gradient-to-t from-[var(--bg-page)] via-[var(--bg-page)]/95 to-transparent pt-8 pb-4 z-20">
          <div className="w-full px-1">
            <form onSubmit={handleFollowUpSubmit} className="flex items-center gap-2 bg-white border border-[var(--border)] p-1.5 rounded-xl shadow-lg w-full">
              <textarea
                value={followUpText}
                onChange={(e) => setFollowUpText(e.target.value)}
                placeholder="Ask a follow-up doubt about this concept..."
                className="app-input min-h-[40px] h-[40px] resize-none px-3.5 py-2.5 text-xs leading-5 flex-1 rounded-lg border-0 focus:outline-none focus:ring-0 bg-transparent"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleFollowUpSubmit(e);
                  }
                }}
              />
              <MicroInteractionButton
                type="submit"
                disabled={loading || !followUpText.trim()}
                className="btn-primary !min-h-[2rem] !rounded-lg !text-[11px] !py-1.5 !px-3.5 flex items-center justify-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-45"
              >
                {loading ? (
                  <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                )}
                <span className="font-semibold">Ask</span>
              </MicroInteractionButton>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function SectionRenderer({ section, copiedText, onCopy }: { section: Section; copiedText: string; onCopy: (text: string) => void }) {
  if (section.type === "text" && section.content) {
    return <div className="text-sm font-medium leading-7 text-[var(--text-primary)]"><AiMarkdown content={section.content} /></div>;
  }

  if (section.type === "alert" && section.content) {
    return (
      <div className="rounded-xl border border-[var(--danger)]/20 bg-[var(--danger-soft)] p-4 text-xs font-semibold text-[var(--danger)] leading-6">
        <AiMarkdown content={section.content} />
      </div>
    );
  }

  if (section.type === "formula" && section.data) {
    const expression = section.data.expression || "";
    return (
      <div className="py-3 px-4 border-l-2 border-[var(--accent)] bg-[var(--bg-elevated)]/40 rounded-r-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1 text-center md:text-left py-1 overflow-x-auto relative group">
          <div className="absolute right-0 top-0 opacity-0 group-hover:opacity-100 transition">
            {expression ? (
              <button
                type="button"
                onClick={() => onCopy(expression)}
                className="focus-ring rounded border border-[var(--border)] bg-white px-2 py-0.5 text-[9px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                {copiedText === expression ? "Copied" : "Copy"}
              </button>
            ) : null}
          </div>
          <AiMarkdown content={expression.includes("$") ? expression : `$$${expression}$$`} />
        </div>
        {section.data.variables && Object.keys(section.data.variables).length > 0 ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-[var(--text-secondary)] border-t md:border-t-0 md:border-l border-[var(--border)]/65 pt-2.5 md:pt-0 md:pl-4 min-w-[200px] max-w-md">
            <span className="font-bold text-[10px] uppercase tracking-wider text-[var(--text-faint)] w-full block md:inline mb-0.5 select-none">Notation:</span>
            {Object.entries(section.data.variables).map(([key, value]) => (
              <span key={key} className="inline-flex items-center gap-1.5 whitespace-nowrap bg-white border border-[var(--border)]/50 px-2 py-0.5 rounded text-[11px] shadow-sm">
                <span className="font-bold text-[var(--text-primary)]">
                  <AiMarkdown content={key.includes("$") ? key : `$${key}$`} />
                </span>
                <span className="text-[var(--text-faint)]">=</span>
                <span className="text-[var(--text-secondary)] font-medium">{String(value)}</span>
              </span>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  if (section.type === "table" && section.data) {
    const rows = normalizeRows(section.data.rows);
    const headers = normalizeHeaders(section.data.headers, rows);

    if (rows.length === 0) {
      return <p className="text-xs font-semibold text-[var(--text-secondary)]">No table rows returned.</p>;
    }

    return (
      <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-white shadow-sm">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="bg-[var(--bg-elevated)]">
            <tr>
              {headers.map((header, index) => (
                <th key={`${header}-${index}`} className="border-b border-[var(--border)] px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--text-secondary)]">
                  <AiMarkdown content={formatCell(header)} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-b border-[var(--border)] last:border-b-0">
                {Array.from({ length: headers.length }, (_, cellIndex) => (
                  <td key={`${rowIndex}-${cellIndex}`} className="px-3 py-2.5 align-top font-semibold text-[var(--text-primary)]">
                    <AiMarkdown content={formatCell(row[cellIndex] || "")} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (section.type === "hierarchy" && section.data) {
    const items = Array.isArray(section.data.items) ? section.data.items : [];
    return (
      <div className="space-y-3">
        {items.map((item: any, index: number) => {
          const children = normalizeChildren(item.children);
          return (
            <div key={`${formatCell(item.node)}-${index}`} className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3">
              <div className="font-semibold text-xs text-[var(--text-primary)]">
                <AiMarkdown content={formatCell(item.node)} />
              </div>
              {children.length > 0 ? (
                <ul className="mt-2 space-y-1 pl-4 text-xs font-semibold text-[var(--text-secondary)]">
                  {children.map((child, childIndex) => (
                    <li key={`${child}-${childIndex}`} className="list-disc">
                      <AiMarkdown content={formatCell(child)} />
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  }

  return <p className="text-xs font-semibold text-[var(--text-secondary)]">No content returned for this section.</p>;
}

function QuizWidget({
  quiz,
  quizKey,
  score,
  setScore,
}: {
  quiz: QuizQuestion[];
  quizKey: string;
  score: Record<string, number>;
  setScore: React.Dispatch<React.SetStateAction<Record<string, number>>>;
}) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState<Record<number, boolean>>({});

  const correctAnswersCount = useMemo(() => {
    let count = 0;
    quiz.forEach((q, idx) => {
      if (submitted[idx] && answers[idx] === q.answer) {
        count += 1;
      }
    });
    return count;
  }, [quiz, answers, submitted]);

  useEffect(() => {
    if (Object.keys(submitted).length === quiz.length) {
      setScore((prev) => ({
        ...prev,
        [quizKey]: correctAnswersCount
      }));
    }
  }, [submitted, quiz.length, quizKey, correctAnswersCount, setScore]);

  return (
    <div className="mt-8 border-t border-[var(--border)] pt-6">
      <h3 className="text-base font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
        <span>📝</span> Check Your Understanding
      </h3>
      <div className="space-y-4">
        {quiz.map((q, idx) => (
          <div key={idx} className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl p-4">
            <div className="font-semibold text-xs text-[var(--text-primary)] mb-3 [&_p]:m-0">
              <AiMarkdown content={q.question} />
            </div>
            <div className="grid gap-2">
              {q.options.map((opt, optIdx) => {
                const isSelected = answers[idx] === optIdx;
                const isCorrect = optIdx === q.answer;
                const isSubmitted = submitted[idx];
                
                let btnStyle = "bg-white border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]";
                if (isSubmitted) {
                  if (isCorrect) {
                    btnStyle = "bg-green-50 border-green-300 text-green-700 font-semibold";
                  } else if (isSelected) {
                    btnStyle = "bg-red-50 border-red-300 text-red-700";
                  }
                } else if (isSelected) {
                  btnStyle = "bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--accent)] font-semibold";
                }

                return (
                  <button
                    key={optIdx}
                    onClick={() => {
                      if (isSubmitted) return;
                      setAnswers(prev => ({ ...prev, [idx]: optIdx }));
                    }}
                    className={`focus-ring w-full text-left px-3 py-2 text-xs rounded-lg transition ${btnStyle}`}
                  >
                    <div className="[&_p]:m-0 [&_p]:inline-block [&_p]:text-inherit">
                      <AiMarkdown content={opt} />
                    </div>
                  </button>
                );
              })}
            </div>
            {!submitted[idx] && (
              <button
                disabled={answers[idx] === undefined}
                onClick={() => setSubmitted(prev => ({ ...prev, [idx]: true }))}
                className="mt-3 btn-primary text-xs py-1.5 px-3 rounded-lg cursor-pointer disabled:opacity-50"
              >
                Submit Answer
              </button>
            )}
          </div>
        ))}
      </div>
      {score[quizKey] !== undefined && (
        <div className="mt-4 text-xs font-bold text-[var(--accent)] text-right">
          Session Score: {score[quizKey]} / {quiz.length} Correct
        </div>
      )}
    </div>
  );
}

function ThinkingPanel() {
  return (
    <div className="surface soft-blue p-5 border border-[var(--border)] rounded-2xl bg-white shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="section-label mb-2 text-[var(--accent)] animate-pulse">Scholar is building explanation...</p>
          <h3 className="text-base font-bold text-[var(--text-primary)]">Writing sections</h3>
          <p className="mt-1 text-xs font-semibold leading-5 text-[var(--text-secondary)]">
            Analyzing doubts, formulating derivations, and compiling interactive quiz checks.
          </p>
        </div>
        <div className="flex min-w-[220px] gap-2">
          {["Read", "Solve", "Quiz"].map((item, index) => (
            <span key={item} className="flex-1 rounded-lg border border-white bg-[var(--accent-soft)]/40 px-3 py-2 text-center text-[11px] font-semibold text-[var(--accent)]">
              <span className="mx-auto mb-2 block h-1.5 w-1.5 rounded-full bg-[var(--accent)] opacity-80 animate-ping" style={{ animationDelay: `${index * 150}ms` }} />
              {item}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="animate-pulse rounded-xl border border-[var(--border)] bg-white p-4">
            <div className="h-3 w-32 rounded bg-[var(--track)]" />
            <div className="mt-4 h-3 rounded bg-[var(--track)]" />
            <div className="mt-2 h-3 w-4/5 rounded bg-[var(--track)]" />
          </div>
        ))}
      </div>
    </div>
  );
}
