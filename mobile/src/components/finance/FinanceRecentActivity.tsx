import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useTheme } from "@/src/providers/theme-provider";
import { formatINR, shortDate } from "@/src/lib/format";
import { Expense } from "@/src/types/domain";
import { CategoryIconBadge } from "@/src/components/finance/CategoryIconBadge";
import { radii, spacing, typography } from "@/src/theme/tokens";

export interface FinanceRecentActivityProps {
  expensesList: Expense[];
  groupedTop5Expenses: { dateLabel: string; items: Expense[] }[];
  onOpenAllActivity: () => void;
  onLogExpense: () => void;
}

export function FinanceRecentActivity({
  expensesList,
  groupedTop5Expenses,
  onOpenAllActivity,
  onLogExpense,
}: FinanceRecentActivityProps) {
  const { theme, isDark } = useTheme();

  return (
    <Animated.View
      entering={FadeInDown.delay(200).duration(320)}
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
          Recent Activity
        </Text>

        {expensesList.length > 5 ? (
          <Pressable
            onPress={onOpenAllActivity}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={`View all ${expensesList.length} transactions`}
            style={({ pressed }) => [
              styles.headerActionPill,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={[styles.headerActionText, { color: theme.cyan }]}>
              View all ({expensesList.length}) →
            </Text>
          </Pressable>
        ) : null}
      </View>

      {/* 2. Transaction List or Calm Empty State */}
      {expensesList.length > 0 ? (
        <View
          style={[
            styles.unifiedCard,
            {
              backgroundColor: isDark ? "#121216" : theme.surface,
              borderColor: isDark ? "#1f1f25" : theme.border,
            },
          ]}
        >
          {groupedTop5Expenses.map((group, gIdx) => (
            <View key={group.dateLabel}>
              {/* Date Group Header */}
              <View
                style={[
                  styles.dateHeaderRow,
                  {
                    backgroundColor: isDark
                      ? theme.surfaceElevated
                      : theme.surfaceSubtle,
                    borderTopColor: isDark
                      ? theme.borderMuted
                      : theme.divider,
                    borderTopWidth: gIdx > 0 ? StyleSheet.hairlineWidth : 0,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.dateHeaderText,
                    { color: theme.textFaint },
                  ]}
                >
                  {group.dateLabel}
                </Text>
              </View>

              {/* Transaction Items in Date Group */}
              {group.items.map((item, idx) => {
                return (
                  <Pressable
                    key={item.id}
                    onPress={onOpenAllActivity}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.title}: expense of ${formatINR(item.amount)}, ${
                      item.date ? shortDate(item.date) : ""
                    }. Category: ${item.category}.`}
                    style={({ pressed }) => [
                      styles.unifiedItemRow,
                      idx > 0 && [
                        styles.hairlineDivider,
                        {
                          borderTopColor: isDark
                            ? theme.borderMuted
                            : theme.divider,
                        },
                      ],
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    <View style={styles.itemLeftBlock}>
                      <CategoryIconBadge
                        category={item.category}
                        isDark={isDark}
                      />

                      <View style={styles.itemDetails}>
                        <Text
                          style={[
                            styles.itemTitle,
                            { color: isDark ? "#fafafa" : theme.text },
                          ]}
                          numberOfLines={1}
                        >
                          {item.title}
                        </Text>
                        <Text
                          style={[
                            styles.itemSubtext,
                            { color: theme.textMuted },
                          ]}
                        >
                          {item.date ? `${shortDate(item.date)} · ` : ""}
                          {item.category}
                        </Text>
                      </View>
                    </View>

                    <Text
                      style={[
                        styles.itemAmount,
                        { color: isDark ? "#fafafa" : theme.text },
                      ]}
                    >
                      - {formatINR(item.amount)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}

          {expensesList.length > 5 ? (
            <Pressable
              onPress={onOpenAllActivity}
              accessibilityRole="button"
              accessibilityLabel={`View all ${expensesList.length} transactions`}
              style={({ pressed }) => [
                styles.collapseBottomButton,
                {
                  borderTopColor: isDark
                    ? theme.borderMuted
                    : theme.divider,
                },
                pressed && { opacity: 0.65 },
              ]}
            >
              <Text style={[styles.collapseBottomText, { color: theme.cyan }]}>
                View all {expensesList.length} transactions →
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <Pressable
          onPress={onLogExpense}
          accessibilityRole="button"
          accessibilityLabel="No transactions recorded yet. Tap to log an expense."
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
            <Ionicons
              name="receipt-outline"
              size={19}
              color={theme.cyan}
            />
          </View>
          <Text
            style={[
              styles.emptyStateHeadline,
              { color: isDark ? "#fafafa" : theme.text },
            ]}
          >
            No transactions yet
          </Text>
          <Text
            style={[
              styles.emptyStateSubtext,
              { color: theme.textMuted },
            ]}
          >
            Your logged student expenses will appear here.
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
  dateHeaderRow: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  dateHeaderText: {
    ...typography.label,
    fontSize: 10.5,
    letterSpacing: 0.6,
  },
  unifiedItemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  hairlineDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  itemLeftBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
  },
  itemDetails: {
    gap: 2,
    flex: 1,
  },
  itemTitle: {
    ...typography.bodyMedium,
    fontSize: 13.5,
    fontWeight: "600",
  },
  itemSubtext: {
    ...typography.caption,
    fontSize: 11.5,
  },
  itemAmount: {
    ...typography.metric,
    fontSize: 14,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  collapseBottomButton: {
    paddingVertical: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  collapseBottomText: {
    ...typography.caption,
    fontSize: 12.5,
    fontWeight: "700",
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
