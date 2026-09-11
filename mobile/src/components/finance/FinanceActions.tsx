import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@/src/components/app-icon";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useTheme } from "@/src/providers/theme-provider";
import { radii, spacing, typography } from "@/src/theme/tokens";

export interface FinanceActionsProps {
  onLogExpense: () => void;
  onPlanBudget: () => void;
}

export function FinanceActions({
  onLogExpense,
  onPlanBudget,
}: FinanceActionsProps) {
  const { theme, isDark } = useTheme();

  return (
    <Animated.View
      entering={FadeInDown.delay(80).duration(320)}
      style={styles.actionRow}
    >
      <Pressable
        onPress={onLogExpense}
        accessibilityRole="button"
        accessibilityLabel="Log a new student expense"
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        style={({ pressed }) => [
          styles.primaryButton,
          {
            backgroundColor: isDark ? "#FAFBFD" : "#0F172A",
            borderColor: isDark ? "#FAFBFD" : "#0F172A",
          },
          pressed && { opacity: 0.85, transform: [{ scale: 0.985 }] },
        ]}
      >
        <Ionicons name="add" size={19} color={isDark ? "#09090B" : "#FFFFFF"} />
        <Text style={[styles.primaryButtonText, { color: isDark ? "#09090B" : "#FFFFFF" }]}>
          Log Expense
        </Text>
      </Pressable>

      <Pressable
        onPress={onPlanBudget}
        accessibilityRole="button"
        accessibilityLabel="Open monthly budget planner"
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        style={({ pressed }) => [
          styles.secondaryButton,
          {
            backgroundColor: isDark ? "#121216" : theme.surface,
            borderColor: isDark ? "#2D2D36" : theme.border,
          },
          pressed && { opacity: 0.75, transform: [{ scale: 0.985 }] },
        ]}
      >
        <Ionicons name="options-outline" size={16} color={isDark ? "#71717A" : theme.textFaint} />
        <Text style={[styles.secondaryButtonText, { color: isDark ? "#D4D4D8" : theme.textSecondary }]}>
          Plan Budget
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  primaryButton: {
    flex: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
  },
  primaryButtonText: {
    ...typography.bodyMedium,
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
  },
  secondaryButtonText: {
    ...typography.bodyMedium,
    fontSize: 14.5,
    fontWeight: "500",
    letterSpacing: -0.1,
  },
});
