import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/src/providers/theme-provider";
import { radii, spacing, typography } from "@/src/theme/tokens";

export interface StudyWeeklyInsightProps {
  weeklyAnalysis?: string;
}

export function StudyWeeklyInsight({ weeklyAnalysis }: StudyWeeklyInsightProps) {
  const { theme, isDark } = useTheme();
  const hasAnalysis = Boolean(weeklyAnalysis && weeklyAnalysis.trim().length > 0);

  return (
    <View style={styles.sectionGroup}>
      {/* Section Header */}
      <View style={styles.sectionHeaderRow}>
        <Text
          style={[
            styles.sectionTitleText,
            { color: isDark ? "#fafafa" : theme.text },
          ]}
        >
          Weekly Insight
        </Text>
      </View>

      {hasAnalysis ? (
        <View
          accessible={true}
          accessibilityRole="text"
          accessibilityLabel={`Weekly Jujum Read: ${weeklyAnalysis}`}
          style={[
            styles.insightCard,
            {
              backgroundColor: isDark ? "#121216" : theme.surface,
              borderColor: isDark ? "#1f1f25" : theme.border,
            },
          ]}
        >
          <View style={styles.insightHeader}>
            <Ionicons
              name="sparkles"
              size={13}
              color={theme.violet}
            />
            <Text style={[styles.insightOverline, { color: theme.violet }]}>
              WEEKLY JUJUM READ
            </Text>
          </View>

          <Text
            style={[
              styles.insightBody,
              { color: isDark ? "#e4e4e7" : theme.text },
            ]}
          >
            {weeklyAnalysis}
          </Text>
        </View>
      ) : (
        <View
          accessible={true}
          accessibilityRole="text"
          accessibilityLabel="Building your study profile. Your weekly analysis will appear here as your study history builds."
          style={[
            styles.placeholderCard,
            {
              backgroundColor: isDark ? "#121216" : theme.surface,
              borderColor: isDark ? "#1f1f25" : theme.border,
            },
          ]}
        >
          <View
            style={[
              styles.iconBox,
              {
                backgroundColor: isDark
                  ? theme.surfaceElevated
                  : theme.surfaceSubtle,
                borderColor: isDark ? theme.borderMuted : theme.borderMuted,
              },
            ]}
          >
            <Ionicons
              name="bulb-outline"
              size={16}
              color={theme.textFaint}
            />
          </View>

          <View style={styles.placeholderTextBlock}>
            <Text
              style={[
                styles.placeholderTitle,
                { color: isDark ? "#fafafa" : theme.text },
              ]}
            >
              Building your study profile
            </Text>
            <Text
              style={[
                styles.placeholderDesc,
                { color: theme.textMuted },
              ]}
            >
              Your weekly analysis will appear here as your study history builds.
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionGroup: {
    gap: spacing.xs,
  },
  sectionHeaderRow: {
    paddingHorizontal: spacing.xxs,
  },
  sectionTitleText: {
    ...typography.subheading,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  insightCard: {
    padding: spacing.md,
    gap: spacing.xs,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  insightHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  insightOverline: {
    ...typography.label,
    fontSize: 10,
    letterSpacing: 0.8,
  },
  insightBody: {
    ...typography.body,
    fontSize: 13.5,
    lineHeight: 20,
    fontWeight: "400",
  },
  placeholderCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderTextBlock: {
    flex: 1,
    gap: 3,
  },
  placeholderTitle: {
    ...typography.bodyMedium,
    fontSize: 13.5,
    fontWeight: "600",
  },
  placeholderDesc: {
    ...typography.caption,
    fontSize: 12,
    lineHeight: 17,
  },
});
