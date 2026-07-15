"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { AiMarkdown } from "@/components/AiMarkdown";
import { ModelSelector, type AiSelection } from "@/components/ModelSelector";
import { MicroInteractionButton } from "@/components/MotionComponents";
import { toast, Toaster } from "sonner";
import { motion, AnimatePresence } from "motion/react";

interface ChatMessage {
  id: string;
  role: "assistant" | "user";
  content: string;
}

export default function ChatPage() {
  const router = useRouter();
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || "/api/backend";

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "coach-welcome",
      role: "assistant",
      content: "Hello! I am Jujum AI, your preparation coach. Ask me anything about your progress, schedule, or subjects, or instruct me to change the theme or navigate to another page.",
    },
  ]);
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([
    "Show me my weak areas",
    "Go to the subject tracker",
    "Switch to dark mode",
    "How is my overall readiness?",
  ]);
  const [loading, setLoading] = useState(false);
  const [aiSelection, setAiSelection] = useState<AiSelection>({
    provider: "nvidia",
    model: "meta/llama-3.1-8b-instruct",
  });

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendChatMessage = async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
    };

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
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
          aiProvider: aiSelection.provider,
          aiModel: aiSelection.model,
        }),
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("Non-JSON response received:", text.slice(0, 500));
        throw new Error("Received an invalid response from the server (possibly redirected to passcode login). Please refresh or log in again.");
      }

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to get coach response.");

      // Append AI response
      setMessages((curr) => [
        ...curr,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: result.reply || "I'm listening. How can I help you?",
        },
      ]);
      setSuggestions(Array.isArray(result.suggestions) ? result.suggestions : []);

      // Handle App Control Actions
      if (result.action && typeof result.action === "object") {
        const { type, value } = result.action;
        if (type === "SET_THEME" && (value === "dark" || value === "light")) {
          document.documentElement.dataset.theme = value;
          localStorage.setItem("jujum-theme", value);
          toast.success(`Theme switched to ${value} mode!`);
        } else if (type === "NAVIGATE" && typeof value === "string") {
          toast.info(`Opening ${value}...`);
          router.push(value);
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Connection error");
      setMessages((curr) => [
        ...curr,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: `⚠️ **Error communicating with coach**: ${
            err instanceof Error ? err.message : "Server unreachable"
          }. Please check if the backend is running.`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    void sendChatMessage(input);
  };

  return (
    <AppShell
      eyebrow="AI Coach"
      title="General Coaching & Control"
      subtitle="Ask about your study history, readiness metrics, or instruct the AI to control the web app."
      actions={<ModelSelector value={aiSelection} onChange={setAiSelection} />}
    >
      <Toaster position="top-right" richColors />

      <div className="surface flex flex-col h-[75vh] w-full max-w-4xl overflow-hidden bg-[var(--bg-card)] border border-[var(--border)] rounded-xl mx-auto shadow-sm">
        {/* Messages list */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4 no-scrollbar bg-[var(--bg-page)]/20">
          <AnimatePresence initial={false}>
            {messages.map((message) => {
              const isUser = message.role === "user";
              return (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                >
                  {isUser ? (
                    <div className="max-w-[85%] rounded-2xl rounded-tr-none border border-[var(--accent)] bg-[var(--accent)] px-4 py-2.5 text-xs font-semibold leading-relaxed text-white shadow-xs">
                      {message.content}
                    </div>
                  ) : (
                    <div className="max-w-[85%] rounded-2xl rounded-tl-none border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3 text-xs leading-relaxed text-[var(--text-primary)] shadow-2xs">
                      <div className="ai-markdown font-medium">
                        <AiMarkdown content={message.content} />
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>

          {loading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-1.5 border border-[var(--border)] bg-[var(--bg-card)] px-4 py-2 rounded-2xl rounded-tl-none">
                <span className="text-[10px] font-semibold text-[var(--text-secondary)] animate-pulse">COACH THINKING...</span>
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--text-secondary)]" style={{ animationDelay: "0ms" }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--text-secondary)]" style={{ animationDelay: "150ms" }} />
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Suggestion tags */}
        <div className="px-5 py-3 bg-[var(--bg-elevated)]/50 border-t border-[var(--border)]">
          <AnimatePresence>
            {suggestions.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-wrap gap-1.5"
              >
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    disabled={loading}
                    onClick={() => void sendChatMessage(suggestion)}
                    className="focus-ring cursor-pointer rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1.5 text-[10px] font-bold text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition-all disabled:opacity-40"
                  >
                    {suggestion}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Input form */}
        <form onSubmit={handleSend} className="border-t border-[var(--border)] p-4 bg-[var(--bg-card)] shrink-0">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question or type a command (e.g. 'switch to dark mode')..."
              disabled={loading}
              className="app-input flex-1 px-4 py-2.5 text-xs rounded-full border-[var(--border)] bg-[var(--bg-page)]/40 focus:border-[var(--accent)] focus:outline-none transition"
            />
            <MicroInteractionButton
              type="submit"
              loading={loading}
              disabled={!input.trim()}
              className="px-5 py-2.5 rounded-full font-bold text-xs text-stone-900 bg-[#dfb15b] hover:bg-[#c69437] border border-[#c69437]/25 transition cursor-pointer shadow-sm active:scale-[0.98] flex items-center justify-center"
            >
              SEND
            </MicroInteractionButton>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
