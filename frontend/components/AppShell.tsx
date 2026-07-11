"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const navItems = [
 { href: "/dashboard", label: "Dashboard", mobileLabel: "Today", helper: "Today", icon: "home" },
 { href: "/journal", label: "Journal", mobileLabel: "Journal", helper: "Evening", icon: "journal" },
 { href: "/explainer", label: "Explainer", mobileLabel: "Explain", helper: "Concepts", icon: "explain" },
 { href: "/tracker", label: "Tracker", mobileLabel: "Progress", helper: "Weekly", icon: "progress" },
 { href: "/interview", label: "Interview", mobileLabel: "Interview", helper: "PSU prep", icon: "interview" },
] as const;

function todayLabel() { return new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "2-digit", month: "short", timeZone: "Asia/Kolkata" }).format(new Date()); }
function isActive(pathname:string, href:string) { return href === "/dashboard" ? pathname === href || pathname === "/" : pathname.startsWith(href); }
function TabIcon({name}:{name:string}) {
 const common={width:20,height:20,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:1.8,strokeLinecap:"round" as const,strokeLinejoin:"round" as const,"aria-hidden":true};
 if(name==="home") return <svg {...common}><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></svg>;
 if(name==="journal") return <svg {...common}><path d="M5 3h12a2 2 0 0 1 2 2v16H7a2 2 0 0 1-2-2V3Z"/><path d="M8 7h7M8 11h7M8 15h5"/></svg>;
 if(name==="explain") return <svg {...common}><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5M8.5 9a2.5 2.5 0 1 1 4.2 1.8c-.9.7-1.7 1.1-1.7 2.2M11 16h.01"/></svg>;
 if(name==="progress") return <svg {...common}><path d="M4 20V10M10 20V4M16 20v-7M22 20V7"/></svg>;
 return <svg {...common}><path d="M7 8a5 5 0 0 1 10 0c0 3-2 4-2 6H9c0-2-2-3-2-6Z"/><path d="M9 18h6M10 22h4"/></svg>;
}

export function AppShell({children,eyebrow,title,subtitle,actions}:{children:ReactNode;eyebrow?:string;title?:string;subtitle?:string;actions?:ReactNode}) {
 const pathname=usePathname();
 return <div className="app-background min-h-screen lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
  <aside className="hidden min-h-screen border-r border-[var(--border)] bg-[var(--bg-card)] p-5 lg:flex lg:flex-col">
   <Link href="/dashboard" className="focus-ring flex items-center gap-3 rounded-lg p-2 text-[var(--text-primary)] no-underline"><span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--accent)] font-bold text-white">J</span><span><strong className="block">Jujum AI</strong><small className="text-[var(--text-secondary)]">GATE + PSU mentor</small></span></Link>
   <nav className="mt-8 grid gap-1" aria-label="Primary navigation">{navItems.map(item=>{const active=isActive(pathname,item.href);return <Link key={item.href} href={item.href} aria-current={active?"page":undefined} className={`focus-ring flex min-h-12 items-center justify-between rounded-lg px-3 text-sm font-semibold no-underline ${active?"bg-[var(--accent-soft)] text-[var(--accent)]":"text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"}`}><span>{item.label}</span><small>{item.helper}</small></Link>})}</nav>
   <div className="mt-auto"><Link href="/settings/ai" className="btn-secondary w-full">AI settings</Link></div>
  </aside>
  <div className="min-w-0">
   <header className="mobile-header flex h-16 items-center justify-between border-b border-[var(--border)] bg-[var(--bg-card)] px-4 lg:hidden"><Link href="/dashboard" className="focus-ring font-bold no-underline">Jujum AI</Link><span className="text-xs text-[var(--text-secondary)]">{todayLabel()}</span></header>
   <div className="workspace-canvas mx-auto w-full max-w-[1480px] px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
    {title?<header className="mb-8 border-b border-[var(--border)] pb-6"><div className="flex flex-wrap items-end justify-between gap-4"><div>{eyebrow?<p className="section-label mb-2">{eyebrow}</p>:null}<h1 className="text-3xl font-bold sm:text-4xl">{title}</h1>{subtitle?<p className="mt-3 max-w-[70ch] text-sm leading-6 text-[var(--text-secondary)]">{subtitle}</p>:null}</div>{actions?<div className="flex flex-wrap gap-2">{actions}</div>:null}</div></header>:null}
    <main>{children}</main>
   </div>
  </div>
  <nav className="mobile-tab-bar" aria-label="Primary navigation">{navItems.map(item=>{const active=isActive(pathname,item.href);return <Link key={item.href} href={item.href} aria-current={active?"page":undefined} className={`mobile-tab focus-ring ${active?"is-active":""}`}><TabIcon name={item.icon}/><span>{item.mobileLabel}</span></Link>})}</nav>
 </div>;
}

export function PageSection({title,eyebrow,action,children,className=""}:{title:string;eyebrow?:string;action?:ReactNode;children:ReactNode;className?:string}) {
 return <section className={`page-section ${className}`}><div className="mb-4 flex items-end justify-between gap-4"><div>{eyebrow?<p className="section-label mb-2">{eyebrow}</p>:null}<h2 className="text-xl font-bold">{title}</h2></div>{action}</div>{children}</section>;
}
