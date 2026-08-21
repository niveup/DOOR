// ============================================================================
// DOOR Mobile Design Tokens (Obsidian Dark & Refined Light)
// Single Source of Truth for Mobile UI/UX Design System
// ============================================================================

import { TextStyle, ViewStyle } from "react-native";

// ----------------------------------------------------------------------------
// 1. COLOR PALETTES & CONTRACT
// ----------------------------------------------------------------------------

export interface ThemeColors {
  // Canvases & Surfaces
  canvas: string;
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceSubtle: string;
  raised: string;

  // Borders & Dividers
  border: string;
  borderMuted: string;
  borderFocus: string;
  borderHover: string;
  divider: string;

  // Typography Colors
  text: string;
  primaryText: string;
  textMuted: string;
  secondaryText: string;
  textFaint: string;
  mutedText: string;

  // Primary Brand & Accent
  accent: string;
  primary: string;
  primaryForeground: string;
  accentSoft: string;

  // Secondary Controls
  secondary: string;
  secondaryForeground: string;

  // Feedback & Semantic Statuses
  success: string;
  successForeground: string;
  successSoft: string;

  warning: string;
  warningForeground: string;
  warningSoft: string;

  error: string;
  errorForeground: string;
  errorSoft: string;

  info: string;
  infoForeground: string;
  infoSoft: string;

  // Specific Palette Tones
  emerald: string;
  amber: string;
  rose: string;
  violet: string;
  cyan: string;
  blue: string;

  // Input & Component Specific
  inputBg: string;
  inputBorder: string;
  inputBorderFocus: string;

  // Glows & High-contrast text
  cardGlow: string;
  glowEmerald: string;
  glowRose: string;
  solidTextDark: string;
  solidTextLight: string;
}

export const darkColors: ThemeColors = {
  // Canvases & Surfaces
  canvas: "#09090b",            // Deep Obsidian (zinc-950)
  background: "#09090b",        // Canvas alias
  surface: "#121215",           // Neutral Charcoal card
  surfaceElevated: "#18181d",   // Elevated card / modal surface
  surfaceSubtle: "#0e0e11",     // Inset section background
  raised: "#1a1a1f",            // Elevated pill / chip / badge base

  // Borders & Dividers
  border: "#27272a",            // Crisp zinc-800 border
  borderMuted: "#1f1f23",       // Subtle divider / hairline
  borderFocus: "#10b981",       // Vivid Emerald focus ring
  borderHover: "#3f3f46",       // Subtle hover/press border
  divider: "#1f1f23",           // Divider alias

  // Typography Colors
  text: "#fafafa",              // High-contrast crisp white
  primaryText: "#fafafa",       // Primary text alias
  textMuted: "#a1a1aa",         // Secondary zinc-400
  secondaryText: "#a1a1aa",     // Secondary text alias
  textFaint: "#71717a",         // Tertiary zinc-500
  mutedText: "#71717a",         // Muted text alias

  // Primary Brand & Accent
  accent: "#10b981",            // Primary accent (Emerald)
  primary: "#10b981",           // Primary alias
  primaryForeground: "#09090b", // High-contrast dark text on primary
  accentSoft: "rgba(16, 185, 129, 0.12)",

  // Secondary Controls
  secondary: "#27272a",         // Secondary control background
  secondaryForeground: "#fafafa",

  // Feedback & Semantic Statuses
  success: "#10b981",
  successForeground: "#09090b",
  successSoft: "rgba(16, 185, 129, 0.14)",

  warning: "#f59e0b",           // Warm Amber
  warningForeground: "#09090b",
  warningSoft: "rgba(245, 158, 11, 0.14)",

  error: "#f43f5e",             // Soft Rose
  errorForeground: "#ffffff",
  errorSoft: "rgba(244, 63, 94, 0.14)",

  info: "#3b82f6",              // Blue
  infoForeground: "#ffffff",
  infoSoft: "rgba(59, 130, 246, 0.14)",

  // Specific Palette Tones
  emerald: "#10b981",
  amber: "#f59e0b",
  rose: "#f43f5e",
  violet: "#8b5cf6",
  cyan: "#06b6d4",
  blue: "#3b82f6",

  // Input & Component Specific
  inputBg: "#121215",
  inputBorder: "#27272a",
  inputBorderFocus: "#10b981",

  // Glows & High-contrast text
  cardGlow: "rgba(255, 255, 255, 0.03)",
  glowEmerald: "rgba(16, 185, 129, 0.25)",
  glowRose: "rgba(244, 63, 94, 0.25)",
  solidTextDark: "#09090b",
  solidTextLight: "#fafafa",
};

