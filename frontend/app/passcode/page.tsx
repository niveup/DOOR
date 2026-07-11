"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { MicroInteractionButton } from "@/components/MotionComponents";

export default function PasscodePage() {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });

      const data = (await res.json()) as { success?: boolean; error?: string };
      if (data.success) {
        router.push("/dashboard");
        router.refresh();
      } else {
        setError(data.error || "Incorrect passcode");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-background flex min-h-screen items-center justify-center px-4 py-8 text-[var(--text-primary)]">
      <main className="grid w-full max-w-5xl grid-cols-1 gap-5 lg:grid-cols-[1fr_420px]">
        <section className="surface soft-lavender hidden min-h-[560px] flex-col justify-between p-8 lg:flex">
          <div>
            <span className="pill pill-blue">Private study workspace</span>
            <h1 className="mt-8 max-w-xl text-4xl font-semibold leading-tight tracking-tight text-[var(--text-primary)]">
              Jujum AI keeps study honest.
            </h1>
            <p className="mt-5 max-w-lg text-sm font-medium leading-6 text-[var(--text-secondary)]">
              Journal at night, plan in the morning, explain weak concepts during study, and review the 14-subject readiness map every week.
            </p>
          </div>

          <div className="grid grid-cols-4 gap-3">
            {[
              ["01", "Journal"],
              ["02", "Plan"],
              ["03", "Explain"],
              ["04", "Track"],
            ].map(([step, label]) => (
              <div key={step} className="rounded-lg border border-[var(--border)] bg-white p-3">
                <p className="text-[10px] font-semibold text-[var(--accent)]">{step}</p>
                <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="surface flex min-h-[560px] flex-col justify-center p-6 sm:p-8">
          <div className="mx-auto w-full max-w-sm">
            <div className="mb-8 text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-lg border border-[var(--accent)]/20 bg-[var(--accent-soft)] text-xl font-semibold text-[var(--accent)] shadow-sm">
                J
              </div>
              <h2 className="mt-5 text-3xl font-semibold tracking-tight text-[var(--text-primary)]">Unlock Jujum AI</h2>
              <p className="mt-2 text-sm font-medium leading-6 text-[var(--text-secondary)]">
                Your private GATE and PSU mentor workspace.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block">
                <span className="section-label mb-2 block">Passcode</span>
                <input
                  type="password"
                  value={passcode}
                  onChange={(event) => setPasscode(event.target.value)}
                  placeholder="Enter passcode"
                  disabled={loading}
                  className={`app-input px-4 py-3 text-center text-lg font-semibold tracking-[0.25em] ${error ? "error" : ""}`}
                />
              </label>

              <AnimatePresence>
                {error ? (
                  <motion.div
                    initial={{ opacity: 0, y: shouldReduceMotion ? 0 : -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -4 }}
                    transition={{ duration: shouldReduceMotion ? 0.01 : 0.15 }}
                    className="rounded-lg border border-[var(--danger)]/20 bg-[var(--danger-soft)] px-3 py-2 text-center text-sm font-bold text-[var(--danger)]"
                  >
                    {error}
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <MicroInteractionButton type="submit" loading={loading} disabled={loading || !passcode} className="btn-primary w-full">
                Unlock workspace
              </MicroInteractionButton>
            </form>

            <div className="mt-8 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
              <p className="section-label mb-2">Mentor principle</p>
              <p className="text-sm font-semibold leading-6 text-[var(--text-secondary)]">
                Honesty beats motivation. The app should point to the next real action, not decorate missed work.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

