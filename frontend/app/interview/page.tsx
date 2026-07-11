"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell, PageSection } from "@/components/AppShell";
import { MicroInteractionButton, ProgressBar } from "@/components/MotionComponents";

type Mode = "Technical" | "HR" | "Mixed" | "GD" | "Rapid Fire";
type Dimension = { label: string; value: number };
type Feedback = { score: number; dimensions: Dimension[]; missing: string[]; improved: string };
type EvaluationResponse = Feedback & { error?: string };

const companies = ["BHEL", "ONGC", "IOCL", "NTPC", "HPCL", "BPCL", "GAIL", "SAIL", "DRDO", "ISRO", "Other"];
const modes: Mode[] = ["Technical", "HR", "Mixed", "GD", "Rapid Fire"];
const questionBank: Record<Mode, string[]> = {
  Technical: [
    "Explain the difference between impulse and reaction turbines with one practical example.",
    "How will you diagnose low efficiency in a vapour compression refrigeration cycle?",
    "Derive the condition for maximum efficiency of a heat engine in simple terms.",
    "Why is factor of safety not a fixed number in machine design?",
    "Explain boundary layer separation and one way to delay it.",
  ],
  HR: [
    "Why do you want to join this PSU instead of a private engineering role?",
    "Tell me about a time you recovered after a weak academic phase.",
    "How do you handle a repetitive field posting with limited comfort?",
    "What is one habit you are actively correcting right now?",
    "Why should we trust you with a safety-critical plant responsibility?",
  ],
  Mixed: [
    "Connect the Rankine cycle to the real working of a thermal power plant.",
    "You missed a deadline in a plant maintenance team. What do you do first?",
    "Explain cavitation to a non-technical manager and then name the engineering fix.",
    "How would you prepare for a shift handover in a refinery or power station?",
    "What technical subject do you consider weak, and how are you fixing it?",
  ],
  GD: [
    "India should prioritize green hydrogen over conventional refinery expansion. Discuss.",
    "Public sector jobs reward stability more than innovation. Discuss.",
    "Should engineering recruitment test communication as strongly as technical knowledge?",
    "Automation will reduce core mechanical jobs in PSUs. Discuss.",
    "Safety culture matters more than production targets. Discuss.",
  ],
  "Rapid Fire": [
    "Define entropy in one sentence.",
    "Name two causes of pump cavitation.",
    "What is annealing used for?",
    "State Bernoulli's equation assumption.",
    "What does NPSH mean?",
    "What is a governor in an engine?",
    "Name one welding defect.",
    "What is inventory EOQ?",
    "What is the unit of thermal conductivity?",
    "What is the purpose of a flywheel?",
  ],
};

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
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

  const questions = questionBank[mode];
  const currentQuestion = questions[questionIndex % questions.length];
  const sessionLength = mode === "Rapid Fire" ? 10 : 5;

  useEffect(() => {
    if (!running || mode !== "Rapid Fire" || evaluating) return;
    const timer = window.setTimeout(() => {
      if (timeLeft <= 1) {
        setAnsweredCount((count) => Math.min(sessionLength, count + 1));
        setQuestionIndex((index) => (index + 1) % questions.length);
        setAnswer("");
        setFeedback(null);
        setError("");
        setTimeLeft(30);
        return;
      }
      setTimeLeft((value) => value - 1);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [evaluating, mode, questions.length, running, sessionLength, timeLeft]);

  const progress = Math.min(100, (answeredCount / sessionLength) * 100);
  const dimensionAverage = useMemo(() => {
    if (!feedback?.dimensions.length) return 0;
    return feedback.dimensions.reduce((sum, item) => sum + item.value, 0) / feedback.dimensions.length;
  }, [feedback]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const preservedAnswer = answer.trim();
    if (preservedAnswer.length < 20) {
      setError("Write at least 20 characters before scoring the answer.");
      return;
    }

    setEvaluating(true);
    setRunning(false);
    setError("");
    setFeedback(null);

    try {
      const response = await fetch(`${backendUrl}/api/interview/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-passcode": "1234" },
        body: JSON.stringify({ company, mode, question: currentQuestion, answer: preservedAnswer }),
      });
      const result = (await response.json()) as EvaluationResponse;
      if (!response.ok) throw new Error(result.error || "The AI evaluator could not score this answer.");
      if (!Array.isArray(result.dimensions) || result.dimensions.length !== 5 || !Array.isArray(result.missing)) {
        throw new Error("The evaluator returned incomplete feedback. Please retry.");
      }
      setFeedback(result);
      setAnsweredCount((count) => Math.min(sessionLength, count + 1));
    } catch (evaluationError) {
      setError(
        evaluationError instanceof Error
          ? `${evaluationError.message} Your answer is still here.`
          : "The AI evaluator is unavailable. Your answer is still here; please retry."
      );
    } finally {
      setEvaluating(false);
    }
  };

  const handleModeChange = (nextMode: Mode) => {
    if (evaluating) return;
    setMode(nextMode);
    setQuestionIndex(0);
    setAnswer("");
    setFeedback(null);
    setError("");
    setAnsweredCount(0);
    setRunning(false);
    setTimeLeft(nextMode === "Rapid Fire" ? 30 : 300);
  };

  const handleNext = () => {
    if (evaluating) return;
    setQuestionIndex((index) => (index + 1) % questions.length);
    setAnswer("");
    setFeedback(null);
    setError("");
    setTimeLeft(mode === "Rapid Fire" ? 30 : 300);
    setRunning(mode === "Rapid Fire");
  };

  const handleSkip = () => {
    if (evaluating) return;
    setAnsweredCount((count) => Math.min(sessionLength, count + 1));
    handleNext();
  };

  return (
    <AppShell eyebrow="PSU preparation" title="Interview practice" subtitle="Answer one question at a time. The AI scores what you actually wrote, then shows the missing points and a stronger version.">
      <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)_360px]">
        <aside className="space-y-5">
          <section className="surface p-4">
            <label className="mb-2 block text-xs font-bold text-[var(--text-secondary)]" htmlFor="company">Company</label>
            <select id="company" value={company} onChange={(event) => setCompany(event.target.value)} disabled={evaluating} className="app-input px-3 py-2.5 text-sm font-bold">
              {companies.map((item) => <option key={item}>{item}</option>)}
            </select>
            <p className="section-label mb-3 mt-5">Mode</p>
            <div className="grid grid-cols-2 gap-2 xl:grid-cols-1">
              {modes.map((item) => (
                <button key={item} type="button" onClick={() => handleModeChange(item)} disabled={evaluating} className={`focus-ring min-h-11 rounded-lg border px-3 py-2 text-left text-xs font-semibold transition ${mode === item ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]"}`}>
                  {item}
                </button>
              ))}
            </div>
          </section>

          <section className="surface p-4">
            <div className="mb-3 flex items-center justify-between text-xs"><span className="font-bold">Session</span><span className="tabular-nums text-[var(--text-secondary)]">{answeredCount}/{sessionLength}</span></div>
            <ProgressBar value={progress} tone="blue" />
            <p className="muted-copy mt-3">Default rounds use 5 questions. Rapid Fire uses 10 prompts and a 30-second clock.</p>
            {mode === "Rapid Fire" ? (
              <div className="mt-4 rounded-lg bg-[var(--bg-elevated)] p-3">
                <div className="flex items-center justify-between"><span className="text-xs font-bold">Clock</span><strong className="tabular-nums">{timeLeft}s</strong></div>
                <button type="button" onClick={() => setRunning((value) => !value)} disabled={evaluating} className="btn-secondary mt-3 w-full">{running ? "Pause" : "Start"}</button>
              </div>
            ) : null}
          </section>
        </aside>

        <form onSubmit={handleSubmit} className="surface p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-4"><span className="pill pill-blue">Question {(questionIndex % questions.length) + 1}</span><span className="text-xs font-semibold text-[var(--text-secondary)]">{mode}</span></div>
          <h2 className="max-w-3xl text-xl font-bold leading-8 text-[var(--text-primary)]">{currentQuestion}</h2>
          <label className="mb-2 mt-6 block text-xs font-bold" htmlFor="interview-answer">Your answer</label>
          <textarea id="interview-answer" value={answer} onChange={(event) => setAnswer(event.target.value)} disabled={evaluating} placeholder="Answer as you would speak in the room: direct opening, technical detail, practical example, honest closing." className="app-input min-h-[220px] resize-y px-4 py-3 text-sm leading-6" />
          {evaluating ? <p className="mt-3 text-xs font-semibold text-[var(--accent)]" role="status">AI is checking this exact answer against the {mode} rubric…</p> : null}
          {error ? <p className="mt-3 rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-sm font-semibold text-[var(--danger)]" role="alert">{error}</p> : null}
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" onClick={handleSkip} disabled={evaluating} className="btn-quiet">Skip</button>
            <MicroInteractionButton type="submit" loading={evaluating} disabled={answer.trim().length < 20} className="btn-primary">Score answer</MicroInteractionButton>
            {feedback ? <button type="button" onClick={handleNext} className="btn-secondary">Next question</button> : null}
          </div>
        </form>

        <div className="space-y-5" aria-live="polite">
          <PageSection title="Five-part rubric" eyebrow="AI evaluation">
            {feedback ? (
              <div className="surface p-4">
                <div className="mb-5 flex items-end justify-between"><div><p className="section-label">Score</p><strong className="mt-1 block text-3xl tabular-nums">{feedback.score}<span className="text-sm text-[var(--text-secondary)]"> /10</span></strong></div><span className="pill pill-blue">Avg {dimensionAverage.toFixed(1)}/2</span></div>
                <div className="space-y-3">{feedback.dimensions.map((item) => <div key={item.label}><div className="mb-1 flex justify-between text-xs"><span>{item.label}</span><strong>{item.value}/2</strong></div><ProgressBar value={(item.value / 2) * 100} tone={item.value >= 1.5 ? "green" : "amber"} /></div>)}</div>
              </div>
            ) : (
              <div className="surface-flat p-5 text-center"><div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-[var(--accent-soft)] font-bold text-[var(--accent)]">R</div><h3 className="mt-3 font-bold">Rubric appears after scoring</h3><p className="muted-copy mt-1">The real AI evaluator uses mode-specific dimensions.</p></div>
            )}
          </PageSection>

          <PageSection title="What to improve" eyebrow="Coach notes">
            {feedback ? (
              <div className="surface p-4"><h3 className="text-sm font-bold">Missing points</h3><ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-[var(--text-secondary)]">{feedback.missing.map((item) => <li key={item}>{item}</li>)}</ul><div className="mt-5 border-t border-[var(--border)] pt-4"><h3 className="text-sm font-bold">Improved answer</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--text-secondary)]">{feedback.improved}</p></div></div>
            ) : (
              <div className="surface-flat p-5 text-center"><div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-[var(--sun-soft)] font-bold text-[var(--sun)]">I</div><h3 className="mt-3 font-bold">Answer first, polish second</h3><p className="muted-copy mt-1">Your draft stays in the editor if evaluation fails.</p></div>
            )}
          </PageSection>
        </div>
      </div>
    </AppShell>
  );
}