export const lightColors: ThemeColors = {
  // Canvases & Surfaces
  canvas: "#f8fafc",            // Clean warm slate-50
  background: "#f8fafc",        // Canvas alias
  surface: "#ffffff",           // Pure White card
  surfaceElevated: "#ffffff",   // Elevated card
  surfaceSubtle: "#f1f5f9",     // Inset section background
  raised: "#f1f5f9",            // Elevated Slate-100

  // Borders & Dividers
  border: "#e2e8f0",            // Crisp Slate-200 border
  borderMuted: "#cbd5e1",       // Slate-300 divider
  borderFocus: "#059669",       // Deep emerald focus ring
  borderHover: "#94a3b8",       // Slate-400
  divider: "#cbd5e1",           // Divider alias

  // Typography Colors
  text: "#0f172a",              // Deep Slate-900
  primaryText: "#0f172a",       // Primary text alias
  textMuted: "#475569",         // Slate-600
  secondaryText: "#475569",     // Secondary text alias
  textFaint: "#94a3b8",         // Slate-400
  mutedText: "#94a3b8",         // Muted text alias

  // Primary Brand & Accent
  accent: "#059669",            // Primary accent (Deep Emerald)
  primary: "#059669",           // Primary alias
  primaryForeground: "#ffffff", // Crisp white text on primary
  accentSoft: "rgba(5, 150, 105, 0.10)",

  // Secondary Controls
  secondary: "#f1f5f9",         // Slate-100
  secondaryForeground: "#0f172a",

  // Feedback & Semantic Statuses
  success: "#059669",
  successForeground: "#ffffff",
  successSoft: "rgba(5, 150, 105, 0.10)",

  warning: "#d97706",           // Amber-600
  warningForeground: "#ffffff",
  warningSoft: "rgba(217, 119, 6, 0.10)",

  error: "#e11d48",             // Rose-600
  errorForeground: "#ffffff",
  errorSoft: "rgba(225, 29, 72, 0.10)",

  info: "#2563eb",              // Blue-600
  infoForeground: "#ffffff",
  infoSoft: "rgba(37, 99, 235, 0.10)",

  // Specific Palette Tones
  emerald: "#059669",
  amber: "#d97706",
  rose: "#e11d48",
  violet: "#7c3aed",
  cyan: "#0284c7",
  blue: "#2563eb",

  // Input & Component Specific
  inputBg: "#ffffff",
  inputBorder: "#e2e8f0",
  inputBorderFocus: "#059669",

  // Glows & High-contrast text
  cardGlow: "rgba(0, 0, 0, 0.02)",
  glowEmerald: "rgba(5, 150, 105, 0.20)",
  glowRose: "rgba(225, 29, 72, 0.18)",
  solidTextDark: "#09090b",
  solidTextLight: "#ffffff",
};

export type ColorTheme = ThemeColors;

// Default export colors (Dark mode default)
export const colors: ThemeColors = darkColors;

// ----------------------------------------------------------------------------
// 2. SPACING SCALE (4/8-Point Mobile Grid)
// ----------------------------------------------------------------------------

export const spacing = {
  none: 0,
  xxs: 4,      // 4px micro spacing, tight tags, inline icon gap
  xs: 8,       // 8px small control padding, icon gap
  sm: 12,      // 12px card inner gap, compact row gap
  md: 16,      // 16px standard screen margin, card padding
  lg: 20,      // 20px spacious block separation
  xl: 24,      // 24px major section separation
  xxl: 32,     // 32px screen top/hero spacing
  xxxl: 40,    // 40px large section divider
  huge: 48,    // 48px empty state / bottom buffer
} as const;

