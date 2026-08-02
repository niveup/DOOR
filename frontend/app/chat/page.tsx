"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { AiMarkdown } from "@/components/AiMarkdown";
import { type AiSelection } from "@/components/ModelSelector";
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

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
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
          content: `Error communicating with coach: ${
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
    <AppShell>
      <Toaster position="top-right" richColors />

      <div className="surface flex flex-col h-[calc(100vh-5rem)] sm:h-[calc(100vh-3.5rem)] lg:h-[calc(100vh-3rem)] w-full overflow-hidden bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-sm">
        {/* Messages list */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-4 no-scrollbar bg-[var(--bg-page)]/20 flex flex-col">
          {messages.length === 0 ? (
            <div className="my-auto flex flex-col items-center justify-center text-center px-4 py-8">
              <div className="h-12 w-12 rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center mb-3">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">How can I help you today?</h2>
              <p className="mt-1 text-xs text-[var(--text-secondary)] max-w-xs">Ask anything about your preparation, weak areas, or type a command.</p>
            </div>
          ) : (
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
                      <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-tr-none border border-[var(--accent)] bg-[var(--accent)] px-4 py-2.5 text-xs font-semibold leading-relaxed text-white shadow-xs">
                        {message.content}
                      </div>
                    ) : (
                      <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-tl-none border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3 text-xs leading-relaxed text-[var(--text-primary)] shadow-2xs">
                        <div className="ai-markdown font-medium">
                          <AiMarkdown content={message.content} />
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}

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

        {/* Slim Chat Input Form */}
        <form onSubmit={handleSend} className="border-t border-[var(--border)] p-3.5 sm:p-4 bg-[var(--bg-card)] shrink-0">
          <div className="flex gap-2 max-w-4xl mx-auto w-full">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question or type a command..."
              disabled={loading}
              className="app-input flex-1 px-4 py-2.5 text-xs rounded-xl border-[var(--border)] bg-[var(--bg-page)]/40 focus:border-[var(--accent)] focus:outline-none transition"
            />
            <MicroInteractionButton
              type="submit"
              loading={loading}
              disabled={!input.trim()}
              className={`group relative px-5 py-2.5 rounded-xl font-bold text-xs text-stone-900 border transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 shrink-0 shadow-sm active:scale-[0.97] ${
                input.trim()
                  ? "bg-gradient-to-r from-[#e8be6b] via-[#dfb15b] to-[#c69437] border-[#c69437]/40 shadow-[0_2px_12px_rgba(223,177,91,0.35)] hover:shadow-[0_4px_16px_rgba(223,177,91,0.5)] hover:brightness-105"
                  : "bg-[#dfb15b]/50 border-[#c69437]/20 text-stone-900/50 cursor-not-allowed"
              }`}
            >
              <span>SEND</span>
              <svg
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  input.trim() ? "group-hover:translate-x-0.5 group-hover:-translate-y-0.5" : ""
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3 21l18-9L3 3l3 9zm0 0h8" />
              </svg>
            </MicroInteractionButton>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
