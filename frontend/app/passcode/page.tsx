"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MicroInteractionButton } from "@/components/MotionComponents";

export default function PasscodePage() {
  const [passcode, setPasscode] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode) return;
    setLoading(true);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });

      if (res.ok) {
        toast.success("Access granted");
        router.push("/dashboard");
      } else {
        toast.error("Incorrect passcode");
      }
    } catch {
      toast.error("Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center px-4 py-12 relative overflow-hidden select-none">
      {/* Background Decorative Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e5e5e0_1px,transparent_1px),linear-gradient(to_bottom,#e5e5e0_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-35 pointer-events-none" />

      {/* Main Unified Card */}
      <main className="relative w-full max-w-4xl bg-white border border-stone-300 shadow-2xl grid grid-cols-1 md:grid-cols-12 rounded-none overflow-hidden z-10">
        
        {/* LEFT COLUMN: Editorial Workspace Presentation (7/12 width) */}
        <section className="md:col-span-7 p-8 md:p-12 bg-[#FCFBF9] flex flex-col justify-between border-b md:border-b-0 md:border-r border-stone-300 min-h-[500px]">
          <div>
            <div className="flex items-center gap-2 text-stone-500 uppercase tracking-widest text-[9px] font-mono font-bold mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Private Workspace
            </div>
            <h1 className="text-3xl md:text-4xl font-serif font-extrabold text-stone-800 tracking-tight leading-tight">
              DOOR keeps study honest.
            </h1>
            <p className="mt-4 text-xs md:text-sm text-stone-500 leading-relaxed max-w-md font-sans">
              Welcome to your private preparation center. Designed for rigorous study, daily routines, progress tracking, and secure practice.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              ["01", "Daily Ledger", "Journal and review daily study logs"],
              ["02", "Study Plan", "Formulate targeted preparation items"],
              ["03", "AI Explainer", "Interact and resolve complex concepts"],
              ["04", "Tracker Maps", "Assess subject and exam readiness"],
            ].map(([num, title, desc]) => (
              <div key={num} className="border-l border-stone-300 pl-3 py-1">
                <p className="text-[10px] font-mono font-bold text-stone-400">{num}</p>
                <p className="text-xs font-serif font-bold text-stone-700 mt-0.5">{title}</p>
                <p className="text-[10px] text-stone-400 mt-0.5 leading-snug">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* RIGHT COLUMN: Secure Entry Portal (5/12 width) */}
        <section className="md:col-span-5 p-8 md:p-12 flex flex-col justify-center bg-white">
          <div className="w-full">
            <div className="text-center mb-8">
              {/* Architectural Door SVG */}
              <div className="mx-auto w-16 h-16 flex items-center justify-center text-stone-700 mb-4 animate-pulse">
                <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 22V10a4 4 0 118 0v12M2 22h20" />
                </svg>
              </div>
              <h2 className="text-2xl font-serif font-extrabold text-stone-800 tracking-[0.15em] uppercase">DOOR</h2>
              <p className="text-[10px] text-stone-400 tracking-wider font-mono uppercase mt-1">Unlock Workspace</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <input
                  type="password"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full text-center tracking-[0.4em] text-sm font-mono bg-[#FAF9F5] border border-stone-300 focus:border-stone-850 focus:ring-1 focus:ring-stone-850 p-3 rounded-none focus:outline-none transition"
                />
              </div>

              <span className="btn-ai-wrapper w-full mt-2">
                <MicroInteractionButton
                  type="submit"
                  loading={loading}
                  className="w-full btn-ai-custom py-3 text-xs font-mono font-bold tracking-wider cursor-pointer group"
                >
                  <span className="w-4 h-4 flex items-center justify-center shrink-0">
                    <svg className="h-4 w-4 text-amber-500 transition-transform duration-500 ease-out group-hover:rotate-90" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C12 7.5 16.5 12 22 12C16.5 12 12 16.5 12 22C12 16.5 7.5 12 2 12C7.5 12 12 7.5 12 2Z" />
                    </svg>
                  </span>
                  <span className="btn-text-slide">ENTER WORKSPACE</span>
                </MicroInteractionButton>
              </span>
            </form>

            <div className="mt-8 flex items-center justify-center gap-1.5 text-stone-400 font-mono text-[9px] uppercase tracking-wider">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
              Secure Gateway Active
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}
