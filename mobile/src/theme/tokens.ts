// Apple & Google inspired Obsidian Dark & Refined Light Tokens

export const darkColors = {
  canvas: "#09090b",       // Deep Obsidian (zinc-950)
  surface: "#121215",      // Neutral Charcoal card
  raised: "#1a1a1f",       // Elevated pill/badge
  border: "#27272a",       // Crisp zinc-800 border
  borderMuted: "#1f1f23",  // Subtle divider
  borderFocus: "#10b981",  // Emerald focus border
  borderHover: "#3f3f46",  // Subtle hover border
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
  surfaceElevated: "#18181d",
  surfaceSubtle: "#0e0e11",
  inputBg: "#121215",
  inputBorder: "#27272a",
  inputBorderFocus: "#10b981",
  error: "#f43f5e",
  errorSoft: "rgba(244, 63, 94, 0.14)",
  warning: "#f59e0b",
  warningSoft: "rgba(245, 158, 11, 0.14)",
  success: "#10b981",
  successSoft: "rgba(16, 185, 129, 0.14)",
  info: "#3b82f6",
  infoSoft: "rgba(59, 130, 246, 0.14)",
  glowEmerald: "rgba(16, 185, 129, 0.25)",
  solidTextDark: "#09090b",
  solidTextLight: "#fafafa",
} as const;

export const lightColors = {
  canvas: "#f8fafc",       // Clean warm slate-50
  surface: "#ffffff",      // Pure White card
  raised: "#f1f5f9",       // Elevated Slate-100
  border: "#e2e8f0",       // Crisp Slate-200 border
  borderMuted: "#cbd5e1",  // Slate-300
  borderFocus: "#059669",  // Deep emerald focus border
  borderHover: "#94a3b8",  // Slate-400
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
  surfaceElevated: "#ffffff",
  surfaceSubtle: "#f8fafc",
  inputBg: "#ffffff",
  inputBorder: "#e2e8f0",
  inputBorderFocus: "#059669",
  error: "#e11d48",
  errorSoft: "rgba(225, 29, 72, 0.10)",
  warning: "#d97706",
  warningSoft: "rgba(217, 119, 6, 0.10)",
  success: "#059669",
  successSoft: "rgba(5, 150, 105, 0.10)",
  info: "#2563eb",
  infoSoft: "rgba(37, 99, 235, 0.10)",
  glowEmerald: "rgba(5, 150, 105, 0.20)",
  solidTextDark: "#09090b",
  solidTextLight: "#ffffff",
} as const;

// Default exported colors (Dark mode default)
export const colors = darkColors;

export const spacing = {
  xxs: 4,
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radii = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

export const shadows = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 2,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 4,
  },
  emeraldGlow: {
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 3,
  },
} as const;

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
