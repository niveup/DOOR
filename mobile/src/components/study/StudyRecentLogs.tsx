import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
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

export interface StudyRecentLogsProps {
  logs: StudyLog[];
  onViewAll: () => void;
}

export function StudyRecentLogs({ logs, onViewAll }: StudyRecentLogsProps) {
  const { theme, isDark } = useTheme();
  const top3Logs = logs.slice(0, 3);

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
          Recent Study
        </Text>

        {logs.length > 0 ? (
          <Pressable
            onPress={onViewAll}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="View full study history"
            style={({ pressed }) => [
              styles.viewAllButton,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={[styles.viewAllButtonText, { color: theme.cyan }]}>
              View all →
            </Text>
          </Pressable>
        ) : null}
      </View>

      {/* Logs Feed or Empty State */}
      {logs.length > 0 ? (
        <View
          style={[
            styles.logsContainer,
            {
              backgroundColor: isDark ? "#121216" : theme.surface,
              borderColor: isDark ? "#1f1f25" : theme.border,
            },
          ]}
        >
          {top3Logs.map((log, idx) => (
            <Pressable
              key={log.id || `log-${idx}`}
              onPress={onViewAll}
              accessibilityRole="button"
              accessibilityLabel={`${log.subjectName}, ${log.hoursStudied} hours on ${formatLogDate(
                log.logDate
              )}${log.questionsSolved ? `, ${log.questionsSolved} questions solved` : ""}`}
              style={({ pressed }) => [
                styles.logItemRow,
                idx > 0 && [
                  styles.logRowDivider,
                  {
                    borderTopColor: isDark
                      ? theme.borderMuted
                      : theme.divider,
                  },
                ],
                pressed && { opacity: 0.75 },
              ]}
            >
              <View style={styles.logTextContainer}>
                <Text
                  style={[
                    styles.logSubjectTitle,
                    { color: isDark ? "#fafafa" : theme.text },
                  ]}
                  numberOfLines={1}
                >
                  {log.subjectName}
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
                  {log.questionsSolved > 0
                    ? ` · ${log.questionsSolved} Q`
                    : ""}
                  {log.notes ? ` · ${log.notes}` : ""}
                </Text>
              </View>

              <View
                style={[
                  styles.durationBadge,
                  {
                    backgroundColor: isDark
                      ? "rgba(6, 182, 212, 0.08)"
                      : "rgba(2, 132, 199, 0.08)",
                  },
                ]}
              >
                <Text style={[styles.logDurationText, { color: theme.cyan }]}>
                  {log.hoursStudied}h
                </Text>
              </View>
            </Pressable>
          ))}
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
    </View>
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
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  viewAllButton: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
  },
  viewAllButtonText: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: "700",
  },
  logsContainer: {
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  logItemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    minHeight: 56,
  },
  logRowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  logTextContainer: {
    flex: 1,
    gap: 3,
  },
  logSubjectTitle: {
    ...typography.bodyMedium,
    fontSize: 13.5,
    fontWeight: "600",
  },
  logMetaSubtitle: {
    ...typography.caption,
    fontSize: 11.5,
  },
  durationBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  logDurationText: {
    ...typography.metric,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
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
  },
});
