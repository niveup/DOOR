"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route render failed:", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="text-3xl">😵‍💫</span>
      <h2 className="text-lg font-bold text-[var(--text-primary)]">
        This page hit a snag
      </h2>
      <p className="text-sm text-[var(--text-secondary)] max-w-sm">
        Something broke while rendering. Your data is safe — try again, or head
        back to the dashboard.
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="px-4 py-2 rounded-xl bg-[var(--accent)] text-white text-sm font-semibold hover:opacity-90 transition cursor-pointer"
        >
          Try again
        </button>
        <Link
          href="/dashboard"
          className="px-4 py-2 rounded-xl border border-[var(--border)] text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition"
        >
          Dashboard
        </Link>
      </div>
    </div>
  );
}
