"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, createContext, useContext, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

const AppShellContext = createContext<{ isInsideLayout: boolean }>({ isInsideLayout: false });

const primaryNavItems = [
  { href: "/dashboard", label: "Dashboard", mobileLabel: "Today", helper: "Today", mark: "D", icon: "home" },
  { href: "/journal", label: "Journal", mobileLabel: "Journal", helper: "Evening", mark: "J", icon: "journal" },
  { href: "/tracker", label: "Tracker", mobileLabel: "Progress", helper: "Weekly", mark: "T", icon: "progress" },
  { href: "/chat", label: "AI Coach", mobileLabel: "Coach", helper: "General", mark: "C", icon: "chat" },
];

const progressNavItems = [
  { href: "/interview", label: "Interview", mobileLabel: "Interview", helper: "PSU prep", mark: "I", icon: "interview" },
  { href: "/explainer", label: "Explainer", mobileLabel: "Explain", helper: "Midday", mark: "E", icon: "explain" },
  { href: "/settings/ai", label: "AI Control", mobileLabel: "Settings", helper: "Provider", mark: "S", icon: "settings" },
];

const navItems = [...primaryNavItems, ...progressNavItems];
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
    width: 17,
    height: 17,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (name === "home") return <svg {...common}><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
  if (name === "journal") return <svg {...common}><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10M6 10h10"/></svg>;
  if (name === "progress") return <svg {...common}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
  if (name === "interview") return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>;
  if (name === "chat") return <svg {...common}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M12 7v6M9 10h6"/></svg>;
  if (name === "explain") return <svg {...common}><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
  if (name === "settings") return <svg {...common}><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>;
  return <svg {...common}><path d="M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/><path d="M5 21a7 7 0 0 1 14 0"/></svg>;
}

