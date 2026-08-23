import type { ComponentProps } from "react";
import {
  Ionicons as NativeIonicons,
  MaterialCommunityIcons,
} from "@expo/vector-icons";

type IconName = ComponentProps<typeof NativeIonicons>["name"];
type NativeIconProps = ComponentProps<typeof NativeIonicons>;
type MaterialIconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

/**
 * DOOR's single icon entry point.
 *
 * Screens keep the familiar Ionicons names, while this adapter selects the
 * more substantial Material Community glyph where it improves clarity. That
 * keeps navigation, forms, feedback, and finance categories visually aligned
 * without introducing a new icon dependency or changing product copy.
 */
const materialIconMap: Partial<Record<IconName, MaterialIconName>> = {
  add: "plus",
  remove: "minus",
  close: "close",
  "arrow-back": "arrow-left",
  "arrow-down": "arrow-down",
  "chevron-down": "chevron-down",
  "chevron-forward": "chevron-right",
  checkmark: "check",
  checkbox: "checkbox-marked",
  "checkbox-outline": "checkbox-blank-circle-outline",
  "checkmark-circle": "check-circle",
  "checkmark-circle-outline": "check-circle-outline",
  "alert-circle": "alert-circle",
  "alert-circle-outline": "alert-outline",
  "information-circle": "information-outline",
  "information-circle-outline": "information-outline",
  "close-circle": "close-circle-outline",
  "time-outline": "clock-outline",
  "alarm-outline": "alarm",
  "cloud-offline-outline": "cloud-off-outline",
  "refresh-outline": "refresh",
  "refresh-circle-outline": "refresh",
  "search-outline": "magnify",
  "trash-outline": "trash-can-outline",
  "options-outline": "dots-horizontal-circle-outline",
  "warning-outline": "alert-outline",
  pencil: "pencil-outline",
  "play-circle": "play-circle",
  "key-outline": "key-outline",
  "school-outline": "school-outline",
  "book-outline": "book-open-page-variant-outline",
  book: "book-open-page-variant",
  "wallet-outline": "wallet-outline",
  wallet: "wallet",
  "person-circle-outline": "account-circle-outline",
  "person-circle": "account-circle",
  "home-outline": "home-variant-outline",
  "restaurant-outline": "silverware-fork-knife",
  "tv-outline": "television",
  "car-outline": "car-outline",
  "fitness-outline": "dumbbell",
  "barbell-outline": "dumbbell",
  "game-controller-outline": "controller-classic-outline",
  "receipt-outline": "receipt-text-outline",
  "calendar-outline": "calendar-blank-outline",
  "pie-chart-outline": "chart-pie-outline",
  "hardware-chip-outline": "memory",
  "finger-print-outline": "fingerprint",
  "shield-checkmark": "shield-check",
  "lock-closed": "lock",
  "lock-closed-outline": "lock-outline",
  "log-out-outline": "logout",
  "server-outline": "server-outline",
  "snow-outline": "snowflake",
  "flash-outline": "flash-outline",
  sparkles: "star-four-points",
  "sparkles-outline": "star-four-points-outline",
  "bulb-outline": "lightbulb-on-outline",
  "cube-outline": "cube-outline",
  "leaf-outline": "leaf",
};

function DoorIcon({ name, ...props }: NativeIconProps) {
  const materialName = materialIconMap[name];

  if (materialName) {
    return <MaterialCommunityIcons {...props} name={materialName} />;
  }

  return <NativeIonicons {...props} name={name} />;
}

// Retain the Ionicons-shaped API so existing components can use the system
// without any prop or type churn. New UI should import from this file too.
export const Ionicons = Object.assign(DoorIcon, {
  glyphMap: NativeIonicons.glyphMap,
});

export type { IconName };
