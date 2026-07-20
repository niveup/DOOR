"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "motion/react";
import { AppShell, PageSection } from "@/components/AppShell";
import { AiMarkdown } from "@/components/AiMarkdown";
import { AnimatedNumber, EmptyState, MicroInteractionButton, ProgressBar } from "@/components/MotionComponents";

interface Subject { subjectId: number; subjectName: string; importanceLevel: number; topics: string[]; latestRating: number | null; hoursStudied: number; questionsSolved: number; confidenceLevel: number | null; isNeglected: boolean; hasAvoidanceWarning: boolean; aiRecommendation?: string | null; cumulativeHours?: number; cumulativeQuestions?: number }
interface TrackerData { overallReadiness: number; subjects: Subject[]; weeklyAnalysis?: string | null }
type Filter = "all" | "weak" | "neglected" | "high";
const filters: Array<{ id: Filter; label: string }> = [{ id: "all", label: "All" }, { id: "weak", label: "Weak" }, { id: "neglected", label: "Neglected" }, { id: "high", label: "High weight" }];
const cacheKey = "jujum_tracker_status_v1";

const faqs: Array<{ term: string; detail: string }> = [
  { term: "Readiness", detail: "How exam-ready you are overall, shown as a percentage. It is a weighted average of all your subject ratings — subjects that carry more marks in the exam count for more. If you rate everything 5 out of 5, you reach 100%." },
  { term: "Logged", detail: "How many of the 14 subjects you have rated this week, shown as a count out of 14. Every time you rate a subject, it counts as logged. Aim to log all of them each week for an accurate picture." },
  { term: "Weak", detail: "The number of subjects you rated 2 out of 5 or lower. These are the topics you understand the least right now, so they usually deserve the most study time." },
  { term: "Neglected", detail: "Subjects you have not rated in over three weeks (or have never rated). They have quietly dropped off your radar — a quick rating brings them back into your plan." },
  { term: "High weight", detail: "Subjects that carry the most marks in the exam. Doing well here moves your readiness the most, so they should usually be a priority." },
  { term: "Weight %", detail: "Shown on each subject card. It is that subject's share of the exam. A higher percentage means more marks come from it, so it matters more for your final score." },
  { term: "Avoidance warning", detail: "A red badge that appears when you have rated a subject 2 out of 5 or lower for three weeks in a row. It is a gentle nudge that you may be avoiding a topic you find hard." },
  { term: "Star rating (x/5)", detail: "Your own honest rating of how well you know a subject, from 1 (completely lost) to 5 (fully mastered). This single number drives most of the other stats, so rate honestly." },
  { term: "Hours & Questions", detail: "On each card, the first values are your effort this week; the values in brackets are your running totals across all weeks. They help you see both recent activity and long-term consistency." },
];

