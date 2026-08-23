import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@/src/components/app-icon";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useTheme } from "@/src/providers/theme-provider";
import { radii, spacing, typography } from "@/src/theme/tokens";
import { shortDate, todayInKolkata } from "@/src/lib/format";
import { StudyLog } from "@/src/types/domain";

export function formatLogDate(dateStr: string): string {
  try {
    const today = todayInKolkata();
    const cleanDate = (dateStr || "").slice(0, 10);
    if (cleanDate === today) {
      return "Today";
    }
    return shortDate(cleanDate);
  } catch {
    return dateStr;
  }
}

function formatHours(hours: number): string {
  if (!hours || hours <= 0) return "0h";
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export interface StudyRecentLogsProps {
  logs: StudyLog[];
  onViewAll: () => void;
}

export function StudyRecentLogs({ logs, onViewAll }: StudyRecentLogsProps) {
  const { theme, isDark } = useTheme();
  const top3Logs = (logs || []).slice(0, 3);

  return (
    <Animated.View
      entering={FadeInDown.delay(90).duration(300)}
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
          Recent Activity
        </Text>

        {logs && logs.length > 0 ? (
          <Pressable
            onPress={onViewAll}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={`View all ${logs.length} study sessions`}
            style={styles.viewAllButton}
          >
            <Text style={[styles.viewAllButtonText, { color: theme.textMuted }]}>
              View all ({logs.length}) →
            </Text>
          </Pressable>
        ) : null}
      </View>

      {/* 2. Unified Recent Sessions Card or Empty State */}
      {top3Logs.length > 0 ? (
        <View
          style={[
            styles.unifiedCard,
            {
              backgroundColor: isDark ? "#121216" : theme.surface,
              borderColor: isDark ? "#1f1f25" : theme.border,
            },
          ]}
        >
          {top3Logs.map((log, idx) => {
            const hasQuestions =
              typeof log.questionsSolved === "number" && log.questionsSolved > 0;
            return (
              <Pressable
                key={log.id || `recent-${idx}`}
                onPress={onViewAll}
                accessibilityRole="button"
                accessibilityLabel={`${log.subjectName || "Study session"} on ${formatLogDate(log.logDate)}, ${formatHours(log.hoursStudied)}, ${log.questionsSolved || 0} questions solved.`}
                style={({ pressed }) => [
                  styles.logItemRow,
                  idx > 0 && [
                    styles.hairlineDivider,
                    {
                      borderTopColor: isDark
                        ? theme.borderMuted
                        : theme.divider,
                    },
                  ],
                  pressed && { opacity: 0.75 },
                ]}
              >
                {/* Left: Calm Neutral Glyph Badge */}
                <View
                  style={[
                    styles.iconBadge,
                    {
                      backgroundColor: isDark
                        ? theme.surfaceElevated
                        : theme.surfaceSubtle,
                      borderColor: isDark
                        ? theme.borderMuted
                        : theme.border,
                    },
                  ]}
                >
                  <Ionicons
                    name="book-outline"
                    size={14}
                    color={theme.textMuted}
                  />
                </View>

                {/* Middle: Subject Name & Metadata */}
                <View style={styles.logDetailsContainer}>
                  <Text
                    style={[
                      styles.logSubjectTitle,
                      { color: isDark ? "#fafafa" : theme.text },
                    ]}
                    numberOfLines={1}
                  >
                    {log.subjectName || "Study Session"}
                  </Text>

                  <Text
                    style={[
                      styles.logMetaSubtitle,
                      { color: theme.textMuted },
                    ]}
                    numberOfLines={1}
                  >
                    {formatLogDate(log.logDate)}
                    {log.timeBlock ? ` · ${log.timeBlock}` : ""}
                    {log.notes ? ` · ${log.notes}` : ""}
                  </Text>
                </View>

                {/* Right: Duration & Question Count Metrics */}
                <View style={styles.metricsColumn}>
                  <Text
                    style={[
                      styles.durationText,
                      { color: isDark ? "#fafafa" : theme.text },
                    ]}
                    numberOfLines={1}
                  >
                    {formatHours(log.hoursStudied)}
                  </Text>
                  <Text
                    style={[
                      styles.questionsMetaText,
                      { color: theme.textMuted },
                    ]}
                    numberOfLines={1}
                  >
                    {hasQuestions
                      ? `${log.questionsSolved.toLocaleString()} ${
                          log.questionsSolved === 1 ? "Q" : "Qs"
                        }`
                      : "0 Qs"}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View
          style={[
            styles.emptyLogsCard,
            {
              backgroundColor: isDark ? "#121216" : theme.surface,
              borderColor: isDark ? "#1f1f25" : theme.border,
            },
          ]}
        >
          <Ionicons
            name="school-outline"
            size={22}
            color={theme.textFaint}
          />
          <Text
            style={[
              styles.emptyLogsText,
              { color: theme.textMuted },
            ]}
          >
            No study sessions recorded yet. Start your first session above.
          </Text>
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xxs,
  },
  sectionTitleText: {
    ...typography.subheading,
    fontSize: 14.5,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  viewAllButton: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
    minHeight: 28,
    justifyContent: "center",
  },
  viewAllButtonText: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: "700",
  },
  unifiedCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  logItemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    minHeight: 56,
  },
  hairlineDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  logDetailsContainer: {
    flex: 1,
    gap: 2,
  },
  logSubjectTitle: {
    ...typography.bodyMedium,
    fontSize: 13.5,
    fontWeight: "600",
    lineHeight: 18,
  },
  logMetaSubtitle: {
    ...typography.caption,
    fontSize: 11.5,
    lineHeight: 15,
  },
  metricsColumn: {
    alignItems: "flex-end",
    gap: 2,
    minWidth: 70,
  },
  durationText: {
    ...typography.metric,
    fontSize: 13.5,
    lineHeight: 17,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  questionsMetaText: {
    ...typography.caption,
    fontSize: 10.5,
    lineHeight: 13,
    fontWeight: "500",
  },
  emptyLogsCard: {
    padding: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  emptyLogsText: {
    ...typography.caption,
    fontSize: 12,
    textAlign: "center",
    fontWeight: "500",
    lineHeight: 16,
  },
});

