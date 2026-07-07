"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import { AppShell, PageSection } from "@/components/AppShell";
import { AnimatedNumber, EmptyState, MicroInteractionButton, ProgressBar } from "@/components/MotionComponents";

interface Subject {
  subjectId: number;
  subjectName: string;
  importanceLevel: number;
  topics: string[];
  latestRating: number | null;
  hoursStudied: number;
  questionsSolved: number;
  confidenceLevel: number | null;
  isNeglected: boolean;
  hasAvoidanceWarning: boolean;
}

interface TrackerData {
  overallReadiness: number;
  subjects: Subject[];
}

type Filter = "all" | "weak" | "neglected" | "high";

const filters: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "weak", label: "Weak" },
  { id: "neglected", label: "Neglected" },
  { id: "high", label: "High weight" },
];

const trackerCacheKey = "jujum_tracker_status_v1";
const subjectCatalog: Subject[] = [
  [1, "Engineering Mathematics", 0.14],
  [2, "Engineering Mechanics", 0.06],
  [3, "Strength of Materials", 0.09],
  [4, "Theory of Machines", 0.09],
  [5, "Machine Design", 0.06],
  [6, "Fluid Mechanics", 0.09],
  [7, "Heat Transfer", 0.06],
  [8, "Thermodynamics", 0.11],
  [9, "Power Plant Engineering", 0.05],
  [10, "Refrigeration & Air Conditioning", 0.05],
  [11, "Internal Combustion Engines", 0.05],
  [12, "Manufacturing Engineering", 0.14],
  [13, "Industrial Engineering", 0.06],
  [14, "General Aptitude", 0.15],
].map(([subjectId, subjectName, importanceLevel]) => ({
  subjectId: Number(subjectId),
  subjectName: String(subjectName),
  importanceLevel: Number(importanceLevel),
  topics: ["Syncing latest weekly progress"],
  latestRating: null,
  hoursStudied: 0,
  questionsSolved: 0,
  confidenceLevel: null,
  isNeglected: false,
  hasAvoidanceWarning: false,
}));

