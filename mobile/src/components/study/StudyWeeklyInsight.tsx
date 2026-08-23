import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@/src/components/app-icon";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useTheme } from "@/src/providers/theme-provider";
import { radii, spacing, typography } from "@/src/theme/tokens";

export interface StudyWeeklyInsightProps {
  weeklyAnalysis?: string;
}

export function StudyWeeklyInsight({ weeklyAnalysis }: StudyWeeklyInsightProps) {
  const { theme, isDark } = useTheme();
  const hasAnalysis = Boolean(weeklyAnalysis && weeklyAnalysis.trim().length > 0);

  return (
    <Animated.View
      entering={FadeInDown.delay(120).duration(300)}
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
          Weekly Insight
        </Text>
      </View>

      {/* 2. Insight Card or Calm Profile-Building Placeholder */}
      {hasAnalysis ? (
        <View
          accessible={true}
          accessibilityRole="text"
          accessibilityLabel={`Weekly Study Insight: ${weeklyAnalysis}`}
          style={[
            styles.insightCard,
            {
              backgroundColor: isDark ? "#121216" : theme.surface,
              borderColor: isDark ? "#1f1f25" : theme.border,
            },
          ]}
        >
          {/* Overline Badge Row */}
          <View style={styles.insightHeader}>
            <View
              style={[
                styles.iconMiniBadge,
                {
                  backgroundColor: isDark
                    ? "rgba(124, 58, 237, 0.12)"
                    : "rgba(124, 58, 237, 0.08)",
                  borderColor: isDark
                    ? "rgba(124, 58, 237, 0.25)"
                    : "rgba(124, 58, 237, 0.15)",
                },
              ]}
            >
              <Ionicons
                name="sparkles"
                size={12}
                color={theme.violet}
              />
            </View>
            <Text style={[styles.insightOverline, { color: theme.violet }]}>
              WEEKLY MENTOR READ
            </Text>
          </View>

          {/* Main Coaching Analysis Body */}
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
                borderColor: isDark ? theme.borderMuted : theme.border,
              },
            ]}
          >
            <Ionicons
              name="bulb-outline"
              size={15}
              color={theme.textFaint}
            />
          </View>

          <View style={styles.placeholderTextBlock}>
            <Text
              style={[
                styles.placeholderTitle,
                { color: isDark ? "#fafafa" : theme.text },
              ]}
              numberOfLines={1}
            >
              Building your study profile
            </Text>
            <Text
              style={[
                styles.placeholderDesc,
                { color: theme.textMuted },
              ]}
            >
              Weekly AI analysis will appear as your study logs build.
            </Text>
          </View>
        </View>
      )}
    </Animated.View>
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
    fontSize: 14.5,
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
  iconMiniBadge: {
    width: 22,
    height: 22,
    borderRadius: radii.xs,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  insightOverline: {
    ...typography.label,
    fontSize: 10,
    letterSpacing: 0.8,
    fontWeight: "700",
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
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderTextBlock: {
    flex: 1,
    gap: 2,
  },
  placeholderTitle: {
    ...typography.bodyMedium,
    fontSize: 13.5,
    fontWeight: "600",
    lineHeight: 18,
  },
  placeholderDesc: {
    ...typography.caption,
    fontSize: 11.5,
    lineHeight: 16,
  },
});

