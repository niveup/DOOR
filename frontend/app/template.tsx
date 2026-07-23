"use client";

import { motion, useReducedMotion } from "motion/react";

export default function Template({ children }: { children: React.ReactNode }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: shouldReduceMotion ? 1 : 0.9, y: shouldReduceMotion ? 0 : 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: shouldReduceMotion ? 0.01 : 0.18,
        ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
      }}
      style={{ willChange: "opacity, transform" }}
      className="flex-1 flex flex-col w-full min-h-0"
    >
      {children}
    </motion.div>
  );
}