export default function TrackerPage() {
  const [data, setData] = useState<TrackerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Subject | null>(null);
  const [rating, setRating] = useState("3");
  const [hours, setHours] = useState("0");
  const [questions, setQuestions] = useState("0");
  const [confidence, setConfidence] = useState("3");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || "/api/backend";

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await fetch(`${backendUrl}/api/tracker/status?t=${Date.now()}`, {
        headers: { "Cache-Control": "no-cache" }
      });
      const result = (await response.json()) as TrackerData & { error?: string };
      if (!response.ok) throw new Error(result.error || "Tracker progress could not be loaded.");
      setData(result); setError(""); localStorage.setItem(cacheKey, JSON.stringify(result));
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Unable to connect to the tracker database."); }
    finally { setLoading(false); }
  }, [backendUrl]);

  useEffect(() => { const cached = localStorage.getItem(cacheKey); if (cached) { try { setData(JSON.parse(cached)); setLoading(false); } catch { localStorage.removeItem(cacheKey); } } void refresh(Boolean(cached)); }, [refresh]);

  const subjects = useMemo(() => data?.subjects || [], [data]);
  const visible = useMemo(() => subjects.filter((subject) => filter === "all" || (filter === "weak" && subject.latestRating !== null && subject.latestRating <= 2) || (filter === "neglected" && subject.isNeglected) || (filter === "high" && subject.importanceLevel >= .1)), [subjects, filter]);
  const weak = subjects.filter((subject) => subject.latestRating !== null && subject.latestRating <= 2).length;
  const neglected = subjects.filter((subject) => subject.isNeglected).length;

  const openRating = (subject: Subject) => { setSelected(subject); setRating(String(subject.latestRating || 3)); setHours(String(subject.hoursStudied || 0)); setQuestions(String(subject.questionsSolved || 0)); setConfidence(String(subject.confidenceLevel || 3)); setNotes(""); };
  const saveRating = async (event: React.FormEvent) => {
    event.preventDefault(); if (!selected) return; setSaving(true);
    try {
      const response = await fetch(`${backendUrl}/api/tracker/rating`, { method: "POST", headers: { "Content-Type": "application/json",}, body: JSON.stringify({ subjectId: selected.subjectId, selfRating: Number(rating), hoursStudied: Number(hours), questionsSolved: Number(questions), confidenceLevel: Number(confidence), notes }) });
      if (!response.ok) throw new Error("Could not save rating."); setSelected(null); await refresh(true); toast.success("Weekly rating saved");
    } catch (saveError) { toast.error(saveError instanceof Error ? saveError.message : "Tracker service is offline."); }
    finally { setSaving(false); }
  };

  return <AppShell eyebrow="Weekly readiness" title="How ready are you?" subtitle={"\u00A0"} actions={<MicroInteractionButton onClick={() => void refresh()} loading={loading} className="btn-secondary">Refresh</MicroInteractionButton>}>
    {error ? <div className="mb-5 rounded-lg bg-[var(--danger-soft)] p-3 text-sm font-semibold text-[var(--danger)]">{error}</div> : null}
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Metric label="Readiness" value={data?.overallReadiness || 0} suffix="%" /><Metric label="Logged" value={subjects.filter((item) => item.latestRating !== null).length} suffix="/14" /><Metric label="Weak" value={weak} suffix="" /><Metric label="Neglected" value={neglected} suffix="" /></section>
    <PageSection title="Your subjects" titleClassName="text-lg font-semibold tracking-tight text-[var(--text-primary)]" className="mt-6" headerClassName="mb-6" action={
      <div className="relative flex items-center rounded-full bg-[var(--bg-elevated)] p-1 border border-[var(--border)] w-fit z-0">
        {filters.map((item) => {
          const isSelected = filter === item.id;
          return (
            <button 
              key={item.id} 
              onClick={() => setFilter(item.id)} 
              className="focus-ring relative rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors duration-250 text-[var(--text-secondary)] hover:text-[var(--text-primary)] z-10 border border-transparent"
            >
              {isSelected && (
                <motion.div 
                  layoutId="active-filter" 
                  className="absolute inset-0 bg-[var(--bg-card)] rounded-full border border-[var(--border-strong)]/10 shadow-xs -z-10"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              {item.label}
            </button>
          );
        })}
      </div>
    }>
      {loading && !data ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[1,2,3,4,5,6].map((item) => (
            <div key={item} className="surface h-40 animate-pulse bg-[var(--track)]" />
          ))}
        </div>
      ) : visible.length ? (
        <motion.div 
          key={filter}
          initial={{ opacity: 0.88, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
          className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"
        >
          {visible.map((subject) => (
            <article key={subject.subjectId} className="surface p-4 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <h3 className="font-semibold text-sm leading-tight text-[var(--text-primary)]">{subject.subjectName}</h3>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <p className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-secondary)]">Weight {Math.round(subject.importanceLevel * 100)}%</p>
                      {subject.hasAvoidanceWarning && (
                        <span className="inline-flex items-center bg-rose-50 border border-rose-200 text-rose-600 px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wider select-none shrink-0">Avoidance</span>
                      )}
                      {subject.isNeglected && (
                        <span className="inline-flex items-center bg-amber-50 border border-amber-200 text-amber-600 px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wider select-none shrink-0">Neglected</span>
                      )}
                    </div>
                  </div>
                  {subject.latestRating ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--accent)]/15 bg-gradient-to-br from-[var(--bg-card)] to-[var(--accent-soft)] px-2.5 py-1 text-[10px] font-extrabold tracking-wider text-[var(--accent)] shadow-2xs shrink-0">
                      ★ {subject.latestRating}/5
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--warning)]/15 bg-gradient-to-br from-[var(--bg-card)] to-[var(--warning-soft)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--warning)] shadow-2xs shrink-0">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--warning)] opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[var(--warning)]"></span>
                      </span>
                      Not rated
                    </span>
                  )}
                </div>
                <ProgressBar value={((subject.latestRating || 0) / 5) * 100} tone={subject.latestRating && subject.latestRating <= 2 ? "rose" : "blue"} />
                <p className="mt-3 line-clamp-2 text-xs leading-5 text-[var(--text-secondary)]">{subject.topics.join(", ")}</p>
                {subject.aiRecommendation ? (
                  <div className="mt-3 border-t border-[var(--border)] pt-3">
                    <AiMarkdown content={subject.aiRecommendation} />
                  </div>
                ) : null}
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-3">
                <span className="text-[10.5px] leading-5 text-[var(--text-secondary)]">
                  {subject.hoursStudied}h this week <span className="text-[var(--text-faint)]">(Total: {subject.cumulativeHours || 0}h)</span> · {subject.questionsSolved} Qs <span className="text-[var(--text-faint)]">(Total: {subject.cumulativeQuestions || 0})</span>
                </span>
                <MicroInteractionButton onClick={() => openRating(subject)} className="btn-secondary py-1 min-h-[1.8rem] text-xs">Rate</MicroInteractionButton>
              </div>
            </article>
          ))}
        </motion.div>
      ) : (
        <EmptyState mark="T" title="No subjects in this filter" description="Switch filters or add a weekly rating to bring subjects into view." className="min-h-[320px]" />
      )}
    </PageSection>
    {data?.weeklyAnalysis ? <PageSection title="Weekly analysis" className="mt-6"><div className="surface p-5"><AiMarkdown content={data.weeklyAnalysis} /></div></PageSection> : null}
    <PageSection title="What do these terms mean?" titleClassName="text-lg font-semibold tracking-tight text-[var(--text-primary)]" eyebrow="Help & FAQ" className="mt-6">
      <div className="space-y-2.5">
        {faqs.map((item) => (
          <details key={item.term} className="surface group overflow-hidden p-0">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3.5 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-elevated)]">
              <span>{item.term}</span>
              <svg className="h-4 w-4 shrink-0 text-[var(--text-secondary)] transition-transform duration-200 group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </summary>
            <p className="border-t border-[var(--border)] px-5 py-3.5 text-[13px] leading-6 text-[var(--text-secondary)]">{item.detail}</p>
          </details>
        ))}
      </div>
    </PageSection>
    {selected ? (
      <div className="fixed inset-0 z-50 grid place-items-center bg-black/20 p-4" onClick={() => setSelected(null)}>
        <form onSubmit={saveRating} onClick={(event) => event.stopPropagation()} className="surface w-full max-w-md space-y-5 p-6">
          <div>
            <p className="section-label">Weekly log</p>
            <h2 className="mt-1.5 text-xl font-bold tracking-tight">{selected.subjectName}</h2>
          </div>
          <Rating label="Self rating" value={rating} onChange={setRating} />
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="section-label mb-2 block">Hours</span>
              <input type="number" min="0" step=".5" value={hours} onChange={(event) => setHours(event.target.value)} className="app-input px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="section-label mb-2 block">Questions</span>
              <input type="number" min="0" value={questions} onChange={(event) => setQuestions(event.target.value)} className="app-input px-3 py-2 text-sm" />
            </label>
          </div>
          <Rating label="Confidence" value={confidence} onChange={setConfidence} />
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Weak sub-topics, mistakes, revision needed..." className="app-input min-h-24 p-3 text-sm" />
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={() => setSelected(null)} className="btn-quiet">Cancel</button>
            <MicroInteractionButton type="submit" loading={saving} className="btn-primary">Save</MicroInteractionButton>
          </div>
        </form>
      </div>
    ) : null}
  </AppShell>;
}