export type SpacingTokens = typeof spacing;

// ----------------------------------------------------------------------------
// 3. BORDER RADII SCALE
// ----------------------------------------------------------------------------

export const radii = {
  none: 0,
  xs: 4,       // 4px micro badge / indicator
  sm: 8,       // 8px small control, badge, chip
  md: 12,      // 12px standard input, compact card, button
  lg: 16,      // 16px standard card, inset group container
  xl: 20,      // 20px hero card, banner
  xxl: 24,     // 24px bottom sheet, modal header
  full: 9999,  // Pill, circular icon button, avatar

  // Semantic Aliases
  control: 8,
  input: 12,
  button: 12,
  card: 16,
  sheet: 24,
} as const;

export type RadiiTokens = typeof radii;

// ----------------------------------------------------------------------------
// 4. ELEVATION & SHADOWS
// ----------------------------------------------------------------------------

export interface ShadowStyle {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
}

export const shadows = {
  none: {
    shadowColor: "transparent",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
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
  roseGlow: {
    shadowColor: "#f43f5e",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 3,
  },
} as const;

export type ShadowTokens = typeof shadows;

// ----------------------------------------------------------------------------
// 5. TYPOGRAPHY SCALE & TOKENS
// ----------------------------------------------------------------------------

export const fontWeights = {
  regular: "400" as const,
  medium: "500" as const,
  semibold: "600" as const,
  bold: "700" as const,
  heavy: "800" as const,
  black: "900" as const,
};

export const typography = {
  display: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: fontWeights.bold,
    letterSpacing: -0.8,
  } as TextStyle,

  largeHeading: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: fontWeights.bold,
    letterSpacing: -0.5,
  } as TextStyle,

  heading: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: fontWeights.bold,
    letterSpacing: -0.4,
  } as TextStyle,

  subheading: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: fontWeights.semibold,
    letterSpacing: -0.2,
  } as TextStyle,

  body: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: fontWeights.regular,
  } as TextStyle,

  bodyMedium: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: fontWeights.semibold,
  } as TextStyle,

  bodySmall: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: fontWeights.regular,
  } as TextStyle,

  bodySmallMedium: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: fontWeights.semibold,
  } as TextStyle,

  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: fontWeights.medium,
  } as TextStyle,

  label: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: fontWeights.heavy,
    letterSpacing: 0.6,
    textTransform: "uppercase" as const,
  } as TextStyle,

  button: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: fontWeights.bold,
    letterSpacing: -0.1,
  } as TextStyle,

  buttonSmall: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: fontWeights.bold,
  } as TextStyle,

  buttonLarge: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: fontWeights.heavy,
  } as TextStyle,

  metric: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: fontWeights.black,
    fontVariant: ["tabular-nums"] as const,
  } as TextStyle,

  metricLarge: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: fontWeights.black,
    fontVariant: ["tabular-nums"] as const,
  } as TextStyle,
} as const;

export type TypographyTokens = typeof typography;

// ----------------------------------------------------------------------------
// 6. MOBILE LAYOUT & TOUCH TARGET METRICS
// ----------------------------------------------------------------------------

export const layout = {
  minTouchTarget: 44,       // Apple HIG / Android 44x44 minimum touch target
  buttonHeight: 48,
  buttonHeightSm: 36,
  buttonHeightLg: 54,
  inputHeight: 48,
  inputHeightCompact: 40,
  headerHeight: 56,
  tabBarHeight: 62,
  screenPadding: spacing.md,
  cardPadding: spacing.md,
  bottomScrollPadding: 120, // Offset for floating navigation bar
} as const;

export type LayoutTokens = typeof layout;

// ----------------------------------------------------------------------------
// 7. CATEGORY ACCENT MAPPING
// ----------------------------------------------------------------------------

export const categoryColors: Record<string, string> = {
  "Hostel & utilities": darkColors.violet,
  "Food & mess": darkColors.amber,
  "Travel & commute": darkColors.cyan,
  Academics: darkColors.blue,
  "Personal & health": darkColors.rose,
  Subscriptions: darkColors.emerald,
  "Fun & social": "#ec4899",
  Others: darkColors.textMuted,
};