export default function TrackerPage() {
  const [data, setData] = useState<TrackerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [selfRating, setSelfRating] = useState("3");
  const [hoursStudied, setHoursStudied] = useState("0");
  const [questionsSolved, setQuestionsSolved] = useState("0");
  const [confidenceLevel, setConfidenceLevel] = useState("3");
  const [notes, setNotes] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

  const fetchTrackerStatus = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/tracker/status`, {
        headers: { "x-passcode": "1234" },
      });
      if (res.ok) {
        const result = (await res.json()) as TrackerData;
        setData(result);
        window.localStorage.setItem(trackerCacheKey, JSON.stringify(result));
        setError("");
      } else {
        setError("Tracker progress could not be loaded.");
      }
    } catch {
      setError("Unable to connect to the tracker database.");
    } finally {
      setLoading(false);
    }
  }, [backendUrl]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      let hasCachedData = false;
      try {
        const cached = window.localStorage.getItem(trackerCacheKey);
        if (cached) {
          const parsed = JSON.parse(cached) as TrackerData;
          if (Array.isArray(parsed.subjects)) {
            setData(parsed);
            setLoading(false);
            hasCachedData = true;
          }
        }
      } catch {
        window.localStorage.removeItem(trackerCacheKey);
      }

      if (!hasCachedData) {
        setData({ overallReadiness: 0, subjects: subjectCatalog });
        setLoading(false);
      }
      void fetchTrackerStatus(hasCachedData);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [fetchTrackerStatus]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedSubject(null);
    };
    if (selectedSubject) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedSubject]);

  const handleOpenRatingModal = (subject: Subject) => {
    setSelectedSubject(subject);
    setSelfRating(String(subject.latestRating || 3));
    setHoursStudied(String(subject.hoursStudied || 0));
    setQuestionsSolved(String(subject.questionsSolved || 0));
    setConfidenceLevel(String(subject.confidenceLevel || 3));
    setNotes("");
  };

  const handleRatingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubject) return;

    setSubmitLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/tracker/rating`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-passcode": "1234",
        },
        body: JSON.stringify({
          subjectId: selectedSubject.subjectId,
          selfRating: Number(selfRating),
          hoursStudied: Number(hoursStudied),
          questionsSolved: Number(questionsSolved),
          confidenceLevel: Number(confidenceLevel),
          notes,
        }),
      });

      if (res.ok) {
        setSelectedSubject(null);
        await fetchTrackerStatus(true);
        toast.success("Weekly rating saved");
      } else {
        toast.error("Could not save rating");
      }
    } catch {
      toast.error("Tracker service is offline");
    } finally {
      setSubmitLoading(false);
    }
  };

  const subjects = useMemo(() => data?.subjects || [], [data?.subjects]);
  const loggedCount = subjects.filter((subject) => subject.latestRating !== null).length;
  const weakCount = subjects.filter((subject) => subject.latestRating !== null && subject.latestRating <= 2).length;
  const neglectedCount = subjects.filter((subject) => subject.isNeglected).length;

  const filteredSubjects = useMemo(() => {
    if (filter === "weak") return subjects.filter((subject) => subject.latestRating !== null && subject.latestRating <= 2);
    if (filter === "neglected") return subjects.filter((subject) => subject.isNeglected);
    if (filter === "high") return subjects.filter((subject) => subject.importanceLevel >= 0.1);
    return subjects;
  }, [filter, subjects]);

  const topRisks = useMemo(
    () =>
      [...subjects]
        .sort((a, b) => {
          const riskA = (a.isNeglected ? 2 : 0) + (a.hasAvoidanceWarning ? 3 : 0) + (5 - (a.latestRating || 0)) * a.importanceLevel;
          const riskB = (b.isNeglected ? 2 : 0) + (b.hasAvoidanceWarning ? 3 : 0) + (5 - (b.latestRating || 0)) * b.importanceLevel;
          return riskB - riskA;
        })
        .slice(0, 4),
    [subjects]
  );

  return (
    <AppShell
      eyebrow="Weekly readiness"
      title="The 14-subject map decides the next week"
      subtitle="Rate each GATE ME subject honestly. The tracker turns weak, neglected, and high-weightage subjects into a practical readiness percentage."
      actions={
        <MicroInteractionButton onClick={() => void fetchTrackerStatus()} loading={loading} className="btn-secondary">
          Refresh tracker
        </MicroInteractionButton>
      }
    >
      {error ? (
        <div className="mb-5 rounded-lg border border-[var(--danger)]/20 bg-[var(--danger-soft)] px-4 py-3 text-sm font-semibold text-[var(--danger)]">
          {error}
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <TrackerMetric label="Readiness" value={data?.overallReadiness || 0} suffix="%" tone="blue" />
        <TrackerMetric label="Subjects logged" value={loggedCount} suffix="/14" tone="green" />
        <TrackerMetric label="Weak subjects" value={weakCount} suffix="" tone="rose" />
        <TrackerMetric label="Neglected" value={neglectedCount} suffix="" tone="amber" />
      </section>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-12">
        <PageSection
          title="Subject Grid"
          eyebrow="Weekly input"
          className="xl:col-span-8"
          action={
            <div className="flex rounded-full border border-[var(--border)] bg-white p-1">
              {filters.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilter(item.id)}
                  className={`focus-ring rounded-full px-2.5 py-1.5 text-[11px] font-semibold transition ${
                    filter === item.id ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          }
        >
          {loading && !data ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((item) => (
                <div key={item} className="surface h-32 animate-pulse p-3">
                  <div className="h-3 w-2/3 rounded bg-[var(--track)]" />
                  <div className="mt-4 h-2 rounded bg-[var(--track)]" />
                  <div className="mt-2 h-2 w-5/6 rounded bg-[var(--track)]" />
                  <div className="mt-7 h-7 rounded bg-[var(--track)]" />
                </div>
              ))}
            </div>
          ) : filteredSubjects.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {filteredSubjects.map((subject) => (
                <div key={subject.subjectId} className="surface interactive-surface p-3">
                  <div className="flex min-h-[132px] flex-col justify-between gap-3">
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-semibold tracking-tight text-[var(--text-primary)]">{subject.subjectName}</h3>
                          <p className="mt-1 text-[11px] font-medium text-[var(--text-secondary)]">Weight {Math.round(subject.importanceLevel * 100)}%</p>
                        </div>
                        <StatusPills subject={subject} />
                      </div>
                      <div className="mt-3">
                        <div className="flex items-center justify-between gap-3 text-[11px] font-semibold text-[var(--text-secondary)]">
                          <span>Self rating</span>
                          <span>{subject.latestRating ? `${subject.latestRating}/5` : "Not logged"}</span>
                        </div>
                        <div className="mt-2 flex gap-1">
                          {[1, 2, 3, 4, 5].map((value) => (
                            <span
                              key={value}
                              className={`h-1.5 flex-1 rounded-full ${value <= (subject.latestRating || 0) ? "bg-[var(--accent)]" : "bg-[var(--track)]"}`}
                            />
                          ))}
                        </div>
                      </div>
                      <p className="mt-3 line-clamp-1 text-[11px] font-medium text-[var(--text-secondary)]">
                        {Array.isArray(subject.topics) ? subject.topics.join(", ") : "Topics will appear after seeding."}
                      </p>
                    </div>

                    <div className="grid grid-cols-[1fr_auto] items-end gap-3 border-t border-[var(--border)] pt-3">
                      <div className="grid grid-cols-2 gap-2 text-[11px] font-medium text-[var(--text-secondary)]">
                        <span>{subject.hoursStudied || 0}h studied</span>
                        <span>{subject.questionsSolved || 0} questions</span>
                      </div>
                      <MicroInteractionButton onClick={() => handleOpenRatingModal(subject)} className="btn-secondary min-h-0 px-3 py-1.5">
                        Rate
                      </MicroInteractionButton>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState mark="T" title="No subjects in this filter" description="Switch filters or seed the subjects table to fill the weekly tracker grid." className="min-h-[360px]" />
          )}
        </PageSection>

        <PageSection title="Risk Radar" eyebrow="Next review" className="xl:col-span-4">
          <div className="surface p-5">
            <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
              <p className="section-label mb-2">Readiness formula</p>
              <p className="text-sm font-medium leading-6 text-[var(--text-secondary)]">
                Ratings are normalized across 14 subjects. High-weightage weak areas should be handled first, especially General Aptitude, Manufacturing, Mathematics, and Thermodynamics.
              </p>
              <div className="mt-4">
                <ProgressBar value={data?.overallReadiness || 0} tone="blue" />
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {topRisks.length > 0 ? (
                topRisks.map((subject, index) => (
                  <div key={subject.subjectId} className="rounded-lg border border-[var(--border)] bg-white p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{subject.subjectName}</p>
                        <p className="mt-1 text-xs font-semibold text-[var(--text-secondary)]">
                          Rating {subject.latestRating || 0}/5 - Weight {Math.round(subject.importanceLevel * 100)}%
                        </p>
                      </div>
                      <span className="grid h-7 w-7 place-items-center rounded-md bg-[var(--accent-soft)] text-xs font-semibold text-[var(--accent)]">{index + 1}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm font-semibold text-[var(--text-secondary)]">Risk radar appears after tracker data loads.</p>
              )}
            </div>
          </div>
        </PageSection>
      </div>

      {selectedSubject ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: shouldReduceMotion ? 0.01 : 0.15 }}
          onClick={() => setSelectedSubject(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(88,104,126,0.18)] p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: shouldReduceMotion ? 0.01 : 0.18 }}
            onClick={(event) => event.stopPropagation()}
            className="surface w-full max-w-lg p-5"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-4">
              <div>
                <p className="section-label mb-2">Weekly log</p>
                <h3 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">{selectedSubject.subjectName}</h3>
                <p className="mt-1 text-sm font-medium text-[var(--text-secondary)]">Rate understanding, effort, confidence, and weak spots.</p>
              </div>
              <button type="button" onClick={() => setSelectedSubject(null)} className="focus-ring rounded-lg px-3 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]">
                Close
              </button>
            </div>

            <form onSubmit={handleRatingSubmit} className="mt-5 space-y-4">
              <RatingSelector label="Self rating" value={selfRating} onChange={setSelfRating} />
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="section-label mb-2 block">Hours</span>
                  <input type="number" step="0.5" min="0" value={hoursStudied} onChange={(e) => setHoursStudied(e.target.value)} className="app-input px-3 py-2 text-sm" />
                </label>
                <label className="block">
                  <span className="section-label mb-2 block">Questions</span>
                  <input type="number" min="0" value={questionsSolved} onChange={(e) => setQuestionsSolved(e.target.value)} className="app-input px-3 py-2 text-sm" />
                </label>
              </div>
              <RatingSelector label="Confidence" value={confidenceLevel} onChange={setConfidenceLevel} />
              <label className="block">
                <span className="section-label mb-2 block">Notes</span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Sub-topics that still feel shaky, question types missed, revision needed..."
                  className="app-input min-h-[88px] resize-none px-3 py-2 text-sm leading-6"
                />
              </label>
              <MicroInteractionButton type="submit" loading={submitLoading} className="btn-primary w-full">
                Save weekly log
              </MicroInteractionButton>
            </form>
          </motion.div>
        </motion.div>
      ) : null}
    </AppShell>
  );
}

function TrackerMetric({ label, value, suffix, tone }: { label: string; value: number; suffix: string; tone: "blue" | "green" | "amber" | "rose" }) {
  const pillClass = { blue: "pill-blue", green: "pill-green", amber: "pill-amber", rose: "pill-rose" }[tone];
  return (
    <div className="surface interactive-surface flex min-h-[112px] flex-col justify-between p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="section-label">{label}</p>
        <span className={`pill ${pillClass}`}>Week</span>
      </div>
      <div>
        <p className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
          <AnimatedNumber value={value} />
          <span className="ml-1 text-sm text-[var(--text-secondary)]">{suffix}</span>
        </p>
        <div className="mt-2"><ProgressBar value={suffix === "%" ? value : Math.min(value * 8, 100)} tone={tone} /></div>
      </div>
    </div>
  );
}

function StatusPills({ subject }: { subject: Subject }) {
  if (subject.hasAvoidanceWarning) return <span className="pill pill-rose">Avoid</span>;
  if (subject.isNeglected) return <span className="pill pill-amber">Neglected</span>;
  if ((subject.latestRating || 0) >= 4) return <span className="pill pill-green">Strong</span>;
  return <span className="pill pill-blue">Track</span>;
}

function RatingSelector({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <span className="section-label mb-2 block">{label}</span>
      <div className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onChange(String(item))}
            className={`focus-ring rounded-lg border px-3 py-2 text-sm font-semibold transition ${
              Number(value) === item
                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                : "border-[var(--border)] bg-white text-[var(--text-secondary)] hover:border-[var(--border-strong)]"
            }`}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}
