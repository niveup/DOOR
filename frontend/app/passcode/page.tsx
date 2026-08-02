"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MicroInteractionButton } from "@/components/MotionComponents";

export default function PasscodePage() {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim()) {
      setError("Please enter the password");
      return;
    }
    setError("");
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
        setError("Incorrect password");
      }
    } catch {
      toast.error("Authentication failed");
      setError("Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center px-4 py-12 relative overflow-hidden select-none font-sans">
      {/* Background Decorative Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e5e5e0_1px,transparent_1px),linear-gradient(to_bottom,#e5e5e0_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-35 pointer-events-none" />

      {/* Main Unified Card */}
      <main className="relative w-full max-w-4xl bg-white border border-stone-300 shadow-2xl grid grid-cols-1 md:grid-cols-12 rounded-xl overflow-hidden z-10">
        
        {/* LEFT COLUMN: Presentation (7/12 width) */}
        <section className="md:col-span-7 p-8 md:p-12 bg-[#FCFBF9] flex flex-col justify-between border-b md:border-b-0 md:border-r border-stone-200 min-h-[460px]">
          <div>
            <h1 className="text-3xl md:text-4xl font-sans font-extrabold text-stone-900 tracking-tight leading-tight">
              DOOR keeps study honest.
            </h1>
            <p className="mt-3 text-xs md:text-sm text-stone-500 leading-relaxed max-w-md font-sans">
              A focused space for preparation, progress tracking, and practice.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 font-sans">
            {[
              ["01", "Daily Ledger", "Journal and review daily study logs"],
              ["02", "Study Plan", "Formulate targeted preparation items"],
              ["03", "AI Explainer", "Interact and resolve complex concepts"],
              ["04", "Tracker Maps", "Assess subject and exam readiness"],
            ].map(([num, title, desc]) => (
              <div key={num} className="border-l-2 border-amber-500/40 hover:border-amber-500 pl-3 py-1 transition-colors">
                <span className="text-[11px] font-bold text-amber-600 tracking-wider block">{num}</span>
                <p className="text-xs font-semibold text-stone-800 mt-0.5">{title}</p>
                <p className="text-[11px] text-stone-500 mt-0.5 leading-snug">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* RIGHT COLUMN: Entry Portal (5/12 width) */}
        <section className="md:col-span-5 p-8 md:p-12 flex flex-col justify-center bg-white">
          <div className="w-full">
            <div className="text-center mb-8">
              {/* Symmetric Architectural Door SVG */}
              <div className="mx-auto w-20 h-20 flex items-center justify-center text-stone-800 mb-3">
                <svg
                  className="h-16 w-16"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  {/* Revealed Doorway Background */}
                  <path
                    d="M5 21V9a7 7 0 0114 0v12Z"
                    fill="#FAF8F4"
                  />

                  {/* Outer Symmetric Arch Frame */}
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 21V9a7 7 0 0114 0v12M3 21h18"
                    stroke="#292524"
                  />

                  {/* Separated Symmetric Door Leaf (Rotates on left hinge only) */}
                  <g
                    className="transition-transform duration-500 ease-out"
                    style={{
                      transformOrigin: "6.5px 12px",
                      transform: isHovered || loading ? "rotateY(-45deg)" : "rotateY(0deg)",
                    }}
                  >
                    {/* Door Leaf Body */}
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6.5 21V9.5a5.5 5.5 0 0111 0V21Z"
                      fill="#EFECE6"
                      stroke="#44403C"
                    />

                    {/* Symmetric Inner Panel Relief */}
                    <path
                      d="M8.5 10a3.5 3.5 0 017 0v3h-7v-3zM8.5 14.5h7V19.5h-7v-5z"
                      fill="#E7E4DC"
                      stroke="#A8A29E"
                      strokeWidth="0.8"
                    />

                    {/* Door Knob */}
                    <circle cx="15.8" cy="14" r="0.75" fill="#78716C" stroke="none" />
                  </g>
                </svg>
              </div>
              <h2 className="text-2xl font-sans font-extrabold text-stone-800 tracking-[0.15em] uppercase">DOOR</h2>
            </div>

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div>
                <input
                  type="password"
                  value={passcode}
                  onChange={(e) => {
                    setPasscode(e.target.value);
                    if (error) setError("");
                  }}
                  placeholder="••••••••"
                  className={`w-full text-center tracking-[0.4em] text-sm font-sans bg-[#FAF9F5] border p-3 rounded-lg focus:outline-none transition ${
                    error
                      ? "border-rose-400 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/20"
                      : "border-stone-300 focus:border-stone-800 focus:ring-1 focus:ring-stone-800"
                  }`}
                />
                {error && (
                  <div className="flex items-center justify-center gap-1.5 text-xs text-rose-500 font-sans font-medium mt-2 animate-fadeIn">
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                    <span>{error}</span>
                  </div>
                )}
              </div>

              <MicroInteractionButton
                type="submit"
                loading={loading}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                className="w-full relative overflow-hidden bg-stone-900 hover:bg-stone-800 text-stone-100 hover:text-white py-3.5 text-xs font-sans font-semibold tracking-wider rounded-lg border border-stone-800 hover:border-stone-700 shadow-sm hover:shadow transition-all duration-200 cursor-pointer uppercase group"
              >
                <span className="relative z-10 transition-all duration-200 tracking-wider group-hover:tracking-[0.2em] flex items-center justify-center gap-2">
                  ENTER
                  <svg className="w-3.5 h-3.5 text-stone-400 group-hover:text-white transition-all duration-200 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </span>
              </MicroInteractionButton>
            </form>
          </div>
        </section>

      </main>
    </div>
  );
}
