import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@/src/components/app-icon";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ProgressBar } from "@/src/components/ui";
import { useTheme } from "@/src/providers/theme-provider";
import { formatINR } from "@/src/lib/format";
import { FinanceCategory } from "@/src/types/domain";
import { CATEGORY_TOKENS, SEMANTIC, getBudgetHealthColor } from "@/src/components/finance/FinanceConstants";
import { CategoryIconBadge } from "@/src/components/finance/CategoryIconBadge";
import { radii, spacing, typography } from "@/src/theme/tokens";

export interface CategoryStat {
  category: FinanceCategory;
  cap: number;
  total: number;
  percent: number;
  isOver: boolean;
}

export interface FinanceSpendingOverviewProps {
  allCategoryStats: CategoryStat[];
  top3Spending: CategoryStat[];
  spent: number;
  onOpenAllSpending: () => void;
  onSelectCategory: (category: FinanceCategory) => void;
  onLogExpense: () => void;
}

export function FinanceSpendingOverview({
  allCategoryStats,
  top3Spending,
  spent,
  onOpenAllSpending,
  onSelectCategory,
  onLogExpense,
}: FinanceSpendingOverviewProps) {
  const { theme, isDark } = useTheme();

  return (
    <Animated.View
      entering={FadeInDown.delay(120).duration(320)}
      style={styles.sectionGroup}
    >
      {/* 1. Section Header */}
      <View style={styles.sectionHeaderRow}>
        <Text
          style={[
            styles.sectionTitleText,
            { color: isDark ? "#fafafa" : theme.text },
          ]}
        >
          Spending Breakdown
        </Text>

        {allCategoryStats.length > 3 ? (
          <Pressable
            onPress={onOpenAllSpending}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={`View all ${allCategoryStats.length} spending categories`}
            style={({ pressed }) => [
              styles.headerActionPill,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={[styles.headerActionText, { color: theme.cyan }]}>
              View all ({allCategoryStats.length}) →
            </Text>
          </Pressable>
        ) : null}
      </View>

      {allCategoryStats.length > 0 && spent > 0 ? (
        <View
          style={[
            styles.unifiedCard,
            {
              backgroundColor: isDark ? "#121216" : theme.surface,
              borderColor: isDark ? "#1f1f25" : theme.border,
            },
          ]}
        >
          {/* Top 3 Spending Categories */}
          {top3Spending.map((item, idx) => {
            return (
              <Pressable
                key={item.category}
                onPress={() => onSelectCategory(item.category)}
                accessibilityRole="button"
                accessibilityLabel={`${item.category}: ${formatINR(item.total)} spent (${item.cap > 0 ? `${item.percent}% of budget` : "no budget set"}). ${
                  item.cap > 0
                    ? item.isOver
                      ? `${formatINR(item.total - item.cap)} over ${formatINR(item.cap)} budget`
                      : `${formatINR(item.cap - item.total)} remaining of ${formatINR(item.cap)} budget`
                    : "No budget set"
                }`}
                style={({ pressed }) => [
                  styles.spendingRowItem,
                  idx > 0 && [
                    styles.hairlineDivider,
                    {
                      borderTopColor: isDark
                        ? theme.borderMuted
                        : theme.divider,
                    },
                  ],
                  pressed && { opacity: 0.75 },
                ]}
              >
                <View style={styles.spendingRowLeft}>
                  <CategoryIconBadge category={item.category} isDark={isDark} />
                  <View style={styles.categoryInfoBlock}>
                    <Text
                      style={[
                        styles.categoryTitleText,
                        { color: isDark ? "#fafafa" : theme.text },
                      ]}
                      numberOfLines={1}
                    >
                      {item.category}
                    </Text>

                    {item.cap > 0 ? (
                      item.isOver ? (
                        <Text
                          style={[
                            styles.categorySubtext,
                            { color: SEMANTIC.crimson, fontWeight: "600" },
                          ]}
                        >
                          {formatINR(item.total - item.cap)} over {formatINR(item.cap)} budget
                        </Text>
                      ) : (
                        <Text
                          style={[
                            styles.categorySubtext,
                            { color: theme.textMuted },
                          ]}
                        >
                          {item.total > 0
                            ? `${formatINR(item.cap - item.total)} remaining of ${formatINR(item.cap)} budget`
                            : `Budget: ${formatINR(item.cap)} · ₹0 spent`}
                        </Text>
                      )
                    ) : (
                      <Text
                        style={[
                          styles.categorySubtext,
                          { color: theme.textFaint },
                        ]}
                      >
                        No budget set
                      </Text>
                    )}

                    {item.cap > 0 ? (
                      <View style={styles.rowProgressWrapper}>
                        <ProgressBar
                          value={item.percent}
                          height={4}
                          tone={getBudgetHealthColor(item.percent, item.isOver)}
                        />
                      </View>
                    ) : null}
                  </View>
                </View>

                <View style={styles.spendingRowRight}>
                  <Text
                    style={[
                      styles.itemAmountText,
                      { color: isDark ? "#fafafa" : theme.text },
                    ]}
                  >
                    {formatINR(item.total)}
                  </Text>
                  <Text style={[styles.itemShareText, { color: theme.textMuted }]}>
                    {item.cap > 0 ? `${item.percent}%` : "—"}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <Pressable
          onPress={onLogExpense}
          accessibilityRole="button"
          accessibilityLabel="No spending recorded yet. Tap to log your first expense."
          style={({ pressed }) => [
            styles.emptyStateBlock,
            {
              backgroundColor: isDark ? "#121216" : theme.surface,
              borderColor: isDark ? "#1f1f25" : theme.border,
            },
            pressed && { opacity: 0.82, transform: [{ scale: 0.99 }] },
          ]}
        >
          <View
            style={[
              styles.emptyStateIconBadge,
              {
                backgroundColor: isDark
                  ? theme.surfaceElevated
                  : theme.surfaceSubtle,
                borderColor: isDark ? theme.borderMuted : theme.borderMuted,
              },
            ]}
          >
            <Ionicons name="pie-chart-outline" size={20} color={theme.cyan} />
          </View>
          <Text
            style={[
              styles.emptyStateHeadline,
              { color: isDark ? "#fafafa" : theme.text },
            ]}
          >
            No spending recorded yet
          </Text>
          <Text
            style={[
              styles.emptyStateSubtext,
              { color: theme.textMuted },
            ]}
          >
            Log your first expense to see where your money goes.
          </Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sectionGroup: {
    gap: spacing.xs,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xxs,
  },
  sectionTitleText: {
    ...typography.subheading,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  headerActionPill: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
    borderRadius: radii.sm,
  },
  headerActionText: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: "700",
  },
  unifiedCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  spendingRowItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    gap: spacing.sm,
  },
  hairlineDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  spendingRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
  },
  categoryInfoBlock: {
    gap: 3,
    flex: 1,
  },
  categoryTitleText: {
    ...typography.bodyMedium,
    fontSize: 13.5,
    fontWeight: "600",
  },
  categorySubtext: {
    ...typography.caption,
    fontSize: 11.5,
  },
  rowProgressWrapper: {
    marginTop: 4,
  },
  spendingRowRight: {
    alignItems: "flex-end",
    gap: 1,
  },
  itemAmountText: {
    ...typography.metric,
    fontSize: 14,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  itemShareText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
  },
  emptyStateBlock: {
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xxs,
  },
  emptyStateIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xxs,
  },
  emptyStateHeadline: {
    ...typography.bodyMedium,
    fontSize: 14.5,
    fontWeight: "700",
  },
  emptyStateSubtext: {
    ...typography.caption,
    fontSize: 12,
    textAlign: "center",
  },
});