function Metric({ label, value, suffix }: { label: string; value: number; suffix: string }) { return <div className="surface p-4"><p className="section-label">{label}</p><p className="mt-4 text-2xl font-semibold"><AnimatedNumber value={value} /><span className="ml-1 text-sm text-[var(--text-secondary)]">{suffix}</span></p></div>; }
function Rating({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { 
  const ratingEmojis: Record<number, string> = {
    1: "😟",
    2: "😐",
    3: "🙂",
    4: "😊",
    5: "⚡",
  };
  return <div>
    <span className="section-label mb-2.5 block">{label}</span>
    <div className="flex justify-center gap-3">
      {[1,2,3,4,5].map((item) => {
        const isSelected = Number(value) === item;
        return (
          <button 
            key={item} 
            type="button" 
            onClick={() => onChange(String(item))} 
            className={`focus-ring h-12 w-12 flex flex-col items-center justify-center rounded-full font-bold transition-all duration-150 border ${
              isSelected 
                ? "border-[var(--accent)] bg-[var(--accent)] text-white shadow-md shadow-[var(--accent)]/15 scale-105" 
                : "border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
            }`}
          >
            <span className="text-base leading-none">{ratingEmojis[item]}</span>
            <span className="text-[9px] leading-none mt-0.5 opacity-80">{item}</span>
          </button>
        );
      })}
    </div>
  </div>; 
}
