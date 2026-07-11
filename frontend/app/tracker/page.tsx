"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell, PageSection } from "@/components/AppShell";
import { AiMarkdown } from "@/components/AiMarkdown";
import { AnimatedNumber, EmptyState, MicroInteractionButton, ProgressBar } from "@/components/MotionComponents";

interface Subject { subjectId: number; subjectName: string; importanceLevel: number; topics: string[]; latestRating: number | null; hoursStudied: number; questionsSolved: number; confidenceLevel: number | null; isNeglected: boolean; hasAvoidanceWarning: boolean; aiRecommendation?: string | null }
interface TrackerData { overallReadiness: number; subjects: Subject[]; weeklyAnalysis?: string | null }
type Filter = "all" | "weak" | "neglected" | "high";
const filters: Array<{ id: Filter; label: string }> = [{ id: "all", label: "All" }, { id: "weak", label: "Weak" }, { id: "neglected", label: "Neglected" }, { id: "high", label: "High weight" }];
const cacheKey = "jujum_tracker_status_v1";

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
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await fetch(`${backendUrl}/api/tracker/status`, { headers: { "x-passcode": "1234" } });
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
      const response = await fetch(`${backendUrl}/api/tracker/rating`, { method: "POST", headers: { "Content-Type": "application/json", "x-passcode": "1234" }, body: JSON.stringify({ subjectId: selected.subjectId, selfRating: Number(rating), hoursStudied: Number(hours), questionsSolved: Number(questions), confidenceLevel: Number(confidence), notes }) });
      if (!response.ok) throw new Error("Could not save rating."); setSelected(null); await refresh(true); toast.success("Weekly rating saved");
    } catch (saveError) { toast.error(saveError instanceof Error ? saveError.message : "Tracker service is offline."); }
    finally { setSaving(false); }
  };

  return <AppShell eyebrow="Weekly readiness" title="The 14-subject map decides the next week" subtitle="Rate each subject honestly. Weak and high-weightage areas should drive the plan." actions={<MicroInteractionButton onClick={() => void refresh()} loading={loading} className="btn-secondary">Refresh</MicroInteractionButton>}>
    {error ? <div className="mb-5 rounded-lg bg-[var(--danger-soft)] p-3 text-sm font-semibold text-[var(--danger)]">{error}</div> : null}
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Metric label="Readiness" value={data?.overallReadiness || 0} suffix="%" /><Metric label="Logged" value={subjects.filter((item) => item.latestRating !== null).length} suffix="/14" /><Metric label="Weak" value={weak} suffix="" /><Metric label="Neglected" value={neglected} suffix="" /></section>
    {data?.weeklyAnalysis ? <PageSection title="Weekly analysis" eyebrow="AI review"><div className="surface p-5"><AiMarkdown content={data.weeklyAnalysis} /></div></PageSection> : null}
    <PageSection title="Subjects" eyebrow="Weekly input" action={
      <div className="flex items-center gap-1 rounded-full bg-[var(--bg-elevated)] p-1 border border-[var(--border)]">
        {filters.map((item) => {
          const isSelected = filter === item.id;
          return (
            <button 
              key={item.id} 
              onClick={() => setFilter(item.id)} 
              className={`focus-ring rounded-full px-3.5 py-1.5 text-xs font-bold transition-all duration-150 ${
                isSelected 
                  ? "bg-[var(--bg-card)] text-[var(--accent)] shadow-xs border border-[var(--border-strong)]/10" 
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
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
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((subject) => (
            <article key={subject.subjectId} className="surface p-4 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <h3 className="font-semibold text-sm leading-tight text-[var(--text-primary)]">{subject.subjectName}</h3>
                    <p className="mt-1 text-[10px] uppercase font-bold tracking-wider text-[var(--text-secondary)]">Weight {Math.round(subject.importanceLevel * 100)}%</p>
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
                <span className="text-xs text-[var(--text-secondary)]">{subject.hoursStudied}h · {subject.questionsSolved} questions</span>
                <MicroInteractionButton onClick={() => openRating(subject)} className="btn-secondary py-1 min-h-[1.8rem] text-xs">Rate</MicroInteractionButton>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState mark="T" title="No subjects in this filter" description="Switch filters or add a weekly rating to bring subjects into view." className="min-h-[320px]" />
      )}
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
            className={`focus-ring h-11 w-11 flex items-center justify-center rounded-full font-bold text-sm transition-all duration-150 border ${
              isSelected 
                ? "border-[var(--accent)] bg-[var(--accent)] text-white shadow-md shadow-[var(--accent)]/15 scale-105" 
                : "border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
            }`}
          >
            {item}
          </button>
        );
      })}
    </div>
  </div>; 
}
