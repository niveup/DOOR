import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ProgressBar } from "@/src/components/ui";
import { useTheme } from "@/src/providers/theme-provider";
import { formatINR } from "@/src/lib/format";
import { SEMANTIC } from "@/src/components/finance/FinanceConstants";
import { radii, spacing, typography } from "@/src/theme/tokens";

export interface FinanceHeroRunwayProps {
  isOverBudget: boolean;
  overBudgetAmount: number;
  allowance: number;
  remaining: number;
  spent: number;
  safeDailySpend: number;
  daysLeft: number;
  rawSpendPercent: number;
  onOpenBudget: () => void;
}

export function FinanceHeroRunway({
  isOverBudget,
  overBudgetAmount,
  allowance,
  remaining,
  spent,
  safeDailySpend,
  daysLeft,
  rawSpendPercent,
  onOpenBudget,
}: FinanceHeroRunwayProps) {
  const { theme, isDark } = useTheme();

  const isNearLimit = rawSpendPercent >= 80 && !isOverBudget;
  const isHealthy = allowance > 0 && !isOverBudget && !isNearLimit;
  const hasNoBudget = allowance <= 0;

  const statusTone = isOverBudget
    ? SEMANTIC.crimson
    : isNearLimit
    ? SEMANTIC.amber
    : isHealthy
    ? SEMANTIC.emerald
    : theme.textFaint;

  const statusLabel = isOverBudget
    ? "Over Budget"
    : isNearLimit
    ? "Near Limit"
    : isHealthy
    ? "On Track"
    : "No Budget Set";

  const statusIcon = isOverBudget
    ? "alert-circle"
    : isNearLimit
    ? "warning-outline"
    : isHealthy
    ? "checkmark-circle"
    : "options-outline";

  return (
    <Animated.View
      entering={FadeInDown.delay(40).duration(320)}
      accessible={true}
      accessibilityRole="summary"
      accessibilityLabel={`Monthly Runway: ${
        isOverBudget
          ? `Over budget by ${formatINR(overBudgetAmount)}`
          : allowance > 0
          ? `${formatINR(remaining)} remaining of ${formatINR(allowance)} allowance`
          : `${formatINR(spent)} spent this month`
      }. Safe daily spend is ${formatINR(safeDailySpend)} per day with ${daysLeft} days left.`}
      style={[
        styles.heroCard,
        {
          backgroundColor: isDark ? "#121216" : theme.surface,
          borderColor: isDark ? "#1f1f25" : theme.border,
        },
      ]}
    >
      {/* 1. Header: Section Tag + Status Pill / Budget Link */}
      <View style={styles.headerRow}>
        <View style={styles.tagGroup}>
          <View
            style={[
              styles.pulseDot,
              { backgroundColor: statusTone },
            ]}
          />
          <Text style={[styles.sectionLabel, { color: theme.textFaint }]}>
            MONTHLY RUNWAY
          </Text>
        </View>

        {hasNoBudget ? (
          <Pressable
            onPress={onOpenBudget}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Set monthly budget allowance"
            style={({ pressed }) => [
              styles.statusPill,
              {
                backgroundColor: isDark ? theme.surfaceElevated : theme.surfaceSubtle,
                borderColor: isDark ? theme.borderMuted : theme.border,
              },
              pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] },
            ]}
          >
            <Ionicons name="options-outline" size={11} color={theme.textMuted} />
            <Text style={[styles.statusPillText, { color: theme.text }]}>
              Set budget →
            </Text>
          </Pressable>
        ) : (
          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: isDark ? theme.surfaceElevated : theme.surfaceSubtle,
                borderColor: isDark ? theme.borderMuted : theme.border,
              },
            ]}
          >
            <Ionicons name={statusIcon} size={11} color={statusTone} />
            <Text style={[styles.statusPillText, { color: statusTone }]}>
              {statusLabel}
            </Text>
          </View>
        )}
      </View>

      {/* 2. Main Balance Metric Block */}
      <View style={styles.balanceBlock}>
        <Text
          style={[
            styles.primaryBalanceValue,
            {
              color: isOverBudget
                ? SEMANTIC.crimson
                : isDark
                ? "#fafafa"
                : theme.text,
            },
          ]}
        >
          {isOverBudget
            ? `- ${formatINR(overBudgetAmount)}`
            : allowance > 0
            ? formatINR(remaining)
            : formatINR(spent)}
        </Text>

        <Text style={[styles.balanceSubtext, { color: theme.textMuted }]}>
          {isOverBudget
            ? `Exceeded ₹${allowance.toLocaleString("en-IN")} monthly allowance`
            : allowance > 0
            ? `remaining of ${formatINR(allowance)} allowance`
            : "Spent this month · No allowance limit configured"}
        </Text>
      </View>

      {/* 3. Progress Meter */}
      <View style={styles.progressContainer}>
        <ProgressBar
          value={Math.min(100, Math.max(0, rawSpendPercent))}
          height={6}
          tone={statusTone}
        />
      </View>

      {/* 4. Secondary Metrics Split (Safe Daily Spend | Total Spent) */}
      <View
        style={[
          styles.metricsSplitGrid,
          {
            backgroundColor: isDark ? theme.surfaceElevated : theme.surfaceSubtle,
            borderColor: isDark ? theme.borderMuted : theme.border,
          },
        ]}
      >
        <View style={styles.metricColumn}>
          <Text style={[styles.metricColumnLabel, { color: theme.textFaint }]}>
            SAFE DAILY SPEND
          </Text>
          <Text
            style={[
              styles.metricColumnValue,
              {
                color: isOverBudget
                  ? SEMANTIC.crimson
                  : isDark
                  ? "#fafafa"
                  : theme.text,
              },
            ]}
          >
            {allowance
              ? isOverBudget
                ? "₹0/day"
                : `${formatINR(safeDailySpend)}/day`
              : "Not configured"}
          </Text>
          <Text style={[styles.metricColumnSub, { color: theme.textMuted }]}>
            {daysLeft} {daysLeft === 1 ? "day remaining" : "days remaining"}
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
            TOTAL SPENT
          </Text>
          <Text
            style={[
              styles.metricColumnValue,
              { color: isDark ? "#fafafa" : theme.text },
            ]}
          >
            {formatINR(spent)}
          </Text>
          <Text style={[styles.metricColumnSub, { color: theme.textMuted }]}>
            {allowance > 0 ? `${rawSpendPercent}% of allowance` : "Total outgoings"}
          </Text>
        </View>
      </View>

      {/* 5. Footer Coaching / Context Row */}
      <View style={styles.footerRow}>
        <Ionicons
          name={
            isOverBudget
              ? "alert-circle"
              : isNearLimit
              ? "warning-outline"
              : isHealthy
              ? "sparkles"
              : "information-circle-outline"
          }
          size={13}
          color={statusTone}
        />
        <Text
          style={[
            styles.footerContextText,
            {
              color: isOverBudget
                ? SEMANTIC.crimson
                : isNearLimit
                ? SEMANTIC.amber
                : isHealthy
                ? theme.textMuted
                : theme.textMuted,
            },
          ]}
          numberOfLines={1}
        >
          {isOverBudget
            ? `Pace exceeded budget limit by ${formatINR(overBudgetAmount)}`
            : isNearLimit
            ? "Pace is approaching your monthly allowance limit"
            : isHealthy
            ? "Spending velocity is healthy for the remaining days"
            : "Set a monthly target to unlock daily spending guidance"}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
    fontSize: 11,
    fontWeight: "700",
  },
  balanceBlock: {
    gap: 2,
    marginTop: spacing.xxs,
  },
  primaryBalanceValue: {
    ...typography.metricLarge,
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -0.8,
    fontVariant: ["tabular-nums"],
  },
  balanceSubtext: {
    ...typography.caption,
    fontSize: 12.5,
    lineHeight: 18,
  },
  progressContainer: {
    paddingVertical: spacing.xxs,
  },
  metricsSplitGrid: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    marginTop: spacing.xxs,
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
    fontSize: 15,
    lineHeight: 19,
    fontVariant: ["tabular-nums"],
  },
  metricColumnSub: {
    ...typography.caption,
    fontSize: 11,
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
