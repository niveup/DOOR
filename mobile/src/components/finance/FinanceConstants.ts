import { Ionicons } from "@/src/components/app-icon";
import { FinanceCategory } from "@/src/types/domain";
import { shortDate, todayInKolkata } from "@/src/lib/format";

export const SEMANTIC = {
  crimson: "#D94A62", // Muted crimson for over-budget & warnings (financial state ONLY)
  amber: "#C58A2A",   // Muted amber for near-limit
  emerald: "#18B887", // Restrained accent green for on-track / positive state
};

export const CATEGORY_TOKENS: Record<
  FinanceCategory,
  {
    icon: keyof typeof Ionicons.glyphMap;
    darkIcon: string;
    darkBg: string;
    darkBorder: string;
    lightIcon: string;
    lightBg: string;
    lightBorder: string;
    barColor: string;
  }
> = {
  // 1. Food & mess — Warm muted amber
  "Food & mess": {
    icon: "restaurant-outline",
    darkIcon: "#C98A3A",
    darkBg: "#241F18",
    darkBorder: "#342C22",
    lightIcon: "#9A6218",
    lightBg: "#FDF6EC",
    lightBorder: "#F3E2CC",
    barColor: "#D97706",
  },
  // 2. Travel & commute — Slate steel blue
  "Travel & commute": {
    icon: "car-outline",
    darkIcon: "#5C8BB8",
    darkBg: "#161D26",
    darkBorder: "#222D3B",
    lightIcon: "#2563EB",
    lightBg: "#EFF6FF",
    lightBorder: "#BFDBFE",
    barColor: "#3B82F6",
  },
  // 3. Entertainment — Muted dusty lavender
  Entertainment: {
    icon: "game-controller-outline",
    darkIcon: "#8E7CB5",
    darkBg: "#1E1A27",
    darkBorder: "#2C263A",
    lightIcon: "#7C3AED",
    lightBg: "#FAF5FF",
    lightBorder: "#E9D5FF",
    barColor: "#8B5CF6",
  },
  // 4. Shopping — Muted rose
  Shopping: {
    icon: "cart-outline",
    darkIcon: "#B5657A",
    darkBg: "#24161C",
    darkBorder: "#3A212B",
    lightIcon: "#BE185D",
    lightBg: "#FDF2F8",
    lightBorder: "#FBCFE8",
    barColor: "#D94A6E",
  },
  // 5. Education — Muted cyan
  Education: {
    icon: "school-outline",
    darkIcon: "#5A9AA8",
    darkBg: "#152024",
    darkBorder: "#203037",
    lightIcon: "#0369A1",
    lightBg: "#ECFEFF",
    lightBorder: "#A5F3FC",
    barColor: "#0284C7",
  },
  // 6. Bills — Muted sage teal
  Bills: {
    icon: "receipt-outline",
    darkIcon: "#4F9A90",
    darkBg: "#152220",
    darkBorder: "#1F3431",
    lightIcon: "#0F766E",
    lightBg: "#F0FDFA",
    lightBorder: "#99F6E4",
    barColor: "#0D9488",
  },
  // 7. Personal — Muted warm gold
  Personal: {
    icon: "person-outline",
    darkIcon: "#A88748",
    darkBg: "#221E16",
    darkBorder: "#332D21",
    lightIcon: "#92400E",
    lightBg: "#FFFBEB",
    lightBorder: "#FDE68A",
    barColor: "#B45309",
  },
  // 8. Other — Muted graphite slate
  Other: {
    icon: "shapes-outline",
    darkIcon: "#7C8294",
    darkBg: "#191B22",
    darkBorder: "#262934",
    lightIcon: "#475569",
    lightBg: "#F1F5F9",
    lightBorder: "#CBD5E1",
    barColor: "#64748B",
  },

  // --- Backward-Compatible Aliases ---
  "Fun & social": {
    icon: "game-controller-outline",
    darkIcon: "#8E7CB5",
    darkBg: "#1E1A27",
    darkBorder: "#2C263A",
    lightIcon: "#7C3AED",
    lightBg: "#FAF5FF",
    lightBorder: "#E9D5FF",
    barColor: "#8B5CF6",
  },
  Academics: {
    icon: "school-outline",
    darkIcon: "#5A9AA8",
    darkBg: "#152024",
    darkBorder: "#203037",
    lightIcon: "#0369A1",
    lightBg: "#ECFEFF",
    lightBorder: "#A5F3FC",
    barColor: "#0284C7",
  },
  "Hostel & utilities": {
    icon: "receipt-outline",
    darkIcon: "#4F9A90",
    darkBg: "#152220",
    darkBorder: "#1F3431",
    lightIcon: "#0F766E",
    lightBg: "#F0FDFA",
    lightBorder: "#99F6E4",
    barColor: "#0D9488",
  },
  Subscriptions: {
    icon: "receipt-outline",
    darkIcon: "#4F9A90",
    darkBg: "#152220",
    darkBorder: "#1F3431",
    lightIcon: "#0F766E",
    lightBg: "#F0FDFA",
    lightBorder: "#99F6E4",
    barColor: "#0D9488",
  },
  "Personal & health": {
    icon: "person-outline",
    darkIcon: "#A88748",
    darkBg: "#221E16",
    darkBorder: "#332D21",
    lightIcon: "#92400E",
    lightBg: "#FFFBEB",
    lightBorder: "#FDE68A",
    barColor: "#B45309",
  },
  Others: {
    icon: "shapes-outline",
    darkIcon: "#7C8294",
    darkBg: "#191B22",
    darkBorder: "#262934",
    lightIcon: "#475569",
    lightBg: "#F1F5F9",
    lightBorder: "#CBD5E1",
    barColor: "#64748B",
  },
};

export const CATEGORY_ALIASES: Record<string, FinanceCategory> = {
  "Fun & social": "Entertainment",
  Academics: "Education",
  "Hostel & utilities": "Bills",
  Subscriptions: "Bills",
  "Personal & health": "Personal",
  Others: "Other",
};

export function normalizeCategory(category: string): FinanceCategory {
  if (CATEGORY_ALIASES[category]) {
    return CATEGORY_ALIASES[category];
  }
  return category as FinanceCategory;
}

export function getDateLabel(dateStr: string): string {
  const today = todayInKolkata();
  if (dateStr === today) return `Today · ${shortDate(dateStr)}`;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().slice(0, 10);
  if (dateStr === yStr) return `Yesterday · ${shortDate(dateStr)}`;
  try {
    return shortDate(dateStr);
  } catch {
    return dateStr;
  }
}
