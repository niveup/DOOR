"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell, PageSection } from "@/components/AppShell";
import { AiMarkdown } from "@/components/AiMarkdown";
import { EmptyState, MicroInteractionButton, ProgressBar } from "@/components/MotionComponents";

type Mode = "Technical" | "HR" | "Mixed" | "GD" | "Rapid Fire";
type Dimension = { label: string; value: number };
type SessionSummary = { completed: boolean; answered: number; skipped: number; totalQuestions: number; averageScore: number };
type Feedback = { score: number; dimensions: Dimension[]; missing: string[]; improved: string; sessionSummary?: SessionSummary | null };

const companies = ["BHEL", "ONGC", "IOCL", "NTPC", "HPCL", "BPCL", "GAIL", "SAIL", "DRDO", "ISRO", "Other"];
const modes: Mode[] = ["Technical", "HR", "Mixed", "GD", "Rapid Fire"];
const questionBank: Record<Mode, string[]> = {
 Technical: ["Explain the difference between impulse and reaction turbines with one practical example.", "How will you diagnose low efficiency in a vapour compression refrigeration cycle?", "Derive the condition for maximum efficiency of a heat engine in simple terms.", "Why is factor of safety not a fixed number in machine design?", "Explain boundary layer separation and one way to delay it."],
 HR: ["Why do you want to join this PSU instead of a private engineering role?", "Tell me about a time you recovered after a weak academic phase.", "How do you handle a repetitive field posting with limited comfort?", "What is one habit you are actively correcting right now?", "Why should we trust you with a safety-critical plant responsibility?"],
 Mixed: ["Connect the Rankine cycle to the real working of a thermal power plant.", "You missed a deadline in a plant maintenance team. What do you do first?", "Explain cavitation to a non-technical manager and then name the engineering fix.", "How would you prepare for a shift handover in a refinery or power station?", "What technical subject do you consider weak, and how are you fixing it?"],
 GD: ["India should prioritize green hydrogen over conventional refinery expansion. Discuss.", "Public sector jobs reward stability more than innovation. Discuss.", "Should engineering recruitment test communication as strongly as technical knowledge?", "Automation will reduce core mechanical jobs in PSUs. Discuss.", "Safety culture matters more than production targets. Discuss."],
 "Rapid Fire": ["Define entropy in one sentence.", "Name two causes of pump cavitation.", "What is annealing used for?", "State Bernoulli's equation assumption.", "What does NPSH mean?", "What is a governor in an engine?", "Name one welding defect.", "What is inventory EOQ?", "What is the unit of thermal conductivity?", "What is the purpose of a flywheel?"],
};

