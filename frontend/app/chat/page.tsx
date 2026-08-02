"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { AiMarkdown } from "@/components/AiMarkdown";
import { ModelSelector, type AiSelection } from "@/components/ModelSelector";
import { MicroInteractionButton } from "@/components/MotionComponents";
import { toast, Toaster } from "sonner";
import { motion, AnimatePresence } from "motion/react";

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

const starterPrompts: Array<{ label: string; prompt: string; layout: AnswerLayout; icon: string }> = [
  { label: "Explain a concept", prompt: "Explain entropy from first principles with a simple example.", layout: "concept_explainer", icon: "?" },
  { label: "Solve step by step", prompt: "Help me solve a GATE-level numerical step by step.", layout: "problem_solving", icon: "S" },
  { label: "Make a revision plan", prompt: "Make me a focused 3-day revision plan for my weakest subject.", layout: "revision", icon: "?" },
  { label: "Compare clearly", prompt: "Compare Rankine cycle and Brayton cycle in an exam-ready table.", layout: "comparison", icon: "?" },
];

function isAnswerLayout(value: unknown): value is AnswerLayout {
  return typeof value === "string" && value in answerLayouts;
}

function AssistantResponse({ message, onUsePrompt }: { message: ChatMessage; onUsePrompt: (prompt: string) => void }) {
  const layout = message.layout || "general";
  const meta = answerLayouts[layout];
  const [copied, setCopied] = useState(false);

  const copyAnswer = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      toast.success("Answer copied");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Could not copy that answer");
    }
  };

  return (
    <article className="w-full max-w-5xl overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-[var(--shadow-tight)]">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--bg-page)]/50 px-5 py-3.5 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-base font-bold ${meta.tone}`} aria-hidden="true">{meta.icon}</span>
          <div className="min-w-0">
            <p className="truncate text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-primary)]">{meta.label}</p>
            <p className="hidden truncate text-[11px] font-medium text-[var(--text-secondary)] sm:block">{meta.description}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void copyAnswer()}
          className="focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-bold text-[var(--text-secondary)] transition hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
          aria-label="Copy coach response"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.9" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="px-5 py-5 sm:px-7 sm:py-6">
        <div className="coach-answer ai-markdown font-medium">
          <AiMarkdown content={message.content} />
        </div>
      </div>
      {layout === "revision" && (
        <button
          type="button"
          onClick={() => onUsePrompt("Test me with 5 questions from this topic, one at a time.")}
          className="focus-ring mx-5 mb-5 inline-flex items-center gap-2 rounded-lg border border-[var(--sun)]/25 bg-[var(--sun-soft)] px-3 py-2 text-[11px] font-bold text-[var(--sun)] transition hover:brightness-95 sm:mx-5 sm:mb-5"
        >
          <span aria-hidden="true">?</span> Test me on this
        </button>
      )}
    </article>
  );
}

export default function ChatPage() {
  const router = useRouter();
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || "/api/backend";
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

  const sendChatMessage = async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessage = { id: `user-${messages.length + 1}`, role: "user", content: trimmed };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setSuggestions([]);
    setLoading(true);

    try {
      const response = await fetch(`${backendUrl}/api/routine/general-chat`, {
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
      toast.error(errorMessage);
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
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <AppShell>
      <Toaster position="top-right" richColors />
      <section className="surface flex h-[calc(100vh-5rem)] w-full flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-[var(--shadow-soft)] sm:h-[calc(100vh-3.5rem)] lg:h-[calc(100vh-3rem)]">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--bg-card)] px-5 py-4 sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--accent)]/20 bg-[var(--accent-soft)] text-[var(--accent)] shadow-sm" aria-hidden="true">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-5l-5 5v-5z" /></svg>
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-base font-black tracking-tight text-[var(--text-primary)]">AI Coach</h1>
                <span className="hidden rounded-full border border-[var(--success)]/20 bg-[var(--success-soft)] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--success)] sm:inline">Adaptive</span>
              </div>
              <p className="truncate text-xs font-medium text-[var(--text-secondary)]">General answers, subject mastery, and focused next steps.</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden md:block"><ModelSelector value={aiSelection} onChange={setAiSelection} /></div>
            <button type="button" onClick={startFresh} className="focus-ring rounded-lg border border-[var(--border)] px-3.5 py-2.5 text-[11px] font-bold text-[var(--text-primary)] transition hover:bg-[var(--bg-elevated)]">New chat</button>
          </div>
        </header>

        <div className="no-scrollbar flex flex-1 flex-col overflow-y-auto bg-[var(--bg-page)]/40">
          {messages.length === 0 ? (
            <div className="m-auto w-full max-w-5xl px-5 py-10 sm:px-8">
              <div className="mx-auto max-w-2xl text-center">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent)]/20 bg-[var(--accent-soft)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--accent)]">? Built around your question</span>
                <h2 className="mt-5 text-3xl font-black tracking-tight text-[var(--text-primary)] sm:text-4xl">Ask it your way. Get the right shape of answer.</h2>
                <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[var(--text-secondary)]">Your coach switches from simple answers to worked solutions, comparison tables, revision sprints, and study plans—without forcing every question into the same template.</p>
              </div>
              <div className="mt-9 grid gap-4 sm:grid-cols-2">
                {starterPrompts.map((starter) => {
                  const meta = answerLayouts[starter.layout];
                  return (
                    <button key={starter.label} type="button" onClick={() => void sendChatMessage(starter.prompt)} className="focus-ring group flex min-h-32 items-start gap-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 text-left shadow-2xs transition hover:-translate-y-0.5 hover:border-[var(--accent)]/30 hover:shadow-[var(--shadow-tight)]">
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-base font-bold ${meta.tone}`} aria-hidden="true">{starter.icon}</span>
                      <span className="min-w-0"><span className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">{starter.label}<span className="opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" aria-hidden="true">?</span></span><span className="mt-1.5 block text-xs leading-6 text-[var(--text-secondary)]">{meta.description}</span></span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-6 text-center text-xs font-medium text-[var(--text-faint)]">Try any subject question, a general question, or a request about your preparation.</p>
            </div>
          ) : (
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-7 px-5 py-7 sm:px-9 sm:py-8">
              <AnimatePresence initial={false}>
                {messages.map((message) => {
                  const isUser = message.role === "user";
                  return (
                    <motion.div key={message.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                      {isUser ? <div className="max-w-[88%] rounded-2xl rounded-tr-sm border border-[var(--accent)] bg-[var(--accent)] px-5 py-4 text-base font-semibold leading-7 text-white shadow-sm sm:max-w-[68%]">{message.content}</div> : <AssistantResponse message={message} onUsePrompt={(prompt) => void sendChatMessage(prompt)} />}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              {loading && <div className="flex justify-start"><div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3.5 py-2.5 shadow-2xs"><span className="flex gap-1" aria-hidden="true"><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--accent)]" /><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--accent)]" style={{ animationDelay: "150ms" }} /><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--accent)]" style={{ animationDelay: "300ms" }} /></span><span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-secondary)]">Finding the best way to explain this</span></div></div>}
              {suggestions.length > 0 && !loading && <div className="flex flex-wrap gap-2 sm:pl-1">{suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => void sendChatMessage(suggestion)} className="focus-ring rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] transition hover:border-[var(--accent)]/30 hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]">{suggestion}</button>)}</div>}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        <form onSubmit={handleSend} className="shrink-0 border-t border-[var(--border)] bg-[var(--bg-card)] p-4 sm:px-7 sm:py-5">
          <div className="mx-auto max-w-6xl"><div className="rounded-xl border border-[var(--border-strong)] bg-[var(--bg-page)]/55 p-2 shadow-inner transition focus-within:border-[var(--accent)]/60 focus-within:ring-4 focus-within:ring-[var(--focus-shadow)]">
            <textarea ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={handleKeyDown} placeholder="Ask anything—concepts, problems, plans, or everyday questions…" disabled={loading} rows={1} className="max-h-36 min-h-12 w-full resize-none bg-transparent px-3 py-3 text-base font-medium leading-6 text-[var(--text-primary)] outline-none placeholder:text-[var(--text-faint)] disabled:opacity-60" />
            <div className="flex items-center justify-between gap-3 px-1"><p className="hidden text-[10px] font-medium text-[var(--text-faint)] sm:block">Enter to send <span className="mx-1">·</span> Shift + Enter for a new line</p><div className="ml-auto flex items-center gap-2"><MicroInteractionButton type="submit" loading={loading} disabled={!input.trim()} className={`group inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-4 text-[11px] font-black uppercase tracking-[0.1em] transition ${input.trim() ? "border-[#c69437]/40 bg-gradient-to-r from-[#e8be6b] via-[#dfb15b] to-[#c69437] text-stone-900 shadow-[0_2px_10px_rgba(223,177,91,0.32)] hover:brightness-105" : "cursor-not-allowed border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-faint)]"}`}><span>Send</span><svg className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3 21l18-9L3 3l3 9m0 0h8" /></svg></MicroInteractionButton></div></div>
          </div></div>
        </form>
      </section>
    </AppShell>
  );
}