"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PasscodePage() {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!passcode || loading) return;
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      const result = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !result.success) {
        setError(result.error || "That passcode is not correct.");
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("The workspace could not be reached. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="entry-screen">
      <section className="entry-intro" aria-labelledby="entry-title">
        <div className="entry-brand">
          <span className="brand-seal" aria-hidden="true">J</span>
          <span>Jujum AI</span>
        </div>
        <div>
          <p className="entry-eyebrow">Private study workspace</p>
          <h1 id="entry-title">Do the work.<br />Keep the record.</h1>
          <p className="entry-lead">A quiet system for GATE Mechanical prep: plan the day, study the weak spots, and close the loop honestly.</p>
        </div>
        <ol className="entry-loop" aria-label="Daily study loop">
          <li><span>01</span>Plan</li>
          <li><span>02</span>Study</li>
          <li><span>03</span>Review</li>
          <li><span>04</span>Repeat</li>
        </ol>
      </section>

      <section className="entry-panel" aria-label="Unlock workspace">
        <form onSubmit={handleSubmit} className="entry-form">
          <div>
            <p className="entry-eyebrow">Welcome back</p>
            <h2>Unlock your workspace</h2>
            <p>Enter the private passcode to continue.</p>
          </div>
          <label htmlFor="passcode">Passcode</label>
          <input
            id="passcode"
            type="password"
            value={passcode}
            onChange={(event) => setPasscode(event.target.value)}
            autoComplete="current-password"
            inputMode="numeric"
            autoFocus
            disabled={loading}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "passcode-error" : undefined}
            className={`app-input entry-input${error ? " error" : ""}`}
            placeholder="Enter passcode"
          />
          {error ? <p id="passcode-error" role="alert" className="entry-error">{error}</p> : null}
          <button type="submit" className="btn-primary entry-submit" disabled={!passcode || loading}>
            {loading ? "Checking…" : "Open workspace"}
          </button>
          <p className="entry-privacy">Your session is stored in a signed, httpOnly cookie for seven days.</p>
        </form>
      </section>
    </main>
  );
}
