"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { AiMarkdown } from "@/components/AiMarkdown";
import { type AiSelection } from "@/components/ModelSelector";
import { MicroInteractionButton } from "@/components/MotionComponents";
import { toast, Toaster } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { useDemoFetch } from "@/lib/DemoContext";

type AnswerLayout =
  | "quick_answer"
  | "concept_explainer"
  | "problem_solving"
  | "comparison"
  | "study_plan"
  | "revision"
  | "career_guidance"
  | "app_assistance"
  | "general";

interface ChatMessage {
  id: string;
  role: "assistant" | "user";
  content: string;
  layout?: AnswerLayout;
}

const answerLayouts: Record<AnswerLayout, { label: string; description: string; icon: string; tone: string }> = {
  quick_answer: { label: "Quick answer", description: "Straight to the point", icon: "?", tone: "text-[var(--teal)] bg-[var(--teal-soft)] border-[var(--teal)]/20" },
  concept_explainer: { label: "Concept map", description: "Break it down, then make it stick", icon: "?", tone: "text-[var(--lavender)] bg-[var(--lavender-soft)] border-[var(--lavender)]/20" },
  problem_solving: { label: "Worked solution", description: "Method, steps, and a final check", icon: "S", tone: "text-[var(--accent)] bg-[var(--accent-soft)] border-[var(--accent)]/25" },
  comparison: { label: "Side-by-side", description: "Compare the options and choose clearly", icon: "?", tone: "text-[var(--teal)] bg-[var(--teal-soft)] border-[var(--teal)]/20" },
  study_plan: { label: "Action plan", description: "A focused route from now to done", icon: "?", tone: "text-[var(--success)] bg-[var(--success-soft)] border-[var(--success)]/20" },
  revision: { label: "Revision sprint", description: "Recall, practice, and lock it in", icon: "?", tone: "text-[var(--sun)] bg-[var(--sun-soft)] border-[var(--sun)]/25" },
  career_guidance: { label: "Decision guide", description: "Trade-offs, direction, and next move", icon: "?", tone: "text-[var(--lavender)] bg-[var(--lavender-soft)] border-[var(--lavender)]/20" },
  app_assistance: { label: "App assistant", description: "A change or shortcut for your workspace", icon: "?", tone: "text-[var(--accent)] bg-[var(--accent-soft)] border-[var(--accent)]/25" },
  general: { label: "Coach response", description: "Clear, tailored guidance", icon: "?", tone: "text-[var(--accent)] bg-[var(--accent-soft)] border-[var(--accent)]/25" },
};

const starterPrompts: Array<{ label: string; prompt: string; layout: AnswerLayout }> = [
  { label: "Explain a concept", prompt: "Explain entropy from first principles with a simple example.", layout: "concept_explainer" },
  { label: "Solve step by step", prompt: "Help me solve a GATE-level numerical step by step.", layout: "problem_solving" },
  { label: "Make a revision plan", prompt: "Make me a focused 3-day revision plan for my weakest subject.", layout: "revision" },
  { label: "Compare clearly", prompt: "Compare Rankine cycle and Brayton cycle in an exam-ready table.", layout: "comparison" },
];

function isAnswerLayout(value: unknown): value is AnswerLayout {
  return typeof value === "string" && value in answerLayouts;
}

function AssistantResponse({ message, onUsePrompt }: { message: ChatMessage; onUsePrompt: (prompt: string) => void }) {
  const layout = message.layout || "general";

  return (
    <div className="w-full">
      <div className="coach-answer ai-markdown font-medium">
        <AiMarkdown content={message.content} />
      </div>
      {layout === "revision" && (
        <button
          type="button"
          onClick={() => onUsePrompt("Test me with 5 questions from this topic, one at a time.")}
          className="focus-ring mt-3 inline-flex items-center gap-2 rounded-lg border border-[var(--sun)]/25 bg-[var(--sun-soft)] px-3 py-2 text-[11px] font-bold text-[var(--sun)] transition hover:brightness-95"
        >
          <span aria-hidden="true">?</span> Test me on this
        </button>
      )}
    </div>
  );
}

