"use client";

import { useState } from "react";
import { toast } from "sonner";

export default function JournalUnlockPage() {
  const [passcode, setPasscode] = useState("");
  const [loading, setLoading] = useState(false);

  const unlock = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!passcode || loading) return;
    setLoading(true);
    try {
      const response = await fetch("/api/journal-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Journal unlock failed.");
      setPasscode("");
      toast.success("Private journal unlocked");
      // Full navigation ensures the Set-Cookie from the auth response is
      // applied before the browser sends the next request. The client-side
      // router fires too fast and the proxy reads the stale session cookie.
      window.location.replace("/journal");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Journal unlock failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="journal-unlock-page">
      <section className="journal-unlock-card brand-fixed" aria-labelledby="journal-unlock-title">
        <div className="journal-lock-mark" aria-hidden="true">?</div>
        <p className="journal-unlock-kicker">Private notebook</p>
        <h1 id="journal-unlock-title">A page for your eyes only.</h1>
        <p>Use your separate journal passcode. This private session re-locks automatically after a short period.</p>
        <form onSubmit={unlock} className="mt-7 space-y-3">
          <label className="journal-unlock-label" htmlFor="journal-passcode">Journal passcode</label>
          <input
            id="journal-passcode"
            type="password"
            autoComplete="current-password"
            value={passcode}
            onChange={(event) => setPasscode(event.target.value)}
            className="journal-unlock-input"
            placeholder="Enter your private passcode"
            maxLength={256}
            autoFocus
          />
          <button className="journal-unlock-button" type="submit" disabled={!passcode || loading}>
            {loading ? "Unsealing?" : "Open journal"}
          </button>
        </form>
      </section>
    </main>
  );
}
