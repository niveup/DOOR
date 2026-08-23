import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@/src/components/app-icon";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ProgressBar } from "@/src/components/ui";
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
  const isNearTarget = progressPercent >= 75 && !isCompleted;
  const isStarted = todayHours > 0 && !isCompleted && !isNearTarget;
  const isNotStarted = todayHours <= 0;

  // Semantic status tone derived from real progress
  const statusTone = isCompleted
    ? theme.emerald
    : isNearTarget
    ? theme.cyan
    : isStarted
    ? theme.cyan
    : theme.textFaint;

  const statusLabel = isCompleted
    ? "Target Reached"
    : isNearTarget
    ? "Almost There"
    : isStarted
    ? "In Progress"
    : "Not Started";

  const statusIcon = isCompleted
    ? "checkmark-circle"
    : isNearTarget
    ? "trending-up"
    : isStarted
    ? "time-outline"
    : "ellipse-outline";

  return (
    <Animated.View
      entering={FadeInDown.delay(40).duration(320)}
      accessible={true}
      accessibilityRole="summary"
      accessibilityLabel={`Today's Study Target: ${formatHours(todayHours)} studied of ${dailyGoal} hours goal, ${progressPercent}% complete. ${
        isCompleted
          ? "Target reached!"
          : `${formatHours(remainingHours)} remaining.`
      } ${todayQuestions} questions solved today.`}
      style={[
        styles.heroCard,
        {
          backgroundColor: isDark ? "#121216" : theme.surface,
          borderColor: isDark ? "#1f1f25" : theme.border,
        },
      ]}
    >
      {/* 1. Header: Section Label + Tactile Goal Target Action */}
      <View style={styles.headerRow}>
        <View style={styles.tagGroup}>
          <View
            style={[
              styles.pulseDot,
              { backgroundColor: statusTone },
            ]}
          />
          <Text style={[styles.sectionLabel, { color: theme.textFaint }]}>
            TODAY’S TARGET
          </Text>
        </View>

        <View style={styles.headerRightGroup}>
          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: isDark
                  ? theme.surfaceElevated
                  : theme.surfaceSubtle,
                borderColor: isDark ? theme.borderMuted : theme.border,
              },
            ]}
          >
            <Ionicons name={statusIcon} size={11} color={statusTone} />
            <Text style={[styles.statusPillText, { color: statusTone }]}>
              {statusLabel}
            </Text>
          </View>

          <Pressable
            onPress={onOpenGoal}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={`Change daily study goal. Current target is ${dailyGoal} hours.`}
            style={({ pressed }) => [
              styles.goalButton,
              {
                backgroundColor: isDark
                  ? theme.surfaceElevated
                  : theme.surfaceSubtle,
                borderColor: isDark ? theme.borderMuted : theme.border,
              },
              pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] },
            ]}
          >
            <Text style={[styles.goalButtonText, { color: theme.text }]}>
              {dailyGoal}h goal
            </Text>
            <Ionicons
              name="pencil"
              size={11}
              color={theme.textMuted}
            />
          </Pressable>
        </View>
      </View>

      {/* 2. Main Study Metric Block (Crisp & Uncluttered) */}
      <View style={styles.metricBlock}>
        <View style={styles.primaryMetricRow}>
          <Text
            style={[
              styles.primaryHoursValue,
              { color: isDark ? "#fafafa" : theme.text },
            ]}
          >
            {formatHours(todayHours)}
          </Text>
          <Text style={[styles.primaryGoalContext, { color: theme.textMuted }]}>
            / {dailyGoal}h
          </Text>
        </View>

        <Text style={[styles.balanceSubtext, { color: theme.textMuted }]}>
          {isCompleted
            ? "Goal achieved · 100%"
            : isStarted || isNearTarget
            ? `${progressPercent}% completed · ${formatHours(remainingHours)} left`
            : "0% completed · Ready to start"}
        </Text>
      </View>

      {/* 3. Progress Meter */}
      <View style={styles.progressContainer}>
        <ProgressBar
          value={Math.min(100, Math.max(0, progressPercent))}
          height={6}
          tone={statusTone}
        />
      </View>

      {/* 4. Secondary Metrics Split (Remaining | Questions) */}
      <View
        style={[
          styles.metricsSplitGrid,
          {
            backgroundColor: isDark
              ? theme.surfaceElevated
              : theme.surfaceSubtle,
            borderColor: isDark ? theme.borderMuted : theme.border,
          },
        ]}
      >
        <View style={styles.metricColumn}>
          <Text style={[styles.metricColumnLabel, { color: theme.textFaint }]}>
            REMAINING
          </Text>
          <Text
            style={[
              styles.metricColumnValue,
              {
                color: isCompleted
                  ? theme.emerald
                  : isDark
                  ? "#fafafa"
                  : theme.text,
              },
            ]}
          >
            {isCompleted ? "Done" : formatHours(remainingHours)}
          </Text>
          <Text style={[styles.metricColumnSub, { color: theme.textMuted }]}>
            {isCompleted ? "Target met" : "left today"}
          </Text>
        </View>

        <View
          style={[
            styles.metricDivider,
            { backgroundColor: isDark ? theme.borderMuted : theme.border },
          ]}
        />

        <View style={styles.metricColumn}>
          <Text style={[styles.metricColumnLabel, { color: theme.textFaint }]}>
            QUESTIONS
          </Text>
          <Text
            style={[
              styles.metricColumnValue,
              { color: isDark ? "#fafafa" : theme.text },
            ]}
          >
            {todayQuestions}
          </Text>
          <Text style={[styles.metricColumnSub, { color: theme.textMuted }]}>
            solved today
          </Text>
        </View>
      </View>

      {/* 5. Footer Coaching Context */}
      <View style={styles.footerRow}>
        <Ionicons
          name={
            isCompleted
              ? "sparkles"
              : isNearTarget
              ? "flame"
              : isStarted
              ? "time-outline"
              : "school-outline"
          }
          size={13}
          color={statusTone}
        />
        <Text
          style={[
            styles.footerContextText,
            { color: isCompleted ? theme.emerald : theme.textMuted },
          ]}
          numberOfLines={1}
        >
          {isCompleted
            ? "Goal reached! Excellent consistency today."
            : isNearTarget
            ? `Final stretch — ${formatHours(remainingHours)} left to close goal.`
            : isStarted
            ? "Focus momentum active. Keep going."
            : "Protect your daily study block."}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.xs,
  },
  tagGroup: {
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
    fontSize: 10,
    letterSpacing: 0.8,
    fontWeight: "700",
  },
  headerRightGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  statusPillText: {
    ...typography.caption,
    fontSize: 10.5,
    fontWeight: "700",
  },
  goalButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  goalButtonText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: "600",
  },
  metricBlock: {
    gap: spacing.xxs,
  },
  primaryMetricRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.xs,
  },
  primaryHoursValue: {
    ...typography.metricLarge,
    fontSize: 32,
    lineHeight: 36,
    fontWeight: "900",
    letterSpacing: -0.6,
    fontVariant: ["tabular-nums"],
  },
  primaryGoalContext: {
    ...typography.bodySmallMedium,
    fontSize: 13,
  },
  balanceSubtext: {
    ...typography.caption,
    fontSize: 12,
    lineHeight: 16,
  },
  progressContainer: {
    marginVertical: 2,
  },
  metricsSplitGrid: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radii.md,
    borderWidth: 1,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  metricColumn: {
    flex: 1,
    gap: 2,
  },
  metricColumnLabel: {
    ...typography.label,
    fontSize: 9,
    letterSpacing: 0.8,
  },
  metricColumnValue: {
    ...typography.metric,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  metricColumnSub: {
    ...typography.caption,
    fontSize: 10.5,
  },
  metricDivider: {
    width: StyleSheet.hairlineWidth,
    height: 32,
    marginHorizontal: spacing.sm,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingTop: 2,
  },
  footerContextText: {
    ...typography.caption,
    fontSize: 11.5,
    flex: 1,
  },
});
