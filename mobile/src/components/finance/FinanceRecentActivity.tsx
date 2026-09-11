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
            borderColor: isDark ? "#23232b" : "#e2e8f0",
          },
        ]}
      >
        {/* Top Section: Recent Activity with its own boundary and distinct grey shading */}
        {isExpanded ? (
          <View
            style={[
              styles.topSectionExpanded,
              {
                backgroundColor: isDark ? "#131317" : "#f8fafc",
                borderBottomColor: isDark ? "#1e1e26" : "#e2e8f0",
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
              {expensesList.length > 0 ? (
                <View
                  style={[
                    styles.countBadge,
                    {
                      backgroundColor: isDark ? "#202028" : "#e2e8f0",
                      borderColor: isDark ? "#2a2a35" : "#cbd5e1",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.countBadgeText,
                      { color: isDark ? "#9d9da8" : "#64748b" },
                    ]}
                  >
                    {expensesList.length}
                  </Text>
                </View>
              ) : null}
              <Ionicons
                name="chevron-up"
                size={13}
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
                  backgroundColor: isDark ? "#22222b" : "#e2e8f0",
                  borderColor: isDark ? "#2f2f3c" : "#cbd5e1",
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
                size={11}
                color={isDark ? "#f4f4f6" : "#1e293b"}
              />
            </Pressable>
          </View>
        ) : (
          <View
            style={[
              styles.topSectionCollapsed,
              {
                backgroundColor: isDark ? "#131317" : "#f8fafc",
                borderBottomColor: isDark ? "#1e1e26" : "#e2e8f0",
              },
            ]}
          >
            <View style={styles.titleWithBadgeRow}>
              <Text
                style={[
                  styles.sectionTitleText,
                  { color: isDark ? "#fafafa" : theme.text },
                ]}
              >
                Recent Activity
              </Text>
              {expensesList.length > 0 ? (
                <View
                  style={[
                    styles.countBadge,
                    {
                      backgroundColor: isDark ? "#202028" : "#e2e8f0",
                      borderColor: isDark ? "#2a2a35" : "#cbd5e1",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.countBadgeText,
                      { color: isDark ? "#9d9da8" : "#64748b" },
                    ]}
                  >
                    {expensesList.length}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        )}

        {/* Bottom Section: Differentiated grey shading */}
        {isExpanded && expensesList.length > 0 ? (
          <View
            style={[
              styles.activitiesContainer,
              {
                backgroundColor: isDark ? "#17171e" : "#f1f5f9",
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
                      backgroundColor: isDark ? "#131317" : "#e9eef5",
                      borderTopColor: isDark ? "#1e1e26" : "#cbd5e1",
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
                        { borderTopColor: isDark ? "#1e1e26" : "#e2e8f0" },
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
                backgroundColor: isDark ? "#17171e" : "#f1f5f9",
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
                  backgroundColor: isDark ? "#22222b" : "#e2e8f0",
                  borderColor: isDark ? "#2f2f3c" : "#cbd5e1",
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
                size={12}
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
    borderRadius: radii.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  topSectionCollapsed: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topSectionExpanded: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  titleWithBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  headerLeftCollapseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sectionTitleText: {
    ...typography.subheading,
    fontSize: 13.5,
    fontWeight: "600",
    letterSpacing: -0.1,
  },
  countBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  countBadgeText: {
    ...typography.caption,
    fontSize: 10.5,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  farRightGreyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 3.5,
    paddingHorizontal: 9,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  farRightGreyButtonText: {
    ...typography.caption,
    fontSize: 11.5,
    fontWeight: "600",
    letterSpacing: 0.1,
  },
  bottomSection: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  greyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 4.5,
    paddingHorizontal: 13,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  greyButtonText: {
    ...typography.caption,
    fontSize: 11.5,
    fontWeight: "600",
    letterSpacing: 0.1,
  },
  activitiesContainer: {
    overflow: "hidden",
  },
  dateHeaderRow: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  dateHeaderText: {
    ...typography.label,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  unifiedItemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 10,
  },
  hairlineDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  itemLeftBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  itemDetails: {
    gap: 1,
    flex: 1,
  },
  itemTitle: {
    ...typography.bodyMedium,
    fontSize: 13,
    fontWeight: "600",
  },
  itemSubtext: {
    ...typography.caption,
    fontSize: 11,
  },
  itemAmount: {
    ...typography.metric,
    fontSize: 13.5,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
});
