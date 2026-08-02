"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
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

const TASK_TYPE_OPTIONS: { value: TaskType; label: string; dot: string; bg: string; text: string; shadow: string }[] = [
  { 
    value: "study", 
    label: "Study", 
    dot: "bg-amber-500 shadow-[0_0_4px_rgba(245,158,11,0.6)]", 
    bg: "bg-amber-50/90 hover:bg-amber-100/90 border-amber-300/80", 
    text: "text-amber-950",
    shadow: "shadow-[0_2px_5px_rgba(217,119,6,0.2),0_1px_2px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.9)]"
  },
  { 
    value: "exercise", 
    label: "Exercise", 
    dot: "bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.6)]", 
    bg: "bg-emerald-50/90 hover:bg-emerald-100/90 border-emerald-300/80", 
    text: "text-emerald-950",
    shadow: "shadow-[0_2px_5px_rgba(5,150,105,0.2),0_1px_2px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.9)]"
  },
  { 
    value: "reading", 
    label: "Reading", 
    dot: "bg-orange-500 shadow-[0_0_4px_rgba(249,115,22,0.6)]", 
    bg: "bg-orange-50/90 hover:bg-orange-100/90 border-orange-300/80", 
    text: "text-orange-950",
    shadow: "shadow-[0_2px_5px_rgba(234,88,12,0.2),0_1px_2px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.9)]"
  },
  { 
    value: "routine", 
    label: "Routine", 
    dot: "bg-zinc-500 shadow-[0_0_4px_rgba(113,113,122,0.5)]", 
    bg: "bg-zinc-100/90 hover:bg-zinc-200/90 border-zinc-300/80", 
    text: "text-zinc-900",
    shadow: "shadow-[0_2px_5px_rgba(82,82,91,0.2),0_1px_2px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.9)]"
  },
];

export const TASK_CARD_STYLES: Record<TaskType, { border: string; bg: string; shadow: string }> = {
  study: {
    border: "border-amber-300/90 hover:border-amber-400",
    bg: "bg-gradient-to-b from-white via-white to-amber-50/30",
    shadow: "shadow-[0_2px_8px_rgba(245,158,11,0.09),0_1px_2px_rgba(0,0,0,0.02)]",
  },
  exercise: {
    border: "border-emerald-300/90 hover:border-emerald-400",
    bg: "bg-gradient-to-b from-white via-white to-emerald-50/30",
    shadow: "shadow-[0_2px_8px_rgba(16,185,129,0.09),0_1px_2px_rgba(0,0,0,0.02)]",
  },
  reading: {
    border: "border-orange-300/90 hover:border-orange-400",
    bg: "bg-gradient-to-b from-white via-white to-orange-50/30",
    shadow: "shadow-[0_2px_8px_rgba(249,115,22,0.09),0_1px_2px_rgba(0,0,0,0.02)]",
  },
  routine: {
    border: "border-zinc-300/90 hover:border-zinc-400",
    bg: "bg-gradient-to-b from-white via-white to-zinc-50/30",
    shadow: "shadow-[0_2px_8px_rgba(113,113,122,0.09),0_1px_2px_rgba(0,0,0,0.02)]",
  },
};

