import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@/src/components/app-icon";
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
  upcomingBillsTotal?: number;
  upcomingBillsCount?: number;
  safeDailySpend?: number;
  daysLeft?: number;
  rawSpendPercent: number;
  onOpenBudget: () => void;
}

export function FinanceHeroRunway({
  isOverBudget,
  overBudgetAmount,
  allowance,
  remaining,
  spent,
  upcomingBillsTotal = 0,
  upcomingBillsCount = 0,
  safeDailySpend = 0,
  daysLeft = 0,
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
      {/* 1. Main Balance Metric Row with Status Pill */}
      <View style={styles.balanceRow}>
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
              ? "over budget this month"
              : allowance > 0
              ? "remaining this month"
              : "spent this month"}
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

      {/* 2. Progress Meter */}
      <View style={styles.progressContainer}>
        <View style={styles.progressHeaderRow}>
          <Text style={[styles.progressLabel, { color: theme.textMuted }]}>
            Allowance used
          </Text>
          <Text
            style={[
              styles.progressPercent,
              {
                color: isOverBudget
                  ? SEMANTIC.crimson
                  : isNearLimit
                  ? SEMANTIC.amber
                  : theme.textMuted,
              },
            ]}
          >
            {Math.round(rawSpendPercent)}%
          </Text>
        </View>
        <ProgressBar
          value={Math.min(100, Math.max(0, rawSpendPercent))}
          height={6}
          tone={statusTone}
        />
      </View>

      {/* 3. Secondary Metrics Split (Upcoming Bills | Total Spent) */}
      <View style={styles.metricsSplitGrid}>
        <View style={styles.metricColumn}>
          <Text style={[styles.metricColumnLabel, { color: theme.textFaint }]}>
            UPCOMING BILLS
          </Text>
          <Text
            style={[
              styles.metricColumnValue,
              { color: isDark ? "#fafafa" : theme.text },
            ]}
          >
            {formatINR(upcomingBillsTotal)}
          </Text>
          <Text style={[styles.metricColumnSub, { color: theme.textMuted }]}>
            {upcomingBillsCount === 0
              ? "No pending bills"
              : upcomingBillsCount === 1
              ? "1 bill due this month"
              : `${upcomingBillsCount} bills due this month`}
          </Text>
        </View>

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
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    padding: 24,
    borderRadius: radii.xl,
    borderWidth: 1,
  },
  balanceRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  balanceBlock: {
    flex: 1,
    gap: 4,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs,
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    borderRadius: radii.full,
    borderWidth: 1,
    marginTop: 2,
  },
  statusPillText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: "700",
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
    fontSize: 13,
    lineHeight: 18,
  },
  progressContainer: {
    marginTop: 24,
    gap: 8,
  },
  progressHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  progressLabel: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: "500",
  },
  progressPercent: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  metricsSplitGrid: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
  },
  metricColumn: {
    flex: 1,
    gap: 4,
  },
  metricColumnLabel: {
    ...typography.label,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  metricColumnValue: {
    ...typography.metric,
    fontSize: 16,
    lineHeight: 22,
    fontVariant: ["tabular-nums"],
  },
  metricColumnSub: {
    ...typography.caption,
    fontSize: 12,
    lineHeight: 16,
  },
});
