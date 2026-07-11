"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const navItems = [
  { href: "/dashboard", label: "Today", helper: "Plan and focus", mark: "01" },
  { href: "/journal", label: "Journal", helper: "Close the day", mark: "02" },
  { href: "/explainer", label: "Explain", helper: "Work a concept", mark: "03" },
  { href: "/tracker", label: "Progress", helper: "Weekly review", mark: "04" },
  { href: "/interview", label: "Interview", helper: "PSU practice", mark: "05" },
] as const;

function todayLabel() {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
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
    <div className="workspace-shell">
      <aside className="workspace-rail" aria-label="Primary navigation">
        <Link href="/dashboard" className="brand-lockup focus-ring" aria-label="Jujum AI home">
          <span className="brand-seal" aria-hidden="true">J</span>
          <span>
            <strong>Jujum</strong>
            <small>Study workspace</small>
          </span>
        </Link>

        <nav className="rail-nav">
          {navItems.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rail-link focus-ring${active ? " is-active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <span className="rail-index">{item.mark}</span>
                <span className="rail-copy">
                  <strong>{item.label}</strong>
                  <small>{item.helper}</small>
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="rail-bottom">
          <Link href="/settings/ai" className={`rail-settings focus-ring${pathname.startsWith("/settings") ? " is-active" : ""}`}>
            <span>AI settings</span>
            <span aria-hidden="true">→</span>
          </Link>
          <p>Private by design.<br />One student, one honest system.</p>
        </div>
      </aside>

      <div className="workspace-main">
        <header className="mobile-header">
          <Link href="/dashboard" className="mobile-brand focus-ring">
            <span className="brand-seal">J</span>
            <strong>Jujum</strong>
          </Link>
          <span className="mobile-date">{todayLabel()}</span>
        </header>

        <nav className="mobile-nav" aria-label="Primary navigation">
          {navItems.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link key={item.href} href={item.href} className={`mobile-nav-link focus-ring${active ? " is-active" : ""}`}>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="workspace-canvas">
          {title ? (
            <div className="page-heading">
              <div className="page-heading-copy">
                <div className="page-kicker">
                  <span>{eyebrow || "Workspace"}</span>
                  <time>{todayLabel()}</time>
                </div>
                <h1>{title}</h1>
                {subtitle ? <p>{subtitle}</p> : null}
              </div>
              {actions ? <div className="page-actions">{actions}</div> : null}
            </div>
          ) : null}
          <main>{children}</main>
        </div>
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
    <section className={`page-section ${className}`}>
      <div className="section-heading">
        <div>
          {eyebrow ? <p className="section-label">{eyebrow}</p> : null}
          <h2>{title}</h2>
        </div>
        {action ? <div>{action}</div> : null}
      </div>
      {children}
    </section>
  );
}
