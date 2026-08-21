import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
        <View
          style={[
            styles.actionBtnIconBadge,
            { backgroundColor: isDark ? "#09090B" : "#FFFFFF" },
          ]}
        >
          <Ionicons name="add" size={13} color={isDark ? "#FFFFFF" : "#0F172A"} />
        </View>
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
            borderColor: isDark ? "#1F1F25" : theme.border,
          },
          pressed && { opacity: 0.75, transform: [{ scale: 0.985 }] },
        ]}
      >
        <Ionicons name="options-outline" size={15} color={isDark ? "#A1A1AA" : theme.textMuted} />
        <Text style={[styles.secondaryButtonText, { color: isDark ? "#FAFBFD" : theme.text }]}>
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
    flex: 1.2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    height: 46,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
  },
  actionBtnIconBadge: {
    width: 20,
    height: 20,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    ...typography.bodyMedium,
    fontSize: 13.5,
    fontWeight: "700",
  },
  secondaryButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    height: 46,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
  },
  secondaryButtonText: {
    ...typography.bodyMedium,
    fontSize: 13.5,
    fontWeight: "600",
  },
});