export function CustomTaskTypeDropdown({
  value,
  onChange,
}: {
  value: TaskType;
  onChange: (val: TaskType) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentOpt = TASK_TYPE_OPTIONS.find((o) => o.value === value) || TASK_TYPE_OPTIONS[0];

  useEffect(() => {
    if (!open) return;

    function handleOutsideClick(e: Event) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handleOutsideClick, true);
    document.addEventListener("click", handleOutsideClick, true);
    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("pointerdown", handleOutsideClick, true);
      document.removeEventListener("click", handleOutsideClick, true);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [open]);

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-wide border transition-all duration-150 cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${currentOpt.bg} ${currentOpt.text} ${currentOpt.shadow}`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${currentOpt.dot}`} />
        <span>{currentOpt.label}</span>
        <svg
          className={`w-2.5 h-2.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 4 }}
            exit={{ opacity: 0, scale: 0.92, y: -4 }}
            transition={{ type: "spring", stiffness: 450, damping: 28, mass: 0.5 }}
            className="absolute left-0 top-full z-50 mt-1 min-w-[125px] overflow-hidden rounded-xl border border-stone-200/90 bg-white/95 backdrop-blur-md p-1 shadow-xl text-xs"
          >
            {TASK_TYPE_OPTIONS.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-[10px] font-bold transition-all cursor-pointer ${
                    isSelected
                      ? "bg-stone-100 text-stone-900 font-extrabold"
                      : "text-stone-600 hover:bg-stone-50 hover:text-stone-900"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${opt.dot}`} />
                    <span>{opt.label}</span>
                  </div>
                  {isSelected && (
                    <svg className="h-3 w-3 text-stone-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

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
  onUpdateDraftTasks,
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
  onUpdateDraftTasks?: (tasks: PlanChatTask[]) => void;
  onCreate: () => void;
  onClose: () => void;
}) {
  const chatEndRef = useRef<HTMLDivElement>(null);

  const handleUpdateTask = (index: number, patch: Partial<PlanChatTask>) => {
    const updated = [...draftTasks];
    updated[index] = { ...updated[index], ...patch };
    onUpdateDraftTasks?.(updated);
  };

  const handleDeleteTask = (index: number) => {
    const updated = draftTasks.filter((_, i) => i !== index);
    onUpdateDraftTasks?.(updated);
  };

  const hasEmptyTitle = draftTasks.some((t) => !t.title.trim());

  const handleAddTask = () => {
    const emptyIndex = draftTasks.findIndex((t) => !t.title.trim());
    if (emptyIndex !== -1) {
      toast.error(`Please enter a title for Task #${emptyIndex + 1} before adding a new task.`);
      return;
    }
    const newTask: PlanChatTask = {
      title: "",
      taskType: "study",
      durationMin: 30,
    };
    onUpdateDraftTasks?.([...draftTasks, newTask]);
  };

  // Auto-scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    const originalStyle = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  const totalMinutes = draftTasks.reduce((sum, t) => sum + t.durationMin, 0);
  const totalHours = (totalMinutes / 60).toFixed(1);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-3 sm:p-4 backdrop-blur-xs animate-fade-in overscroll-contain"
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
          
          {/* LEFT PANE - CHAT WORKSPACE (5/11 width) */}
          <div className="flex-1 md:flex-[5_5_0%] flex flex-col min-h-0 bg-white">
            
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

          {/* RIGHT PANE - PLANNING LEDGER (6/11 width - More Space for Draft) */}
          <div className="w-full md:w-auto md:flex-[6_6_0%] flex flex-col min-h-0 bg-[#FCFBF9]">
            
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
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-[#FAF9F6]/20">
              <AnimatePresence initial={false}>
                {draftTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-6 border border-dashed border-stone-300 bg-[#FCFBF8] rounded-2xl">
                    <svg className="h-6 w-6 text-stone-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-[10px] font-mono font-bold text-stone-600 uppercase mt-1">No Tasks Drafted</p>
                    <p className="text-[10px] text-stone-500 font-sans mt-1 max-w-[200px] leading-normal">
                      Your study tasks will appear here once proposed in the chat.
                    </p>
                    <button
                      type="button"
                      onClick={handleAddTask}
                      className="mt-3 px-4 py-2 bg-stone-800 text-white text-[10px] font-mono font-bold hover:bg-stone-900 rounded-full transition cursor-pointer shadow-xs"
                    >
                      + Add Task Manually
                    </button>
                  </div>
                ) : (
                  draftTasks.map((task, index) => {
                    return (
                      <motion.div
                        key={`task-${index}`}
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -8 }}
                        transition={{ duration: 0.12 }}
                        className="group relative flex items-center gap-3 bg-gradient-to-b from-white to-[#FDFCFB] border border-stone-200/90 rounded-2xl p-3.5 shadow-[0_3px_10px_rgba(0,0,0,0.05),0_1px_3px_rgba(0,0,0,0.03)] hover:border-stone-300 hover:shadow-[0_6px_18px_rgba(0,0,0,0.08)] transition-all duration-200"
                      >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-stone-100 text-[10px] font-extrabold text-stone-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(0,0,0,0.04)]">
                          {index + 1}
                        </span>
                        
                        <div className="min-w-0 flex-1 flex flex-col gap-1">
                          <input
                            type="text"
                            value={task.title}
                            onChange={(e) => handleUpdateTask(index, { title: e.target.value })}
                            placeholder="Task title..."
                            className="w-full bg-transparent text-xs font-semibold text-stone-800 tracking-tight border-b border-transparent hover:border-stone-200 focus:border-stone-400 focus:bg-stone-50/50 focus:outline-none px-1 py-0.5 rounded-md transition"
                          />
                          <div className="flex items-center gap-2">
                            <CustomTaskTypeDropdown
                              value={task.taskType}
                              onChange={(val) => handleUpdateTask(index, { taskType: val })}
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center gap-1 bg-stone-100/90 border border-stone-200/90 rounded-full px-3 py-1 shadow-[inset_0_1px_2px_rgba(0,0,0,0.05),0_1px_0_rgba(255,255,255,0.8)]">
                            <input
                              type="number"
                              min={5}
                              max={480}
                              step={5}
                              value={task.durationMin || 0}
                              onChange={(e) => handleUpdateTask(index, { durationMin: Math.max(5, parseInt(e.target.value || "0", 10)) })}
                              className="w-8 text-xs font-bold text-stone-800 text-center tabular-nums bg-transparent focus:outline-none transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <span className="text-[10px] font-bold text-stone-500">m</span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDeleteTask(index)}
                            className="opacity-40 group-hover:opacity-100 hover:text-rose-600 hover:bg-rose-50 text-stone-400 p-1.5 rounded-full transition-all cursor-pointer"
                            title="Delete task"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </AnimatePresence>

              {draftTasks.length > 0 && (
                <button
                  type="button"
                  onClick={handleAddTask}
                  className="w-full py-2.5 border border-dashed border-stone-300/90 hover:border-stone-400 bg-gradient-to-b from-white to-stone-50/70 hover:from-stone-50 hover:to-stone-100/80 text-xs font-bold text-stone-600 hover:text-stone-800 transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer rounded-2xl shadow-[0_2px_6px_rgba(0,0,0,0.03),inset_0_1px_0_rgba(255,255,255,0.9)] hover:shadow-xs mt-3"
                >
                  + Add Custom Task
                </button>
              )}
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
    </div>,
    document.body
  );
}
