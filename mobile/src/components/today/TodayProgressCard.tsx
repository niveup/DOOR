import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card, ProgressBar } from "@/src/components/ui";
import { useTheme } from "@/src/providers/theme-provider";
import { radii, spacing, typography } from "@/src/theme/tokens";

export interface TodayProgressCardProps {
  completedCount: number;
  totalCount: number;
  progressPercent: number;
  nextPendingTaskText?: string | null;
}

export function TodayProgressCard({
  completedCount,
  totalCount,
  progressPercent,
  nextPendingTaskText,
}: TodayProgressCardProps) {
  const { theme, isDark } = useTheme();

  const isAllComplete = progressPercent === 100 && totalCount > 0;
  const pendingCount = Math.max(0, totalCount - completedCount);

  // Dynamic progress tone based on status
  const progressTone = isAllComplete
    ? theme.accent
    : progressPercent >= 50
    ? theme.cyan
    : theme.amber;

  return (
    <Card
      style={[
        styles.card,
        {
          backgroundColor: isDark ? "#121216" : theme.surface,
          borderColor: isDark ? "#1f1f25" : theme.border,
        },
      ]}
    >
      {/* Top Header Row */}
      <View style={styles.topRow}>
        <View style={styles.leftBlock}>
          <Text style={[styles.sectionLabel, { color: theme.textFaint }]}>
            TODAY'S PROGRESS
          </Text>
          <View style={styles.valueRow}>
            <Text
              style={[
                styles.percentText,
                {
                  color: isAllComplete
                    ? theme.accent
                    : isDark
                    ? "#fafafa"
                    : theme.text,
                },
              ]}
            >
              {progressPercent}%
            </Text>
            <Text style={[styles.countSubtext, { color: theme.textMuted }]}>
              ({completedCount}/{totalCount} done)
            </Text>
          </View>
        </View>

        {/* Status Indicator Badge */}
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor: isAllComplete
                ? theme.successSoft
                : isDark
                ? "rgba(255, 255, 255, 0.05)"
                : theme.raised,
              borderColor: isAllComplete
                ? theme.accent
                : isDark
                ? theme.border
                : theme.border,
            },
          ]}
        >
          <Ionicons
            name={isAllComplete ? "checkmark-circle" : "time-outline"}
            color={isAllComplete ? theme.accent : theme.amber}
            size={14}
          />
          <Text
            style={[
              styles.statusText,
              {
                color: isAllComplete
                  ? theme.accent
                  : isDark
                  ? "#fafafa"
                  : theme.text,
              },
            ]}
          >
            {isAllComplete ? "All completed" : `${pendingCount} remaining`}
          </Text>
        </View>
      </View>

      {/* Progress Bar Meter */}
      <ProgressBar
        value={progressPercent}
        height={6}
        tone={progressTone}
      />

      {/* Next Focus Highlight Row */}
      <View style={styles.nextFocusBox}>
        {isAllComplete ? (
          <View style={styles.focusRow}>
            <Ionicons name="sparkles" size={13} color={theme.accent} />
            <Text style={[styles.focusDoneText, { color: theme.textMuted }]}>
              All targets completed for today. Solid work!
            </Text>
          </View>
        ) : nextPendingTaskText ? (
          <View style={styles.focusRow}>
            <Text style={[styles.focusLabel, { color: theme.textFaint }]}>
              Next up:
            </Text>
            <Text
              style={[styles.focusTitle, { color: theme.text }]}
              numberOfLines={1}
            >
              {nextPendingTaskText}
            </Text>
          </View>
        ) : (
          <Text style={[styles.focusMutedText, { color: theme.textMuted }]}>
            Small, honest daily actions compound into huge breakthroughs.
          </Text>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radii.card,
    borderWidth: 1,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  leftBlock: {
    gap: spacing.xxs,
  },
  sectionLabel: {
    ...typography.label,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.xs,
  },
  percentText: {
    ...typography.display,
    fontSize: 32,
    lineHeight: 38,
  },
  countSubtext: {
    ...typography.bodySmall,
    fontWeight: "600",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs + 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs + 1,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  statusText: {
    ...typography.caption,
    fontWeight: "700",
  },
  nextFocusBox: {
    paddingTop: 2,
  },
  focusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs - 2,
  },
  focusLabel: {
    ...typography.caption,
    fontWeight: "700",
  },
  focusTitle: {
    ...typography.bodySmall,
    fontWeight: "700",
    flex: 1,
  },
  focusDoneText: {
    ...typography.bodySmall,
  },
  focusMutedText: {
    ...typography.caption,
    lineHeight: 17,
  },
});
