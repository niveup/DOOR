"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell, PageSection } from "@/components/AppShell";
import { MicroInteractionButton, ProgressBar } from "@/components/MotionComponents";

type Mode = "Technical" | "HR" | "Mixed" | "GD" | "Rapid Fire";

type Dimension = {
  label: string;
  value: number;
};

type Feedback = {
  score: number;
  dimensions: Dimension[];
  missing: string[];
  improved: string;
};

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

const technicalTerms = [
  "cycle",
  "efficiency",
  "pressure",
  "temperature",
  "stress",
  "strain",
  "flow",
  "entropy",
  "safety",
  "maintenance",
  "turbine",
  "pump",
  "heat",
  "load",
  "design",
];

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

  const questions = questionBank[mode];
  const currentQuestion = questions[questionIndex % questions.length];
  const sessionLength = mode === "Rapid Fire" ? 10 : 5;

  useEffect(() => {
    if (!running || mode !== "Rapid Fire") return;
    const timer = window.setTimeout(() => {
      if (timeLeft <= 1) {
        setAnsweredCount((count) => Math.min(sessionLength, count + 1));
        setQuestionIndex((index) => (index + 1) % questions.length);
        setAnswer("");
        setFeedback(null);
        setError("");
        setTimeLeft(30);
        setRunning(true);
        return;
      }

      setTimeLeft((value) => value - 1);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [mode, questions.length, running, sessionLength, timeLeft]);

  const progress = Math.min(100, (answeredCount / sessionLength) * 100);

  const dimensionAverage = useMemo(() => {
    if (!feedback) return 0;
    return feedback.dimensions.reduce((sum, item) => sum + item.value, 0) / feedback.dimensions.length;
  }, [feedback]);

  const evaluateAnswer = (input: string): Feedback => {
    const words = input.trim().split(/\s+/).filter(Boolean);
    const lower = input.toLowerCase();
    const termHits = technicalTerms.filter((term) => lower.includes(term)).length;
    const hasStructure = /first|second|third|because|therefore|example|finally/.test(lower);
    const hasCompany = lower.includes(company.toLowerCase()) || lower.includes("psu") || lower.includes("plant") || lower.includes("field");
    const hasHonesty = /weak|improve|learn|miss|mistake|correct/.test(lower);

    const clarity = Math.min(2, words.length > 90 ? 2 : words.length > 35 ? 1.5 : words.length > 15 ? 1 : 0.5);
    const technical = Math.min(2, termHits >= 5 ? 2 : termHits >= 3 ? 1.5 : termHits >= 1 ? 1 : 0.5);
    const structure = hasStructure ? 2 : words.length > 60 ? 1.25 : 0.75;
    const psuFit = hasCompany ? 2 : 1;
    const honesty = hasHonesty ? 2 : 1;
    const dimensions = [
      { label: "Clarity", value: clarity },
      { label: "Technical", value: technical },
      { label: "Structure", value: structure },
      { label: "PSU fit", value: psuFit },
      { label: "Honesty", value: honesty },
    ];
    const score = Math.max(1, Math.min(10, Math.round(dimensions.reduce((sum, item) => sum + item.value, 0))));
    const missing = [
      words.length < 50 ? "Add a sharper opening and one concrete example." : "Tighten the ending into a direct conclusion.",
      termHits < 3 ? "Use more precise Mechanical Engineering terms." : "Keep technical terms connected to the actual question.",
      !hasCompany ? `Connect the answer to ${company} or PSU field responsibility.` : "Mention measurable impact or safety where relevant.",
    ];

    return {
      score,
      dimensions,
      missing,
      improved: `A stronger answer would start with the direct concept, add one mechanical example, and then connect it to ${company} work culture. Keep it crisp: definition, reason, practical implication, and an honest line about how you would verify or improve in the field.`,
    };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (answer.trim().length < 20) {
      setError("Write at least 20 characters before scoring the answer.");
      return;
    }
    setError("");
    setFeedback(evaluateAnswer(answer));
    setAnsweredCount((count) => Math.min(sessionLength, count + 1));
    setRunning(false);
  };

  const handleModeChange = (nextMode: Mode) => {
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
    setQuestionIndex((index) => (index + 1) % questions.length);
    setAnswer("");
    setFeedback(null);
    setError("");
    setTimeLeft(mode === "Rapid Fire" ? 30 : 300);
    setRunning(mode === "Rapid Fire");
  };

  const handleSkip = () => {
    setAnsweredCount((count) => Math.min(sessionLength, count + 1));
    handleNext();
  };

  return (
    <AppShell
      eyebrow="Mock interview and GD prep"
      title="Practice like the panel is already waiting"
      subtitle="Choose the PSU, choose the round, answer one prompt at a time, and get a rubric-style score with concrete missing points."
    >
      <section className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <PageSection title="Session Controls" eyebrow="Setup" className="xl:col-span-4">
          <div className="surface space-y-5 p-5">
            <label className="block">
              <span className="section-label mb-2 block">Company</span>
              <select value={company} onChange={(e) => setCompany(e.target.value)} className="app-input px-3 py-2.5 text-sm font-bold">
                {companies.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>

            <div>
              <span className="section-label mb-2 block">Mode</span>
              <div className="grid grid-cols-2 gap-2">
                {modes.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => handleModeChange(item)}
                    className={`focus-ring rounded-lg border px-3 py-2 text-left text-xs font-semibold transition ${
                      mode === item
                        ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                        : "border-[var(--border)] bg-white text-[var(--text-secondary)] hover:border-[var(--border-strong)]"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="section-label">Session</span>
                <span className="pill pill-blue">{answeredCount}/{sessionLength}</span>
              </div>
              <div className="mt-4"><ProgressBar value={progress} tone="blue" /></div>
              <p className="mt-3 text-sm font-medium leading-6 text-[var(--text-secondary)]">
                Default rounds run 5 questions. Rapid Fire runs 10 prompts with a 30-second clock.
              </p>
            </div>

            {mode === "Rapid Fire" ? (
              <div className="rounded-lg border border-[var(--warning)]/20 bg-[var(--warning-soft)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="section-label text-[var(--warning)]">Clock</span>
                  <span className="text-2xl font-semibold tabular-nums text-[var(--warning)]">{timeLeft}s</span>
                </div>
                <MicroInteractionButton onClick={() => setRunning((value) => !value)} className="btn-secondary mt-3 w-full">
                  {running ? "Pause" : "Start"}
                </MicroInteractionButton>
              </div>
            ) : null}
          </div>
        </PageSection>

        <PageSection title="Question" eyebrow={`${company} - ${mode}`} className="xl:col-span-8">
          <form onSubmit={handleSubmit} className="surface p-5">
            <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <span className="pill pill-teal">Question {(questionIndex % questions.length) + 1}</span>
                <span className="text-xs font-semibold text-[var(--text-secondary)]">{mode}</span>
              </div>
              <h2 className="text-xl font-semibold leading-tight tracking-tight text-[var(--text-primary)]">{currentQuestion}</h2>
            </div>

            <label className="mt-5 block">
              <span className="section-label mb-2 block">Your answer</span>
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Answer like you would speak in the room: direct opening, technical detail, practical example, honest closing."
                className="app-input min-h-[190px] resize-none px-4 py-3 text-sm leading-6"
              />
            </label>

            {error ? (
              <div className="mt-4 rounded-lg border border-[var(--danger)]/20 bg-[var(--danger-soft)] px-4 py-3 text-sm font-semibold text-[var(--danger)]">
                {error}
              </div>
            ) : null}

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <MicroInteractionButton type="button" onClick={handleSkip} className="btn-secondary">
                Skip
              </MicroInteractionButton>
              <MicroInteractionButton type="submit" className="btn-primary">
                Score answer
              </MicroInteractionButton>
              <MicroInteractionButton type="button" onClick={handleNext} className="btn-quiet">
                Next question
              </MicroInteractionButton>
            </div>
          </form>
        </PageSection>
      </section>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-12">
        <PageSection title="Rubric" eyebrow="Evaluation" className="xl:col-span-5">
          <div className="surface min-h-[360px] p-5">
            {feedback ? (
              <div>
                <div className="flex items-end justify-between gap-4 border-b border-[var(--border)] pb-4">
                  <div>
                    <p className="section-label mb-2">Score</p>
                    <p className="text-3xl font-semibold tracking-tight text-[var(--text-primary)]">{feedback.score}<span className="text-lg text-[var(--text-secondary)]">/10</span></p>
                  </div>
                  <span className="pill pill-blue">Avg {dimensionAverage.toFixed(1)}/2</span>
                </div>
                <div className="mt-5 space-y-3">
                  {feedback.dimensions.map((item) => (
                    <div key={item.label}>
                      <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-[var(--text-secondary)]">
                        <span>{item.label}</span>
                        <span>{item.value}/2</span>
                      </div>
                      <ProgressBar value={(item.value / 2) * 100} tone={item.value >= 1.5 ? "green" : "amber"} />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex min-h-[310px] flex-col items-center justify-center text-center">
                <span className="grid h-12 w-12 place-items-center rounded-lg bg-[var(--accent-soft)] text-sm font-semibold text-[var(--accent)]">R</span>
                <h3 className="mt-4 text-base font-semibold text-[var(--text-primary)]">Rubric appears after scoring</h3>
                <p className="mt-2 max-w-sm text-sm font-medium leading-6 text-[var(--text-secondary)]">The local evaluator follows the five-dimension scoring shape.</p>
              </div>
            )}
          </div>
        </PageSection>

        <PageSection title="Feedback" eyebrow="Missing points" className="xl:col-span-7">
          <div className="surface min-h-[360px] p-5">
            {feedback ? (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-[var(--border)] bg-white p-4">
                  <p className="section-label mb-3">Missing points</p>
                  <ul className="space-y-3 text-sm font-medium leading-6 text-[var(--text-secondary)]">
                    {feedback.missing.map((item) => (
                      <li key={item} className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-3">{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg border border-[var(--accent)]/20 bg-[var(--accent-soft)] p-4">
                  <p className="section-label text-[var(--accent)]">Improved answer shape</p>
                  <p className="mt-3 text-sm font-semibold leading-6 text-[var(--text-primary)]">{feedback.improved}</p>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[310px] flex-col items-center justify-center text-center">
                <span className="grid h-12 w-12 place-items-center rounded-lg bg-[var(--teal-soft)] text-sm font-semibold text-[var(--teal)]">I</span>
                <h3 className="mt-4 text-base font-semibold text-[var(--text-primary)]">Answer first, polish second</h3>
                <p className="mt-2 max-w-sm text-sm font-medium leading-6 text-[var(--text-secondary)]">Submit an answer to see missing points and a tighter response structure.</p>
              </div>
            )}
          </div>
        </PageSection>
      </div>
    </AppShell>
  );
}
