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

  return (
    <Animated.View
      entering={FadeInDown.delay(200).duration(320)}
      style={styles.sectionGroup}
    >
      <View style={styles.buttonWrapper}>
        <Pressable
          onPress={expensesList.length > 0 ? onOpenAllActivity : onLogExpense}
          accessibilityRole="button"
          accessibilityLabel={expensesList.length > 0 ? "View activity" : "Log an expense"}
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
            {expensesList.length > 0 ? "View activity" : "Log an expense"}
          </Text>
          <Ionicons
            name={expensesList.length > 0 ? "arrow-forward" : "add"}
            size={13}
            color={isDark ? "#f4f4f6" : "#1e293b"}
          />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sectionGroup: {
    gap: spacing.xs,
  },
  buttonWrapper: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xs,
  },
  greyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  greyButtonText: {
    ...typography.caption,
    fontSize: 12.5,
    fontWeight: "600",
    letterSpacing: 0.1,
  },
});