function newSessionId() {
 return typeof crypto !== "undefined" && "randomUUID" in crypto ? `session_${crypto.randomUUID()}` : `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export default function InterviewPage() {
 const [company, setCompany] = useState("BHEL");
 const [mode, setMode] = useState<Mode>("Mixed");
 const [questionIndex, setQuestionIndex] = useState(0);
 const [answer, setAnswer] = useState("");
 const [feedback, setFeedback] = useState<Feedback | null>(null);
 const [error, setError] = useState("");
 const [answeredCount, setAnsweredCount] = useState(0);
 const [running, setRunning] = useState(false);
 const [timeLeft, setTimeLeft] = useState(300);
 const [evaluating, setEvaluating] = useState(false);
 const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null);
 const [sessionId, setSessionId] = useState(newSessionId);
 const skipInFlight = useRef(false);
 const backendUrl = process.env.NEXT_PUBLIC_API_URL || "/api/backend";
 const questions = questionBank[mode];
 const currentQuestion = questions[questionIndex % questions.length];
 const sessionLength = mode === "Rapid Fire" ? 10 : 5;

 const advance = () => {
  setQuestionIndex((index) => Math.min(index + 1, sessionLength - 1));
  setAnswer(""); setFeedback(null); setError("");
  setTimeLeft(mode === "Rapid Fire" ? 30 : 300);
  setRunning(mode === "Rapid Fire" && questionIndex + 1 < sessionLength);
 };

 const persistSkip = async () => {
  if (skipInFlight.current || evaluating || sessionSummary?.completed) return;
  skipInFlight.current = true;
  setRunning(false);
  try {
   const response = await fetch(`${backendUrl}/api/interview/skip`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, questionIndex, sessionLength, company, mode, question: currentQuestion }),
   });
   const result = await response.json() as { error?: string; sessionSummary?: SessionSummary | null };
   if (!response.ok) throw new Error(result.error || "Skip could not be saved.");
   setAnsweredCount((count) => Math.min(sessionLength, count + 1));
   setSessionSummary(result.sessionSummary || null);
   if (!result.sessionSummary?.completed) advance();
  } catch (skipError) {
   setError(skipError instanceof Error ? skipError.message : "Skip could not be saved. Try again.");
  } finally { skipInFlight.current = false; }
 };

 useEffect(() => {
  if (!running || mode !== "Rapid Fire" || evaluating || sessionSummary?.completed) return;
  const timer = window.setTimeout(() => {
   if (timeLeft <= 1) { void persistSkip(); return; }
   setTimeLeft((value) => value - 1);
  }, 1000);
  return () => window.clearTimeout(timer);
 }, [running, mode, timeLeft, evaluating, sessionSummary, questionIndex]);

 const progress = Math.min(100, (answeredCount / sessionLength) * 100);
 const dimensionAverage = useMemo(() => feedback ? feedback.dimensions.reduce((sum, item) => sum + item.value, 0) / feedback.dimensions.length : 0, [feedback]);

 const handleSubmit = async (event: React.FormEvent) => {
  event.preventDefault();
  if (answer.trim().length < 20) { setError("Write at least 20 characters before scoring the answer."); return; }
  setEvaluating(true); setRunning(false); setError("");
  try {
   const response = await fetch(`${backendUrl}/api/interview/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, questionIndex, sessionLength, company, mode, question: currentQuestion, answer }),
   });
   const result = await response.json() as Feedback & { error?: string };
   if (!response.ok) throw new Error(result.error || "The AI evaluator could not score this answer.");
   setFeedback(result);
   setAnsweredCount((count) => Math.min(sessionLength, count + 1));
   setSessionSummary(result.sessionSummary || null);
  } catch (submitError) {
   setError(submitError instanceof Error ? submitError.message : "The evaluator is temporarily unavailable. Your answer is still here.");
  } finally { setEvaluating(false); }
 };

 const handleModeChange = (nextMode: Mode) => {
  setMode(nextMode); setQuestionIndex(0); setAnswer(""); setFeedback(null); setError(""); setAnsweredCount(0); setSessionSummary(null); setSessionId(newSessionId()); setRunning(false); setTimeLeft(nextMode === "Rapid Fire" ? 30 : 300);
 };
 const handleNext = () => { if (!sessionSummary?.completed) advance(); };

 return (
  <AppShell eyebrow="PSU preparation" title="Interview practice" subtitle="Every answer and skip is saved to one durable session.">
   <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)_360px]">
    <aside className="space-y-5">
     <section className="surface p-4">
      <label className="mb-2 block text-xs font-bold" htmlFor="company">Company</label>
      <select id="company" value={company} onChange={(event) => setCompany(event.target.value)} disabled={answeredCount > 0} className="app-input px-3 py-2.5 text-sm font-bold">{companies.map((item) => <option key={item}>{item}</option>)}</select>
      <p className="section-label mb-3 mt-5">Mode</p>
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-1">{modes.map((item) => <button key={item} type="button" onClick={() => handleModeChange(item)} disabled={answeredCount > 0 || evaluating} className={`focus-ring min-h-11 rounded-lg border px-3 py-2 text-left text-xs font-semibold ${mode === item ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-secondary)]"}`}>{item}</button>)}</div>
     </section>
     <section className="surface p-4"><div className="mb-3 flex justify-between text-xs"><strong>Session</strong><span>{answeredCount}/{sessionLength}</span></div><ProgressBar value={progress} tone="blue" />{mode === "Rapid Fire" ? <button type="button" onClick={() => setRunning((value) => !value)} disabled={evaluating || Boolean(sessionSummary?.completed)} className="btn-secondary mt-3 w-full">{running ? `Pause (${timeLeft}s)` : `Start (${timeLeft}s)`}</button> : null}</section>
    </aside>

    <form onSubmit={handleSubmit} className="surface p-5 sm:p-6">
     {sessionSummary?.completed ? <EmptyState mark="✓" title="Session complete" description={`${sessionSummary.answered} answered, ${sessionSummary.skipped} skipped, average ${sessionSummary.averageScore}/10.`} actionLabel="Start another session" onAction={() => handleModeChange(mode)} /> : <>
      <div className="mb-5 flex justify-between"><span className="pill pill-blue">Question {questionIndex + 1}</span><span className="text-xs font-semibold text-[var(--text-secondary)]">{mode}</span></div>
      <h2 className="text-xl font-bold leading-8">{currentQuestion}</h2>
      <label className="mb-2 mt-6 block text-xs font-bold" htmlFor="interview-answer">Your answer</label>
      <textarea id="interview-answer" value={answer} onChange={(event) => setAnswer(event.target.value)} disabled={evaluating} className="app-input min-h-[220px] resize-y px-4 py-3 text-sm leading-6" />
      {error ? <p role="alert" className="mt-3 rounded-lg bg-[var(--danger-soft)] p-3 text-sm text-[var(--danger)]">{error}</p> : null}
      <div className="mt-5 flex gap-2"><button type="button" onClick={() => void persistSkip()} disabled={evaluating || skipInFlight.current} className="btn-quiet">Skip</button><MicroInteractionButton type="submit" loading={evaluating} disabled={answer.trim().length < 20} className="btn-primary">Score answer</MicroInteractionButton>{feedback ? <button type="button" onClick={handleNext} className="btn-secondary">Next question</button> : null}</div>
     </>}
    </form>

    <div className="space-y-5" aria-live="polite">
     <PageSection title="Five-part rubric" eyebrow="AI evaluation">{feedback ? <div className="surface p-4"><strong className="text-3xl">{feedback.score}<span className="text-sm text-[var(--text-secondary)]"> /10</span></strong><span className="pill pill-blue ml-3">Avg {dimensionAverage.toFixed(1)}/2</span><div className="mt-5 space-y-3">{feedback.dimensions.map((item) => <div key={item.label}><div className="mb-1 flex justify-between text-xs"><span>{item.label}</span><strong>{item.value}/2</strong></div><ProgressBar value={(item.value / 2) * 100} tone={item.value >= 1.5 ? "green" : "amber"} /></div>)}</div></div> : <EmptyState mark="R" title="Rubric appears after scoring" description="The AI uses a mode-specific five-part rubric." />}</PageSection>
     <PageSection title="What to improve" eyebrow="Coach notes">{feedback ? <div className="surface p-4"><ul className="list-disc space-y-2 pl-5 text-sm">{feedback.missing.map((item) => <li key={item}>{item}</li>)}</ul><div className="mt-5 border-t border-[var(--border)] pt-4"><AiMarkdown content={feedback.improved} /></div></div> : <EmptyState mark="I" title="Answer first, polish second" description="Your draft remains if evaluation fails." />}</PageSection>
    </div>
   </div>
  </AppShell>
 );
}
