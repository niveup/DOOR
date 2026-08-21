import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card, ProgressBar } from "@/src/components/ui";
import { useTheme } from "@/src/providers/theme-provider";
import { radii, spacing, typography } from "@/src/theme/tokens";

export function formatHours(hours: number): string {
  if (hours <= 0) return "0h";
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export interface StudyHeroFocusProps {
  todayHours: number;
  dailyGoal: number;
  progressPercent: number;
  remainingHours: number;
  todayQuestions: number;
  onOpenGoal: () => void;
}

export function StudyHeroFocus({
  todayHours,
  dailyGoal,
  progressPercent,
  remainingHours,
  todayQuestions,
  onOpenGoal,
}: StudyHeroFocusProps) {
  const { theme, isDark } = useTheme();

  const isCompleted = progressPercent >= 100 && dailyGoal > 0;
  const isStarted = todayHours > 0;

  // Dynamic progress tone based on status
  const progressTone = isCompleted
    ? theme.accent
    : isStarted
    ? theme.cyan
    : theme.textFaint;

  return (
    <Card
      style={[
        styles.container,
        {
          backgroundColor: isDark ? "#121216" : theme.surface,
          borderColor: isDark ? "#1f1f25" : theme.border,
        },
      ]}
    >
      {/* 1. Header Row: Section Label + Tactile Goal Target Control */}
      <View style={styles.headerRow}>
        <View style={styles.titleGroup}>
          <View
            style={[
              styles.pulseDot,
              {
                backgroundColor: isCompleted
                  ? theme.accent
                  : isStarted
                  ? theme.cyan
                  : theme.textFaint,
              },
            ]}
          />
          <Text
            style={[
              styles.sectionLabel,
              { color: isDark ? theme.textMuted : theme.textFaint },
            ]}
          >
            TODAY’S STUDY TARGET
          </Text>
        </View>

        <Pressable
          onPress={onOpenGoal}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={`Edit daily study target. Current target is ${dailyGoal} hours.`}
          style={({ pressed }) => [
            styles.goalBadgeButton,
            {
              backgroundColor: isDark ? theme.surfaceElevated : theme.surfaceSubtle,
              borderColor: isDark ? theme.border : theme.borderMuted,
            },
            pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] },
          ]}
        >
          <Text style={[styles.goalBadgeText, { color: theme.text }]}>
            {dailyGoal}h target
          </Text>
          <Ionicons
            name="pencil"
            size={11}
            color={theme.textMuted}
          />
        </Pressable>
      </View>

      {/* 2. Main Metrics Block: Prominent Hours + Progress Percentage */}
      <View style={styles.metricsRow}>
        <View style={styles.hoursContainer}>
          <View style={styles.hoursValueRow}>
            <Text
              style={[
                styles.primaryHoursValue,
                { color: isDark ? "#fafafa" : theme.text },
              ]}
            >
              {formatHours(todayHours)}
            </Text>
            <Text style={[styles.goalTargetContext, { color: theme.textMuted }]}>
              of {dailyGoal}h goal
            </Text>
          </View>

          <Text style={[styles.statusSubtitle, { color: theme.textMuted }]}>
            {isCompleted
              ? "Daily target reached"
              : isStarted
              ? `${formatHours(remainingHours)} remaining to reach goal`
              : "No study sessions logged today"}
          </Text>
        </View>

        <View style={styles.percentBadgeContainer}>
          <Text
            style={[
              styles.percentValue,
              {
                color: isCompleted
                  ? theme.accent
                  : isStarted
                  ? theme.cyan
                  : theme.textFaint,
              },
            ]}
          >
            {progressPercent}%
          </Text>
          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: isCompleted
                  ? theme.successSoft
                  : isDark
                  ? theme.surfaceElevated
                  : theme.surfaceSubtle,
                borderColor: isCompleted
                  ? theme.accent
                  : isDark
                  ? theme.borderMuted
                  : theme.border,
              },
            ]}
          >
            <Ionicons
              name={
                isCompleted
                  ? "checkmark-circle"
                  : isStarted
                  ? "time-outline"
                  : "ellipse-outline"
              }
              size={11}
              color={
                isCompleted
                  ? theme.accent
                  : isStarted
                  ? theme.cyan
                  : theme.textFaint
              }
            />
            <Text
              style={[
                styles.statusPillText,
                {
                  color: isCompleted
                    ? theme.accent
                    : isDark
                    ? theme.textMuted
                    : theme.textMuted,
                },
              ]}
            >
              {isCompleted
                ? "Achieved"
                : isStarted
                ? `${formatHours(remainingHours)} left`
                : "Not started"}
            </Text>
          </View>
        </View>
      </View>

      {/* 3. Progress Bar Meter */}
      <ProgressBar
        value={Math.min(100, Math.max(0, progressPercent))}
        height={6}
        tone={progressTone}
      />

      {/* 4. Footer Row: Supporting Achievement & Questions Solved */}
      <View style={styles.footerRow}>
        <View style={styles.footerLeftGroup}>
          <Ionicons
            name={isCompleted ? "sparkles" : "calendar-outline"}
            size={13}
            color={isCompleted ? theme.accent : theme.textFaint}
          />
          <Text
            style={[
              styles.footerMetaText,
              { color: isCompleted ? theme.accent : theme.textMuted },
            ]}
            numberOfLines={1}
          >
            {isCompleted
              ? "Goal achieved! Excellent consistency."
              : isStarted
              ? "Keep the momentum going."
              : "Track your focused time to build momentum."}
          </Text>
        </View>

        <View
          style={[
            styles.questionsBadge,
            {
              backgroundColor: isDark
                ? "rgba(255, 255, 255, 0.04)"
                : theme.surfaceSubtle,
              borderColor: isDark ? theme.borderMuted : theme.borderMuted,
            },
          ]}
        >
          <Ionicons
            name="help-circle-outline"
            size={12}
            color={todayQuestions > 0 ? theme.cyan : theme.textFaint}
          />
          <Text
            style={[
              styles.questionsText,
              {
                color: todayQuestions > 0
                  ? isDark
                    ? "#fafafa"
                    : theme.text
                  : theme.textFaint,
              },
            ]}
          >
            {todayQuestions} {todayQuestions === 1 ? "question" : "questions"}
          </Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
  },

  // 1. Header
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: radii.full,
  },
  sectionLabel: {
    ...typography.label,
    letterSpacing: 0.8,
  },
  goalBadgeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  goalBadgeText: {
    ...typography.bodySmallMedium,
    fontSize: 11,
    lineHeight: 14,
  },

  // 2. Metrics
  metricsRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  hoursContainer: {
    flex: 1,
    gap: spacing.xxs,
  },
  hoursValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.xs,
  },
  primaryHoursValue: {
    ...typography.metricLarge,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.6,
  },
  goalTargetContext: {
    ...typography.bodySmallMedium,
    fontSize: 13,
  },
  statusSubtitle: {
    ...typography.caption,
    fontSize: 11.5,
  },
  percentBadgeContainer: {
    alignItems: "flex-end",
    gap: spacing.xxs,
  },
  percentValue: {
    ...typography.metricLarge,
    fontSize: 24,
    lineHeight: 28,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs,
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  statusPillText: {
    ...typography.caption,
    fontSize: 10.5,
    fontWeight: "600",
  },

  // 4. Footer
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingTop: spacing.xxs,
  },
  footerLeftGroup: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  footerMetaText: {
    ...typography.caption,
    fontSize: 11.5,
    flexShrink: 1,
  },
  questionsBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs,
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  questionsText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
});
