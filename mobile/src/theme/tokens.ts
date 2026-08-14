export const colors = {
  canvas: "#090d16",
  surface: "#0f172a",
  raised: "#172238",
  border: "#334155",
  borderMuted: "#1e293b",
  text: "#f8fafc",
  textMuted: "#94a3b8",
  textFaint: "#64748b",
  cyan: "#06b6d4",
  blue: "#38bdf8",
  emerald: "#10b981",
  amber: "#f59e0b",
  rose: "#f43f5e",
  violet: "#a78bfa",
} as const;

export const spacing = { xs: 6, sm: 10, md: 16, lg: 24, xl: 32 } as const;

export const categoryColors: Record<string, string> = {
  "Hostel & utilities": colors.violet,
  "Food & mess": colors.amber,
  "Travel & commute": colors.cyan,
  Academics: colors.blue,
  "Personal & health": colors.rose,
  Subscriptions: colors.emerald,
  "Fun & social": "#f472b6",
  Others: colors.textMuted,
};
