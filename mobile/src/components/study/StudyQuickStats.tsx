import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/src/providers/theme-provider";
import { radii, spacing, typography } from "@/src/theme/tokens";

export interface StudyQuickStatsProps {
  totalHours: number;
  totalQuestions: number;
  totalSessions: number;
}

export function StudyQuickStats({
  totalHours,
  totalQuestions,
  totalSessions,
}: StudyQuickStatsProps) {
  const { theme, isDark } = useTheme();

  return (
    <View
      accessible={true}
      accessibilityRole="summary"
      accessibilityLabel={`Lifetime study summary: ${totalHours.toFixed(
        1
      )} hours total study time, ${totalQuestions} questions solved, ${totalSessions} sessions recorded.`}
      style={[
        styles.quickStatsContainer,
        {
          backgroundColor: isDark ? "#121216" : theme.surface,
          borderColor: isDark ? "#1f1f25" : theme.border,
        },
      ]}
    >
      {/* Column 1: Total Study Time */}
      <View
        style={styles.quickStatCol}
        accessible={true}
        accessibilityLabel={`${totalHours.toFixed(1)} hours study time`}
      >
        <Text
          style={[
            styles.quickStatNumber,
            { color: isDark ? "#fafafa" : theme.text },
          ]}
          numberOfLines={1}
        >
          {totalHours.toFixed(1)}h
        </Text>
        <Text
          style={[
            styles.quickStatLabel,
            { color: theme.textMuted },
          ]}
          numberOfLines={1}
        >
          Study time
        </Text>
      </View>

      {/* Subtle Vertical Separator */}
      <View
        style={[
          styles.statDivider,
          { backgroundColor: isDark ? theme.borderMuted : theme.divider },
        ]}
      />

      {/* Column 2: Total Questions */}
      <View
        style={styles.quickStatCol}
        accessible={true}
        accessibilityLabel={`${totalQuestions} questions solved`}
      >
        <Text
          style={[
            styles.quickStatNumber,
            { color: isDark ? "#fafafa" : theme.text },
          ]}
          numberOfLines={1}
        >
          {totalQuestions.toLocaleString()}
        </Text>
        <Text
          style={[
            styles.quickStatLabel,
            { color: theme.textMuted },
          ]}
          numberOfLines={1}
        >
          Questions
        </Text>
      </View>

      {/* Subtle Vertical Separator */}
      <View
        style={[
          styles.statDivider,
          { backgroundColor: isDark ? theme.borderMuted : theme.divider },
        ]}
      />

      {/* Column 3: Total Sessions */}
      <View
        style={styles.quickStatCol}
        accessible={true}
        accessibilityLabel={`${totalSessions} sessions recorded`}
      >
        <Text
          style={[
            styles.quickStatNumber,
            { color: isDark ? "#fafafa" : theme.text },
          ]}
          numberOfLines={1}
        >
          {totalSessions.toLocaleString()}
        </Text>
        <Text
          style={[
            styles.quickStatLabel,
            { color: theme.textMuted },
          ]}
          numberOfLines={1}
        >
          Sessions
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  quickStatsContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  quickStatCol: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xxs,
    paddingHorizontal: spacing.xxs,
  },
  quickStatNumber: {
    ...typography.metric,
    fontSize: 18,
    lineHeight: 22,
    letterSpacing: -0.3,
  },
  quickStatLabel: {
    ...typography.caption,
    fontSize: 11.5,
    fontWeight: "500",
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 22,
  },
});