export default function ChatPage() {
  const router = useRouter();
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || "/api/backend";
  const appFetch = useDemoFetch();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiSelection, setAiSelection] = useState<AiSelection>({ provider: "nvidia", model: "meta/llama-3.1-8b-instruct" });
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading, suggestions]);

  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = event.target.value;
    setInput(val);
    const el = event.target;
    el.style.height = "auto";
    const maxHeight = 140;
    const newHeight = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${newHeight}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  };

  const sendChatMessage = async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessage = { id: `user-${messages.length + 1}`, role: "user", content: trimmed };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setSuggestions([]);
    setLoading(true);

    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    try {
      const response = await appFetch(`${backendUrl}/api/routine/general-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map((message) => ({ role: message.role, content: message.content })),
          aiProvider: aiSelection.provider,
          aiModel: aiSelection.model,
        }),
      });
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Received an invalid response from the server. Please refresh or log in again.");
      }
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to get coach response.");

      setMessages((current) => [
        ...current,
        {
          id: `assistant-${nextMessages.length + 1}`,
          role: "assistant",
          content: typeof result.reply === "string" && result.reply.trim() ? result.reply : "I’m listening. How can I help you?",
          layout: isAnswerLayout(result.layout) ? result.layout : "general",
        },
      ]);
      setSuggestions(Array.isArray(result.suggestions) ? result.suggestions.map((item: unknown) => String(item).trim()).filter(Boolean).slice(0, 4) : []);

      if (result.action && typeof result.action === "object") {
        const { type, value } = result.action;
        if (type === "SET_THEME" && (value === "dark" || value === "light")) {
          document.documentElement.setAttribute("data-theme", value);
          localStorage.setItem("jujum-theme", value);
          toast.success(`Theme switched to ${value} mode`);
        } else if (type === "NAVIGATE" && typeof value === "string") {
          toast.info(`Opening ${value}…`);
          router.push(value);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Connection error";
      setMessages((current) => [...current, {
        id: `error-${nextMessages.length + 1}`,
        role: "assistant",
        content: `## I couldn't reach your coach\n\n${errorMessage}\n\nTry again in a moment, or check that the backend is running.`,
        layout: "general",
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = (event: React.FormEvent) => {
    event.preventDefault();
    void sendChatMessage(input);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendChatMessage(input);
    }
  };

  const startFresh = () => {
    setMessages([]);
    setSuggestions([]);
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <AppShell>
      <Toaster position="top-right" richColors />
      <section className="relative flex flex-1 h-[calc(100vh-4.5rem)] min-h-[calc(100vh-4.5rem)] max-h-[calc(100vh-4.5rem)] w-full flex-col overflow-hidden bg-transparent">
        {messages.length === 0 ? (
          <div className="m-auto flex w-full max-w-4xl flex-col items-center justify-center px-4 py-8 text-center sm:px-6 my-auto">
            <motion.h2
              initial={{ y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.35, delay: 0.05 }}
              className="text-xl font-bold tracking-tight text-[var(--text-primary)] sm:text-2xl"
            >
              How can I help you today?
            </motion.h2>

            <form
              onSubmit={handleSend}
              className="mt-6 w-full max-w-4xl px-2"
            >
              <div className="flex items-center gap-2.5 rounded-full border border-slate-200/90 bg-white dark:bg-[var(--bg-card)] dark:border-[var(--border)] pl-4 pr-2 py-2 shadow-xl shadow-slate-900/10 transition-all duration-200 focus-within:border-[var(--accent)]/70 focus-within:ring-4 focus-within:ring-[var(--accent)]/15">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask anything..."
                  disabled={loading}
                  rows={1}
                  className="no-scrollbar flex-1 resize-none bg-transparent py-1 text-xs font-medium leading-5 text-slate-900 dark:text-[var(--text-primary)] outline-none placeholder:text-slate-400 dark:placeholder:text-[var(--text-secondary)] disabled:opacity-60 sm:text-sm"
                  style={{ minHeight: "26px", maxHeight: "140px" }}
                />
                <motion.button
                  type="submit"
                  whileHover={input.trim() ? { scale: 1.08 } : {}}
                  whileTap={input.trim() ? { scale: 0.92 } : {}}
                  disabled={!input.trim() || loading}
                  className={`flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-full transition-all duration-200 ${
                    input.trim()
                      ? "bg-[var(--accent)] text-white shadow-md hover:brightness-110 cursor-pointer"
                      : "bg-stone-200/90 text-stone-600 dark:bg-stone-800/80 dark:text-stone-300 cursor-not-allowed opacity-70"
                  }`}
                  aria-label="Send prompt"
                >
                  <svg className="h-4 w-4 text-current" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3 21l18-9L3 3l3 9m0 0h8" />
                  </svg>
                </motion.button>
              </div>
            </form>
          </div>
        ) : (
          <>
            <div className="no-scrollbar flex flex-1 flex-col overflow-y-auto min-h-0 bg-transparent">
              <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 pt-6 pb-6 sm:px-6 sm:pt-8 sm:pb-8">
                <AnimatePresence initial={false}>
                  {messages.map((message, index) => {
                    const isUser = message.role === "user";
                    const isLast = index === messages.length - 1;
                    return (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.16 }}
                        className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                      >
                        {isUser ? (
                          <div className="max-w-[76%] rounded-2xl rounded-tr-xs bg-slate-100 text-slate-900 border border-slate-200/90 dark:bg-slate-800/70 dark:text-slate-100 dark:border-slate-700/60 px-3.5 py-2.5 text-xs sm:text-sm font-medium leading-5 shadow-2xs sm:max-w-[56%]">
                            {message.content}
                          </div>
                        ) : (
                          <AssistantResponse message={message} onUsePrompt={(prompt) => void sendChatMessage(prompt)} />
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
                {loading && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="flex justify-start pt-1"
                  >
                    <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)]/70 bg-[var(--bg-card)] px-3.5 py-1.5 shadow-2xs">
                      <span className="h-2 w-2 rounded-full bg-[var(--accent)] animate-pulse" />
                      <span className="text-xs font-medium text-[var(--text-secondary)] tracking-wide select-none">
                        Thinking...
                      </span>
                    </div>
                  </motion.div>
                )}
                <div ref={chatEndRef} />
              </div>
            </div>

            <form
              onSubmit={handleSend}
              className="mt-auto shrink-0 w-full py-3 px-4 bg-[var(--bg-main)]/90 backdrop-blur-md z-30 border-t border-[var(--border)]/40"
            >
              <div className="mx-auto max-w-4xl w-full flex flex-col gap-2.5">
                <AnimatePresence>
                  {suggestions.length > 0 && !loading && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 2 }}
                      transition={{ duration: 0.18 }}
                      className="flex flex-wrap items-center gap-1.5 px-0.5"
                    >
                      {suggestions.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => void sendChatMessage(suggestion)}
                          className="focus-ring rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-3.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] shadow-2xs transition hover:border-[var(--accent)]/40 hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] cursor-pointer"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
                <div className="flex items-center gap-2.5 rounded-full border border-slate-200/90 bg-white dark:bg-[var(--bg-card)] dark:border-[var(--border)] pl-4 pr-2 py-2 shadow-xl shadow-slate-900/10 transition-all duration-200 focus-within:border-[var(--accent)]/70 focus-within:ring-4 focus-within:ring-[var(--accent)]/15">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask anything..."
                    disabled={loading}
                    rows={1}
                    className="no-scrollbar flex-1 resize-none bg-transparent py-1 text-xs font-medium leading-5 text-slate-900 dark:text-[var(--text-primary)] outline-none placeholder:text-slate-400 dark:placeholder:text-[var(--text-secondary)] disabled:opacity-60 sm:text-sm"
                    style={{ minHeight: "26px", maxHeight: "140px" }}
                  />
                  <motion.button
                    type="submit"
                    whileHover={input.trim() ? { scale: 1.08 } : {}}
                    whileTap={input.trim() ? { scale: 0.92 } : {}}
                    disabled={!input.trim() || loading}
                    className={`flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-full transition-all duration-200 ${
                      input.trim()
                        ? "bg-[var(--accent)] text-white shadow-md hover:brightness-110 cursor-pointer"
                        : "bg-stone-200/90 text-stone-600 dark:bg-stone-800/80 dark:text-stone-300 cursor-not-allowed opacity-70"
                    }`}
                    aria-label="Send prompt"
                  >
                    <svg className="h-4 w-4 text-current" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3 21l18-9L3 3l3 9m0 0h8" />
                    </svg>
                  </motion.button>
                </div>
              </div>
            </form>
          </>
        )}
      </section>
    </AppShell>
  );
}