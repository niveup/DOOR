import React, { useState } from "react";
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from "react-native";
import { Ionicons } from "@/src/components/app-icon";
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
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpand = () => {
    if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded((prev) => !prev);
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(200).duration(320)}
      style={styles.sectionGroup}
    >
      <View
        style={[
          styles.unifiedCard,
          {
            backgroundColor: isDark ? "#121216" : theme.surface,
            borderColor: isDark ? "#1f1f25" : theme.border,
          },
        ]}
      >
        {/* Centered Box Header */}
        <Pressable
          onPress={expensesList.length > 0 ? toggleExpand : onLogExpense}
          accessibilityRole="button"
          accessibilityLabel={
            expensesList.length > 0
              ? isExpanded
                ? "Hide recent activity"
                : "View more activity"
              : "No transactions yet, tap to log expense"
          }
          style={({ pressed }) => [
            styles.centeredHeaderBox,
            pressed && { opacity: 0.75 },
            isExpanded && [
              styles.hairlineDivider,
              { borderBottomColor: isDark ? "#1f1f25" : theme.divider, borderBottomWidth: StyleSheet.hairlineWidth },
            ],
          ]}
        >
          <Text
            style={[
              styles.centeredTitleText,
              { color: isDark ? "#fafafa" : theme.text },
            ]}
          >
            Recent Activity
          </Text>

          {expensesList.length > 0 ? (
            <View style={styles.toggleRow}>
              <Text style={[styles.toggleActionText, { color: theme.cyan }]}>
                {isExpanded ? "Hide activity" : "View more activity"}
              </Text>
              <Ionicons
                name={isExpanded ? "chevron-up" : "chevron-down"}
                size={14}
                color={theme.cyan}
              />
            </View>
          ) : (
            <Text style={[styles.emptyHintText, { color: theme.textMuted }]}>
              No transactions yet · Tap to log
            </Text>
          )}
        </Pressable>

        {/* Revealed Content: generally hidden, shown only after clicking view more activity */}
        {isExpanded && expensesList.length > 0 ? (
          <View>
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
                {group.items.map((item, idx) => (
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
                ))}
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
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sectionGroup: {
    gap: spacing.xs,
  },
  centeredHeaderBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 4,
  },
  centeredTitleText: {
    ...typography.subheading,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
    textAlign: "center",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  toggleActionText: {
    ...typography.caption,
    fontSize: 12.5,
    fontWeight: "700",
  },
  emptyHintText: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: "500",
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
});
