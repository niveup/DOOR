"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AiMarkdown } from "@/components/AiMarkdown";
import { ModelSelector, type AiSelection } from "@/components/ModelSelector";
import { MicroInteractionButton } from "@/components/MotionComponents";

export type TaskType = "study" | "exercise" | "reading" | "routine";

export interface PlanChatMessage {
  id: string;
  role: "assistant" | "user";
  content: string;
}

export interface PlanChatTask {
  title: string;
  taskType: TaskType;
  durationMin: number;
}

const taskTypeLedger = {
  study: { border: "border-l-stone-600", text: "text-stone-800 bg-stone-100 border-stone-300" },
  exercise: { border: "border-l-amber-600", text: "text-amber-800 bg-amber-50 border-amber-200" },
  reading: { border: "border-l-orange-700", text: "text-orange-900 bg-orange-50 border-orange-200" },
  routine: { border: "border-l-zinc-500", text: "text-zinc-700 bg-zinc-100 border-zinc-200" }
};

export function PlanChatModal({
  messages,
  input,
  suggestions,
  draftTasks,
  ready,
  loading,
  saving,
  aiSelection,
  onInputChange,
  onAiSelectionChange,
  onSend,
  onSuggestion,
  onCreate,
  onClose,
}: {
  messages: PlanChatMessage[];
  input: string;
  suggestions: string[];
  draftTasks: PlanChatTask[];
  ready: boolean;
  loading: boolean;
  saving: boolean;
  aiSelection: AiSelection;
  onInputChange: (value: string) => void;
  onAiSelectionChange: (selection: AiSelection) => void;
  onSend: (event: React.FormEvent) => void;
  onSuggestion: (suggestion: string) => void;
  onCreate: () => void;
  onClose: () => void;
}) {
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const totalMinutes = draftTasks.reduce((sum, t) => sum + t.durationMin, 0);
  const totalHours = (totalMinutes / 60).toFixed(1);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-3 sm:p-4 backdrop-blur-xs animate-fade-in"
      onMouseDown={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Plan with AI"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ type: "spring", stiffness: 280, damping: 26 }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className="surface flex h-[88vh] max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden bg-[#FAF9F6] shadow-2xl border border-stone-300 rounded-none text-stone-800"
      >
        
        {/* MODAL HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-stone-300 px-6 py-4 bg-white/70">
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold text-stone-800 tracking-tight font-serif">Plan with AI</h2>
          </div>
          
          <div className="flex items-center gap-3 self-end sm:self-center">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close planning chat"
              className="focus-ring flex h-8 w-8 items-center justify-center border border-stone-300 text-stone-500 hover:bg-stone-100 hover:text-stone-800 transition rounded-none"
            >
              ✕
            </button>
          </div>
        </div>

        {/* SPLIT PANE BODY */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-stone-300">
          
          {/* LEFT PANE - CHAT WORKSPACE (7/12 width) */}
          <div className="flex-1 md:flex-[7_7_0%] flex flex-col min-h-0 bg-white">
            
            {/* Chat message timeline */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 bg-[#FAF9F6]/20">
              <AnimatePresence initial={false}>
                {messages.map((message) => {
                  const isUser = message.role === "user";
                  return (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.12 }}
                      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                    >
                      {isUser ? (
                        /* USER: Dark charcoal cardboard slip */
                        <div className="max-w-[85%] rounded-none border border-stone-800 bg-stone-800 px-4 py-2.5 text-xs font-semibold leading-relaxed text-stone-100 shadow-sm">
                          {message.content}
                        </div>
                      ) : (
                        /* ASSISTANT: Ivory paper index card */
                        <div className="max-w-[85%] rounded-none border border-stone-300 bg-[#FCFBF8] px-4 py-3 text-xs leading-relaxed text-stone-800 shadow-2xs">
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
                  <div className="flex items-center gap-1.5 border border-stone-300 bg-[#FCFBF8] px-4 py-2">
                    <span className="text-[9px] font-mono text-stone-400 animate-pulse">GENERATING PLAN...</span>
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-stone-500" style={{ animationDelay: "0ms" }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-stone-500" style={{ animationDelay: "150ms" }} />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Highlighter-style suggestion tags */}
            <div className="px-6 py-3 bg-[#FAF9F6]/50 border-t border-stone-200">
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
                        onClick={() => onSuggestion(suggestion)}
                        className="focus-ring cursor-pointer rounded-none border border-dashed border-stone-400 bg-white px-2.5 py-1 text-[10px] font-semibold text-stone-600 tracking-tight transition-all duration-150 hover:bg-[#FDFCE4] hover:border-solid hover:border-yellow-600 hover:text-yellow-800 disabled:opacity-40"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Input Form - Cozy Blueprint Style */}
            <form onSubmit={onSend} className="border-t border-stone-300 p-4 bg-white">
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={(e) => onInputChange(e.target.value)}
                  placeholder="Request plan edits (e.g. 'remove task 2', 'make thermodynamics 60 min')..."
                  disabled={loading}
                  className="app-input flex-1 px-4 py-2.5 text-xs rounded-none border-stone-300 shadow-2xs hover:border-stone-400 focus:border-stone-800 focus:ring-0"
                />
                <MicroInteractionButton
                  type="submit"
                  loading={loading}
                  disabled={!input.trim()}
                  className="btn-secondary border border-stone-800 px-5 text-xs font-mono font-bold tracking-wider rounded-none hover:bg-stone-50"
                >
                  SEND
                </MicroInteractionButton>
              </div>
            </form>

          </div>

          {/* RIGHT PANE - PLANNING LEDGER (5/12 width) */}
          <div className="w-full md:w-auto md:flex-[5_5_0%] flex flex-col min-h-0 bg-[#FCFBF9]">
            
            {/* Ledger Stats Header */}
            <div className="p-4 border-b border-stone-300 bg-[#F5F3EC]/50">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold font-serif text-stone-800">Proposed Draft</h3>
                <span className="text-xs font-bold text-stone-700 bg-stone-100 border border-stone-300 px-2.5 py-0.5 rounded-sm tabular-nums">
                  {totalHours} hrs ({totalMinutes}m)
                </span>
              </div>

              {/* Progress Bar (Grid styled indicator) */}
              <div className="mt-3">
                <div className="flex items-center justify-between text-[9px] font-semibold text-stone-500 mb-1">
                  <span>TOTAL COMMITMENT</span>
                  <span className="tabular-nums">{Math.min(100, Math.round((totalMinutes / 480) * 100))}% Capacity</span>
                </div>
                <div className="h-2 w-full bg-stone-200 border border-stone-300 overflow-hidden">
                  <motion.div
                    className="h-full bg-stone-700"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, (totalMinutes / 480) * 100)}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>
            </div>

            {/* Tasks Ledger Rows */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-[#FAF9F6]/20">
              <AnimatePresence initial={false}>
                {draftTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-6 border border-dashed border-stone-300 bg-[#FCFBF8]">
                    <svg className="h-6 w-6 text-stone-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-[10px] font-mono font-bold text-stone-600 uppercase mt-1">No Tasks Drafted</p>
                    <p className="text-[10px] text-stone-500 font-sans mt-1 max-w-[200px] leading-normal">
                      Your study tasks will appear here once proposed in the chat.
                    </p>
                  </div>
                ) : (
                  draftTasks.map((task, index) => {
                    const theme = taskTypeLedger[task.taskType] || taskTypeLedger.study;
                    return (
                      <motion.div
                        key={`${task.title}-${index}`}
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -8 }}
                        transition={{ duration: 0.12, delay: index * 0.02 }}
                        className={`flex items-center gap-3 bg-white border border-stone-300 border-l-4 rounded-none p-3 shadow-2xs hover:border-stone-400 transition ${theme.border}`}
                      >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center border border-stone-300 bg-[#FAF9F6] text-[10px] font-bold text-stone-500">
                          {index + 1}
                        </span>
                        
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-bold text-stone-800 tracking-tight">
                            {task.title}
                          </p>
                          <span className={`inline-block text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 border mt-1 ${theme.text}`}>
                            {task.taskType}
                          </span>
                        </div>

                        <span className="text-xs font-bold text-stone-700 tabular-nums">
                          {task.durationMin}m
                        </span>
                      </motion.div>
                    );
                  })
                )}
              </AnimatePresence>
            </div>

            {/* Actions */}
            <div className="border-t border-stone-300 p-4 bg-[#F5F3EC]/50">
              <button
                onClick={onCreate}
                disabled={draftTasks.length === 0 || saving}
                className="w-full bg-stone-800 hover:bg-stone-900 border border-stone-800 text-[#FAF9F5] py-2.5 text-xs font-mono font-bold tracking-wider shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer transition uppercase"
              >
                {saving ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Saving...
                  </>
                ) : (
                  <>
                    ✓ Approve and Create Plan
                  </>
                )}
              </button>
              <p className="text-[9px] text-center text-stone-400 font-sans mt-2">
                This will apply these tasks to your today's dashboard.
              </p>
            </div>

          </div>

        </div>

      </motion.div>
    </div>
  );
}
