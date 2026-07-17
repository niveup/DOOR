"use client";

import { useState } from "react";
import { toast } from "sonner";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";

export default function JournalUnlockPage() {
  const [passcode, setPasscode] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

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
      window.location.replace("/journal");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Journal unlock failed.");
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <main className="journal-unlock-page">
      {/* Film grain overlay */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.055] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`
        }}
      />
      
      {/* Premium Circular Back Button in Upper Left Viewport */}
      <div className="absolute top-8 left-8 z-10">
        <button
          onClick={handleBack}
          className="flex items-center gap-2.5 group bg-transparent border-0 p-0 cursor-pointer outline-none"
          title="Go back"
        >
          {/* Round Circle Container with Arrow */}
          <div className="w-9 h-9 rounded-full border border-[#dac7a8] bg-[#fffdf5] flex items-center justify-center shadow-sm transition-all duration-300 group-hover:border-[#9b664c] group-hover:bg-[#fff7e9] group-hover:shadow">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor" 
              strokeWidth="2" 
              className="w-4 h-4 text-[#745842] transition-transform duration-300 group-hover:-translate-x-1"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </div>
          {/* Back text next to it */}
          <span className="text-[10px] font-sans font-bold tracking-wider uppercase text-[#745842] transition-colors duration-300 group-hover:text-[#392920] select-none">
            Back
          </span>
        </button>
      </div>

      <motion.section 
        className="journal-unlock-card relative brand-fixed flex flex-col items-center" 
        aria-labelledby="journal-unlock-title"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* SVG Lock Icon: Starts centered on viewport (y: 128px relative to top of card) and scales down smoothly */}
        <div className="flex justify-center mb-5">
          <motion.div
            style={{ transformOrigin: "24px 24px" }}
            initial={{ scale: 2.5, y: 128 }}
            animate={{ scale: 1.0, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor" 
              strokeWidth="1.8" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              className="w-12 h-12 text-[#6b503d]"
              style={{ overflow: "visible" }}
            >
              {/* Shackle */}
              <path className="lock-shackle" d="M8 10V6.5a4 4 0 0 1 8 0V10" />
              
              {/* Lock Body */}
              <rect x="5" y="10" width="14" height="10.5" rx="2.5" />
              
              {/* Shackle Collars (Shoulders) */}
              <rect x="7" y="9" width="2" height="1.2" rx="0.4" fill="currentColor" stroke="none" />
              <rect x="15" y="9" width="2" height="1.2" rx="0.4" fill="currentColor" stroke="none" />
              
              {/* Decorative Rivets in 4 corners */}
              <circle cx="7.5" cy="12.5" r="0.45" fill="currentColor" stroke="none" opacity="0.75" />
              <circle cx="16.5" cy="12.5" r="0.45" fill="currentColor" stroke="none" opacity="0.75" />
              <circle cx="7.5" cy="18" r="0.45" fill="currentColor" stroke="none" opacity="0.75" />
              <circle cx="16.5" cy="18" r="0.45" fill="currentColor" stroke="none" opacity="0.75" />
              
              {/* Inner Panel Bevel */}
              <rect x="6.8" y="11.8" width="10.4" height="6.9" rx="1.5" stroke="currentColor" strokeWidth="0.6" strokeOpacity="0.35" />
              
              {/* Center Keyhole Medallion Ring */}
              <circle cx="12" cy="15.2" r="2.8" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.5" />
              
              {/* Vintage Keyhole */}
              <circle cx="12" cy="14.6" r="0.8" fill="currentColor" stroke="none" />
              <path d="M11.5 15.2l1 0l-0.3 1.8l-0.4 0z" fill="currentColor" stroke="none" />
            </svg>
          </motion.div>
        </div>

        {/* Other card contents fading in after the lock starts scaling down */}
        <motion.div
          className="flex flex-col items-center w-full"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5, ease: "easeOut" }}
        >
          <p className="journal-unlock-kicker">Private notebook</p>
          <h1 id="journal-unlock-title">A page for your eyes only.</h1>
          <form onSubmit={unlock} className="mt-7 w-full space-y-3">
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
              {loading ? "Unsealing..." : "Open journal"}
            </button>
          </form>
        </motion.div>
      </motion.section>
    </main>
  );
}
