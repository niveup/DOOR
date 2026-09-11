import React, { useMemo, useState } from "react";
import {
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from "react-native";
import { Ionicons } from "@/src/components/app-icon";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useTheme } from "@/src/providers/theme-provider";
import { formatINR, shortDate } from "@/src/lib/format";
import { Expense } from "@/src/types/domain";
import { CategoryIconBadge } from "@/src/components/finance/CategoryIconBadge";
import { radii, spacing, typography } from "@/src/theme/tokens";

export interface FinanceRecentActivityProps {
  expensesList: Expense[];
  groupedTop5Expenses?: { dateLabel: string; items: Expense[] }[];
  onOpenAllActivity: () => void;
  onLogExpense: () => void;
}

export function FinanceRecentActivity({
  expensesList,
  groupedTop5Expenses = [],
  onOpenAllActivity,
  onLogExpense,
}: FinanceRecentActivityProps) {
  const { theme, isDark } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);

  const activeGroups = useMemo(() => {
    if (groupedTop5Expenses && groupedTop5Expenses.length > 0) {
      return groupedTop5Expenses;
    }
    const top5 = expensesList.slice(0, 5);
    const groups: { dateLabel: string; items: Expense[] }[] = [];
    top5.forEach((item) => {
      const label = item.date ? shortDate(item.date) : "Recent";
      const existing = groups.find((g) => g.dateLabel === label);
      if (existing) {
        existing.items.push(item);
      } else {
        groups.push({ dateLabel: label, items: [item] });
      }
    });
    return groups;
  }, [groupedTop5Expenses, expensesList]);

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
          styles.mainCard,
          {
            borderColor: isDark ? "#282834" : "#cbd5e1",
          },
        ]}
      >
        {/* Top Section: Recent Activity with its own boundary and distinct grey shading */}
        {isExpanded ? (
          <View
            style={[
              styles.topSectionExpanded,
              {
                backgroundColor: isDark ? "#141419" : "#f1f5f9",
                borderBottomColor: isDark ? "#242430" : "#cbd5e1",
              },
            ]}
          >
            <Pressable
              onPress={toggleExpand}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Collapse recent activity"
              style={styles.headerLeftCollapseRow}
            >
              <Text
                style={[
                  styles.sectionTitleText,
                  { color: isDark ? "#fafafa" : theme.text },
                ]}
              >
                Recent Activity
              </Text>
              <Ionicons
                name="chevron-up"
                size={14}
                color={isDark ? "#8e8e99" : theme.textMuted}
              />
            </Pressable>

            {/* "View More Activity" button shifts to far right side and becomes "View more" */}
            <Pressable
              onPress={onOpenAllActivity}
              accessibilityRole="button"
              accessibilityLabel="View more transactions on dedicated page"
              style={({ pressed }) => [
                styles.farRightGreyButton,
                {
                  backgroundColor: isDark ? "#2a2a36" : "#d8e0ea",
                  borderColor: isDark ? "#3c3c4e" : "#bcc8d8",
                },
                pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
              ]}
            >
              <Text
                style={[
                  styles.farRightGreyButtonText,
                  { color: isDark ? "#f4f4f6" : "#1e293b" },
                ]}
              >
                View more
              </Text>
              <Ionicons
                name="arrow-forward"
                size={12}
                color={isDark ? "#f4f4f6" : "#1e293b"}
              />
            </Pressable>
          </View>
        ) : (
          <View
            style={[
              styles.topSectionCollapsed,
              {
                backgroundColor: isDark ? "#141419" : "#f1f5f9",
                borderBottomColor: isDark ? "#242430" : "#cbd5e1",
              },
            ]}
          >
            <Text
              style={[
                styles.sectionTitleText,
                { color: isDark ? "#fafafa" : theme.text },
                { textAlign: "center" },
              ]}
            >
              Recent Activity
            </Text>
            {expensesList.length > 0 ? (
              <Text style={[styles.sectionSubtitleText, { color: isDark ? "#8e8e99" : theme.textMuted }]}>
                {expensesList.length} transaction{expensesList.length === 1 ? "" : "s"} recorded
              </Text>
            ) : (
              <Text style={[styles.sectionSubtitleText, { color: isDark ? "#8e8e99" : theme.textMuted }]}>
                No transactions logged yet
              </Text>
            )}
          </View>
        )}

        {/* Bottom Section: Differentiated grey shading */}
        {isExpanded && expensesList.length > 0 ? (
          <View
            style={[
              styles.activitiesContainer,
              {
                backgroundColor: isDark ? "#1b1b23" : "#e9eef5",
              },
            ]}
          >
            {activeGroups.map((group, gIdx) => (
              <View key={group.dateLabel}>
                {/* Date Group Header */}
                <View
                  style={[
                    styles.dateHeaderRow,
                    {
                      backgroundColor: isDark ? "#16161f" : "#e2e8f0",
                      borderTopColor: isDark ? "#242430" : "#cbd5e1",
                      borderTopWidth: gIdx > 0 ? StyleSheet.hairlineWidth : 0,
                    },
                  ]}
                >
                  <Text style={[styles.dateHeaderText, { color: isDark ? "#8e8e99" : theme.textFaint }]}>
                    {group.dateLabel}
                  </Text>
                </View>

                {/* Transaction Items */}
                {group.items.map((item, idx) => (
                  <Pressable
                    key={item.id}
                    onPress={onOpenAllActivity}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.title}: expense of ${formatINR(item.amount)}`}
                    style={({ pressed }) => [
                      styles.unifiedItemRow,
                      idx > 0 && [
                        styles.hairlineDivider,
                        { borderTopColor: isDark ? "#242430" : "#cbd5e1" },
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
          </View>
        ) : (
          <View
            style={[
              styles.bottomSection,
              {
                backgroundColor: isDark ? "#1b1b23" : "#e9eef5",
              },
            ]}
          >
            <Pressable
              onPress={expensesList.length > 0 ? toggleExpand : onLogExpense}
              accessibilityRole="button"
              accessibilityLabel={expensesList.length > 0 ? "View more activity" : "Log an expense"}
              style={({ pressed }) => [
                styles.greyButton,
                {
                  backgroundColor: isDark ? "#2a2a36" : "#d8e0ea",
                  borderColor: isDark ? "#3c3c4e" : "#bcc8d8",
                },
                pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] },
              ]}
            >
              <Text
                style={[
                  styles.greyButtonText,
                  { color: isDark ? "#f4f4f6" : "#1e293b" },
                ]}
              >
                {expensesList.length > 0 ? "View more activity" : "Log an expense"}
              </Text>
              <Ionicons
                name={expensesList.length > 0 ? "arrow-down" : "add"}
                size={14}
                color={isDark ? "#f4f4f6" : "#1e293b"}
              />
            </Pressable>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sectionGroup: {
    gap: spacing.xs,
  },
  mainCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  topSectionCollapsed: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    gap: 3,
  },
  topSectionExpanded: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  headerLeftCollapseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sectionTitleText: {
    ...typography.subheading,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  sectionSubtitleText: {
    ...typography.caption,
    fontSize: 11.5,
    fontWeight: "500",
    textAlign: "center",
  },
  farRightGreyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  farRightGreyButtonText: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.1,
  },
  bottomSection: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  greyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: radii.md,
    borderWidth: 1,
    minWidth: 180,
  },
  greyButtonText: {
    ...typography.caption,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.1,
  },
  activitiesContainer: {
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
});
