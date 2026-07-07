"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", helper: "Today", mark: "D" },
  { href: "/journal", label: "Journal", helper: "Evening", mark: "J" },
  { href: "/explainer", label: "Explainer", helper: "Midday", mark: "E" },
  { href: "/tracker", label: "Tracker", helper: "Weekly", mark: "T" },
  { href: "/interview", label: "Interview", helper: "PSU prep", mark: "I" },
  { href: "/settings/ai", label: "AI Control", helper: "Provider", mark: "S" },
];

function todayLabel() {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date());
}

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href || pathname === "/";
  return pathname.startsWith(href);
}

export function AppShell({
  children,
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  children: ReactNode;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="app-background min-h-screen text-[var(--text-primary)]">
      <div className="mx-auto flex min-h-screen w-full max-w-[1500px] gap-4 px-3 py-3 sm:px-4 lg:px-5">
        <aside className="surface hidden w-[244px] shrink-0 flex-col justify-between p-3 lg:flex sticky top-3 h-[calc(100vh-24px)]">
          <div>
            <Link href="/dashboard" className="focus-ring interactive-surface flex items-center gap-3 rounded-lg p-2">
              <span className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--accent)]/20 bg-[var(--accent-soft)] text-xs font-semibold text-[var(--accent)] shadow-sm">
                J
              </span>
              <span>
                <span className="block text-sm font-semibold tracking-tight">Jujum AI</span>
                <span className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                  GATE + PSU mentor
                </span>
              </span>
            </Link>

            <nav className="mt-5 space-y-1" aria-label="Primary navigation">
              {navItems.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`focus-ring interactive-surface group flex items-center gap-3 rounded-lg border px-2.5 py-2 transition ${
                      active
                        ? "border-[var(--accent)]/25 bg-[var(--accent-soft)] text-[var(--accent)] shadow-sm"
                        : "border-transparent text-[var(--text-secondary)] hover:border-[var(--border)] hover:bg-white hover:text-[var(--text-primary)]"
                    }`}
                  >
                    <span
                      className={`grid h-7 w-7 place-items-center rounded-md text-[10px] font-semibold ${
                        active
                          ? "bg-white text-[var(--accent)]"
                          : "bg-[var(--bg-elevated)] text-[var(--text-secondary)] group-hover:text-[var(--accent)]"
                      }`}
                    >
                      {item.mark}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold">{item.label}</span>
                      <span className={`block text-[10px] font-semibold ${active ? "text-[var(--accent)]/70" : "text-[var(--text-faint)]"}`}>
                        {item.helper}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="soft-mint rounded-lg border border-[var(--border)] p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="section-label">Quick start</span>
              <span className="text-[11px] font-bold text-[var(--text-secondary)]">{todayLabel()}</span>
            </div>
            <div className="mt-3 grid gap-2">
              <Link href="/journal" className="interactive-surface rounded-md border border-[var(--border)] bg-white px-3 py-2 text-[11px] font-semibold text-[var(--text-primary)]">
                Write today&apos;s entry
              </Link>
              <Link href="/dashboard" className="interactive-surface rounded-md border border-[var(--border)] bg-white px-3 py-2 text-[11px] font-semibold text-[var(--text-primary)]">
                Make today&apos;s plan
              </Link>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="surface mb-3 flex flex-col gap-3 p-3 lg:hidden">
            <div className="flex items-center justify-between gap-3">
              <Link href="/dashboard" className="focus-ring flex items-center gap-2 rounded-lg">
                <span className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--accent)]/20 bg-[var(--accent-soft)] text-xs font-semibold text-[var(--accent)]">
                  J
                </span>
                <span>
                  <span className="block text-sm font-semibold">Jujum AI</span>
                  <span className="block text-[10px] font-bold text-[var(--text-secondary)]">{todayLabel()}</span>
                </span>
              </Link>
              {actions ? <div className="shrink-0">{actions}</div> : null}
            </div>
            <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Mobile navigation">
              {navItems.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`focus-ring rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                      active
                        ? "border-[var(--accent)]/25 bg-[var(--accent-soft)] text-[var(--accent)]"
                        : "border-[var(--border)] bg-white text-[var(--text-secondary)]"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {title ? (
            <header className="surface mb-4 flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-end lg:p-4">
              <div className="min-w-0">
                {eyebrow ? <p className="section-label mb-2">{eyebrow}</p> : null}
                <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-2xl">
                  {title}
                </h1>
                {subtitle ? <p className="mt-1.5 max-w-3xl text-xs font-medium leading-5 text-[var(--text-secondary)]">{subtitle}</p> : null}
              </div>
              {actions ? <div className="hidden shrink-0 items-center gap-2 lg:flex">{actions}</div> : null}
            </header>
          ) : null}

          {children}
        </main>
      </div>
    </div>
  );
}

export function PageSection({
  title,
  eyebrow,
  action,
  children,
  className = "",
}: {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <div className="mb-3 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          {eyebrow ? <p className="section-label mb-1.5">{eyebrow}</p> : null}
          <h2 className="text-base font-semibold tracking-tight text-[var(--text-primary)]">{title}</h2>
        </div>
        {action ? <div className="w-full overflow-x-auto sm:w-auto sm:shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