export function AppShellLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [optimisticPathname, setOptimisticPathname] = useState(pathname);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setOptimisticPathname(pathname);
  }, [pathname]);

  const isNavActive = (href: string) => {
    const current = optimisticPathname || pathname;
    if (href === "/dashboard") return current === href || current === "/";
    return current.startsWith(href);
  };

  useEffect(() => {
    const currentTheme = (document.documentElement.dataset.theme as "light" | "dark") || "dark";
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

  if (pathname === "/passcode") {
    return <>{children}</>;
  }

  return (
    <AppShellContext.Provider value={{ isInsideLayout: true }}>
      <div className="app-background min-h-screen text-[var(--text-primary)]">
        <div className="flex min-h-screen w-full max-w-full">
          <aside className="surface hidden w-[240px] lg:w-[250px] shrink-0 flex-col justify-between p-4 lg:flex sticky top-0 h-screen rounded-none border-t-0 border-b-0 border-l-0 border-r border-[var(--border)] z-30">
            <div>
              <div className="flex items-center justify-between gap-1">
                <Link href="/dashboard" onClick={() => setOptimisticPathname("/dashboard")} className="brand-mark brand-fixed focus-ring interactive-surface flex items-center gap-2.5 rounded-lg p-2.5 flex-1 min-w-0">
                  <div className="h-8 w-8 rounded-md bg-stone-900 dark:bg-stone-950 flex items-center justify-center text-white shadow-sm shrink-0">
                    <svg className="h-5 w-5 text-stone-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                      <path d="M4 21V9a8 8 0 0116 0v12Z" fill="#ffffff" stroke="none" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 21V9a8 8 0 0116 0v12M2 21h20" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 21V9c0-1.8 1-3.2 2.5-4l7 2v12.5L6 21z" fill="#1a1917" />
                      <circle cx="12.5" cy="12.5" r="1.1" fill="#dfb15b" stroke="none" />
                    </svg>
                  </div>
                  <span className="text-[16px] font-black tracking-[0.22em] text-[#000000] dark:text-[#ffffff] uppercase font-sans">DOOR</span>
                </Link>
                
                <button
                  type="button"
                  onClick={toggleTheme}
                  suppressHydrationWarning
                  title={!mounted ? "Switch to dark mode" : `Switch to ${theme === "light" ? "dark" : "light"} mode`}
                  className="focus-ring interactive-surface border border-transparent text-zinc-950 dark:text-[var(--text-secondary)] hover:border-[var(--border)] hover:bg-[var(--bg-card)] dark:hover:text-[var(--text-primary)] rounded-lg p-2 transition flex items-center justify-center h-9 w-9 shrink-0 cursor-pointer"
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

              <nav className="mt-4 space-y-1" aria-label="Primary navigation">
                {primaryNavItems.map((item) => {
                  const active = isNavActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOptimisticPathname(item.href)}
                      className={`focus-ring relative group flex items-center gap-2.5 rounded-lg border px-2.5 py-1.5 transition-colors duration-150 ${
                        active
                          ? "border-[var(--accent)]/25 shadow-xs text-[var(--accent)] font-bold"
                          : "border-transparent text-[#000000] dark:text-[var(--text-primary)] hover:border-[var(--border)] hover:bg-[var(--bg-card)]"
                      }`}
                    >
                      {active && (
                        <motion.div
                          layoutId="activeSidebarPill"
                          className="absolute inset-0 rounded-lg border border-[var(--accent)]/25 bg-[var(--accent-soft)] shadow-xs -z-0 pointer-events-none"
                          transition={{ type: "spring", stiffness: 500, damping: 35, mass: 0.5 }}
                          style={{ willChange: "transform, opacity" }}
                        />
                      )}
                      <span className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-md transition-colors duration-150 ${active ? "bg-[var(--bg-card)] text-[#000000] dark:text-[var(--accent)] shadow-xs" : "bg-[var(--bg-elevated)] text-[#000000] dark:text-[var(--text-secondary)] group-hover:bg-[var(--bg-card)]"}`}>
                        <TabIcon name={item.icon} />
                      </span>
                      <span className={`relative z-10 truncate text-[13px] font-semibold ${active ? "text-[#000000] dark:text-[var(--accent)]" : "text-[#000000] dark:text-[var(--text-primary)]"}`}>{item.label}</span>
                    </Link>
                  );
                })}

                <div className="mt-36 mb-2.5 flex items-center gap-2 px-1 py-1">
                  <div className="h-px flex-1 bg-[var(--border)]" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#000000] dark:text-[var(--text-secondary)] shrink-0">
                    On Progress
                  </span>
                  <div className="h-px flex-1 bg-[var(--border)]" />
                </div>

                {progressNavItems.map((item) => {
                  const active = isNavActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOptimisticPathname(item.href)}
                      className={`focus-ring relative group flex items-center gap-2.5 rounded-lg border px-2.5 py-1.5 transition-colors duration-150 ${
                        active
                          ? "border-[var(--accent)]/25 shadow-xs text-[var(--accent)] font-bold"
                          : "border-transparent text-[#000000] dark:text-[var(--text-primary)] hover:border-[var(--border)] hover:bg-[var(--bg-card)]"
                      }`}
                    >
                      {active && (
                        <motion.div
                          layoutId="activeSidebarPill"
                          className="absolute inset-0 rounded-lg border border-[var(--accent)]/25 bg-[var(--accent-soft)] shadow-xs -z-0 pointer-events-none"
                          transition={{ type: "spring", stiffness: 500, damping: 35, mass: 0.5 }}
                          style={{ willChange: "transform, opacity" }}
                        />
                      )}
                      <span className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-md transition-colors duration-150 ${active ? "bg-[var(--bg-card)] text-[#000000] dark:text-[var(--accent)] shadow-xs" : "bg-[var(--bg-elevated)] text-[#000000] dark:text-[var(--text-secondary)] group-hover:bg-[var(--bg-card)]"}`}>
                        <TabIcon name={item.icon} />
                      </span>
                      <span className={`relative z-10 truncate text-[13px] font-semibold ${active ? "text-[#000000] dark:text-[var(--accent)]" : "text-[#000000] dark:text-[var(--text-primary)]"}`}>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="soft-mint rounded-lg border border-[var(--border)] p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="section-label text-zinc-950 dark:text-inherit font-semibold text-[12px]">Quick start</span>
                <span suppressHydrationWarning className="text-[12px] font-semibold text-zinc-950 dark:text-[var(--text-secondary)]">{mounted ? todayLabel() : ""}</span>
              </div>
              <div className="mt-2.5 grid gap-1.5">
                <Link href="/journal" onClick={() => setOptimisticPathname("/journal")} className="interactive-surface rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-2.5 py-1.5 text-xs font-semibold text-zinc-950 dark:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]">Write today&apos;s entry</Link>
                <Link href="/dashboard" onClick={() => setOptimisticPathname("/dashboard")} className="interactive-surface rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-2.5 py-1.5 text-xs font-semibold text-zinc-950 dark:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]">Make today&apos;s plan</Link>
              </div>
            </div>
          </aside>

          <main className="min-w-0 flex-1 max-w-[1400px] mobile-content-clearance p-3.5 sm:p-5 lg:p-6 xl:px-8 xl:py-6">
            <div className="surface mb-3 flex flex-col gap-3 p-3 lg:hidden">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Link href="/dashboard" onClick={() => setOptimisticPathname("/dashboard")} className="brand-mark brand-fixed focus-ring flex items-center gap-2.5 rounded-lg">
                    <div className="h-8 w-8 rounded-md bg-stone-900 dark:bg-stone-950 flex items-center justify-center text-white shadow-sm shrink-0">
                      <svg className="h-5 w-5 text-stone-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                        <path d="M4 21V9a8 8 0 0116 0v12Z" fill="#ffffff" stroke="none" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 21V9a8 8 0 0116 0v12M2 21h20" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 21V9c0-1.8 1-3.2 2.5-4l7 2v12.5L6 21z" fill="#1a1917" />
                        <circle cx="12.5" cy="12.5" r="1.1" fill="#dfb15b" stroke="none" />
                      </svg>
                    </div>
                    <span>
                      <span className="block text-sm font-black tracking-[0.22em] text-[#000000] dark:text-[#ffffff] uppercase font-sans leading-none">DOOR</span>
                      <span suppressHydrationWarning className="block text-[9px] font-bold text-[var(--text-secondary)] mt-1">{mounted ? todayLabel() : ""}</span>
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
              </div>
              <nav className="tablet-nav flex flex-wrap items-center gap-1.5" aria-label="Tablet navigation">
                {primaryNavItems.map((item) => {
                  const active = isNavActive(item.href);
                  return (
                    <Link key={item.href} href={item.href} onClick={() => setOptimisticPathname(item.href)} className={`focus-ring relative rounded-lg border px-3 py-2 text-xs font-semibold transition-colors duration-150 ${active ? "border-[var(--accent)]/25 text-[var(--accent)] font-bold" : "border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-secondary)]"}`}>
                      {active && (
                        <motion.div
                          layoutId="activeTabletPill"
                          className="absolute inset-0 rounded-lg border border-[var(--accent)]/25 bg-[var(--accent-soft)] -z-0 pointer-events-none"
                          transition={{ type: "spring", stiffness: 500, damping: 35, mass: 0.5 }}
                          style={{ willChange: "transform, opacity" }}
                        />
                      )}
                      <span className="relative z-10">{item.label}</span>
                    </Link>
                  );
                })}
                <span className="px-1 text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-secondary)]">On Progress</span>
                {progressNavItems.map((item) => {
                  const active = isNavActive(item.href);
                  return (
                    <Link key={item.href} href={item.href} onClick={() => setOptimisticPathname(item.href)} className={`focus-ring relative rounded-lg border px-3 py-2 text-xs font-semibold transition-colors duration-150 ${active ? "border-[var(--accent)]/25 text-[var(--accent)] font-bold" : "border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-secondary)]"}`}>
                      {active && (
                        <motion.div
                          layoutId="activeTabletPill"
                          className="absolute inset-0 rounded-lg border border-[var(--accent)]/25 bg-[var(--accent-soft)] -z-0 pointer-events-none"
                          transition={{ type: "spring", stiffness: 500, damping: 35, mass: 0.5 }}
                          style={{ willChange: "transform, opacity" }}
                        />
                      )}
                      <span className="relative z-10">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            {children}
          </main>
        </div>

        <nav className="mobile-tab-bar" aria-label="Mobile navigation">
          {mobileItems.map((item) => {
            const active = isNavActive(item.href);
            return (
              <Link key={item.href} href={item.href} onClick={() => setOptimisticPathname(item.href)} aria-current={active ? "page" : undefined} className={`mobile-tab focus-ring relative ${active ? "is-active" : ""}`}>
                {active && (
                  <motion.div
                    layoutId="activeMobilePill"
                    className="absolute inset-0 rounded-lg bg-[var(--accent-soft)] -z-0 pointer-events-none"
                    transition={{ type: "spring", stiffness: 500, damping: 35, mass: 0.5 }}
                    style={{ willChange: "transform, opacity" }}
                  />
                )}
                <span className="relative z-10 flex flex-col items-center justify-center gap-0.5">
                  <TabIcon name={item.icon} />
                  <span>{item.mobileLabel}</span>
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </AppShellContext.Provider>
  );
}

export function AppShell({
  children,
  eyebrow,
  title,
  subtitle,
  actions,
  titleClassName = "text-xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-2xl",
}: {
  children: ReactNode;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  titleClassName?: string;
}) {
  const pathname = usePathname();
  const ctx = useContext(AppShellContext);

  const headerContent = (
    <AnimatePresence mode="wait">
      {title || actions ? (
        <motion.header
          key={pathname + (title || "")}
          initial={{ opacity: 0.95, y: -2 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0.95, y: 2 }}
          transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="surface mb-5 flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-end lg:p-5"
        >
          <div className="min-w-0">
            {eyebrow ? <p className="section-label mb-2">{eyebrow}</p> : null}
            {title ? <h1 className={titleClassName}>{title}</h1> : null}
            {subtitle ? <p className="mt-1.5 max-w-3xl text-xs font-medium leading-5 text-[var(--text-secondary)]">{subtitle}</p> : null}
          </div>
          {actions ? <div className="hidden shrink-0 items-center gap-2 lg:flex">{actions}</div> : null}
        </motion.header>
      ) : null}
    </AnimatePresence>
  );

  if (ctx.isInsideLayout) {
    return (
      <>
        {headerContent}
        {children}
      </>
    );
  }

  return (
    <AppShellLayout>
      {headerContent}
      {children}
    </AppShellLayout>
  );
}

export function PageSection({
  title,
  eyebrow,
  action,
  children,
  className = "",
  titleClassName = "text-base font-semibold tracking-tight text-[var(--text-primary)]",
  headerClassName = "mb-3",
}: {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  titleClassName?: string;
  headerClassName?: string;
}) {
  return (
    <section className={className}>
      <div className={`${headerClassName} flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end`}>
        <div>
          {eyebrow ? <p className="section-label mb-1.5">{eyebrow}</p> : null}
          {title ? <h2 className={titleClassName}>{title}</h2> : null}
        </div>
        {action ? <div className="w-full overflow-x-auto sm:w-auto sm:shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}
