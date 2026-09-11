import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@/src/components/app-icon";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useTheme } from "@/src/providers/theme-provider";
import { Expense } from "@/src/types/domain";
import { radii, spacing, typography } from "@/src/theme/tokens";

export interface FinanceRecentActivityProps {
  expensesList: Expense[];
  groupedTop5Expenses?: { dateLabel: string; items: Expense[] }[];
  onOpenAllActivity: () => void;
  onLogExpense: () => void;
}

export function FinanceRecentActivity({
  expensesList,
  onOpenAllActivity,
  onLogExpense,
}: FinanceRecentActivityProps) {
  const { theme, isDark } = useTheme();

  const handleViewMore = () => {
    if (expensesList.length > 0) {
      onOpenAllActivity();
    } else {
      onLogExpense();
    }
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
        <View
          style={[
            styles.topSection,
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

        {/* Bottom Section: View Activities with differentiated grey shading, boundary, and grey button */}
        <View
          style={[
            styles.bottomSection,
            {
              backgroundColor: isDark ? "#1b1b23" : "#e9eef5",
            },
          ]}
        >
          <Pressable
            onPress={handleViewMore}
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
  topSection: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    gap: 3,
  },
  sectionTitleText: {
    ...typography.subheading,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
    textAlign: "center",
  },
  sectionSubtitleText: {
    ...typography.caption,
    fontSize: 11.5,
    fontWeight: "500",
    textAlign: "center",
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
});
