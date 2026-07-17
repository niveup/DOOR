"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", mobileLabel: "Today", helper: "Today", mark: "D", icon: "home" },
  { href: "/journal", label: "Journal", mobileLabel: "Journal", helper: "Evening", mark: "J", icon: "journal" },
  { href: "/explainer", label: "Explainer", mobileLabel: "Explain", helper: "Midday", mark: "E", icon: "explain" },
  { href: "/tracker", label: "Tracker", mobileLabel: "Progress", helper: "Weekly", mark: "T", icon: "progress" },
  { href: "/interview", label: "Interview", mobileLabel: "Interview", helper: "PSU prep", mark: "I", icon: "interview" },
  { href: "/chat", label: "AI Coach", mobileLabel: "Coach", helper: "General", mark: "C", icon: "chat" },
  { href: "/settings/ai", label: "AI Control", mobileLabel: "Settings", helper: "Provider", mark: "S", icon: "settings" },
];
const mobileItems = navItems.filter(item => item.icon !== "settings");

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

function TabIcon({ name }: { name: string }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (name === "home") return <svg {...common}><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9.5 20v-5h5v5"/></svg>;
  if (name === "journal") return <svg {...common}><path d="M6 3.5h11a2 2 0 0 1 2 2V20H7a2 2 0 0 1-2-2V4.5a1 1 0 0 1 1-1Z"/><path d="M8 3.5V20M11 8h5M11 12h5"/></svg>;
  if (name === "explain") return <svg {...common}><path d="M4 5.5h16v11H9l-5 4v-15Z"/><path d="M9.5 9a2.5 2.5 0 1 1 3.6 2.25c-.8.4-1.1.85-1.1 1.5M12 15h.01"/></svg>;
  if (name === "progress") return <svg {...common}><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></svg>;
  if (name === "chat") return <svg {...common}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
  return <svg {...common}><path d="M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/><path d="M5 21a7 7 0 0 1 14 0M18 7h3M19.5 5.5v3"/></svg>;
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
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const currentTheme = (document.documentElement.dataset.theme as "light" | "dark") || "light";
    setTheme(currentTheme);
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem("jujum-theme", nextTheme);
  };

  useEffect(() => {
    if (!mounted) return;

    const syncTheme = () => {
      const currentTheme = (document.documentElement.dataset.theme as "light" | "dark") || "light";
      setTheme(currentTheme);
    };

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === "data-theme") {
          syncTheme();
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, [mounted]);

  return (
    <div className="app-background min-h-screen text-[var(--text-primary)]">
      <div className="mx-auto flex min-h-screen w-full max-w-[1500px] gap-4 px-3 py-3 sm:px-4 lg:px-5">
        <aside className="surface hidden w-[244px] shrink-0 flex-col justify-between p-3 lg:flex sticky top-3 h-[calc(100vh-24px)]">
          <div>
            <div className="flex items-center justify-between gap-1">
              <Link href="/dashboard" className="brand-mark brand-fixed focus-ring interactive-surface flex items-center gap-2.5 rounded-lg p-2.5 flex-1 min-w-0">
                <div className="h-8 w-8 rounded-md bg-stone-900 flex items-center justify-center text-white shadow-sm shrink-0">
                  <svg className="h-5 w-5 text-stone-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                    {/* Background Arch Fill (white light coming through) */}
                    <path d="M4 21V9a8 8 0 0116 0v12Z" fill="#ffffff" stroke="none" />
                    {/* Frame */}
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 21V9a8 8 0 0116 0v12M2 21h20" />
                    {/* Open Door Leaf (dark wood/stone) */}
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 21V9c0-1.8 1-3.2 2.5-4l7 2v12.5L6 21z" fill="#2d2c2a" />
                    {/* Small Knob (gold) */}
                    <circle cx="12.5" cy="12.5" r="1.1" fill="#dfb15b" stroke="none" />
                  </svg>
                </div>
                <span className="text-sm font-extrabold tracking-[0.22em] text-stone-850 uppercase font-sans">DOOR</span>
              </Link>
              
              <button
                type="button"
                onClick={toggleTheme}
                title={!mounted ? "Switch to dark mode" : `Switch to ${theme === "light" ? "dark" : "light"} mode`}
                className="focus-ring interactive-surface border border-transparent text-[var(--text-secondary)] hover:border-[var(--border)] hover:bg-white hover:text-[var(--text-primary)] rounded-lg p-2 transition flex items-center justify-center h-9 w-9 shrink-0 cursor-pointer"
              >
                {!mounted || theme === "light" ? (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m0 13.5V21M4.95 4.95l1.59 1.59m10.91 10.91l1.59 1.59M3 12h2.25m13.5 0H21m-2.23-7.28l-1.59 1.59m-10.91 10.91l-1.59 1.59M12 8.25a3.75 3.75 0 100 7.5 3.75 3.75 0 000-7.5z" />
                  </svg>
                )}
              </button>
            </div>

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
                    <span className={`grid h-7 w-7 place-items-center rounded-md text-[10px] font-semibold ${active ? "bg-white text-[var(--accent)]" : "bg-[var(--bg-elevated)] text-[var(--text-secondary)] group-hover:text-[var(--accent)]"}`}>{item.mark}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold">{item.label}</span>
                      <span className={`block text-[10px] font-semibold ${active ? "text-[var(--accent)]/70" : "text-[var(--text-faint)]"}`}>{item.helper}</span>
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
              <Link href="/journal" className="interactive-surface rounded-md border border-[var(--border)] bg-white px-3 py-2 text-[11px] font-semibold text-[var(--text-primary)]">Write today&apos;s entry</Link>
              <Link href="/dashboard" className="interactive-surface rounded-md border border-[var(--border)] bg-white px-3 py-2 text-[11px] font-semibold text-[var(--text-primary)]">Make today&apos;s plan</Link>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 mobile-content-clearance">
          <div className="surface mb-3 flex flex-col gap-3 p-3 lg:hidden">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Link href="/dashboard" className="brand-mark brand-fixed focus-ring flex items-center gap-2.5 rounded-lg">
                  <div className="h-8 w-8 rounded-md bg-stone-900 flex items-center justify-center text-white shadow-sm shrink-0">
                    <svg className="h-5 w-5 text-stone-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                      {/* Background Arch Fill (white light coming through) */}
                      <path d="M4 21V9a8 8 0 0116 0v12Z" fill="#ffffff" stroke="none" />
                      {/* Frame */}
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 21V9a8 8 0 0116 0v12M2 21h20" />
                      {/* Open Door Leaf (dark wood/stone) */}
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 21V9c0-1.8 1-3.2 2.5-4l7 2v12.5L6 21z" fill="#2d2c2a" />
                      {/* Small Knob (gold) */}
                      <circle cx="12.5" cy="12.5" r="1.1" fill="#dfb15b" stroke="none" />
                    </svg>
                  </div>
                  <span>
                    <span className="block text-sm font-extrabold tracking-[0.22em] text-stone-850 uppercase font-sans leading-none">DOOR</span>
                    <span className="block text-[9px] font-bold text-[var(--text-secondary)] mt-1">{todayLabel()}</span>
                  </span>
                </Link>
                
                <button
                  type="button"
                  onClick={toggleTheme}
                  title={!mounted ? "Switch to dark mode" : `Switch to ${theme === "light" ? "dark" : "light"} mode`}
                  className="focus-ring border border-transparent text-[var(--text-secondary)] hover:border-[var(--border)] hover:bg-white hover:text-[var(--text-primary)] rounded-lg p-2 transition flex items-center justify-center h-9 w-9 shrink-0 cursor-pointer"
                >
                  {!mounted || theme === "light" ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m0 13.5V21M4.95 4.95l1.59 1.59m10.91 10.91l1.59 1.59M3 12h2.25m13.5 0H21m-2.23-7.28l-1.59 1.59m-10.91 10.91l-1.59 1.59M12 8.25a3.75 3.75 0 100 7.5 3.75 3.75 0 000-7.5z" />
                    </svg>
                  )}
                </button>
              </div>
              {actions ? <div className="shrink-0">{actions}</div> : null}
            </div>
            <nav className="tablet-nav" aria-label="Tablet navigation">
              {navItems.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link key={item.href} href={item.href} className={`focus-ring rounded-lg border px-3 py-2 text-xs font-semibold ${active ? "border-[var(--accent)]/25 bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--border)] bg-white text-[var(--text-secondary)]"}`}>
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {title || actions ? (
            <header className="surface mb-4 flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-end lg:p-4">
              <div className="min-w-0">
                {eyebrow ? <p className="section-label mb-2">{eyebrow}</p> : null}
                {title ? <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-2xl">{title}</h1> : null}
                {subtitle ? <p className="mt-1.5 max-w-3xl text-xs font-medium leading-5 text-[var(--text-secondary)]">{subtitle}</p> : null}
              </div>
              {actions ? <div className="hidden shrink-0 items-center gap-2 lg:flex">{actions}</div> : null}
            </header>
          ) : null}

          {children}
        </main>
      </div>

      <nav className="mobile-tab-bar" aria-label="Mobile navigation">
        {mobileItems.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`mobile-tab focus-ring ${active ? "is-active" : ""}`}>
              <TabIcon name={item.icon} />
              <span>{item.mobileLabel}</span>
            </Link>
          );
        })}
      </nav>
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
