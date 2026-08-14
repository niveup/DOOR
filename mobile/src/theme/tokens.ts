// Apple & Google inspired Obsidian Dark & Refined Light Tokens

export const darkColors = {
  canvas: "#09090b",       // Deep Obsidian (zinc-950)
  surface: "#121215",      // Neutral Charcoal card
  raised: "#1a1a1f",       // Elevated pill/badge
  border: "#27272a",       // Crisp zinc-800 border
  borderMuted: "#1f1f23",  // Subtle divider
  text: "#fafafa",         // High-contrast crisp white
  textMuted: "#a1a1aa",    // Zinc-400
  textFaint: "#71717a",    // Zinc-500
  emerald: "#10b981",      // Vivid Emerald
  amber: "#f59e0b",        // Warm Amber
  rose: "#f43f5e",         // Soft Rose
  violet: "#8b5cf6",       // Violet
  cyan: "#06b6d4",         // Cyan accent
  blue: "#3b82f6",         // Blue accent
  accent: "#10b981",       // Primary accent
  accentSoft: "rgba(16, 185, 129, 0.12)",
  cardGlow: "rgba(255, 255, 255, 0.03)",
} as const;

export const lightColors = {
  canvas: "#f8fafc",       // Clean warm slate-50
  surface: "#ffffff",      // Pure White card
  raised: "#f1f5f9",       // Elevated Slate-100
  border: "#e2e8f0",       // Crisp Slate-200 border
  borderMuted: "#cbd5e1",  // Slate-300
  text: "#0f172a",         // Deep Slate-900
  textMuted: "#475569",    // Slate-600
  textFaint: "#94a3b8",    // Slate-400
  emerald: "#059669",      // Deep Emerald-600
  amber: "#d97706",        // Amber-600
  rose: "#e11d48",         // Rose-600
  violet: "#7c3aed",       // Violet-600
  cyan: "#0284c7",         // Sky-600
  blue: "#2563eb",         // Blue-600
  accent: "#059669",       // Primary accent
  accentSoft: "rgba(5, 150, 105, 0.10)",
  cardGlow: "rgba(0, 0, 0, 0.02)",
} as const;

// Default exported colors (Dark mode default)
export const colors = darkColors;

export const spacing = { xs: 6, sm: 10, md: 16, lg: 24, xl: 32 } as const;

export const categoryColors: Record<string, string> = {
  "Hostel & utilities": colors.violet,
  "Food & mess": colors.amber,
  "Travel & commute": colors.cyan,
  Academics: colors.blue,
  "Personal & health": colors.rose,
  Subscriptions: colors.emerald,
  "Fun & social": "#ec4899",
  Others: colors.textMuted,
};
