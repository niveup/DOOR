"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", mobileLabel: "Today", helper: "Today", mark: "D", icon: "home" },
  { href: "/journal", label: "Journal", mobileLabel: "Journal", helper: "Evening", mark: "J", icon: "journal" },
  { href: "/explainer", label: "Explainer", mobileLabel: "Explain", helper: "Midday", mark: "E", icon: "explain" },
  { href: "/tracker", label: "Tracker", mobileLabel: "Progress", helper: "Weekly", mark: "T", icon: "progress" },
  { href: "/interview", label: "Interview", mobileLabel: "Interview", helper: "PSU prep", mark: "I", icon: "interview" },
  { href: "/settings/ai", label: "AI Control", mobileLabel: "Settings", helper: "Provider", mark: "S", icon: "settings" },
];
const mobileItems = navItems.slice(0, 5);

function todayLabel() {
  return new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "2-digit", month: "short", timeZone: "Asia/Kolkata" }).format(new Date());
}
function isActive(pathname: string, href: string) { return href === "/dashboard" ? pathname === href || pathname === "/" : pathname.startsWith(href); }

function TabIcon({ name }: { name: string }) {
  const common = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (name === "home") return <svg {...common}><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9.5 20v-5h5v5"/></svg>;
  if (name === "journal") return <svg {...common}><path d="M6 3.5h11a2 2 0 0 1 2 2V20H7a2 2 0 0 1-2-2V4.5a1 1 0 0 1 1-1Z"/><path d="M8 3.5V20M11 8h5M11 12h5"/></svg>;
  if (name === "explain") return <svg {...common}><path d="M4 5.5h16v11H9l-5 4v-15Z"/><path d="M9.5 9a2.5 2.5 0 1 1 3.6 2.25c-.8.4-1.1.85-1.1 1.5M12 15h.01"/></svg>;
  if (name === "progress") return <svg {...common}><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></svg>;
  return <svg {...common}><path d="M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/><path d="M5 21a7 7 0 0 1 14 0M18 7h3M19.5 5.5v3"/></svg>;
}

export function AppShell({ children, eyebrow, title, subtitle, actions }: { children: ReactNode; eyebrow?: string; title?: string; subtitle?: string; actions?: ReactNode }) {
  const pathname = usePathname();
  return <div className="app-background min-h-screen text-[var(--text-primary)]">
    <div className="mx-auto flex min-h-screen w-full max-w-[1500px] gap-4 px-3 py-3 sm:px-4 lg:px-5">
      <aside className="surface sticky top-3 hidden h-[calc(100vh-24px)] w-[244px] shrink-0 flex-col justify-between p-3 lg:flex">
        <div>
          <Link href="/dashboard" className="focus-ring interactive-surface flex items-center gap-3 rounded-lg p-2"><span className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--accent)]/20 bg-[var(--accent-soft)] text-xs font-semibold text-[var(--accent)]">J</span><span><span className="block text-sm font-semibold">Jujum AI</span><span className="block text-[11px] font-semibold text-[var(--text-secondary)]">GATE + PSU mentor</span></span></Link>
          <nav className="mt-5 space-y-1" aria-label="Primary navigation">{navItems.map((item) => { const active = isActive(pathname, item.href); return <Link key={item.href} href={item.href} className={`focus-ring interactive-surface group flex items-center gap-3 rounded-lg border px-2.5 py-2 ${active ? "border-[var(--accent)]/25 bg-[var(--accent-soft)] text-[var(--accent)]" : "border-transparent text-[var(--text-secondary)] hover:border-[var(--border)] hover:bg-white"}`}><span className={`grid h-7 w-7 place-items-center rounded-md text-[10px] font-semibold ${active ? "bg-white text-[var(--accent)]" : "bg-[var(--bg-elevated)]"}`}>{item.mark}</span><span><span className="block text-xs font-semibold">{item.label}</span><span className="block text-[10px] text-[var(--text-faint)]">{item.helper}</span></span></Link>; })}</nav>
        </div>
        <div className="soft-mint rounded-lg border border-[var(--border)] p-3"><div className="flex justify-between"><span className="section-label">Quick start</span><span className="text-[11px] font-bold text-[var(--text-secondary)]">{todayLabel()}</span></div><div className="mt-3 grid gap-2"><Link href="/journal" className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-[11px] font-semibold">Write today's entry</Link><Link href="/dashboard" className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-[11px] font-semibold">Make today's plan</Link></div></div>
      </aside>

      <main className="min-w-0 flex-1 pb-[calc(82px+env(safe-area-inset-bottom))] lg:pb-0">
        <div className="surface mb-3 flex items-center justify-between gap-3 p-3 lg:hidden">
          <Link href="/dashboard" className="focus-ring flex items-center gap-2 rounded-lg"><span className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--accent)]/20 bg-[var(--accent-soft)] text-xs font-semibold text-[var(--accent)]">J</span><span><span className="block text-sm font-semibold">Jujum AI</span><span className="block text-[10px] font-bold text-[var(--text-secondary)]">{todayLabel()}</span></span></Link>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
        {title ? <header className="surface mb-4 flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-end"><div className="min-w-0">{eyebrow ? <p className="section-label mb-2">{eyebrow}</p> : null}<h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>{subtitle ? <p className="mt-1.5 max-w-3xl text-xs font-medium leading-5 text-[var(--text-secondary)]">{subtitle}</p> : null}</div>{actions ? <div className="hidden shrink-0 lg:flex">{actions}</div> : null}</header> : null}
        {children}
      </main>
    </div>

    <nav className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-[var(--border)] bg-[var(--bg-card)] px-1 pt-1 shadow-[0_-8px_24px_rgba(32,33,36,0.08)] lg:hidden" style={{ paddingBottom: "max(4px, env(safe-area-inset-bottom))" }} aria-label="Mobile navigation">
      {mobileItems.map((item) => { const active = isActive(pathname, item.href); return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`focus-ring flex min-h-[60px] min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-0.5 text-[10px] font-semibold leading-none transition-colors ${active ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--text-secondary)]"}`}><TabIcon name={item.icon} /><span className="whitespace-nowrap">{item.mobileLabel}</span></Link>; })}
    </nav>
  </div>;
}

export function PageSection({ title, eyebrow, action, children, className = "" }: { title: string; eyebrow?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={className}><div className="mb-3 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end"><div>{eyebrow ? <p className="section-label mb-1.5">{eyebrow}</p> : null}<h2 className="text-base font-semibold tracking-tight">{title}</h2></div>{action ? <div className="w-full overflow-x-auto sm:w-auto sm:shrink-0">{action}</div> : null}</div>{children}</section>;
}
