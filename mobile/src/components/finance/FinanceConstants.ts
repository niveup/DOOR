import { Ionicons } from "@expo/vector-icons";
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
  "Food & mess": {
    icon: "restaurant-outline",
    darkIcon: "#C98A3A",
    darkBg: "#241F18",
    darkBorder: "#342C22",
    lightIcon: "#9A6218",
    lightBg: "#FDF6EC",
    lightBorder: "#F3E2CC",
    barColor: "#F59E0B",
  },
  Subscriptions: {
    icon: "tv-outline",
    darkIcon: "#8B7CF6",
    darkBg: "#1F1C2B",
    darkBorder: "#2D283E",
    lightIcon: "#6355D8",
    lightBg: "#F4F2FD",
    lightBorder: "#E2DCFA",
    barColor: "#A855F7",
  },
  "Hostel & utilities": {
    icon: "home-outline",
    darkIcon: "#6F8FAF",
    darkBg: "#1B2025",
    darkBorder: "#272E36",
    lightIcon: "#486B8C",
    lightBg: "#F0F4F8",
    lightBorder: "#DCE5EE",
    barColor: "#38BDF8",
  },
  "Travel & commute": {
    icon: "car-outline",
    darkIcon: "#4FA39A",
    darkBg: "#182321",
    darkBorder: "#233330",
    lightIcon: "#2E7C74",
    lightBg: "#EEF7F6",
    lightBorder: "#D2EBE8",
    barColor: "#14B8A6",
  },
  Academics: {
    icon: "school-outline",
    darkIcon: "#7180B5",
    darkBg: "#1C1E27",
    darkBorder: "#282C3A",
    lightIcon: "#4E5F97",
    lightBg: "#F1F3F9",
    lightBorder: "#DCE1F1",
    barColor: "#6366F1",
  },
  "Personal & health": {
    icon: "fitness-outline",
    darkIcon: "#FB7185",
    darkBg: "#2A161E",
    darkBorder: "#4A2030",
    lightIcon: "#E11D48",
    lightBg: "#FFF1F2",
    lightBorder: "#FECDD3",
    barColor: "#F43F5E",
  },
  "Fun & social": {
    icon: "game-controller-outline",
    darkIcon: "#8B78B0",
    darkBg: "#211D26",
    darkBorder: "#302A37",
    lightIcon: "#6E5A93",
    lightBg: "#F5F2F9",
    lightBorder: "#E5DEEF",
    barColor: "#FB923C",
  },
  Others: {
    icon: "receipt-outline",
    darkIcon: "#85858F",
    darkBg: "#1B1B20",
    darkBorder: "#26262D",
    lightIcon: "#5C5C66",
    lightBg: "#F3F3F6",
    lightBorder: "#E1E1E6",
    barColor: "#94A3B8",
  },
};

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
